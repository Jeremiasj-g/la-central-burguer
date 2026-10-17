import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '@/lib/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPPORTED_SIZES = new Set([192, 512]);
const LOGO_BUCKET = 'business-assets';
const FALLBACK_ICON_PATH = '/icons/app-icon.png';

type IconRouteContext = {
  params: Promise<{ size: string }>;
};

/**
 * Los íconos de las PWA de Admin y Delivery se generan desde el mismo
 * logo que utiliza el sitio público (business_config.logo_path).
 * Las aplicaciones conservan sus manifest, ID y scope independientes.
 */
export async function GET(request: Request, context: IconRouteContext) {
  const { size: sizeParam } = await context.params;
  const size = Number(sizeParam);

  if (!SUPPORTED_SIZES.has(size)) {
    return new Response('Tamaño de ícono no disponible.', { status: 404 });
  }

  // Si falta la configuración, la instalación PWA sigue teniendo un ícono.
  const fallback = () =>
    Response.redirect(new URL(FALLBACK_ICON_PATH, request.url), 307);

  if (!isSupabaseConfigured()) return fallback();

  try {
    const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: business, error: configError } = await supabase
      .from('business_config')
      .select('logo_path')
      .eq('id', 1)
      .single();

    if (configError || !business?.logo_path) return fallback();

    // Storage descargado por su ruta interna: no se solicitan URLs arbitrarias.
    const { data: logo, error: logoError } = await supabase.storage
      .from(LOGO_BUCKET)
      .download(business.logo_path);

    if (logoError || !logo || !logo.type.startsWith('image/')) return fallback();

    const base64 = Buffer.from(await logo.arrayBuffer()).toString('base64');
    const imageUri = `data:${logo.type};base64,${base64}`;
    const logoSize = Math.round(size * 0.77);

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: '#F2E3CA',
          }}
        >
          <img
            src={imageUri}
            width={logoSize}
            height={logoSize}
            alt=""
            style={{
              display: 'block',
              width: logoSize,
              height: logoSize,
              borderRadius: '50%',
              objectFit: 'contain',
            }}
          />
        </div>
      ),
      {
        width: size,
        height: size,
        headers: {
          'Cache-Control': 'public, max-age=600, stale-while-revalidate=86400',
        },
      },
    );
  } catch {
    return fallback();
  }
}
