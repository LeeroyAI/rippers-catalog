/**
 * Use a full document navigation after setting `rippers_onboarded` via `document.cookie`
 * so the next request reliably includes the cookie (App Router client transitions can
 * otherwise hit middleware without it and bounce back to `/welcome`).
 */
export function enterAppAfterOnboarding(href: string): void {
  if (typeof window === "undefined") return;
  const path = href.startsWith("/") ? href : `/${href}`;
  window.location.assign(path);
}
