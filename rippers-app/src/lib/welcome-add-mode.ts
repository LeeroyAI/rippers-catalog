/**
 * Whether the welcome URL means “add a household rider” vs “edit/save the active rider”.
 */
export function welcomeUrlIndicatesAddRider(searchParams: URLSearchParams): boolean {
  const raw = (searchParams.get("add") ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (searchParams.get("mode") === "add-rider") return true;
  return false;
}

const INTENT_SESSION_KEY = "rippers:intent:add-household-rider:v1";
/** Same payload as session; survives a few WebViews / privacy modes where session is unreliable. */
const INTENT_LOCAL_KEY = "rippers:intent:add-household-rider-ls:v1";
const INTENT_TTL_MS = 20 * 60 * 1000;

type IntentPayload = { v: 1; t: number };

function parsePayload(raw: string | null): IntentPayload | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as IntentPayload;
    if (p?.v !== 1 || typeof p.t !== "number") return null;
    if (Date.now() - p.t > INTENT_TTL_MS) return null;
    return p;
  } catch {
    return null;
  }
}

function parseIntentFromSessionStorage(): IntentPayload | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(INTENT_SESSION_KEY);
    const p = parsePayload(raw);
    if (p == null && raw) sessionStorage.removeItem(INTENT_SESSION_KEY);
    return p;
  } catch {
    return null;
  }
}

function parseIntentFromLocalStorage(): IntentPayload | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(INTENT_LOCAL_KEY);
    const p = parsePayload(raw);
    if (p == null && raw) localStorage.removeItem(INTENT_LOCAL_KEY);
    return p;
  } catch {
    return null;
  }
}

function peekIntentPayload(): IntentPayload | null {
  return parseIntentFromSessionStorage() ?? parseIntentFromLocalStorage();
}

/** Call from “+ Add rider” links right before navigation so submit still works if the query string is dropped. */
export function markAddHouseholdRiderNavigationIntent(): void {
  const p: IntentPayload = { v: 1, t: Date.now() };
  const json = JSON.stringify(p);
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(INTENT_SESSION_KEY, json);
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(INTENT_LOCAL_KEY, json);
  } catch {
    /* ignore */
  }
}

export function peekAddHouseholdRiderNavigationIntent(): boolean {
  return peekIntentPayload() != null;
}

export function clearAddHouseholdRiderNavigationIntent(): void {
  try {
    sessionStorage?.removeItem(INTENT_SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage?.removeItem(INTENT_LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

/** True if the welcome form submit should append a household rider (not overwrite the active one). */
export function welcomeSubmitShouldAddHouseholdRider(searchQueryString: string): boolean {
  const q = searchQueryString.startsWith("?") ? searchQueryString.slice(1) : searchQueryString;
  const sp = new URLSearchParams(q);
  if (welcomeUrlIndicatesAddRider(sp)) return true;
  return peekAddHouseholdRiderNavigationIntent();
}

/**
 * URL for adding another person to the household. Uses a **pathname** (`/welcome/add-rider`)
 * so navigation cannot silently degrade into “edit active profile” when query params are lost.
 */
export function householdAddRiderHref(nextPath: string): string {
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  const q = new URLSearchParams();
  q.set("next", next);
  return `/welcome/add-rider?${q.toString()}`;
}

/** @deprecated Use `householdAddRiderHref` — query-only flows are fragile. */
export function welcomeAddRiderQuerySuffix(nextPath: string): string {
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  const q = new URLSearchParams();
  q.set("add", "1");
  q.set("mode", "add-rider");
  q.set("next", next);
  return `?${q.toString()}`;
}
