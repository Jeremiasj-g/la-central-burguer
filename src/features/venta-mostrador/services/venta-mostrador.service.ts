import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';

export type CounterServiceMode = 'takeaway' | 'dine_in';
export type CounterPaymentMethod = 'efectivo' | 'transferencia';

export interface CounterSaleItemInput {
  productId: string;
  quantity: number;
}

export interface CreateCounterSaleInput {
  customerName?: string;
  customerPhone?: string;
  serviceMode: CounterServiceMode;
  paymentMethod: CounterPaymentMethod;
  notes?: string;
  items: CounterSaleItemInput[];
}

export interface CounterSaleResult {
  orderId: string;
  orderCode: string;
  total: number;
}

export async function createCounterSale(input: CreateCounterSaleInput): Promise<CounterSaleResult> {
  requireSupabaseConfigured('registrar una venta de mostrador');

  if (!input.items.length) throw new Error('Agregá al menos un producto a la venta.');

  const supabase = getSupabaseBrowserClient();
  const customerName = input.customerName?.trim() || 'Venta mostrador';
  const customerPhone = input.customerPhone?.trim() || '';
  const normalizedPhone = customerPhone.replace(/\D/g, '');

  if (customerPhone && normalizedPhone.length < 6) {
    throw new Error('El teléfono ingresado no es válido.');
  }

  const quantities = new Map<string, number>();
  for (const item of input.items) {
    const quantity = Math.max(1, Math.min(99, Math.trunc(item.quantity)));
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + quantity);
  }

  const productIds = [...quantities.keys()];
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id,category_id,name,image_url,is_promotion,current_price,active,available,deleted_at')
    .in('id', productIds);

  if (productsError) throw new Error(productsError.message);
  if (!products || products.length !== productIds.length) {
    throw new Error('Uno de los productos ya no existe. Actualizá la pantalla e intentá nuevamente.');
  }

  if (products.some((product) => !product.active || !product.available || product.deleted_at)) {
    throw new Error('Uno de los productos ya no se encuentra disponible.');
  }

  const subtotal = products.reduce(
    (total, product) => total + Number(product.current_price) * (quantities.get(product.id) ?? 1),
    0,
  );

  let customerId: string | null = null;
  if (customerPhone) {
    const { data: existingCustomer, error: customerReadError } = await supabase
      .from('customers')
      .select('id')
      .eq('normalized_phone', normalizedPhone)
      .maybeSingle();

    if (customerReadError) throw new Error(customerReadError.message);

    if (existingCustomer) {
      const { error: customerUpdateError } = await supabase
        .from('customers')
        .update({ full_name: customerName, phone: customerPhone })
        .eq('id', existingCustomer.id);
      if (customerUpdateError) throw new Error(customerUpdateError.message);
      customerId = existingCustomer.id;
    } else {
      const { data: createdCustomer, error: customerCreateError } = await supabase
        .from('customers')
        .insert({
          full_name: customerName,
          phone: customerPhone,
          normalized_phone: normalizedPhone,
        })
        .select('id')
        .single();
      if (customerCreateError) throw new Error(customerCreateError.message);
      customerId = createdCustomer.id;
    }
  }

  const { data: orderCode, error: orderCodeError } = await (supabase.rpc as unknown as (
    functionName: string,
    args?: Record<string, never>,
  ) => Promise<{ data: string | null; error: { message: string } | null }>)('generate_order_code');

  if (orderCodeError || !orderCode) {
    throw new Error(orderCodeError?.message || 'No se pudo generar el código de la venta.');
  }

  const serviceLabel = input.serviceMode === 'dine_in' ? 'Comer en el local' : 'Para llevar';
  const cleanNotes = input.notes?.trim();
  const storedNotes = [`Venta mostrador · ${serviceLabel}.`, cleanNotes].filter(Boolean).join('\n');

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_code: orderCode,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone || 'Sin teléfono',
      delivery_method: 'retiro_local',
      payment_method: input.paymentMethod,
      subtotal,
      delivery_cost: 0,
      status: 'entregado',
      notes: storedNotes,
      source: 'admin',
    })
    .select('id,order_code,total')
    .single();

  if (orderError) throw new Error(orderError.message);

  const itemRows = products.map((product) => ({
    order_id: order.id,
    product_id: product.id,
    category_id: product.category_id,
    product_name: product.name,
    image_url: product.image_url,
    is_promotion: product.is_promotion,
    quantity: quantities.get(product.id) ?? 1,
    unit_price: Number(product.current_price),
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(itemRows);
  if (itemsError) {
    await supabase.from('orders').delete().eq('id', order.id);
    throw new Error(itemsError.message);
  }

  return {
    orderId: order.id,
    orderCode: order.order_code,
    total: Number(order.total),
  };
}
