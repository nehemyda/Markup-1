// Project card previews: the server's Chrome opens each project's main page and saves a screenshot (1280×800 JPEG,
// floating chat bubbles and cookie banners hidden). Taken for new projects right away, for any project without one
// shortly after the server starts, and refreshed about once a day; members can also refresh one from the card menu.
// No outside service (no daily limit), and sites only this server can reach (e.g. a local test site) work too.
import type { Browser } from 'puppeteer-core';
import { findRows, getRow, now, supabaseAdmin } from './db';
import { removeFile, saveFile } from './uploads';
import { directPageUrl } from './pageUrl';

const REFRESH_MS = 24 * 60 * 60 * 1000;
// A page that could not be loaded is tried again sooner
const RETRY_MS = 6 * 60 * 60 * 1000;

let getBrowser: () => Promise<Browser>;
const queue: string[] = [];
const waiting = new Map<string, Array<(result: { url?: string; error?: string }) => void>>();
let running = false;

// The project's main page: its first web page
export const mainPage = (project: any): string | null =>
  (project?.assets || []).find((a: any) => a?.type === 'url' && /^https?:\/\//i.test(String(a.url || '')))?.url || null;

// Waits (up to `timeoutMs`) until the page's visible frames are filled and loaded; returns whether it has any
async function waitForFrames(page: import('puppeteer-core').Page, timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  let seen = false;
  while (Date.now() < until) {
    const pending = await page.evaluate(() =>
      Array.from(document.querySelectorAll('iframe')).filter((f) => {
        if (f.offsetWidth < 50 || f.offsetHeight < 50) return false;
        try {
          const doc = f.contentDocument;
          // Another site's frame can't be looked into; its address being set is the best sign it is loading
          if (!doc) return !f.getAttribute('src');
          return !f.getAttribute('src') || doc.readyState !== 'complete' || !doc.body?.childElementCount ||
            Array.from(doc.images).some((img) => !img.complete);
        } catch {
          return false;
        }
      }).length
    ).catch(() => 0);
    const visible = await page.evaluate(() => Array.from(document.querySelectorAll('iframe')).some((f) => f.offsetWidth >= 50)).catch(() => false);
    seen = seen || visible;
    if (!pending) return seen;
    await new Promise((r) => setTimeout(r, 500));
  }
  return seen;
}

async function capture(url: string): Promise<Uint8Array> {
  const page = await (await getBrowser()).newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    try {
      await page.goto(directPageUrl(url), { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (err: any) {
      // Busy pages (live chat, analytics) may never go quiet; use what loaded
      if (!/timeout/i.test(err?.message || '') || !(await page.evaluate(() => document.body?.innerText?.length || 0))) throw err;
    }
    // Pages that show the site inside frames (e.g. laptop/tablet/phone mockups) often set the frames' address from a
    // script after the page loads. Wait until every visible frame has an address and its page (with images) loaded,
    // or the picture shows empty devices.
    const hasFrames = await waitForFrames(page, 20000);
    // Let entrance animations finish (and frame contents settle)
    await new Promise((r) => setTimeout(r, hasFrames ? 3000 : 1500));
    // Hide small floating overlays (chat widgets, cookie bars, back-to-top buttons). Keep full-width bars at the top
    // (sticky headers), large fixed content, and frames showing the site itself (e.g. laptop/phone mockups; chat
    // widgets come from other sites).
    await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const showsSite = (el: Element) =>
        Array.from(el.tagName === 'IFRAME' ? [el] : el.querySelectorAll('iframe')).some((f) => {
          try {
            return new URL(f.getAttribute('src') || '', location.href).origin === location.origin && (f as HTMLElement).offsetHeight >= 150;
          } catch {
            return false;
          }
        });
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        if (getComputedStyle(el).position !== 'fixed') continue;
        const r = el.getBoundingClientRect();
        const topBar = r.top <= 80 && r.width >= vw * 0.9;
        const large = r.width * r.height >= vw * vh * 0.3;
        if (!topBar && !large && !showsSite(el)) (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
      }
    });
    return await page.screenshot({ type: 'jpeg', quality: 72 });
  } finally {
    await page.close().catch(() => {});
  }
}

// Take a new preview now; returns its link
async function takePreview(projectId: string): Promise<string> {
  const project = await getRow('projects', projectId);
  if (!project) throw new Error('Project not found.');
  const url = mainPage(project);
  if (!url) throw new Error('This project has no web page to preview.');
  try {
    const link = saveFile(await capture(url), 'jpg');
    await supabaseAdmin.from('projects').update({ preview_url: link, preview_at: now(), preview_error: null }).eq('id', projectId);
    if (project.previewUrl && project.previewUrl !== link) removeFile(project.previewUrl);
    return link;
  } catch (err: any) {
    const message = String(err?.message || err).slice(0, 300);
    await supabaseAdmin.from('projects').update({ preview_at: now(), preview_error: message }).eq('id', projectId);
    throw new Error(`Could not load ${url}: ${message}`);
  }
}

// One page at a time, so Chrome stays light
async function work() {
  if (running) return;
  running = true;
  while (queue.length) {
    const id = queue.shift()!;
    let result: { url?: string; error?: string };
    try {
      result = { url: await takePreview(id) };
    } catch (err: any) {
      result = { error: err?.message || String(err) };
      console.warn(`Preview: ${result.error}`);
    }
    for (const done of waiting.get(id) || []) done(result);
    waiting.delete(id);
  }
  running = false;
}

// Ask for a preview; resolves when it is taken (several requests for one project share it)
export function requestPreview(projectId: string): Promise<{ url?: string; error?: string }> {
  return new Promise((resolve) => {
    waiting.set(projectId, [...(waiting.get(projectId) || []), resolve]);
    if (!queue.includes(projectId)) queue.push(projectId);
    work();
  });
}

// Projects without a preview, or with an old one
async function sweep() {
  const cutoff = Date.now();
  for (const project of await findRows('projects')) {
    if (!mainPage(project)) continue;
    const taken = project.previewAt ? Date.parse(project.previewAt) : 0;
    const wait = project.previewError ? RETRY_MS : REFRESH_MS;
    if (!taken || cutoff - taken > wait) requestPreview(project.id);
  }
}

export function startPreviews(browser: () => Promise<Browser>) {
  getBrowser = browser;
  // New projects get a preview right away
  supabaseAdmin
    .channel('server-projects')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'projects' }, (change: any) => {
      if (change.new?.id) setTimeout(() => requestPreview(change.new.id), 2000);
    })
    .subscribe();
  const run = () => sweep().catch((err) => console.warn('Preview sweep failed:', err?.message || err));
  setTimeout(run, 20_000);
  setInterval(run, 10 * 60 * 1000).unref();
}
