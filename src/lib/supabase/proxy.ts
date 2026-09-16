import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env, isSupabaseConfigured } from '@/lib/config/env';
import { ROUTES } from '@/shared/constants/routes';
import type { Database } from './database.types';

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null;
  let isAdmin = false;

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role,active')
      .eq('id', userId)
      .maybeSingle();
    isAdmin = profile?.role === 'admin' && profile.active;
  }

  const isLogin = request.nextUrl.pathname === ROUTES.adminLogin;
  if (!isAdmin && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.adminLogin;
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (isAdmin && isLogin) {
    return NextResponse.redirect(new URL(ROUTES.adminDashboard, request.url));
  }

  return response;
}
