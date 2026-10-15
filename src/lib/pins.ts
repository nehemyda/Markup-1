import { Pin } from '../types';

// Next pin number on an asset: one past the highest existing number, so deleted pins never cause duplicates
export function nextPinNumber(pins: Pin[], assetId: string): number {
  return pins.filter((p) => p.assetId === assetId).reduce((max, p) => Math.max(max, p.number || 0), 0) + 1;
}
