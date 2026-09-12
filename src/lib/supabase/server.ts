import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env, requireSupabaseConfigured } from '@/lib/config/env';
import type { Database } from './database.types';

export async function getSupabaseServerClient() {
  requireSupabaseConfigured('usar Supabase desde el servidor');
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Los Server Components no pueden escribir cookies. proxy.ts las actualiza.
        }
      },
    },
  });
}
