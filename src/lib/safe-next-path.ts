/**
 * Validates `next` from query/cookie so redirects stay same-origin paths only.
 */
export function safeInternalNextPath(raw: string | null | undefined): string {
  if (raw == null) return "/";
  let s = String(raw).trim();
  if (!s) return "/";
  try {
    s = decodeURIComponent(s);
  } catch {
    return "/";
  }
  if (!s.startsWith("/")) return "/";
  if (s.startsWith("//")) return "/";
  if (s.includes("://")) return "/";
  const q = s.indexOf("?");
  const pathname = q === -1 ? s : s.slice(0, q);
  if (pathname.length > 256) return "/";
  if (pathname.toLowerCase().startsWith("/welcome")) return "/";
  return s;
}
