// Browsers enforce frame-ancestors silently, so an iframe load (Sec-Fetch-Dest) whose Referer origin is not allowed is logged once per origin, up to a cap.
const loggedOrigins = new Set<string>();
const MAX_LOGGED_ORIGINS = 20;

export function logBlockedFrame(headers: Headers, self: string, allowed: string[]) {
  if (headers.get("sec-fetch-dest") !== "iframe") return;
  let parent;
  try {
    parent = new URL(headers.get("referer") ?? "").origin;
  } catch {
    return;
  }
  if (parent === self || allowed.includes(parent)) return;
  if (loggedOrigins.has(parent) || loggedOrigins.size >= MAX_LOGGED_ORIGINS) return;
  loggedOrigins.add(parent);
  console.warn(`Blocked iframe embed from ${parent}; add it to FRAME_ANCESTORS to allow it.`);
}
