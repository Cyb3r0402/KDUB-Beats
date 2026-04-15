import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  CONTROL_CENTER_COOKIE_NAME,
  isAuthorizedControlCenterSession,
} from "@/lib/control-center-auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/studio-session";

  if (!pathname.startsWith("/control-center") && !isLoginPage) {
    return NextResponse.next();
  }

  const token = request.cookies.get(CONTROL_CENTER_COOKIE_NAME)?.value;
  const isAuthorized = isAuthorizedControlCenterSession(token);

  if (!isAuthorized && pathname.startsWith("/control-center")) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  if (!isAuthorized && isLoginPage) {
    return NextResponse.next();
  }

  if (isAuthorized && isLoginPage) {
    const controlCenterUrl = new URL("/control-center", request.url);
    return NextResponse.redirect(controlCenterUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/control-center/:path*", "/studio-session"],
};
