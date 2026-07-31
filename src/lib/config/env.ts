const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  || '';

export const env = {
  supabaseUrl,
  supabasePublishableKey,
};

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}

export function requireSupabaseConfigured(context = 'esta funcionalidad') {
  if (isSupabaseConfigured()) return;

  throw new Error(
    `Supabase no está configurado para ${context}. Completá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local y reiniciá el servidor.`,
  );
}
