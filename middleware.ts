import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Check if app is closed
  const appClosed = process.env.APP_CLOSED === "true";

  if (!appClosed) {
    return NextResponse.next();
  }

  // Allow bypass with secret
  const bypassSecret = process.env.APP_BYPASS_SECRET;
  if (bypassSecret && searchParams.get("bypass") === bypassSecret) {
    // Set a cookie to remember the bypass for this session
    const response = NextResponse.next();
    response.cookies.set("app_bypass", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });
    return response;
  }

  // Check if user has bypass cookie
  if (request.cookies.get("app_bypass")?.value === "true") {
    return NextResponse.next();
  }

  // Allow access to the closed page itself
  if (pathname === "/closed") {
    return NextResponse.next();
  }

  // Allow static assets and internal routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") // Files with extensions (images, etc.)
  ) {
    return NextResponse.next();
  }

  // Redirect everything else to /closed
  return NextResponse.redirect(new URL("/closed", request.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
