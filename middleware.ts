import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isAppClosed, hasBypass } from '@/lib/appClosure';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Allow required internal/asset routes and the closed/bypass pages
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    url.pathname.startsWith('/favicon') ||
    url.pathname.startsWith('/closed') ||
    url.pathname.startsWith('/bypass') ||
    url.pathname === '/api/health'
  ) {
    return NextResponse.next();
  }

  // If app is not closed, allow everything
  if (!isAppClosed()) {
    return NextResponse.next();
  }

  // Check for bypass via token or cookie
  const token = url.searchParams.get('token');
  const bypassCookie = req.cookies.get('app_bypass')?.value;
  
  if (hasBypass(token, bypassCookie)) {
    return NextResponse.next();
  }

  // Redirect everything else to /closed
  const closedUrl = new URL('/closed', url.origin);
  return NextResponse.redirect(closedUrl);
}

export const config = {
  // Apply to everything except Next.js internals
  matcher: ['/((?!_next|static|favicon.ico).*)'],
};
