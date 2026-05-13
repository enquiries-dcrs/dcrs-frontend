/**
 * Canonical UUID string shape (8-4-4-4-12 hex). Matches typical Postgres `uuid` text
 * and accepts legacy / fixture IDs that are not RFC variant–compliant (e.g. repeated
 * nibbles in the variant field), which stricter RFC-only regexes reject.
 * Keep in sync with `UUID_RE` in backend/server.js for route/body validation.
 */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(s: string | null | undefined): boolean {
  if (s == null || s === "") return false;
  return UUID_RE.test(String(s).trim());
}

/** Read home id from facility-layout row (snake_case / camelCase). */
export function facilityHomeId(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const o = row as Record<string, unknown>;
  for (const k of ["id", "home_id", "homeId"] as const) {
    const v = o[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export function facilityHomeName(row: unknown): string {
  if (!row || typeof row !== "object") return "Home";
  const o = row as Record<string, unknown>;
  const n = o.name ?? o.home_name ?? o.homeName;
  const s = n != null ? String(n).trim() : "";
  return s || "Home";
}

export function facilityHomesList(homes: unknown): Array<{ id: string; name: string }> {
  if (!Array.isArray(homes)) return [];
  const out: Array<{ id: string; name: string }> = [];
  for (const h of homes) {
    const id = facilityHomeId(h);
    if (!isValidUuid(id)) continue;
    out.push({ id, name: facilityHomeName(h) });
  }
  return out;
}
