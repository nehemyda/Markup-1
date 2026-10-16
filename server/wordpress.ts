// WordPress connections. A project can be linked to one WordPress site that runs the WebReview Connector plugin.
// The site's Application Password is encrypted and kept server-only (wpSiteSecrets); members only see the
// site details (wpSites). Every request to WordPress goes through here.
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { decryptSecret, encryptSecret } from './secrets';

const TIMEOUT_MS = 15000;

export interface WpStatus {
  plugin_version: string;
  wordpress_version: string;
  site_url: string;
  site_name: string;
  user: { id: number; name: string; roles: string[] };
  builders: Record<string, string | null>;
}

export interface WpCredentials {
  siteUrl: string;
  username: string;
  appPassword: string;
}

export class WpError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// Local development addresses (the WordPress Playground test site, *.test / *.local dev sites)
function isLocalHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
    || host.endsWith('.localhost') || host.endsWith('.test') || host.endsWith('.local');
}

function comparableHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return host === 'localhost' || host === '[::1]' ? '127.0.0.1' : host;
}

// Same site? (ignores www., treats localhost and 127.0.0.1 as the same machine; ports must match)
export function sameSite(a: string, b: string) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return comparableHost(ua.hostname) === comparableHost(ub.hostname) && ua.port === ub.port;
  } catch {
    return false;
  }
}

// Check and tidy the address someone typed. Passwords are only sent over HTTPS, except to local dev sites.
export function normalizeSiteUrl(raw: string): string {
  let value = (raw || '').trim();
  if (!value) throw new WpError('Enter the WordPress site address.');
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WpError('That is not a valid site address.');
  }
  const local = isLocalHost(url.hostname);
  if (process.env.NODE_ENV === 'production' && local) throw new WpError('Local addresses cannot be connected on the live server.');
  if (url.protocol !== 'https:' && !local) throw new WpError('The site must use HTTPS so the password is sent securely.');
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/+$/, '');
}

function authHeader(creds: WpCredentials) {
  // WordPress shows Application Passwords in groups ("abcd efgh ..."); spaces are optional
  const password = creds.appPassword.replace(/\s+/g, '');
  return `Basic ${Buffer.from(`${creds.username}:${password}`).toString('base64')}`;
}

// Call the site's REST API as the connected WordPress user
export async function wpRequest<T = any>(creds: WpCredentials, route: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const attempt = async (url: string) => {
    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method || 'GET',
        headers: {
          Authorization: authHeader(creds),
          Accept: 'application/json',
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        // Never follow redirects with the password attached
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err: any) {
      if (err?.name === 'TimeoutError') throw new WpError('The WordPress site took too long to answer.', 504);
      throw new WpError('Could not reach the WordPress site. Check the address and that the site is online.', 502);
    }
    return res;
  };

  const [routePath, routeQuery = ''] = route.split('?');
  let res = await attempt(`${creds.siteUrl}/wp-json${routePath}${routeQuery ? `?${routeQuery}` : ''}`);
  // Sites without pretty permalinks only answer on ?rest_route=
  if (res.status === 404 && !(res.headers.get('content-type') || '').includes('json')) {
    res = await attempt(`${creds.siteUrl}/?rest_route=${encodeURIComponent(routePath)}${routeQuery ? `&${routeQuery}` : ''}`);
  }

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location') || '';
    let target = '';
    try { target = new URL(location, creds.siteUrl).origin; } catch {}
    throw new WpError(target ? `The site redirects to ${target}. Use that address instead.` : 'The site redirected the request. Check the address.');
  }

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    const code = data?.code || '';
    if (res.status === 401 || code === 'incorrect_password' || code === 'invalid_username' || code === 'invalid_email') {
      throw new WpError('WordPress did not accept the username or Application Password.', 401);
    }
    if (code === 'rest_no_route') throw new WpError('The WebReview Connector plugin is not installed or not active on this site.', 404);
    if (code === 'webreview_forbidden' && /not allowed to use/.test(data?.message || '')) {
      throw new WpError('This WordPress user is not allowed yet. A WordPress admin can allow it under Settings → WebReview Connector.', 403);
    }
    throw new WpError(data?.message || `WordPress returned an error (${res.status}).`, res.status >= 500 ? 502 : res.status);
  }
  if (data === null) throw new WpError('The site did not answer like a WordPress site. Check the address.', 502);
  return data as T;
}

export async function getSiteStatus(creds: WpCredentials) {
  return wpRequest<WpStatus>(creds, '/webreview/v1/status');
}

// Site details members can see (no password)
function siteDetails(status: WpStatus) {
  return {
    siteName: status.site_name,
    wpSiteUrl: status.site_url,
    wpUser: { id: status.user.id, name: status.user.name, roles: status.user.roles },
    builders: status.builders,
    pluginVersion: status.plugin_version,
    wordpressVersion: status.wordpress_version,
  };
}

export async function connectSite(projectId: string, input: WpCredentials, actorEmail: string) {
  const project = await adminDb.collection('projects').doc(projectId).get();
  if (!project.exists) throw new WpError('Project not found.', 404);
  const username = (input.username || '').trim();
  const appPassword = (input.appPassword || '').trim();
  if (!username || !appPassword) throw new WpError('Enter the WordPress username and Application Password.');
  const creds = { siteUrl: normalizeSiteUrl(input.siteUrl), username, appPassword };

  const status = await getSiteStatus(creds);

  // The site must be the one this project reviews, so fixes can't land on another site by mistake
  const projectUrl: string | undefined = project.data()?.assets?.find((a: any) => a.type === 'url')?.url;
  if (projectUrl && !sameSite(projectUrl, status.site_url)) {
    throw new WpError(`This project reviews ${new URL(projectUrl).host}, but that WordPress site is ${new URL(status.site_url).host}.`);
  }

  const batch = adminDb.batch();
  batch.set(adminDb.collection('wpSites').doc(projectId), {
    projectId,
    siteUrl: creds.siteUrl,
    username,
    ...siteDetails(status),
    status: 'connected',
    lastError: null,
    connectedBy: actorEmail,
    connectedAt: FieldValue.serverTimestamp(),
    lastCheckedAt: FieldValue.serverTimestamp(),
  });
  batch.set(adminDb.collection('wpSiteSecrets').doc(projectId), {
    appPassword: encryptSecret(appPassword),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { siteUrl: creds.siteUrl, ...siteDetails(status) };
}

// Saved connection with its decrypted password (server use only)
export async function loadCredentials(projectId: string): Promise<WpCredentials> {
  const [site, secret] = await Promise.all([
    adminDb.collection('wpSites').doc(projectId).get(),
    adminDb.collection('wpSiteSecrets').doc(projectId).get(),
  ]);
  if (!site.exists || !secret.exists) throw new WpError('This project is not connected to WordPress.', 404);
  return { siteUrl: site.data()!.siteUrl, username: site.data()!.username, appPassword: decryptSecret(secret.data()!.appPassword) };
}

// Re-test a saved connection and record the result
export async function checkSite(projectId: string) {
  const creds = await loadCredentials(projectId);
  const ref = adminDb.collection('wpSites').doc(projectId);
  try {
    const status = await getSiteStatus(creds);
    await ref.update({ ...siteDetails(status), status: 'connected', lastError: null, lastCheckedAt: FieldValue.serverTimestamp() });
    return { ok: true, ...siteDetails(status) };
  } catch (err: any) {
    await ref.update({ status: 'error', lastError: err.message, lastCheckedAt: FieldValue.serverTimestamp() });
    throw err;
  }
}

// Remove the connection. Also tries to revoke the Application Password on the site so the key stops working.
export async function disconnectSite(projectId: string) {
  let revoked = false;
  try {
    const creds = await loadCredentials(projectId);
    const me = await wpRequest<{ uuid: string }>(creds, '/wp/v2/users/me/application-passwords/introspect');
    if (me?.uuid) {
      await wpRequest(creds, `/wp/v2/users/me/application-passwords/${me.uuid}`, { method: 'DELETE' });
      revoked = true;
    }
  } catch {
    // Site offline or key already invalid: still forget it here
  }
  const batch = adminDb.batch();
  batch.delete(adminDb.collection('wpSites').doc(projectId));
  batch.delete(adminDb.collection('wpSiteSecrets').doc(projectId));
  await batch.commit();
  return { revoked };
}

// Which WordPress page is this URL, and which builder made it?
export async function resolvePage(projectId: string, pageUrl: string) {
  const creds = await loadCredentials(projectId);
  if (!sameSite(pageUrl, creds.siteUrl)) throw new WpError('That page is not on the connected WordPress site.');
  return wpRequest(creds, `/webreview/v1/resolve?url=${encodeURIComponent(pageUrl)}`);
}

// Upload an image to the site's Media Library as the connected WordPress user
export async function uploadMedia(creds: WpCredentials, file: { name: string; mime: string; data: Buffer; alt?: string }) {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mime)) throw new WpError('Only JPG, PNG, WebP or GIF images can be added.', 400);
  if (file.data.length > 5 * 1024 * 1024) throw new WpError('The image is too large (max 5 MB).', 400);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
  let res: Response;
  try {
    res = await fetch(`${creds.siteUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.username}:${creds.appPassword.replace(/\s+/g, '')}`).toString('base64')}`,
        'Content-Type': file.mime,
        'Content-Disposition': `attachment; filename="${safeName}"`,
        Accept: 'application/json',
      },
      body: file.data,
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new WpError('Could not upload the image to WordPress.', 502);
  }
  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data?.id) {
    if (data?.code === 'rest_cannot_create') throw new WpError('The connected WordPress user is not allowed to upload images.', 403);
    throw new WpError(data?.message || `WordPress could not save the image (${res.status}).`, 502);
  }
  if (file.alt) {
    await wpRequest(creds, `/wp/v2/media/${data.id}`, { method: 'POST', body: { alt_text: file.alt.slice(0, 200) } }).catch(() => {});
  }
  return { id: data.id as number, url: data.source_url as string };
}
