import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Endpoint temporal para iniciar un usuario de QA exclusivo de DEV.
// No pertenece a main y se retirará después de la operación.
export async function GET(request: NextRequest) {
  const expected = process.env.DEV_BOOTSTRAP_TOKEN ?? '';
  const supplied = request.nextUrl.searchParams.get('token') ?? '';
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);

  if (
    process.env.NEXT_PUBLIC_APP_ENV !== 'development' ||
    !expected || !supplied || a.length !== b.length ||
    !timingSafeEqual(a, b)
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const email = process.env.DEV_BOOTSTRAP_EMAIL;
  const password = process.env.DEV_BOOTSTRAP_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!email || !password || !url || !publicKey) {
    return NextResponse.json({ error: 'Dev setup missing' }, { status: 500 });
  }

  const db = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await db.auth.signUp({
    email, password, options: { data: { full_name: 'Administrador DEV' } },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? 'Auth user not returned' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { ok: true, userId: data.user.id, isConfirmed: Boolean(data.user.email_confirmed_at) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
