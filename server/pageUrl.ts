// Some builders' preview links open a viewer page, not the site: Duda's /preview/<site> shows the site in desktop,
// tablet and phone frames side by side, each scrolling on its own. Pins and screenshots need the site page itself,
// so those links are loaded as the page the desktop/tablet/phone frame shows.

export type PageDevice = 'desktop' | 'tablet' | 'mobile';

export const deviceForWidth = (width: number): PageDevice => (width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop');

// Duda: <editor host>/preview/<site>[/<page>] → <editor host>/site/<site>[/<page>]?preview=true&insitepreview=true&dm_device=…
// Only on Duda editor hosts (editor.<domain>, *.multiscreensite.com, *.dudamobile.com), so other sites' /preview/ pages are left alone.
const DUDA_HOST = /^(editor\.|.*\.multiscreensite\.com$|.*\.dudamobile\.com$)/i;
const DUDA_PATH = /^\/(preview|site)\/([A-Za-z0-9]+)(\/.*)?$/;

export function directPageUrl(raw: string, device: PageDevice = 'desktop'): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const match = url.pathname.match(DUDA_PATH);
  if (!DUDA_HOST.test(url.hostname) || !match) return raw;
  const [, , site, rest = ''] = match;
  const direct = new URL(`/site/${site}${rest}`, url.origin);
  for (const [key, value] of url.searchParams) if (key !== 't') direct.searchParams.set(key, value);
  direct.searchParams.set('preview', 'true');
  direct.searchParams.set('insitepreview', 'true');
  direct.searchParams.set('dm_device', device);
  return direct.href;
}
