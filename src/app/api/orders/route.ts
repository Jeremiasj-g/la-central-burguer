import { after, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { verifyDeliveryQuote } from '@/features/delivery/server/route-quote.server';
import { notifyAdminNewOrder } from '@/features/pedidos/server/admin-push.server';
import type { Json } from '@/lib/supabase/database.types';
import { BUSINESS_CONFIG_DEFAULTS } from '@/features/configuracion/constants/configuracion.defaults';
import { isBusinessOpenBySchedule } from '@/features/configuracion/utils/businessStatus.utils';

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
    const { data: business, error: businessError } = await supabase
      .from('business_config')
      .select('maintenance_mode,closed_weekdays,timezone,is_open,auto_schedule_enabled,auto_open_time,auto_close_time,daily_hours')
      .eq('id', 1)
      .single();
    if (businessError) throw new Error('No pudimos verificar el estado del local.');
    if (!business || !isBusinessOpenBySchedule({
      ...BUSINESS_CONFIG_DEFAULTS,
      timezone: business.timezone,
      isOpen: business.is_open,
      maintenanceMode: business.maintenance_mode,
      autoScheduleEnabled: business.auto_schedule_enabled,
      autoOpenTime: business.auto_open_time.slice(0,5),
      autoCloseTime: business.auto_close_time.slice(0,5),
      closedWeekdays: business.closed_weekdays ?? [],
      dailyHours: (business.daily_hours ?? {}) as Record<string,{open:string;close:string}>,
    })) {
      return NextResponse.json({error:'El local está cerrado en este momento. Consultá los horarios de atención.'},
        {status:503,headers:{'Cache-Control':'no-store'}});
    }

    const { data, error } = await supabase.rpc('create_public_order_from_route', {
      payload: serverPayload as unknown as Json,
    });

    if (error) throw new Error(error.message);

    // El pedido ya está confirmado en PostgreSQL. El Push no debe bloquear
    // la respuesta del cliente ni provocar un segundo pedido si falla.
    const newOrderId = data && typeof data === 'object' && !Array.isArray(data) && 'id' in data
      ? (data as { id?: unknown }).id
      : null;
    if (typeof newOrderId === 'string') {
      after(async () => {
        try { await notifyAdminNewOrder(newOrderId); }
        catch (pushError) {
          console.error('[admin-push] No se pudo notificar el pedido:', pushError instanceof Error ? pushError.message : 'Error desconocido');
        }
      });
    }

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
    const isSupabaseCredentialError = /invalid api key|api key|jwt|service role|secret key/i.test(message);

    console.error('[create-public-order] No se pudo crear el pedido.', {
      message,
      name: error instanceof Error ? error.name : 'UnknownError',
    });

    return NextResponse.json(
      {
        error: isSupabaseCredentialError
          ? 'No pudimos confirmar el pedido en este momento. Intentá nuevamente en unos instantes.'
          : message,
      },
      {
        status: isQuoteError ? 409 : 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
