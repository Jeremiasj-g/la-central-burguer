'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Clock3, ImageUp, MapPin, Navigation, Pencil, Save, Trash2, Store, Truck, MessageCircle, CreditCard, Instagram, CheckCircle2 } from 'lucide-react';
import { useBusinessConfig } from '../hooks/useBusinessConfig';
import type { BusinessConfig } from '../types/configuracion.types';
import { getBusinessStatusLabel, isBusinessOpenBySchedule } from '../utils/businessStatus.utils';
import { Button } from '@/shared/components/ui/Button';
import { Card } from '@/shared/components/ui/Card';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Input } from '@/shared/components/ui/Input';
import { Textarea } from '@/shared/components/ui/Textarea';
import { formatCurrency } from '@/shared/utils/format.utils';
import { useCurrentLocation } from '@/features/delivery/hooks/useCurrentLocation';
import { buildGoogleMapsUrl } from '@/features/delivery/utils/delivery.utils';
import { cn } from '@/shared/utils/cn';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';
import { BusinessLogo } from '../components/BusinessLogo';
import { toast } from 'react-toastify';

const adminInputClass = 'min-w-0 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !px-3 !pr-10 !text-[13px] !font-normal !text-neutral-800 !shadow-none !placeholder:text-neutral-400 transition-all duration-200 hover:!border-neutral-300 focus:!border-central-orange/40 focus:!bg-white focus:!ring-2 focus:!ring-central-orange/10';
const labelClass = 'mb-1.5 block text-[11px] font-medium text-neutral-500';
const panelClass = 'min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.035)] sm:p-6';
const sectionTitleClass = 'text-[16px] font-semibold tracking-[-.02em] text-neutral-900';
const actionClass = '!h-9 !rounded-[11px] !px-3 !text-[12px] !font-medium !shadow-none';

function EditableControl({ children, multiline = false }: { children: ReactNode; multiline?: boolean }) {
  return (
    <div className="group relative">
      {children}
      <Pencil
        aria-hidden="true"
        size={15}
        className={cn(
          'pointer-events-none absolute right-3 text-neutral-400/70 transition-colors duration-200 group-focus-within:text-central-orange',
          multiline ? 'top-3.5' : 'top-1/2 -translate-y-1/2',
        )}
      />
    </div>
  );
}

type ConfigFormValues = Pick<
  BusinessConfig,
  | 'businessName'
  | 'logoUrl'
  | 'logoPath'
  | 'heroDescription'
  | 'whatsappNumber'
  | 'facebookUrl'
  | 'instagramUrl'
  | 'whatsappUrl'
  | 'transferAlias'
  | 'transferCvu'
  | 'address'
  | 'specialty'
  | 'storeLatitude'
  | 'storeLongitude'
  | 'deliveryBaseFee'
  | 'deliveryPricePerKm'
  | 'deliveryMaxDistanceKm'
  | 'deliveryRoundingValue'
  | 'isOpen'
  | 'autoScheduleEnabled'
  | 'autoOpenTime'
  | 'autoCloseTime'
  | 'paymentMethods'
>;

export function ConfiguracionAdminPage() {
  const { config, isLoading, error, refresh, update } = useBusinessConfig();
  const { isLoading: isGettingLocation, requestLocation } = useCurrentLocation();
  const [values, setValues] = useState<ConfigFormValues | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add('config-wallet-active');
    return () => document.body.classList.remove('config-wallet-active');
  }, []);

  useEffect(() => {
    if (!config) return;
    setValues({
      businessName: config.businessName,
      logoUrl: config.logoUrl,
      logoPath: config.logoPath,
      heroDescription: config.heroDescription,
      whatsappNumber: config.whatsappNumber,
      facebookUrl: config.facebookUrl,
      instagramUrl: config.instagramUrl,
      whatsappUrl: config.whatsappUrl,
      transferAlias: config.transferAlias,
      transferCvu: config.transferCvu,
      address: config.address,
      specialty: config.specialty,
      storeLatitude: config.storeLatitude,
      storeLongitude: config.storeLongitude,
      deliveryBaseFee: config.deliveryBaseFee,
      deliveryPricePerKm: config.deliveryPricePerKm,
      deliveryMaxDistanceKm: config.deliveryMaxDistanceKm,
      deliveryRoundingValue: config.deliveryRoundingValue,
      isOpen: config.isOpen,
      autoScheduleEnabled: config.autoScheduleEnabled,
      autoOpenTime: config.autoOpenTime,
      autoCloseTime: config.autoCloseTime,
      paymentMethods: config.paymentMethods,
    });
  }, [config]);

  const previewConfig = useMemo(() => (config && values ? { ...config, ...values } : config), [config, values]);
  const effectiveOpen = useMemo(() => (previewConfig ? isBusinessOpenBySchedule(previewConfig) : false), [previewConfig]);

  async function saveConfig() {
    if (!values) return;
    setIsSaving(true);
    try {
      await update(values);
      setConfirmSaveOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function setStoreCurrentLocation() {
    if (!values) return;
    const location = await requestLocation();
    if (!location) return;
    setValues({ ...values, storeLatitude: location.lat, storeLongitude: location.lng });
  }

  function handleLogoFile(file?: File) {
    if (!file || !values) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('El logo debe ser PNG, JPG o WEBP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('El logo no puede superar los 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setValues((current) => current ? { ...current, logoUrl: reader.result as string } : current);
    };
    reader.onerror = () => toast.error('No se pudo leer el archivo seleccionado.');
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    if (!values) return;
    setValues({ ...values, logoUrl: '', logoPath: null });
  }

  async function toggleManualStatus() {
    if (!values || values.autoScheduleEnabled) return;
    const next = { ...values, isOpen: !values.isOpen };
    setValues(next);
    await update({ isOpen: next.isOpen });
    setConfirmStatusOpen(false);
  }

  if (error) return <DataLoadError message={error} onRetry={refresh} />;
  if (isLoading || !config || !values) return (
    <div className="config-wallet min-w-0 animate-pulse pb-8" role="status" aria-label="Cargando configuración">
      <div className="mb-6 h-9 w-72 max-w-full rounded-[12px] bg-neutral-200" />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-[18px] border border-neutral-200/70 bg-white" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(290px,360px)]">
        <div className="h-[440px] rounded-[20px] border border-neutral-200/70 bg-white" />
        <div className="h-72 rounded-[20px] border border-neutral-200/70 bg-white" />
      </div>
      <span className="sr-only">Cargando configuración del negocio…</span>
    </div>
  );

  return (
    <div className="config-wallet min-w-0 pb-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.045em] text-neutral-950 sm:text-[34px]">Configuración del negocio</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-neutral-500">Administrá la identidad, los horarios, los cobros y el delivery de La Central.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <Button type="button" size="sm" variant="secondary" className={actionClass} title="Cambiar estado manualmente" disabled={values.autoScheduleEnabled} onClick={() => setConfirmStatusOpen(true)}>
            {values.isOpen ? 'Cerrar local' : 'Abrir local'}
          </Button>
          <Button type="button" size="sm" className={actionClass} title="Guardar configuración" onClick={() => setConfirmSaveOpen(true)} disabled={isSaving}>
            <Save size={14} /> {isSaving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-[18px] border border-neutral-200/70 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,.03)]">
          <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-500"><Store size={14} className="text-neutral-400" /> Identidad</div>
          <p className="mt-2 truncate text-[19px] font-semibold tracking-tight text-neutral-900" title={values.businessName}>{values.businessName}</p>
          <p className="mt-1 text-[11px] text-neutral-400">Nombre público del local</p>
        </div>
        <div className="min-w-0 rounded-[18px] border border-neutral-200/70 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,.03)]">
          <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-500"><MessageCircle size={14} className="text-neutral-400" /> Contacto</div>
          <p className="mt-2 truncate text-[19px] font-semibold tracking-tight text-neutral-900" title={values.whatsappNumber}>{values.whatsappNumber || 'Sin número'}</p>
          <p className="mt-1 text-[11px] text-neutral-400">WhatsApp de pedidos</p>
        </div>
        <div className="min-w-0 rounded-[18px] border border-neutral-200/70 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,.03)]">
          <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-500"><Truck size={14} className="text-neutral-400" /> Tarifa de envío</div>
          <p className="mt-2 text-[19px] font-semibold tracking-tight text-neutral-900">{formatCurrency(values.deliveryBaseFee)}</p>
          <p className="mt-1 truncate text-[11px] text-neutral-400">+ {formatCurrency(values.deliveryPricePerKm)} por km</p>
        </div>
        <div className="min-w-0 rounded-[18px] border border-neutral-200/70 bg-[#fcfbf8] p-4 shadow-[0_8px_22px_rgba(15,23,42,.03)]">
          <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-500"><Clock3 size={14} className="text-neutral-400" /> Estado del local</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', effectiveOpen ? 'bg-emerald-500' : 'bg-rose-400')} aria-hidden="true" />
            <p className={cn('min-w-0 truncate text-[19px] font-semibold tracking-tight', effectiveOpen ? 'text-emerald-700' : 'text-neutral-900')}>{getBusinessStatusLabel(previewConfig!)}</p>
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">{values.autoScheduleEnabled ? 'Según horario automático' : 'Control manual'}</p>
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(290px,360px)]">
        <section className={panelClass}>
          <div className="mb-5"><h2 className={sectionTitleClass}>Identidad del negocio</h2><p className="mt-1 text-[12px] text-neutral-500">Los datos que se muestran a tus clientes en la web y el checkout.</p></div>

          <div className="rounded-[15px] border border-neutral-200/70 bg-[#f8f8fa] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid h-32 w-full shrink-0 place-items-center overflow-hidden rounded-[13px] border border-neutral-200 bg-[#11100f] p-3 sm:w-40">
                {values.logoUrl ? (
                  <BusinessLogo logoUrl={values.logoUrl} businessName={values.businessName} mode="admin" className="max-h-full max-w-full" />
                ) : (
                  <div className="brand-stamp h-24 w-24">
                    <BusinessLogo businessName={values.businessName} mode="stamp" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <label className="block text-[13px] font-semibold text-neutral-800">Logo del negocio</label>
                <p className="mt-1 text-[11px] leading-5 text-neutral-500">Se muestra en el hero, el navbar, el footer y el panel administrador. Recomendado: imagen cuadrada PNG o WEBP con fondo transparente, máximo 2 MB.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[11px] bg-central-orange px-3 py-2 text-[12px] font-semibold text-white transition-colors duration-200 hover:bg-central-ember focus-within:ring-2 focus-within:ring-central-orange/30">
                    <ImageUp size={16} /> {values.logoUrl ? 'Cambiar logo' : 'Subir logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        handleLogoFile(event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {values.logoUrl ? (
                    <Button type="button" variant="secondary" size="sm" className={actionClass} title="Quitar logo personalizado" onClick={removeLogo}>
                      <Trash2 size={16} /> Quitar logo
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Nombre del negocio</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.businessName} onChange={(event) => setValues({ ...values, businessName: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className={labelClass}>Número de WhatsApp</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.whatsappNumber} onChange={(event) => setValues({ ...values, whatsappNumber: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className={labelClass}>Alias de transferencia</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.transferAlias} onChange={(event) => setValues({ ...values, transferAlias: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className={labelClass}>CVU / CBU</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.transferCvu} onChange={(event) => setValues({ ...values, transferCvu: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className={labelClass}>Dirección</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.address} onChange={(event) => setValues({ ...values, address: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className={labelClass}>Especialidad</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.specialty} onChange={(event) => setValues({ ...values, specialty: event.target.value })} />
              </EditableControl>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Descripción del hero</label>
              <EditableControl multiline>
                <Textarea className={`${adminInputClass} min-h-28 py-3`} value={values.heroDescription} onChange={(event) => setValues({ ...values, heroDescription: event.target.value })} />
              </EditableControl>
            </div>
          </div>

          <div className="mt-7 border-t border-neutral-100 pt-6">
            <div>
              <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-neutral-900"><Instagram size={16} className="text-central-orange" /> Redes sociales</h3>
              <p className="mt-1 text-[12px] leading-5 text-neutral-500">Configurá las URLs a las que redirigen los íconos del pie de página. Podés pegar la URL completa o escribirla sin https://.</p>
            </div>

            <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Facebook</label>
                <EditableControl>
                  <Input className={adminInputClass} value={values.facebookUrl} onChange={(event) => setValues({ ...values, facebookUrl: event.target.value })} placeholder="facebook.com/tu-pagina" />
                </EditableControl>
              </div>
              <div>
                <label className={labelClass}>Instagram</label>
                <EditableControl>
                  <Input className={adminInputClass} value={values.instagramUrl} onChange={(event) => setValues({ ...values, instagramUrl: event.target.value })} placeholder="instagram.com/tu-cuenta" />
                </EditableControl>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>WhatsApp</label>
                <EditableControl>
                  <Input className={adminInputClass} value={values.whatsappUrl} onChange={(event) => setValues({ ...values, whatsappUrl: event.target.value })} placeholder="wa.me/54379..." />
                </EditableControl>
                <p className="mt-1.5 text-xs text-neutral-500">Si lo dejás vacío, el footer utilizará automáticamente el número de WhatsApp configurado arriba.</p>
              </div>
            </div>
          </div>

          <div className="mt-7 border-t border-neutral-100 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-neutral-900"><Truck size={16} className="text-central-orange" /> Delivery y ubicación</h3>
                <p className="mt-1 text-[12px] leading-5 text-neutral-500">Esta ubicación se usa para estimar el envío por distancia aproximada.</p>
              </div>
              <Button type="button" variant="secondary" size="sm" className={actionClass} title="Usar la ubicación actual como ubicación del local" onClick={setStoreCurrentLocation} disabled={isGettingLocation}>
                <Navigation size={16} /> {isGettingLocation ? 'Buscando...' : 'Usar ubicación actual'}
              </Button>
            </div>

            <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Latitud del local</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" step="any" value={values.storeLatitude ?? ''} onChange={(event) => setValues({ ...values, storeLatitude: event.target.value === '' ? undefined : Number(event.target.value) })} />
                </EditableControl>
              </div>
              <div>
                <label className={labelClass}>Longitud del local</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" step="any" value={values.storeLongitude ?? ''} onChange={(event) => setValues({ ...values, storeLongitude: event.target.value === '' ? undefined : Number(event.target.value) })} />
                </EditableControl>
              </div>
              <div>
                <label className={labelClass}>Precio base de envío</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" min={0} value={values.deliveryBaseFee} onChange={(event) => setValues({ ...values, deliveryBaseFee: Number(event.target.value) })} />
                </EditableControl>
              </div>
              <div>
                <label className={labelClass}>Precio por kilómetro</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" min={0} value={values.deliveryPricePerKm} onChange={(event) => setValues({ ...values, deliveryPricePerKm: Number(event.target.value) })} />
                </EditableControl>
              </div>
              <div>
                <label className={labelClass}>Radio máximo de entrega (km)</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" min={0} step="0.5" value={values.deliveryMaxDistanceKm} onChange={(event) => setValues({ ...values, deliveryMaxDistanceKm: Number(event.target.value) })} />
                </EditableControl>
              </div>
              <div>
                <label className={labelClass}>Redondeo del envío</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" min={1} value={values.deliveryRoundingValue} onChange={(event) => setValues({ ...values, deliveryRoundingValue: Number(event.target.value) })} />
                </EditableControl>
              </div>
            </div>

            {typeof values.storeLatitude === 'number' && typeof values.storeLongitude === 'number' ? (
              <div className="mt-4 space-y-3">
                <a className="inline-flex items-center gap-2 rounded-[11px] border border-neutral-200 bg-[#f8f8fa] px-3 py-2 text-[12px] font-medium text-neutral-700 transition-colors duration-200 hover:border-central-orange/40 hover:text-central-orange" href={buildGoogleMapsUrl({ lat: values.storeLatitude, lng: values.storeLongitude })} target="_blank" rel="noreferrer">
                  <MapPin size={16} /> Ver ubicación del local en Google Maps
                </a>

                <div className="w-full overflow-hidden rounded-[15px] border border-neutral-200/70 bg-neutral-100">
                  <iframe
                    title={`Ubicación de ${values.businessName} en Google Maps`}
                    src={`https://www.google.com/maps?q=${values.storeLatitude},${values.storeLongitude}&z=16&output=embed`}
                    className="block h-[320px] w-full border-0 sm:h-[380px] lg:h-[420px]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className={cn(panelClass, 'xl:sticky xl:top-6')}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-central-orange/10 text-central-orange"><Clock3 size={18} /></span>
            <div>
              <h2 className={sectionTitleClass}>Apertura automática</h2>
              <p className="text-[12px] text-neutral-500">Activá horarios para abrir/cerrar el local solo.</p>
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-center justify-between gap-3 rounded-[13px] border border-neutral-200/70 bg-[#f8f8fa] p-3.5">
            <span className="min-w-0 text-[12px] font-medium leading-5 text-neutral-700">Apertura y cierre automáticos</span>
            <input type="checkbox" className="peer sr-only" checked={values.autoScheduleEnabled} onChange={(event) => setValues({ ...values, autoScheduleEnabled: event.target.checked })} />
            <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-neutral-300 transition-colors duration-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 peer-checked:bg-central-orange peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-central-orange/30" />
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Hora de apertura</label>
              <EditableControl>
                <Input className={`${adminInputClass} admin-time-input`} type="time" value={values.autoOpenTime} onChange={(event) => setValues({ ...values, autoOpenTime: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className={labelClass}>Hora de cierre</label>
              <EditableControl>
                <Input className={`${adminInputClass} admin-time-input`} type="time" value={values.autoCloseTime} onChange={(event) => setValues({ ...values, autoCloseTime: event.target.value })} />
              </EditableControl>
            </div>
          </div>

          <p className="mt-4 rounded-[13px] border border-neutral-200/70 bg-[#f8f8fa] p-3 text-[12px] leading-5 text-neutral-600">
            Con la configuración actual, el sitio muestra el local como <strong className={effectiveOpen ? 'text-emerald-700' : 'text-red-700'}>{effectiveOpen ? 'abierto' : 'cerrado'}</strong>.
          </p>
        </section>
      </div>

      <section className={cn(panelClass, 'mt-4')}>
        <div>
          <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight text-neutral-900"><CreditCard size={17} className="text-central-orange" /> Métodos de pago</h2>
          <p className="mt-1 text-[12px] leading-5 text-neutral-500">Definí cuáles opciones aparecen en el checkout. El alias y el CVU se usan cuando el cliente elige transferencia.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {values.paymentMethods.map((method, index) => (
            <div key={method.id} className="grid min-w-0 items-center gap-3 rounded-[15px] border border-neutral-200/70 bg-[#f8f8fa] p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[.08em] text-neutral-400">{method.type}</label>
                <EditableControl>
                  <Input
                    className={adminInputClass}
                    value={method.name}
                    onChange={(event) => setValues({
                      ...values,
                      paymentMethods: values.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item),
                    })}
                  />
                </EditableControl>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-3 self-end pb-1 text-[12px] font-medium text-neutral-600">
                <span>Activo</span>
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={method.active}
                  onChange={(event) => setValues({
                    ...values,
                    paymentMethods: values.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, active: event.target.checked } : item),
                  })}
                />
                <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-neutral-300 transition-colors duration-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 peer-checked:bg-central-orange peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-central-orange/30" />
              </label>
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={confirmSaveOpen}
        title="Guardar configuración"
        description="¿Seguro que querés guardar estos cambios? Se van a reflejar en el sitio público y en el checkout."
        confirmLabel="Guardar cambios"
        isLoading={isSaving}
        onCancel={() => setConfirmSaveOpen(false)}
        onConfirm={saveConfig}
      />
      <ConfirmDialog
        open={confirmStatusOpen}
        title={values.isOpen ? 'Cerrar local' : 'Abrir local'}
        description={values.isOpen ? '¿Seguro que querés marcar el local como cerrado? Los clientes no podrán agregar productos al pedido.' : '¿Seguro que querés marcar el local como abierto? Los clientes podrán cargar pedidos.'}
        confirmLabel={values.isOpen ? 'Cerrar local' : 'Abrir local'}
        tone={values.isOpen ? 'danger' : 'default'}
        onCancel={() => setConfirmStatusOpen(false)}
        onConfirm={toggleManualStatus}
      />
    </div>
  );
}