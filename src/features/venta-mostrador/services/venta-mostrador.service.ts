import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';
import type { Database, OrderStatus } from '@/lib/supabase/database.types';

export type CounterServiceMode = 'takeaway' | 'dine_in';
export type CounterPaymentMethod = 'efectivo' | 'transferencia';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

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

export interface CounterSaleListItem {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  serviceMode: CounterServiceMode;
  paymentMethod: CounterPaymentMethod;
  subtotal: number;
  total: number;
  status: OrderStatus;
  notes: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CounterSaleEditItem {
  id: string;
  productId: string | null;
  categoryId: string | null;
  productName: string;
  imageUrl: string | null;
  isPromotion: boolean;
  quantity: number;
  unitPrice: number;
  createdAt: string;
}

export interface CounterSaleEditData extends CounterSaleListItem {
  items: CounterSaleEditItem[];
}

export interface CounterSalesPage {
  rows: CounterSaleListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const COUNTER_NOTE_PREFIX = 'Venta mostrador ·';

function parseCounterNotes(value: string | null) {
  const lines = (value ?? '').split('\n');
  const header = lines.shift() ?? '';
  const serviceMode: CounterServiceMode = header.includes('Comer en el local') ? 'dine_in' : 'takeaway';

  return {
    serviceMode,
    notes: lines.join('\n').trim(),
  };
}

function buildCounterNotes(serviceMode: CounterServiceMode, notes?: string) {
  const serviceLabel = serviceMode === 'dine_in' ? 'Comer en el local' : 'Para llevar';
  const cleanNotes = notes?.trim();
  return [`${COUNTER_NOTE_PREFIX} ${serviceLabel}.`, cleanNotes].filter(Boolean).join('\n');
}

function normalizeItems(items: CounterSaleItemInput[]) {
  const quantities = new Map<string, number>();

  for (const item of items) {
    const quantity = Math.max(1, Math.min(99, Math.trunc(item.quantity)));
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + quantity);
  }

  return quantities;
}

async function resolveCustomer(customerNameInput?: string, customerPhoneInput?: string) {
  const supabase = getSupabaseBrowserClient();
  const customerName = customerNameInput?.trim() || 'Venta mostrador';
  const customerPhone = customerPhoneInput?.trim() || '';
  const normalizedPhone = customerPhone.replace(/\D/g, '');

  if (customerPhone && normalizedPhone.length < 6) {
    throw new Error('El teléfono ingresado no es válido.');
  }

  if (!customerPhone) {
    return {
      customerId: null as string | null,
      customerName,
      customerPhone: 'Sin teléfono',
    };
  }

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

    return {
      customerId: existingCustomer.id,
      customerName,
      customerPhone,
    };
  }

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

  return {
    customerId: createdCustomer.id,
    customerName,
    customerPhone,
  };
}

async function prepareSaleItems(
  input: CreateCounterSaleInput,
  existingPrices = new Map<string, number>(),
  existingProductIds = new Set<string>(),
) {
  if (!input.items.length) throw new Error('Agregá al menos un producto a la venta.');

  const supabase = getSupabaseBrowserClient();
  const quantities = normalizeItems(input.items);
  const productIds = [...quantities.keys()];

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id,category_id,name,image_url,is_promotion,current_price,active,available,deleted_at')
    .in('id', productIds);

  if (productsError) throw new Error(productsError.message);
  if (!products || products.length !== productIds.length) {
    throw new Error('Uno de los productos ya no existe. Actualizá la pantalla e intentá nuevamente.');
  }

  const unavailableProduct = products.find((product) =>
    Boolean(product.deleted_at)
    || ((!product.active || !product.available) && !existingProductIds.has(product.id)),
  );

  if (unavailableProduct) {
    throw new Error(`${unavailableProduct.name} ya no se encuentra disponible.`);
  }

  const prices = new Map(
    products.map((product) => [
      product.id,
      existingPrices.get(product.id) ?? Number(product.current_price),
    ]),
  );

  const subtotal = products.reduce(
    (total, product) => total + (prices.get(product.id) ?? Number(product.current_price)) * (quantities.get(product.id) ?? 1),
    0,
  );

  const itemRows = products.map((product) => ({
    product_id: product.id,
    category_id: product.category_id,
    product_name: product.name,
    image_url: product.image_url,
    is_promotion: product.is_promotion,
    quantity: quantities.get(product.id) ?? 1,
    unit_price: prices.get(product.id) ?? Number(product.current_price),
  }));

  return { subtotal, itemRows };
}

function mapCounterSale(
  row: Pick<OrderRow, 'id' | 'order_code' | 'customer_name' | 'customer_phone' | 'payment_method' | 'subtotal' | 'total' | 'status' | 'notes' | 'created_at' | 'updated_at'>,
  itemCount: number,
): CounterSaleListItem {
  const parsed = parseCounterNotes(row.notes);
  return {
    id: row.id,
    orderCode: row.order_code,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    serviceMode: parsed.serviceMode,
    paymentMethod: row.payment_method,
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    status: row.status,
    notes: parsed.notes,
    itemCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createCounterSale(input: CreateCounterSaleInput): Promise<CounterSaleResult> {
  requireSupabaseConfigured('registrar una venta de mostrador');

  const supabase = getSupabaseBrowserClient();
  const [{ subtotal, itemRows }, customer] = await Promise.all([
    prepareSaleItems(input),
    resolveCustomer(input.customerName, input.customerPhone),
  ]);

  const { data: orderCode, error: orderCodeError } = await (supabase.rpc as unknown as (
    functionName: string,
    args?: Record<string, never>,
  ) => Promise<{ data: string | null; error: { message: string } | null }>)('generate_order_code');

  if (orderCodeError || !orderCode) {
    throw new Error(orderCodeError?.message || 'No se pudo generar el código de la venta.');
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_code: orderCode,
      customer_id: customer.customerId,
      customer_name: customer.customerName,
      customer_phone: customer.customerPhone,
      delivery_method: 'retiro_local',
      payment_method: input.paymentMethod,
      subtotal,
      delivery_cost: 0,
      status: 'entregado',
      notes: buildCounterNotes(input.serviceMode, input.notes),
      source: 'admin',
    })
    .select('id,order_code,total')
    .single();

  if (orderError) throw new Error(orderError.message);

  const { error: itemsError } = await supabase.from('order_items').insert(
    itemRows.map((row) => ({ ...row, order_id: order.id })),
  );

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

export async function getCounterSales({
  page = 1,
  pageSize = 10,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<CounterSalesPage> {
  requireSupabaseConfigured('consultar ventas de mostrador');

  const safePageSize = Math.max(1, Math.min(10, Math.trunc(pageSize)));
  const safePage = Math.max(1, Math.trunc(page));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  const supabase = getSupabaseBrowserClient();

  const { data, error, count } = await supabase
    .from('orders')
    .select('id,order_code,customer_name,customer_phone,payment_method,subtotal,total,status,notes,created_at,updated_at', { count: 'exact' })
    .eq('source', 'admin')
    .like('notes', `${COUNTER_NOTE_PREFIX}%`)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const itemCounts = new Map<string, number>();

  if (rows.length) {
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('order_id,quantity')
      .in('order_id', rows.map((row) => row.id));

    if (itemsError) throw new Error(itemsError.message);

    for (const item of items ?? []) {
      itemCounts.set(item.order_id, (itemCounts.get(item.order_id) ?? 0) + Number(item.quantity));
    }
  }

  return {
    rows: rows.map((row) => mapCounterSale(row, itemCounts.get(row.id) ?? 0)),
    total: count ?? 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function getCounterSaleForEdit(orderId: string): Promise<CounterSaleEditData> {
  requireSupabaseConfigured('editar una venta de mostrador');

  const supabase = getSupabaseBrowserClient();
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id,order_code,customer_name,customer_phone,payment_method,subtotal,total,status,notes,created_at,updated_at')
    .eq('id', orderId)
    .eq('source', 'admin')
    .like('notes', `${COUNTER_NOTE_PREFIX}%`)
    .single();

  if (orderError) throw new Error(orderError.message);
  if (order.status === 'cancelado') throw new Error('Las ventas canceladas no pueden editarse.');

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('id,product_id,category_id,product_name,image_url,is_promotion,quantity,unit_price,created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (itemsError) throw new Error(itemsError.message);

  const sale = mapCounterSale(
    order,
    (items ?? []).reduce((total, item) => total + Number(item.quantity), 0),
  );

  return {
    ...sale,
    items: (items ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      categoryId: item.category_id,
      productName: item.product_name,
      imageUrl: item.image_url,
      isPromotion: item.is_promotion,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      createdAt: item.created_at,
    })),
  };
}

function rollbackItemRow(row: OrderItemRow) {
  return {
    id: row.id,
    order_id: row.order_id,
    product_id: row.product_id,
    category_id: row.category_id,
    product_name: row.product_name,
    category_name: row.category_name,
    image_url: row.image_url,
    is_promotion: row.is_promotion,
    quantity: row.quantity,
    unit_price: row.unit_price,
    note: row.note,
    created_at: row.created_at,
  };
}

export async function updateCounterSale(
  orderId: string,
  input: CreateCounterSaleInput,
): Promise<CounterSaleResult> {
  requireSupabaseConfigured('actualizar una venta de mostrador');

  const supabase = getSupabaseBrowserClient();
  const { data: currentOrder, error: orderReadError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('source', 'admin')
    .like('notes', `${COUNTER_NOTE_PREFIX}%`)
    .single();

  if (orderReadError) throw new Error(orderReadError.message);
  if (currentOrder.status === 'cancelado') throw new Error('Las ventas canceladas no pueden editarse.');

  const { data: currentItems, error: itemsReadError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsReadError) throw new Error(itemsReadError.message);

  const existingProductIds = new Set(
    (currentItems ?? []).map((item) => item.product_id).filter((id): id is string => Boolean(id)),
  );
  const existingPrices = new Map(
    (currentItems ?? [])
      .filter((item): item is typeof item & { product_id: string } => Boolean(item.product_id))
      .map((item) => [item.product_id, Number(item.unit_price)]),
  );

  const [{ subtotal, itemRows }, customer] = await Promise.all([
    prepareSaleItems(input, existingPrices, existingProductIds),
    resolveCustomer(input.customerName, input.customerPhone),
  ]);

  const { data: insertedItems, error: newItemsError } = await supabase
    .from('order_items')
    .insert(itemRows.map((row) => ({ ...row, order_id: orderId })))
    .select('id');

  if (newItemsError) throw new Error(newItemsError.message);

  const insertedIds = (insertedItems ?? []).map((item) => item.id);
  const oldIds = (currentItems ?? []).map((item) => item.id);

  if (oldIds.length) {
    const { error: deleteOldError } = await supabase
      .from('order_items')
      .delete()
      .in('id', oldIds);

    if (deleteOldError) {
      if (insertedIds.length) await supabase.from('order_items').delete().in('id', insertedIds);
      throw new Error(deleteOldError.message);
    }
  }

  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update({
      customer_id: customer.customerId,
      customer_name: customer.customerName,
      customer_phone: customer.customerPhone,
      payment_method: input.paymentMethod,
      subtotal,
      notes: buildCounterNotes(input.serviceMode, input.notes),
    })
    .eq('id', orderId)
    .select('id,order_code,total')
    .single();

  if (updateError) {
    if (insertedIds.length) await supabase.from('order_items').delete().in('id', insertedIds);
    if (currentItems?.length) {
      await supabase.from('order_items').insert(currentItems.map(rollbackItemRow));
    }
    throw new Error(updateError.message);
  }

  return {
    orderId: updatedOrder.id,
    orderCode: updatedOrder.order_code,
    total: Number(updatedOrder.total),
  };
}

export async function cancelCounterSale(orderId: string) {
  requireSupabaseConfigured('cancelar una venta de mostrador');

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelado' })
    .eq('id', orderId)
    .eq('source', 'admin')
    .like('notes', `${COUNTER_NOTE_PREFIX}%`)
    .neq('status', 'cancelado')
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('La venta no existe o ya fue cancelada.');
}
