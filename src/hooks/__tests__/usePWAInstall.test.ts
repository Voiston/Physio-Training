import { describe, it, expect } from 'vitest';
import { detectIsIOS, detectIsInstalled } from '../usePWAInstall';

describe('usePWAInstall and platform detection', () => {
  it('detects standard iPhone userAgent as iOS', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15';
    expect(detectIsIOS(ua)).toBe(true);
  });

  it('detects standard iPad userAgent as iOS', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15';
    expect(detectIsIOS(ua)).toBe(true);
  });

  it('detects iPadOS with Macintosh UA and touch points > 1 as iOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    expect(detectIsIOS(ua, 5, 'MacIntel')).toBe(true);
  });

  it('does NOT detect desktop macOS (no touch points) as iOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(detectIsIOS(ua, 0, 'MacIntel')).toBe(false);
  });

  it('does NOT detect Android as iOS', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    expect(detectIsIOS(ua, 5, 'Linux armv8l')).toBe(false);
  });

  it('does NOT detect empty or undefined user agent as iOS', () => {
    expect(detectIsIOS('')).toBe(false);
  });

  it('detects standalone mode with override correctly', () => {
    expect(detectIsInstalled(true)).toBe(true);
    expect(detectIsInstalled(false)).toBe(false);
  });
});
