// proxy.ts — app-level Proxy detected by Next.js (file convention).
// Next.js loads this file automatically (no import required).
// NOTE: Do not delete — this handles session logic for API routes listed in `config.matcher`.

import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'
import { updateSession } from './utils/supabase/middleware'

// Keep the exported name 'proxy' (Next will load this entrypoint by convention).
// Ensure updateSession returns a Response / NextResponse-compatible value.
export async function proxy(request: NextRequest): Promise<Response | NextResponse> {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/api/save/:path*',
    '/api/export/:path*',
    '/api/import/:path*',
  ],
}
