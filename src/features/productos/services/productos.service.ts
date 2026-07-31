import type {
  CreateProductInput,
  Product,
  ProductFilters,
  ProductRow,
  UpdateProductInput,
} from '../types/producto.types';
import { mapProductRowToProduct } from '../mappers/producto.mapper';
import { isSupabaseConfigured, requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { createSharedRealtimeSubscription } from '@/lib/supabase/realtime-subscription';

const PRODUCT_IMAGE_BUCKET = 'product-images';

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'image/jpeg';
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

async function persistProductImage(
  imageUrl: string,
  productSlug: string,
): Promise<{ imageUrl: string; imagePath: string | null }> {
  if (!imageUrl.startsWith('data:image/')) {
    return { imageUrl, imagePath: null };
  }

  const supabase = getSupabaseBrowserClient();
  const blob = dataUrlToBlob(imageUrl);
  const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `${productSlug}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });

  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return { imageUrl: data.publicUrl, imagePath: path };
}

async function removeStoredProductImage(imagePath?: string | null) {
  if (!imagePath) return;

  const { error } = await getSupabaseBrowserClient()
    .storage
    .from(PRODUCT_IMAGE_BUCKET)
    .remove([imagePath]);

  if (error) {
    console.warn(`No se pudo limpiar la imagen anterior del producto: ${error.message}`);
  }
}

async function getProductRowById(id: string): Promise<ProductRow | null> {
  const { data, error } = await getSupabaseBrowserClient()
    .from('products')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ProductRow | null;
}

async function getIngredientMap(productIds: string[]) {
  if (!productIds.length) return new Map<string, string[]>();

  const { data, error } = await getSupabaseBrowserClient()
    .from('product_ingredients')
    .select('product_id,ingredient_id')
    .in('product_id', productIds);

  if (error) throw new Error(error.message);

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    map.set(row.product_id, [...(map.get(row.product_id) ?? []), row.ingredient_id]);
  }
  return map;
}

export async function getProductos(filters: ProductFilters = {}): Promise<Product[]> {
  requireSupabaseConfigured('consultar los productos');

  let query = getSupabaseBrowserClient()
    .from('products')
    .select('*')
    .is('deleted_at', null)
    .order('display_order')
    .order('name');

  if (filters.categoryId && filters.categoryId !== 'all') {
    query = query.eq('category_id', filters.categoryId);
  }
  if (filters.active === 'active') query = query.eq('active', true);
  if (filters.active === 'inactive') query = query.eq('active', false);
  if (!filters.active) query = query.eq('active', true);
  if (filters.available === 'available') query = query.eq('available', true);
  if (filters.available === 'unavailable') query = query.eq('available', false);
  if (filters.featured) query = query.eq('featured', true);
  if (filters.search?.trim()) {
    const search = filters.search.trim();
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ProductRow[];
  const ingredientMap = await getIngredientMap(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...mapProductRowToProduct(row),
    ingredientIds: ingredientMap.get(row.id) ?? [],
  }));
}

export async function getProductoById(id: string): Promise<Product | null> {
  requireSupabaseConfigured('consultar el producto');

  const row = await getProductRowById(id);
  if (!row) return null;

  const map = await getIngredientMap([id]);
  return {
    ...mapProductRowToProduct(row),
    ingredientIds: map.get(id) ?? [],
  };
}

async function syncProductIngredients(productId: string, ingredientIds: string[]) {
  const { error } = await getSupabaseBrowserClient().rpc('sync_product_ingredients', {
    target_product_id: productId,
    ingredient_rows: ingredientIds.map((ingredientId, index) => ({
      ingredientId,
      quantity: null,
      unit: null,
      displayOrder: index,
    })),
  });

  if (error) throw new Error(error.message);
}

export async function createProducto(input: CreateProductInput): Promise<Product> {
  requireSupabaseConfigured('crear productos');

  const slug = slugify(input.name);
  const image = await persistProductImage(
    input.imageUrl || '/images/productos/burger-simple.svg',
    slug,
  );

  const { data, error } = await getSupabaseBrowserClient()
    .from('products')
    .insert({
      category_id: input.categoryId,
      name: input.name,
      description: input.description,
      image_url: image.imageUrl,
      image_path: image.imagePath,
      current_price: input.currentPrice,
      active: input.active ?? true,
      available: input.available ?? true,
      featured: input.featured ?? false,
      is_promotion: input.isPromotion ?? false,
    })
    .select('*')
    .single();

  if (error) {
    await removeStoredProductImage(image.imagePath);
    throw new Error(error.message);
  }

  try {
    await syncProductIngredients(data.id, input.ingredientIds ?? []);
  } catch (syncError) {
    await getSupabaseBrowserClient().from('products').delete().eq('id', data.id);
    await removeStoredProductImage(image.imagePath);
    throw syncError;
  }

  return {
    ...mapProductRowToProduct(data as ProductRow),
    ingredientIds: input.ingredientIds ?? [],
  };
}

export async function updateProducto(input: UpdateProductInput): Promise<Product> {
  requireSupabaseConfigured('editar productos');

  const currentRow = await getProductRowById(input.id);
  if (!currentRow) throw new Error('Producto no encontrado');

  const current = mapProductRowToProduct(currentRow);
  const nextSlug = slugify(input.name ?? current.name);
  let imageUrl = input.imageUrl ?? current.imageUrl;
  let imagePath: string | null | undefined;

  if (input.imageUrl?.startsWith('data:image/')) {
    const image = await persistProductImage(input.imageUrl, nextSlug);
    imageUrl = image.imageUrl;
    imagePath = image.imagePath;
  }

  const payload = {
    ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.imageUrl !== undefined
      ? {
          image_url: imageUrl,
          ...(imagePath !== undefined ? { image_path: imagePath } : {}),
        }
      : {}),
    ...(input.currentPrice !== undefined ? { current_price: input.currentPrice } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.available !== undefined ? { available: input.available } : {}),
    ...(input.featured !== undefined ? { featured: input.featured } : {}),
    ...(input.isPromotion !== undefined ? { is_promotion: input.isPromotion } : {}),
  };

  const { data, error } = await getSupabaseBrowserClient()
    .from('products')
    .update(payload)
    .eq('id', input.id)
    .select('*')
    .single();

  if (error) {
    if (imagePath) await removeStoredProductImage(imagePath);
    throw new Error(error.message);
  }

  if (input.ingredientIds !== undefined) {
    await syncProductIngredients(input.id, input.ingredientIds);
  }

  if (imagePath && currentRow.image_path && currentRow.image_path !== imagePath) {
    await removeStoredProductImage(currentRow.image_path);
  }

  return {
    ...mapProductRowToProduct(data as ProductRow),
    ingredientIds: input.ingredientIds ?? current.ingredientIds ?? [],
  };
}

export async function deleteProducto(id: string): Promise<void> {
  requireSupabaseConfigured('eliminar productos');

  const currentRow = await getProductRowById(id);
  const { error } = await getSupabaseBrowserClient()
    .from('products')
    .update({
      deleted_at: new Date().toISOString(),
      active: false,
      available: false,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
  await removeStoredProductImage(currentRow?.image_path);
}

export async function toggleProductoActive(id: string) {
  const product = await getProductoById(id);
  if (!product) throw new Error('Producto no encontrado');
  return updateProducto({ id, active: !product.active });
}

export async function toggleProductoAvailable(id: string) {
  const product = await getProductoById(id);
  if (!product) throw new Error('Producto no encontrado');
  return updateProducto({ id, available: !product.available });
}

export async function toggleProductoFeatured(id: string) {
  const product = await getProductoById(id);
  if (!product) throw new Error('Producto no encontrado');
  return updateProducto({ id, featured: !product.featured });
}

export function updateProductPrice(productId: string, newPrice: number) {
  return updateProducto({ id: productId, currentPrice: newPrice });
}

const subscribeProductsRealtime = createSharedRealtimeSubscription(
  'catalog-products',
  (channel, notifyListeners) =>
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        notifyListeners,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_ingredients' },
        notifyListeners,
      ),
);

export function subscribeToProducts(onChange: () => void) {
  if (!isSupabaseConfigured()) return () => undefined;
  return subscribeProductsRealtime(onChange);
}
