// The app shows a page in a frame as tall as the page, so CSS sized from the screen height (100vh heroes, Duda's
// 45vh gallery placeholder) would grow with the frame, and the frame with them. Pages are laid out against a normal
// screen height instead (the same height the screenshot browser uses), and stylesheets load through the proxy so
// this applies to them too.

export const SCREEN_HEIGHT = 900;

// 100vh → 900px (also svh/dvh/lvh). The number must start a value (after a space, colon, bracket, comma or operator).
const VH = /(^|[\s:(,+*\/-])(\d*\.?\d+)[sdl]?vh\b/gi;
export const fixedScreenHeight = (css: string) =>
  css.replace(VH, (_m, before, n) => `${before}${+(parseFloat(n) * (SCREEN_HEIGHT / 100)).toFixed(3)}px`);

const absolute = (ref: string, base: string) => {
  try {
    return new URL(ref, base).href;
  } catch {
    return ref;
  }
};

// appOrigin: the page has a <base> pointing at the website, so links back to the app must be full addresses
export const proxiedUrl = (ref: string, base: string, appOrigin: string) =>
  `${appOrigin}/api/proxy-site?url=${encodeURIComponent(absolute(ref, base))}`;

// A stylesheet served from the app: its url(...) and @import addresses still point at the website
export function rewriteStylesheet(css: string, sheetUrl: string, appOrigin: string): string {
  return fixedScreenHeight(
    css
      .replace(/@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1\s*\)?/gi, (_m, _q, ref) => `@import url("${proxiedUrl(ref, sheetUrl, appOrigin)}")`)
      .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (m, _q, ref) =>
        /^(data:|#)/i.test(ref.trim()) || ref.includes('/api/proxy-site?') ? m : `url("${absolute(ref.trim(), sheetUrl)}")`
      )
  );
}

// In the page itself: <style> blocks, style="" attributes, and stylesheet links (loaded through the proxy)
export function rewritePageStyles(html: string, pageUrl: string, appOrigin: string): string {
  return html
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open, css, close) => open + fixedScreenHeight(css) + close)
    .replace(/(\sstyle\s*=\s*)(["'])([^"']*?vh[^"']*?)\2/gi, (_m, attr, q, css) => attr + q + fixedScreenHeight(css) + q)
    .replace(/<link\b[^>]*>/gi, (tag) => {
      if (!/rel\s*=\s*["']?stylesheet|as\s*=\s*["']?style\b/i.test(tag)) return tag;
      return tag.replace(/(\shref\s*=\s*)(["'])([^"']+)\2/i, (_m, attr, q, href) =>
        /^data:/i.test(href) || href.includes('/api/proxy-site?') ? _m : attr + q + proxiedUrl(href.replace(/&amp;/g, '&'), pageUrl, appOrigin).replace(/&/g, '&amp;') + q
      );
    });
}
