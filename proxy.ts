import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'wt-admin-session'

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always let the login page through — prevents redirect loop
  if (pathname === '/admin/login') return NextResponse.next()

  // Check session cookie written by useAdminStore.login()
  const session = req.cookies.get(SESSION_COOKIE)
  if (!session?.value) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }

  return NextResponse.next()
}
