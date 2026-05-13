/** Matches backend `UUID_RE` in server.js (RFC-style UUID string check). */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(s: string | null | undefined): boolean {
  if (s == null || s === "") return false;
  return UUID_RE.test(String(s).trim());
}
