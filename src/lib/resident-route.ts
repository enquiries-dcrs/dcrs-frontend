/** Normalise id from the URL so it matches API UUID text (case-insensitive in DB). */
export function canonicalResidentSegment(segment: string): string {
  return segment.trim().toLowerCase();
}

/**
 * `useParams()` can lag behind the URL on some client navigations; fall back to the pathname segment.
 * Supports nested routes under `/residents/[id]/...` (e.g. `/summary`).
 */
export function resolveResidentRouteId(
  params: Readonly<Record<string, string | string[] | undefined>>,
  pathname: string | null,
): string | null {
  const raw = params?.id;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s && s !== "new") return canonicalResidentSegment(s);
  }
  if (Array.isArray(raw)) {
    const s = String(raw[0] ?? "").trim();
    if (s && s !== "new") return canonicalResidentSegment(s);
  }
  if (pathname) {
    const m = pathname.match(/^\/residents\/([^/]+)/);
    const seg = m?.[1];
    if (seg && seg !== "new") {
      try {
        return canonicalResidentSegment(decodeURIComponent(seg));
      } catch {
        return canonicalResidentSegment(seg);
      }
    }
  }
  return null;
}
