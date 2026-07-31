import { BUSINESS_CONFIG_DEFAULTS } from '../constants/configuracion.defaults';
import type { BusinessConfig, PaymentMethod } from '../types/configuracion.types';
import { isSupabaseConfigured, requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import { createSharedRealtimeSubscription } from '@/lib/supabase/realtime-subscription';

type ConfigRow = Database['public']['Tables']['business_config']['Row'];
type PaymentRow = Database['public']['Tables']['payment_methods']['Row'];

const BUSINESS_ASSETS_BUCKET = 'business-assets';

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'image/png';
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

async function uploadBusinessLogo(dataUrl: string) {
  const supabase = getSupabaseBrowserClient();
  const blob = dataUrlToBlob(dataUrl);
  const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  const path = `logos/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUSINESS_ASSETS_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });

  if (error) throw new Error(`No se pudo subir el logo: ${error.message}`);

  const { data } = supabase.storage.from(BUSINESS_ASSETS_BUCKET).getPublicUrl(path);
  return { logoUrl: data.publicUrl, logoPath: path };
}

async function removeStoredBusinessLogo(path?: string | null) {
  if (!path) return;
  const { error } = await getSupabaseBrowserClient()
    .storage
    .from(BUSINESS_ASSETS_BUCKET)
    .remove([path]);

  if (error) {
    console.warn(`No se pudo eliminar el logo anterior: ${error.message}`);
  }
}

function normalizeBusinessConfig(config: Partial<BusinessConfig>): BusinessConfig {
  return {
    ...BUSINESS_CONFIG_DEFAULTS,
    ...config,
    logoUrl: config.logoUrl ?? BUSINESS_CONFIG_DEFAULTS.logoUrl,
    logoPath: config.logoPath ?? BUSINESS_CONFIG_DEFAULTS.logoPath,
    heroDescription: config.heroDescription ?? BUSINESS_CONFIG_DEFAULTS.heroDescription,
    transferAlias: config.transferAlias ?? BUSINESS_CONFIG_DEFAULTS.transferAlias,
    transferCvu: config.transferCvu ?? BUSINESS_CONFIG_DEFAULTS.transferCvu,
    specialty: config.specialty ?? BUSINESS_CONFIG_DEFAULTS.specialty,
    autoScheduleEnabled: config.autoScheduleEnabled ?? BUSINESS_CONFIG_DEFAULTS.autoScheduleEnabled,
    autoOpenTime: config.autoOpenTime ?? BUSINESS_CONFIG_DEFAULTS.autoOpenTime,
    autoCloseTime: config.autoCloseTime ?? BUSINESS_CONFIG_DEFAULTS.autoCloseTime,
    storeLatitude: config.storeLatitude ?? BUSINESS_CONFIG_DEFAULTS.storeLatitude,
    storeLongitude: config.storeLongitude ?? BUSINESS_CONFIG_DEFAULTS.storeLongitude,
    deliveryBaseFee: config.deliveryBaseFee ?? BUSINESS_CONFIG_DEFAULTS.deliveryBaseFee,
    deliveryPricePerKm: config.deliveryPricePerKm ?? BUSINESS_CONFIG_DEFAULTS.deliveryPricePerKm,
    deliveryMaxDistanceKm: config.deliveryMaxDistanceKm ?? BUSINESS_CONFIG_DEFAULTS.deliveryMaxDistanceKm,
    deliveryRoundingValue: config.deliveryRoundingValue ?? BUSINESS_CONFIG_DEFAULTS.deliveryRoundingValue,
    paymentMethods: config.paymentMethods ?? BUSINESS_CONFIG_DEFAULTS.paymentMethods,
  };
}

function mapPayment(row: PaymentRow): PaymentMethod {
  return {
    id: row.id,
    name: row.name,
    type: row.code,
    active: row.active,
  };
}

function mapConfig(row: ConfigRow, paymentMethods: PaymentMethod[]): BusinessConfig {
  return normalizeBusinessConfig({
    businessName: row.business_name,
    logoUrl: row.logo_url,
    logoPath: row.logo_path,
    heroDescription: row.hero_description,
    whatsappNumber: row.whatsapp_number,
    transferAlias: row.transfer_alias,
    transferCvu: row.transfer_cvu,
    address: row.address,
    specialty: row.specialty,
    isOpen: row.is_open,
    autoScheduleEnabled: row.auto_schedule_enabled,
    autoOpenTime: row.auto_open_time.slice(0, 5),
    autoCloseTime: row.auto_close_time.slice(0, 5),
    storeLatitude: row.store_latitude ?? undefined,
    storeLongitude: row.store_longitude ?? undefined,
    deliveryBaseFee: Number(row.delivery_base_fee),
    deliveryPricePerKm: Number(row.delivery_price_per_km),
    deliveryMaxDistanceKm: Number(row.delivery_max_distance_km),
    deliveryRoundingValue: Number(row.delivery_rounding_value),
    paymentMethods,
  });
}

export async function getBusinessConfig(): Promise<BusinessConfig> {
  requireSupabaseConfigured('consultar la configuración del negocio');

  const supabase = getSupabaseBrowserClient();
  const [
    { data: config, error: configError },
    { data: methods, error: methodsError },
  ] = await Promise.all([
    supabase.from('business_config').select('*').eq('id', 1).single(),
    supabase.from('payment_methods').select('*').order('display_order'),
  ]);

  const error = configError ?? methodsError;
  if (error) throw new Error(error.message);

  return mapConfig(
    config as ConfigRow,
    ((methods ?? []) as PaymentRow[]).map(mapPayment),
  );
}

export async function updateBusinessConfig(input: Partial<BusinessConfig>): Promise<BusinessConfig> {
  requireSupabaseConfigured('actualizar la configuración del negocio');

  const supabase = getSupabaseBrowserClient();
  const { data: currentConfig, error: currentError } = await supabase
    .from('business_config')
    .select('logo_url,logo_path')
    .eq('id', 1)
    .single();

  if (currentError) throw new Error(currentError.message);

  let uploadedLogoPath: string | null = null;
  let nextLogoUrl: string | undefined;
  let nextLogoPath: string | null | undefined;

  if (input.logoUrl !== undefined) {
    if (input.logoUrl.startsWith('data:image/')) {
      const uploaded = await uploadBusinessLogo(input.logoUrl);
      uploadedLogoPath = uploaded.logoPath;
      nextLogoUrl = uploaded.logoUrl;
      nextLogoPath = uploaded.logoPath;
    } else if (!input.logoUrl.trim()) {
      nextLogoUrl = '';
      nextLogoPath = null;
    } else {
      nextLogoUrl = input.logoUrl;
      nextLogoPath = input.logoPath ?? null;
    }
  }

  const payload = {
    ...(input.businessName !== undefined ? { business_name: input.businessName } : {}),
    ...(nextLogoUrl !== undefined ? { logo_url: nextLogoUrl, logo_path: nextLogoPath ?? null } : {}),
    ...(input.heroDescription !== undefined ? { hero_description: input.heroDescription } : {}),
    ...(input.whatsappNumber !== undefined ? { whatsapp_number: input.whatsappNumber } : {}),
    ...(input.transferAlias !== undefined ? { transfer_alias: input.transferAlias } : {}),
    ...(input.transferCvu !== undefined ? { transfer_cvu: input.transferCvu } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.specialty !== undefined ? { specialty: input.specialty } : {}),
    ...(input.isOpen !== undefined ? { is_open: input.isOpen } : {}),
    ...(input.autoScheduleEnabled !== undefined
      ? { auto_schedule_enabled: input.autoScheduleEnabled }
      : {}),
    ...(input.autoOpenTime !== undefined ? { auto_open_time: input.autoOpenTime } : {}),
    ...(input.autoCloseTime !== undefined ? { auto_close_time: input.autoCloseTime } : {}),
    ...(input.storeLatitude !== undefined
      ? { store_latitude: input.storeLatitude ?? null }
      : {}),
    ...(input.storeLongitude !== undefined
      ? { store_longitude: input.storeLongitude ?? null }
      : {}),
    ...(input.deliveryBaseFee !== undefined
      ? { delivery_base_fee: input.deliveryBaseFee }
      : {}),
    ...(input.deliveryPricePerKm !== undefined
      ? { delivery_price_per_km: input.deliveryPricePerKm }
      : {}),
    ...(input.deliveryMaxDistanceKm !== undefined
      ? { delivery_max_distance_km: input.deliveryMaxDistanceKm }
      : {}),
    ...(input.deliveryRoundingValue !== undefined
      ? { delivery_rounding_value: input.deliveryRoundingValue }
      : {}),
  };

  const { error } = await supabase
    .from('business_config')
    .update(payload)
    .eq('id', 1);

  if (error) {
    if (uploadedLogoPath) await removeStoredBusinessLogo(uploadedLogoPath);
    throw new Error(error.message);
  }

  if (
    input.logoUrl !== undefined &&
    currentConfig.logo_path &&
    currentConfig.logo_path !== nextLogoPath
  ) {
    await removeStoredBusinessLogo(currentConfig.logo_path);
  }

  if (input.paymentMethods) {
    const { error: methodsError } = await supabase
      .from('payment_methods')
      .upsert(
        input.paymentMethods.map((method, index) => ({
          ...(method.id && !method.id.startsWith('pay-') ? { id: method.id } : {}),
          name: method.name,
          code: method.type,
          active: method.active,
          display_order: index,
        })),
        { onConflict: 'code' },
      );

    if (methodsError) throw new Error(methodsError.message);
  }

  return getBusinessConfig();
}

const subscribeBusinessConfigRealtime = createSharedRealtimeSubscription(
  'business-config',
  (channel, notifyListeners) =>
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_config' },
        notifyListeners,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_methods' },
        notifyListeners,
      ),
);

export function subscribeToBusinessConfig(onChange: () => void) {
  if (!isSupabaseConfigured()) return () => undefined;
  return subscribeBusinessConfigRealtime(onChange);
}
