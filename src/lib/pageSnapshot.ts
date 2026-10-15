import html2canvas from 'html2canvas';

// What the AI review sends to the server: the real page as rendered in the canvas.
export interface SnapshotElement {
  id: number;
  tag: string;
  text: string;
  selector: string;
  // Center of the element as a percentage of the annotation canvas (where the pin will go)
  pinX: number;
  pinY: number;
  // Position and size in page pixels
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  background?: string;
  contrast?: number;
  attrs?: Record<string, string>;
}

export interface PageSnapshot {
  kind: 'page';
  title: string;
  description: string;
  lang: string;
  pageWidth: number;
  pageHeight: number;
  elements: SnapshotElement[];
  screenshot?: string; // JPEG data URL
}

export interface ImageSnapshot {
  kind: 'image';
  // Where the image sits inside the annotation canvas, in percent, to map Gemini's boxes onto pins
  box: { left: number; top: number; width: number; height: number };
}

export type ReviewSnapshot = PageSnapshot | ImageSnapshot;

const MAX_ELEMENTS = 250;
const MAX_TEXT_LENGTH = 300;
const SCREENSHOT_MAX_WIDTH = 1000;
const SCREENSHOT_TIMEOUT_MS = 15000;

const ELEMENT_QUERY = [
  'h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'img', 'input', 'select', 'textarea', 'label',
  'nav', 'header', 'footer', 'form', 'li', '[role="button"]', 'video', 'iframe',
].join(',');

function parseRgb(color: string): [number, number, number, number] | null {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
}

function luminance([r, g, b]: number[]): number {
  const ch = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

// WCAG contrast ratio between text color and the first opaque background behind it
function contrastFor(el: Element, win: Window): { color: string; background: string; ratio?: number } {
  const style = win.getComputedStyle(el);
  const fg = parseRgb(style.color);
  let node: Element | null = el;
  let bg: [number, number, number, number] | null = null;
  while (node) {
    const s = win.getComputedStyle(node);
    if (s.backgroundImage && s.backgroundImage !== 'none') return { color: style.color, background: 'image' };
    const c = parseRgb(s.backgroundColor);
    if (c && c[3] > 0.9) { bg = c; break; }
    node = node.parentElement;
  }
  bg = bg || [255, 255, 255, 1];
  if (!fg) return { color: style.color, background: `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})` };
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return { color: style.color, background: `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`, ratio: Math.round(ratio * 100) / 100 };
}

function cssSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.tagName !== 'BODY' && parts.length < 4) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    const parent = node.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/**
 * Read the live page inside the canvas iframe (same-origin via /api/proxy-site).
 * zoom is the canvas zoom in percent, used to undo the CSS scale when mapping positions.
 */
export async function capturePageSnapshot(
  iframe: HTMLIFrameElement,
  canvas: HTMLElement,
  zoom: number
): Promise<PageSnapshot> {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win || !doc.body) {
    throw new Error('The page has not finished loading yet. Wait a moment and try again.');
  }
  if (doc.querySelector('meta[name="markup-proxy-error"]')) {
    throw new Error('This website could not be loaded into the canvas, so there is nothing to review.');
  }

  const scale = zoom / 100;
  const canvasRect = canvas.getBoundingClientRect();
  const iframeRect = iframe.getBoundingClientRect();
  const offsetLeft = (iframeRect.left - canvasRect.left) / scale;
  const offsetTop = (iframeRect.top - canvasRect.top) / scale;
  const canvasWidth = canvas.offsetWidth;
  const canvasHeight = canvas.offsetHeight;

  const elements: SnapshotElement[] = [];
  for (const el of Array.from(doc.querySelectorAll(ELEMENT_QUERY))) {
    if (elements.length >= MAX_ELEMENTS) break;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    const style = win.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;

    const x = rect.left + win.scrollX;
    const y = rect.top + win.scrollY;
    const tag = el.tagName.toLowerCase();
    const fullText = ((el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    // Long text is shortened to keep the request small; the [...] marker tells the reviewer it was cut here, not on the page
    const text = fullText.length > MAX_TEXT_LENGTH ? `${fullText.slice(0, MAX_TEXT_LENGTH)} [...]` : fullText;

    const attrs: Record<string, string> = {};
    for (const name of ['alt', 'href', 'aria-label', 'type', 'placeholder', 'role', 'title', 'name']) {
      const v = el.getAttribute(name);
      if (v !== null) attrs[name] = v.slice(0, 120);
    }
    // Skip empty layout containers; keep media and form fields even without text
    const isMediaOrField = ['img', 'input', 'select', 'textarea', 'video', 'iframe'].includes(tag);
    if (!text && !isMediaOrField && Object.keys(attrs).length === 0) continue;

    const hasOwnText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim());
    const colors = hasOwnText ? contrastFor(el, win) : undefined;

    elements.push({
      id: elements.length + 1,
      tag,
      text,
      selector: cssSelector(el),
      pinX: Math.min(99, Math.max(1, ((offsetLeft + x + rect.width / 2) / canvasWidth) * 100)),
      pinY: Math.min(99, Math.max(1, ((offsetTop + y + Math.min(rect.height / 2, 24)) / canvasHeight) * 100)),
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      fontSize: parseFloat(style.fontSize) || undefined,
      fontWeight: style.fontWeight,
      color: colors?.color,
      background: colors?.background,
      contrast: colors?.ratio,
      attrs: Object.keys(attrs).length ? attrs : undefined,
    });
  }

  const pageWidth = doc.documentElement.scrollWidth;
  const pageHeight = doc.documentElement.scrollHeight;

  // Screenshot is best-effort: images from other domains without CORS headers are left blank
  let screenshot: string | undefined;
  try {
    const shot = await withTimeout(
      html2canvas(doc.body, {
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scale: Math.min(1, SCREENSHOT_MAX_WIDTH / Math.max(pageWidth, 1)),
        windowWidth: pageWidth,
        windowHeight: pageHeight,
      }),
      SCREENSHOT_TIMEOUT_MS
    );
    if (shot) screenshot = shot.toDataURL('image/jpeg', 0.7);
  } catch (err) {
    console.warn('AI review screenshot failed; reviewing page structure only:', err);
  }

  return {
    kind: 'page',
    title: doc.title,
    description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    lang: doc.documentElement.lang || '',
    pageWidth,
    pageHeight,
    elements,
    screenshot,
  };
}

// Where an uploaded image / mockup sits inside the canvas
export function captureImageSnapshot(img: HTMLImageElement, canvas: HTMLElement, zoom: number): ImageSnapshot {
  const scale = zoom / 100;
  const c = canvas.getBoundingClientRect();
  const r = img.getBoundingClientRect();
  return {
    kind: 'image',
    box: {
      left: ((r.left - c.left) / scale / canvas.offsetWidth) * 100,
      top: ((r.top - c.top) / scale / canvas.offsetHeight) * 100,
      width: (r.width / scale / canvas.offsetWidth) * 100,
      height: (r.height / scale / canvas.offsetHeight) * 100,
    },
  };
}
