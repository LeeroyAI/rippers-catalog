import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const has = request.cookies.get("rippers_onboarded")?.value === "1";
  if (!has) {
    const u = request.nextUrl.clone();
    const intended = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    u.pathname = "/welcome";
    u.search = "";
    u.searchParams.set("next", intended);
    return NextResponse.redirect(u);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/trip",
    "/trip/:path*",
    "/profile",
    "/profile/:path*",
    "/watch",
    "/watch/:path*",
    "/compare",
    "/compare/:path*",
    "/sizing",
    "/sizing/:path*",
  ],
};
