import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const bypassSecret = process.env.APP_BYPASS_SECRET;
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  // If no bypass secret is configured, show error
  if (!bypassSecret) {
    return NextResponse.json(
      { error: 'Bypass is not configured' },
      { status: 403 }
    );
  }

  // If token doesn't match, show error
  if (token !== bypassSecret) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 403 }
    );
  }

  // Token is valid - set cookie and redirect to home
  const response = NextResponse.redirect(new URL('/', request.url));
  
  // Set bypass cookie (expires in 7 days)
  response.cookies.set('app_bypass', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  return response;
}
