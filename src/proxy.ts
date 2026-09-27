import { type NextRequest, NextResponse } from "next/server";

import { logBlockedFrame } from "./frameLog";

// Framing is limited to this app, the Home Assistant origin and FRAME_ANCESTORS, e.g. when Home Assistant is reached on another hostname.
const frameAncestors = () => {
  const origins = ["'self'"];
  try {
    if (process.env.HA_URL) origins.push(new URL(process.env.HA_URL).origin);
  } catch {}
  origins.push(...(process.env.FRAME_ANCESTORS?.split(/[\s,]+/).filter(Boolean) ?? []));
  return origins;
};

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  `frame-ancestors ${frameAncestors().join(" ")}`,
].join("; ");

// Everything else gets a bare plain-text response, instead of a rendered page.
const ICONS = ["arrow-down", "arrow-up"];
const ROUTES = ["/", "/api/state", "/icon.svg", ...ICONS.map((icon) => `/icons/${icon}.svg`)];
// Next answers misses under /_next/static/ in plain text itself; dev tooling needs the rest of /_next/.
const PREFIXES = process.env.NODE_ENV === "production" ? ["/_next/static/"] : ["/_next/", "/__nextjs"];

const plain = (status: number, text: string, extra: Record<string, string> = {}) =>
  new NextResponse(`${text}\n`, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") logBlockedFrame(request.headers, request.nextUrl.origin, frameAncestors());
  const response = !ROUTES.includes(pathname) && !PREFIXES.some((prefix) => pathname.startsWith(prefix))
    ? plain(404, "404 page not found")
    : !["GET", "HEAD"].includes(request.method)
      ? plain(405, "405 method not allowed", { Allow: "GET, HEAD" })
      : NextResponse.next();
  const headers = response.headers;
  headers.set("Content-Security-Policy", csp);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return response;
}
