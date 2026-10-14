import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { verifyDeliveryQuote } from '@/features/delivery/server/route-quote.server';
import type { Json } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';

interface OrderRequestBody {
  payload?: Record<string, unknown>;
}

function coordinatesMatch(left: unknown, right: number) {
  return typeof left === 'number'
    && Number.isFinite(left)
    && Math.abs(left - right) <= 0.000001;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo confirmar el pedido.';
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as OrderRequestBody;
    const payload = body.payload;

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'El pedido no es válido.' }, { status: 400 });
    }

    const serverPayload: Record<string, unknown> = { ...payload };

    if (payload.deliveryMethod === 'delivery') {
      const quoteToken = typeof payload.deliveryQuoteToken === 'string'
        ? payload.deliveryQuoteToken
        : '';

      if (!quoteToken) {
        return NextResponse.json(
          { error: 'Volvé a compartir tu ubicación para calcular el delivery por ruta.' },
          { status: 409 },
        );
      }

      const quote = verifyDeliveryQuote(quoteToken);

      if (
        !coordinatesMatch(payload.customerLat, quote.customerLat)
        || !coordinatesMatch(payload.customerLng, quote.customerLng)
      ) {
        return NextResponse.json(
          { error: 'La ubicación cambió después de calcular el envío. Volvé a cotizar el delivery.' },
          { status: 409 },
        );
      }

      if (!quote.isWithinRange) {
        return NextResponse.json(
          { error: 'Tu ubicación está fuera del radio de entrega configurado.' },
          { status: 409 },
        );
      }

      serverPayload.expectedDeliveryCost = quote.deliveryCost;
      serverPayload.serverDeliveryQuote = {
        routeDistanceKm: quote.routeDistanceKm,
        straightDistanceKm: quote.straightDistanceKm,
        routeDurationSeconds: quote.routeDurationSeconds,
        deliveryCost: quote.deliveryCost,
        mapsUrl: quote.mapsUrl,
        routeProvider: quote.routeProvider,
        travelMode: quote.travelMode,
        routeVia: quote.routeVia,
        quotedAt: quote.quotedAt,
      };
    }

    delete serverPayload.deliveryQuoteToken;

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc('create_public_order_from_route', {
      payload: serverPayload as unknown as Json,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json(
      { order: data },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    const message = errorMessage(error);
    const isQuoteError = /cotización|ubicación|delivery|ruta|venció|modificada/i.test(message);

    return NextResponse.json(
      { error: message },
      {
        status: isQuoteError ? 409 : 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
