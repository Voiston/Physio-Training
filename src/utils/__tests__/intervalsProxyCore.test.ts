import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  INTERVALS_API_BASE,
  DEFAULT_ALLOWED_EMAILS,
  SAFE_ISO_DATE_REGEX,
  SAFE_ATHLETE_ID_REGEX,
  CLOUD_RUN_ORIGIN_REGEX,
  getAllowedEmails,
  isAllowedCorsOrigin,
  isValidIsoCalendarDate,
  validateSyncDateRange,
  formatUtcDate,
  sanitizeAthleteId,
  sanitizeWellnessItem,
  sanitizeActivityItem,
} from '../../../shared/intervalsProxyCore.mjs';

describe('intervalsProxyCore - validation, CORS, and sanitization', () => {
  it('enforces strict CORS origin allowlist without wildcard access', () => {
    expect(isAllowedCorsOrigin('https://myuser.github.io')).toBe(true);
    expect(isAllowedCorsOrigin('https://ais-pre-abc123.europe-west1.run.app')).toBe(true);
    expect(isAllowedCorsOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedCorsOrigin('https://custom.domain.fr', 'https://custom.domain.fr/')).toBe(true);

    expect(isAllowedCorsOrigin('https://evil.example.com')).toBe(false);
    expect(isAllowedCorsOrigin('http://myuser.github.io')).toBe(false);
    expect(isAllowedCorsOrigin('https://myuser.github.io.evil.com')).toBe(false);
    expect(isAllowedCorsOrigin('')).toBe(false);
    expect(isAllowedCorsOrigin(undefined)).toBe(false);
  });

  it('validates real calendar ISO dates and enforces the 0..60 day sync window', () => {
    expect(isValidIsoCalendarDate('2024-02-29')).toBe(true); // leap year
    expect(isValidIsoCalendarDate('2026-02-29')).toBe(false); // non-leap year
    expect(isValidIsoCalendarDate('2026-02-31')).toBe(false);
    expect(isValidIsoCalendarDate('2026-13-01')).toBe(false);
    expect(isValidIsoCalendarDate('invalid')).toBe(false);

    expect(validateSyncDateRange('2026-11-01', '2026-11-15')).toEqual({ ok: true, diffDays: 14 });
    expect(validateSyncDateRange('2026-11-15', '2026-11-15')).toEqual({ ok: true, diffDays: 0 });

    const reversed = validateSyncDateRange('2026-11-20', '2026-11-10');
    expect(reversed.ok).toBe(false);

    const tooWide = validateSyncDateRange('2026-01-01', '2026-06-01');
    expect(tooWide.ok).toBe(false);

    const badFormat = validateSyncDateRange('not-a-date', '2026-11-15');
    expect(badFormat.ok).toBe(false);
  });

  it('sanitizes athlete IDs and resolves allowed owner emails', () => {
    expect(sanitizeAthleteId('0')).toBe('0');
    expect(sanitizeAthleteId('i123456')).toBe('i123456');
    expect(sanitizeAthleteId('../admin')).toBe('0');
    expect(sanitizeAthleteId('123?evil=1')).toBe('0');

    const emails = getAllowedEmails(' Coach@Example.com , ');
    expect(emails.has('poketime.idle@gmail.com')).toBe(true);
    expect(emails.has('coach@example.com')).toBe(true);
    expect(emails.has('attacker@evil.com')).toBe(false);
  });

  it('whitelists and bounds wellness and activity payloads while rejecting malformed entries', () => {
    expect(formatUtcDate(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');

    expect(sanitizeWellnessItem(null)).toBeNull();
    expect(sanitizeWellnessItem({ id: '2026-02-31', hrv: 60 })).toBeNull();
    expect(
      sanitizeWellnessItem({
        id: '2026-11-20',
        hrv: 65,
        restingHR: 48,
        readiness: 85,
        sleepScore: Number.NaN,
        secretInjectedField: 'drop-me',
      })
    ).toEqual({
      id: '2026-11-20',
      hrv: 65,
      restingHR: 48,
      readiness: 85,
      sleepScore: null,
      sleepSecs: null,
      sleepQuality: null,
    });

    expect(sanitizeActivityItem({ id: '1', start_date_local: 'bad-date' })).toBeNull();
    const longName = 'A'.repeat(200);
    const sanitized = sanitizeActivityItem({
      id: 9988,
      name: longName,
      type: 'Run',
      start_date_local: '2026-11-20T08:00:00',
      moving_time: 2700,
      icu_hr_zone_times: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      extraPrivatePayload: 'ignored',
    });
    expect(sanitized).not.toBeNull();
    expect(sanitized?.id).toBe('9988');
    expect((sanitized?.name as string).length).toBe(120);
    expect((sanitized?.icu_hr_zone_times as number[]).length).toBe(10);
    expect('extraPrivatePayload' in (sanitized as Record<string, unknown>)).toBe(false);
  });

  it('maintains strict security parity between shared core and standalone Cloudflare Worker', () => {
    const workerPath = path.resolve(process.cwd(), 'workers/intervals-proxy.js');
    const workerSource = fs.readFileSync(workerPath, 'utf8');

    expect(workerSource).toContain(`'${INTERVALS_API_BASE}'`);
    expect(workerSource).toContain(SAFE_ISO_DATE_REGEX.source);
    expect(workerSource).toContain(SAFE_ATHLETE_ID_REGEX.source);
    expect(workerSource).toContain(CLOUD_RUN_ORIGIN_REGEX.source);
    for (const email of DEFAULT_ALLOWED_EMAILS) {
      expect(workerSource).toContain(`'${email}'`);
    }
    expect(workerSource).not.toContain("'Access-Control-Allow-Origin': '*'");
  });
});
