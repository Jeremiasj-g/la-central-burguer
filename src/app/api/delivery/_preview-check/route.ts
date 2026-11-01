import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { POST as calculateDeliveryQuote } from '../quote/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Diagnóstico temporal y de solo lectura. Debe retirarse después de comprobar Preview.
export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.NEXT_PUBLIC_APP_ENV !== 'development') {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('business_config')
      .select('store_latitude,store_longitude')
      .eq('id', 1).single();
    if (error || !data || data.store_latitude === null || data.store_longitude === null) {
      return NextResponse.json({ adminConnection: 'failed', quoteRequest: 'not_run' }, { status: 503 });
    }
    const fakeRequest = new Request('http://localhost/api/delivery/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lat: Number(data.store_latitude) + 0.003, lng: Number(data.store_longitude) + 0.003 }),
    });
    const response = await calculateDeliveryQuote(fakeRequest);
    const quote = await response.json() as {
      quoteToken?: string; routeProvider?: string; deliveryCost?: number;
      mapsUrl?: string; error?: string;
    };
    return NextResponse.json({
      adminConnection: 'ok',
      quoteStatus: response.status,
      signedQuote: Boolean(quote.quoteToken),
      routeProvider: quote.routeProvider ?? null,
      mapsLink: Boolean(quote.mapsUrl),
      deliveryCostValid: typeof quote.deliveryCost === 'number' && Number.isFinite(quote.deliveryCost),
      error: quote.error ?? null,
    }, { status: response.ok ? 200 : 502, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ adminConnection: 'error', reason: error instanceof Error ? error.name : 'Unknown' }, { status: 503 });
  }
}
