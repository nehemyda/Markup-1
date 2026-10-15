import { Pin } from '../types';

// Next pin number on an asset: one past the highest existing number, so deleted pins never cause duplicates
export function nextPinNumber(pins: Pin[], assetId: string): number {
  return pins.filter((p) => p.assetId === assetId).reduce((max, p) => Math.max(max, p.number || 0), 0) + 1;
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
