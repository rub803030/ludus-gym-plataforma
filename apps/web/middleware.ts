import { NextResponse, type NextRequest } from 'next/server'

/** Cookie presence gate. Role validation happens in the console layout, where
 *  /api/auth/me can be called server-side with the session cookies. */
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('ludus_sid')?.value
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    if (request.nextUrl.pathname !== '/') {
      loginUrl.searchParams.set('next', request.nextUrl.pathname)
    }
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!login|register-gym|verify-gym|verify-email|_next|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|css|js)$).*)',
  ],
}
