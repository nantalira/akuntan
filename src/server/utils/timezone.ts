/**
 * Stateless Timezone Ingestion Helper
 * Uses native V8 Intl.DateTimeFormat (Zero external dependencies, Cloudflare edge compatible).
 */

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

/**
 * Validates if a timezone string is a recognized IANA timezone identifier.
 */
export function isValidTimezone(timeZone?: string | null): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timeZone.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves user timezone from header or string, falling back to Asia/Jakarta.
 */
export function resolveUserTimezone(headerValue?: string | null): string {
  if (headerValue && isValidTimezone(headerValue.trim())) {
    return headerValue.trim();
  }
  return DEFAULT_TIMEZONE;
}

/**
 * Gets current local date ('YYYY-MM-DD') and time ('HH:mm:ss') for a given timezone.
 */
export function getCurrentDateAndTimeInTimezone(
  timeZone: string = DEFAULT_TIMEZONE,
  referenceDate: Date = new Date()
): { date: string; time: string } {
  const tz = resolveUserTimezone(timeZone);

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(referenceDate);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const date = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const time = `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;

  return { date, time };
}

/**
 * Converts a local date string (YYYY-MM-DD) and time string (HH:mm:ss) in a given timezone
 * into a standardized ISO UTC string.
 */
export function convertLocalToUtcIso(
  dateStr: string,
  timeStr: string = '12:00:00',
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const tz = resolveUserTimezone(timeZone);
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour = 12, minute = 0, second = 0] = timeStr.split(':').map(Number);

  const nominalUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const testDate = new Date(nominalUtcMs);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(testDate);
  const p = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);

  const tzAsUtcMs = Date.UTC(
    p('year'),
    p('month') - 1,
    p('day'),
    p('hour') % 24,
    p('minute'),
    p('second')
  );

  const offsetMs = tzAsUtcMs - nominalUtcMs;
  return new Date(nominalUtcMs - offsetMs).toISOString();
}
