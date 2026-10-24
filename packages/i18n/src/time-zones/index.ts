/** Whether a value is an IANA time-zone name known to the runtime, e.g. `Europe/Warsaw` (§13.1). */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
