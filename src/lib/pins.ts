import { Pin } from '../types';

// Next pin number for a project: one past the highest number on any of its pages (and devices), so numbers run
// continuously across the whole website and deleted pins never cause duplicates
export function nextPinNumber(pins: Pin[], pageIds: string | string[]): number {
  const ids = new Set(Array.isArray(pageIds) ? pageIds : [pageIds]);
  return pins.filter((p) => ids.has(p.assetId)).reduce((max, p) => Math.max(max, p.number || 0), 0) + 1;
}

export type PinDevice = 'desktop' | 'tablet' | 'mobile';
export const PIN_DEVICES: PinDevice[] = ['desktop', 'tablet', 'mobile'];

// Which device view a pin belongs to (pins from before device tracking count as desktop)
export function pinDevice(pin: Pin): PinDevice {
  return pin.metadata?.deviceType || 'desktop';
}

// Browser and OS of the person dropping the pin, e.g. "Chrome 155" / "macOS"
export function describeClient(): { browser: string; os: string } {
  const ua = navigator.userAgent;
  const match =
    ua.match(/(Edg)\/(\d+)/) || ua.match(/(OPR)\/(\d+)/) || ua.match(/(Chrome)\/(\d+)/) ||
    ua.match(/(Firefox)\/(\d+)/) || ua.match(/Version\/(\d+).*(Safari)/);
  let browser = 'Unknown browser';
  if (match) {
    const names: Record<string, string> = { Edg: 'Edge', OPR: 'Opera' };
    browser = match[2] === 'Safari' ? `Safari ${match[1]}` : `${names[match[1]] || match[1]} ${match[2]}`;
  }
  const os = /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return { browser, os };
}

// Width each device view renders the page at (the canvas scales it to fit the screen)
export const DEVICE_WIDTHS: Record<PinDevice, number> = { desktop: 1440, tablet: 768, mobile: 375 };

// Pin colour by category: the same on the page markers and in the comments sidebar
export const PIN_CATEGORY_COLORS: Record<string, { bg: string; border: string; shadow: string }> = {
  bug: { bg: 'bg-rose-500', border: 'border-rose-600', shadow: 'shadow-rose-500/30' },
  design: { bg: 'bg-purple-500', border: 'border-purple-600', shadow: 'shadow-purple-500/30' },
  content: { bg: 'bg-blue-500', border: 'border-blue-600', shadow: 'shadow-blue-500/30' },
  question: { bg: 'bg-amber-500', border: 'border-amber-600', shadow: 'shadow-amber-500/30' },
  approved: { bg: 'bg-emerald-500', border: 'border-emerald-600', shadow: 'shadow-emerald-500/30' },
};

export function pinColor(category: string) {
  return PIN_CATEGORY_COLORS[category] || PIN_CATEGORY_COLORS.design;
}
