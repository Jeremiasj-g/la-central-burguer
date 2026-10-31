import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { env, requireSupabaseConfigured } from '@/lib/config/env';
import type { Database } from '@/lib/supabase/database.types';
import type { GalleryState } from './gallery.service';

// Consulta anónima en el servidor: no depende de sesiones persistidas en el navegador.
// Mantiene las políticas RLS públicas; nunca usa la service_role key.
export async function getPublicGalleryServer(): Promise<GalleryState> {
  requireSupabaseConfigured('cargar la galería pública');
  const db = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  const { data: settings, error: settingsError } = await db.from('gallery_settings')
    .select('enabled').eq('id', 1).single();
  if (settingsError) throw settingsError;
  if (!settings?.enabled) return { enabled: false, images: [] };

  const { data: images, error: imagesError } = await db.from('gallery_images')
    .select('*').order('display_order').order('created_at');
  if (imagesError) throw imagesError;
  return { enabled: true, images: images ?? [] };
}
