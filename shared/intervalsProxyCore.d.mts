export const INTERVALS_API_BASE: string;
export const SAFE_ISO_DATE_REGEX: RegExp;
export const SAFE_ATHLETE_ID_REGEX: RegExp;
export const GITHUB_PAGES_ORIGIN_REGEX: RegExp;
export const CLOUD_RUN_ORIGIN_REGEX: RegExp;
export const LOCALHOST_ORIGIN_REGEX: RegExp;
export const DEFAULT_ALLOWED_EMAILS: string[];

export function getAllowedEmails(extraEmailsCsv?: string): Set<string>;
export function isAllowedCorsOrigin(origin?: string, extraOriginsCsv?: string): boolean;
export function isValidIsoCalendarDate(dateStr: string): boolean;
export function validateSyncDateRange(
  oldest: string,
  newest: string,
  maxDays?: number
): { ok: true; diffDays: number } | { ok: false; error: string };
export function formatUtcDate(date: Date): string;
export function sanitizeAthleteId(rawAthleteId?: string): string;
export function sanitizeWellnessItem(raw: unknown): Record<string, unknown> | null;
export function sanitizeActivityItem(raw: unknown): Record<string, unknown> | null;
