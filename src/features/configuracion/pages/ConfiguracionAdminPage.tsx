'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Clock, ImageUp, MapPin, Navigation, Pencil, Save, Trash2 } from 'lucide-react';
import { useBusinessConfig } from '../hooks/useBusinessConfig';
import type { BusinessConfig } from '../types/configuracion.types';
import { getBusinessStatusLabel, isBusinessOpenBySchedule } from '../utils/businessStatus.utils';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
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

const adminInputClass = '!bg-neutral-50 !text-neutral-600 !placeholder:text-neutral-400 border-neutral-300 pr-10 shadow-[inset_0_1px_2px_rgba(0,0,0,.04)] hover:border-neutral-400 focus:!bg-white focus:!text-central-carbon focus:border-central-orange focus:ring-central-orange/20';

function EditableControl({ children, multiline = false }: { children: ReactNode; multiline?: boolean }) {
  return (
    <div className="group relative">
      {children}
      <Pencil
        aria-hidden="true"
        size={15}
        className={cn(
          'pointer-events-none absolute right-3 text-neutral-400 transition group-focus-within:text-central-orange',
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
    if (!config) return;
    setValues({
      businessName: config.businessName,
      logoUrl: config.logoUrl,
      logoPath: config.logoPath,
      heroDescription: config.heroDescription,
      whatsappNumber: config.whatsappNumber,
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
  if (isLoading || !config || !values) return <div>Cargando configuración...</div>;

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 -mt-4 mb-6 border-b border-neutral-200 bg-[#f6f4ef]/95 px-4 pb-3 pt-4 shadow-[0_8px_24px_rgba(0,0,0,.06)] backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <AdminPageHeader
          className="mb-0"
          eyebrow="Configuración"
          title="Datos del negocio"
          description="Estos datos alimentan el sitio público, el checkout, el delivery y el mensaje de WhatsApp."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" title="Cambiar estado manualmente" disabled={values.autoScheduleEnabled} onClick={() => setConfirmStatusOpen(true)}>
                {values.isOpen ? 'Cerrar local' : 'Abrir local'}
              </Button>
              <Button type="button" title="Guardar configuración" onClick={() => setConfirmSaveOpen(true)} disabled={isSaving}>
                <Save size={17} /> {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          }
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card className="rounded-sm p-5"><p className="text-sm text-neutral-500">Negocio</p><p className="mt-2 text-2xl font-black">{values.businessName}</p></Card>
        <Card className="rounded-sm p-5"><p className="text-sm text-neutral-500">WhatsApp</p><p className="mt-2 text-2xl font-black">{values.whatsappNumber}</p></Card>
        <Card className="rounded-sm p-5"><p className="text-sm text-neutral-500">Alias</p><p className="mt-2 break-all text-xl font-black">{values.transferAlias}</p></Card>
        <Card className="rounded-sm p-5"><p className="text-sm text-neutral-500">CVU / CBU</p><p className="mt-2 break-all text-base font-black">{values.transferCvu}</p></Card>
        <Card className="rounded-sm p-5"><p className="text-sm text-neutral-500">Delivery base</p><p className="mt-2 text-2xl font-black text-central-orange">{formatCurrency(values.deliveryBaseFee)}</p><p className="mt-1 text-xs text-neutral-500">+ {formatCurrency(values.deliveryPricePerKm)} por km</p></Card>
        <Card className="rounded-sm p-5"><p className="text-sm text-neutral-500">Estado actual</p><p className={cn('mt-2 text-2xl font-black', effectiveOpen ? 'text-emerald-700' : 'text-red-700')}>{getBusinessStatusLabel(previewConfig!)}</p></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-sm border border-neutral-200 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-black text-central-carbon">Datos editables</h2>

          <div className="mt-5 rounded-sm border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid h-32 w-full shrink-0 place-items-center overflow-hidden rounded-sm border border-neutral-300 bg-[#11100f] p-3 sm:w-44">
                {values.logoUrl ? (
                  <BusinessLogo logoUrl={values.logoUrl} businessName={values.businessName} mode="admin" className="max-h-full max-w-full" />
                ) : (
                  <div className="brand-stamp h-24 w-24">
                    <BusinessLogo businessName={values.businessName} mode="stamp" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <label className="block text-sm font-bold text-neutral-700">Logo del negocio</label>
                <p className="mt-1 text-xs leading-5 text-neutral-500">Se muestra en el hero, el navbar, el footer y el panel administrador. Recomendado: imagen cuadrada PNG o WEBP con fondo transparente, máximo 2 MB.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm bg-central-orange px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#b66f10]">
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
                    <Button type="button" variant="secondary" size="sm" title="Quitar logo personalizado" onClick={removeLogo}>
                      <Trash2 size={16} /> Quitar logo
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-neutral-700">Nombre del negocio</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.businessName} onChange={(event) => setValues({ ...values, businessName: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-neutral-700">Número de WhatsApp</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.whatsappNumber} onChange={(event) => setValues({ ...values, whatsappNumber: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-neutral-700">Alias de transferencia</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.transferAlias} onChange={(event) => setValues({ ...values, transferAlias: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-neutral-700">CVU / CBU</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.transferCvu} onChange={(event) => setValues({ ...values, transferCvu: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-neutral-700">Dirección</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.address} onChange={(event) => setValues({ ...values, address: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-neutral-700">Especialidad</label>
              <EditableControl>
                <Input className={adminInputClass} value={values.specialty} onChange={(event) => setValues({ ...values, specialty: event.target.value })} />
              </EditableControl>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-neutral-700">Descripción del hero</label>
              <EditableControl multiline>
                <Textarea className={`${adminInputClass} min-h-28 py-3`} value={values.heroDescription} onChange={(event) => setValues({ ...values, heroDescription: event.target.value })} />
              </EditableControl>
            </div>
          </div>

          <div className="mt-7 border-t border-neutral-200 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-central-carbon">Delivery y ubicación del local</h3>
                <p className="mt-1 text-sm text-neutral-500">Esta ubicación se usa para estimar el envío por distancia aproximada.</p>
              </div>
              <Button type="button" variant="secondary" size="sm" title="Usar la ubicación actual como ubicación del local" onClick={setStoreCurrentLocation} disabled={isGettingLocation}>
                <Navigation size={16} /> {isGettingLocation ? 'Buscando...' : 'Usar ubicación actual'}
              </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-neutral-700">Latitud del local</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" step="any" value={values.storeLatitude ?? ''} onChange={(event) => setValues({ ...values, storeLatitude: event.target.value === '' ? undefined : Number(event.target.value) })} />
                </EditableControl>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-neutral-700">Longitud del local</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" step="any" value={values.storeLongitude ?? ''} onChange={(event) => setValues({ ...values, storeLongitude: event.target.value === '' ? undefined : Number(event.target.value) })} />
                </EditableControl>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-neutral-700">Precio base de envío</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" min={0} value={values.deliveryBaseFee} onChange={(event) => setValues({ ...values, deliveryBaseFee: Number(event.target.value) })} />
                </EditableControl>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-neutral-700">Precio por kilómetro</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" min={0} value={values.deliveryPricePerKm} onChange={(event) => setValues({ ...values, deliveryPricePerKm: Number(event.target.value) })} />
                </EditableControl>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-neutral-700">Radio máximo de entrega (km)</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" min={0} step="0.5" value={values.deliveryMaxDistanceKm} onChange={(event) => setValues({ ...values, deliveryMaxDistanceKm: Number(event.target.value) })} />
                </EditableControl>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-neutral-700">Redondeo del envío</label>
                <EditableControl>
                  <Input className={adminInputClass} type="number" min={1} value={values.deliveryRoundingValue} onChange={(event) => setValues({ ...values, deliveryRoundingValue: Number(event.target.value) })} />
                </EditableControl>
              </div>
            </div>

            {typeof values.storeLatitude === 'number' && typeof values.storeLongitude === 'number' ? (
              <a className="mt-4 inline-flex items-center gap-2 rounded-sm border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-bold text-central-carbon hover:border-central-orange hover:text-central-orange" href={buildGoogleMapsUrl({ lat: values.storeLatitude, lng: values.storeLongitude })} target="_blank" rel="noreferrer">
                <MapPin size={16} /> Ver ubicación del local en Google Maps
              </a>
            ) : null}
          </div>
        </section>

        <section className="rounded-sm border border-neutral-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-sm bg-central-orange/10 text-central-orange"><Clock size={19} /></span>
            <div>
              <h2 className="text-xl font-black text-central-carbon">Apertura automática</h2>
              <p className="text-sm text-neutral-500">Activá horarios para abrir/cerrar el local solo.</p>
            </div>
          </div>

          <label className="mt-5 flex items-center gap-3 rounded-sm border border-neutral-200 bg-neutral-50 p-3 text-sm font-bold text-central-carbon">
            <input type="checkbox" checked={values.autoScheduleEnabled} onChange={(event) => setValues({ ...values, autoScheduleEnabled: event.target.checked })} />
            Usar automatización de apertura y cierre
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-neutral-700">Hora de apertura</label>
              <EditableControl>
                <Input className={`${adminInputClass} admin-time-input`} type="time" value={values.autoOpenTime} onChange={(event) => setValues({ ...values, autoOpenTime: event.target.value })} />
              </EditableControl>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-neutral-700">Hora de cierre</label>
              <EditableControl>
                <Input className={`${adminInputClass} admin-time-input`} type="time" value={values.autoCloseTime} onChange={(event) => setValues({ ...values, autoCloseTime: event.target.value })} />
              </EditableControl>
            </div>
          </div>

          <p className="mt-4 rounded-sm border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
            Con la configuración actual, el sitio muestra el local como <strong className={effectiveOpen ? 'text-emerald-700' : 'text-red-700'}>{effectiveOpen ? 'abierto' : 'cerrado'}</strong>.
          </p>
        </section>
      </div>

      <section className="mt-5 rounded-sm border border-neutral-200 bg-white p-5 shadow-soft">
        <div>
          <h2 className="text-xl font-black text-central-carbon">Métodos de pago</h2>
          <p className="mt-1 text-sm text-neutral-500">Definí cuáles opciones aparecen en el checkout. El alias y el CVU se usan cuando el cliente elige transferencia.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {values.paymentMethods.map((method, index) => (
            <div key={method.id} className="grid items-center gap-3 rounded-sm border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[.14em] text-neutral-500">{method.type}</label>
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
              <label className="mt-5 flex items-center gap-2 text-sm font-bold text-neutral-700">
                <input
                  type="checkbox"
                  checked={method.active}
                  onChange={(event) => setValues({
                    ...values,
                    paymentMethods: values.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, active: event.target.checked } : item),
                  })}
                />
                Activo
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
