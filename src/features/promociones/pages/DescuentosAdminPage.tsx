'use client';

import { useEffect, useState } from 'react';
import { BadgePercent, CalendarDays, Check, PauseCircle, PlayCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useCategorias } from '@/features/categorias/hooks/useCategorias';
import { useProductos } from '@/features/productos/hooks/useProductos';
import { formatCurrency } from '@/shared/utils/format.utils';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { Button } from '@/shared/components/ui/Button';
import { DatePickerField } from '@/shared/components/ui/DatePickerField';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Input } from '@/shared/components/ui/Input';
import { Modal } from '@/shared/components/ui/Modal';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';
import { useCategoryDiscounts } from '../hooks/useCategoryDiscounts';
import type { CategoryDiscountCampaign, CategoryDiscountInput } from '../types/descuento.types';
import { businessDate, campaignStatus } from '../utils/descuentos.utils';
import { removeCategoryDiscount, saveCategoryDiscount, setCategoryDiscountEnabled } from '../services/descuentos.service';

const control = '!h-10 !rounded-[11px] !border-neutral-300 !bg-white !text-[13px] !font-normal !text-neutral-900';
const statusLabels = { active: 'Activa', scheduled: 'Programada', finished: 'Finalizada', paused: 'Pausada' };
const statusColors = {
  active: 'text-emerald-700 bg-emerald-50',
  scheduled: 'text-amber-800 bg-amber-50',
  finished: 'text-neutral-500 bg-neutral-100',
  paused: 'text-neutral-500 bg-neutral-100',
};

function emptyForm(today: string): CategoryDiscountInput {
  return { title: '', category_ids: [], product_id: null, product_ids: [], discount_percent: 25, starts_on: today, ends_on: today, enabled: true };
}
function displayDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function DescuentosAdminPage() {
  const { categorias, error: categoriesError, refresh: refreshCategories } = useCategorias({ active: 'all' });
  const { productos, error: productsError, refresh: refreshProducts } = useProductos({ active: 'all', available: 'all' });
  const { config } = useBusinessConfig();
  const { campaigns, loading, error, refresh } = useCategoryDiscounts();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const today = businessDate(now, config?.timezone);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [targetKind, setTargetKind] = useState<'category' | 'product'>('category');
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState<CategoryDiscountInput>(() => emptyForm(businessDate(new Date())));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CategoryDiscountCampaign | null>(null);

  const categoriesById = new Map(categorias.map(c => [c.id, c.name]));
  const productsById = new Map(productos.map(p => [p.id, p]));
  const selectedProductIds = new Set(form.product_ids);
  const normalizedSearch = productSearch.trim().toLocaleLowerCase('es');
  const filteredProducts = productos
    .filter(p => p.active || selectedProductIds.has(p.id))
    .filter(p => !normalizedSearch ||
      p.name.toLocaleLowerCase('es').includes(normalizedSearch) ||
      (categoriesById.get(p.categoryId) ?? '').toLocaleLowerCase('es').includes(normalizedSearch))
    .sort((a, b) => Number(selectedProductIds.has(b.id)) - Number(selectedProductIds.has(a.id))
      || a.name.localeCompare(b.name, 'es'));
  const validTarget = targetKind === 'product' ? form.product_ids.length > 0 : form.category_ids.length > 0;
  const activeCount = campaigns.filter(c => campaignStatus(c, today) === 'active').length;
  const futureCount = campaigns.filter(c => campaignStatus(c, today) === 'scheduled').length;

  function startNew() {
    setEditingId(undefined);
    setProductSearch('');
    setTargetKind('category');
    setForm(emptyForm(today));
    setOpen(true);
  }
  function startEdit(c: CategoryDiscountCampaign) {
    setEditingId(c.id);
    setProductSearch('');
    const productIds = c.product_ids?.length ? c.product_ids : (c.product_id ? [c.product_id] : []);
    setTargetKind(productIds.length ? 'product' : 'category');
    setForm({ title: c.title, category_ids: c.category_ids, product_id: null, product_ids: productIds, discount_percent: Number(c.discount_percent),
      starts_on: c.starts_on, ends_on: c.ends_on, enabled: c.enabled });
    setOpen(true);
  }
  async function save() {
    if (saving || !validTarget || !form.starts_on || !form.ends_on || form.ends_on < form.starts_on) return;
    setSaving(true);
    try {
      await saveCategoryDiscount(form, editingId);
      await refresh();
      setOpen(false);
      toast.success(editingId ? 'Campaña actualizada.' : 'Campaña creada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la campaña.');
    } finally { setSaving(false); }
  }
  async function toggle(c: CategoryDiscountCampaign) {
    try {
      await setCategoryDiscountEnabled(c.id, !c.enabled);
      await refresh();
      toast.success(c.enabled ? 'Campaña pausada.' : 'Campaña habilitada.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el estado.'); }
  }
  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      await removeCategoryDiscount(deleting.id);
      await refresh();
      setDeleting(null);
      toast.success('Campaña eliminada.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'No se pudo eliminar.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="min-w-0 pb-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-.045em] text-neutral-950">Ofertas y descuentos</h1>
          <p className="mt-1 text-[13px] text-neutral-500">Aplicá promociones a categorías o a uno o varios productos.</p>
        </div>
        <Button className="!h-10 !rounded-[11px] !bg-[#191b20] !px-4 !text-[12px] !font-medium" onClick={startNew}>
          <Plus size={16} /> Nueva campaña
        </Button>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-x-7 gap-y-2 border-b border-neutral-200 pb-5">
        <div><p className="text-[11px] text-neutral-500">Campañas</p><p className="text-[27px] font-semibold tabular-nums text-neutral-950">{campaigns.length}</p></div>
        <div><p className="text-[11px] text-neutral-500">Activas hoy</p><p className="text-[27px] font-semibold tabular-nums text-emerald-700">{activeCount}</p></div>
        <div><p className="text-[11px] text-neutral-500">Próximas</p><p className="text-[27px] font-semibold tabular-nums text-amber-700">{futureCount}</p></div>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-neutral-500"><CalendarDays size={14} /> Fechas según el horario del local</span>
      </div>

      {error || categoriesError || productsError ? (
        <DataLoadError message={error ?? categoriesError ?? productsError ?? 'No se pudieron cargar los datos.'}
          onRetry={async () => { await Promise.all([refresh(), refreshCategories(), refreshProducts()]); }} />
      ) : (
        <section className="overflow-hidden rounded-[20px] border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-neutral-900">Campañas programadas</h2>
            <p className="text-[11px] text-neutral-400">No se acumulan las ofertas</p>
          </div>
          {loading ? <p className="px-5 py-10 text-[13px] text-neutral-500">Cargando campañas…</p> : campaigns.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <BadgePercent size={29} className="mx-auto text-neutral-300" />
              <p className="mt-3 text-[14px] font-medium text-neutral-800">Todavía no hay campañas</p>
              <p className="mt-1 text-[12px] text-neutral-500">Elegí un producto o categorías, porcentaje y fechas.</p>
            </div>
          ) : campaigns.map(c => {
            const status = campaignStatus(c, today);
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-neutral-100 px-5 py-4 last:border-b-0">
                <div className="min-w-[200px] flex-1">
                  <p className="text-[13px] font-semibold text-neutral-900">{c.title}</p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {c.product_ids?.length || c.product_id
                      ? `Productos · ${(c.product_ids?.length ? c.product_ids : [c.product_id!]).map(id => productsById.get(id)?.name ?? 'Producto no disponible').join(' · ')}`
                      : `Categorías · ${c.category_ids.map(id => categoriesById.get(id) ?? 'Categoría no disponible').join(' · ')}`}
                  </p>
                </div>
                <div className="w-20">
                  <p className="text-[20px] font-semibold tabular-nums tracking-tight text-[#bc7f2c]">-{Number(c.discount_percent).toLocaleString('es-AR')}%</p>
                  <p className="text-[10px] text-neutral-400">Descuento</p>
                </div>
                <div className="min-w-[172px]">
                  <p className="text-[12px] font-medium tabular-nums text-neutral-800">{displayDate(c.starts_on)} — {displayDate(c.ends_on)}</p>
                  <p className="mt-1 text-[10px] text-neutral-400">Inicio y fin incluidos</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusColors[status]}`}>{statusLabels[status]}</span>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <button type="button" title="Editar campaña" aria-label={`Editar ${c.title}`} onClick={() => startEdit(c)}
                    className="grid h-9 w-9 place-items-center rounded-[9px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
                    <Pencil size={16} />
                  </button>
                  <button type="button" title={c.enabled ? 'Pausar campaña' : 'Habilitar campaña'} aria-label={`${c.enabled ? 'Pausar' : 'Habilitar'} ${c.title}`} onClick={() => void toggle(c)}
                    className="grid h-9 w-9 place-items-center rounded-[9px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
                    {c.enabled ? <PauseCircle size={17} /> : <PlayCircle size={17} />}
                  </button>
                  <button type="button" title="Eliminar campaña" aria-label={`Eliminar ${c.title}`} onClick={() => setDeleting(c)}
                    className="grid h-9 w-9 place-items-center rounded-[9px] text-neutral-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
      <p className="mt-4 text-[11px] leading-5 text-neutral-500">Las ofertas respetan el horario local: inicio y fin incluidos. Si coinciden una oferta por producto y otra por categoría, se aplica solo la de mayor descuento.</p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Editar campaña' : 'Nueva campaña'}
        size="md"
        theme="light"
        panelClassName="!rounded-[18px] !border-neutral-200/80"
        titleClassName="!text-[20px] !font-semibold !tracking-[-.035em]"
        closeButtonClassName="!rounded-[10px]"
      >
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
          <label className="block text-[12px] font-medium text-neutral-700">
            Nombre de la campaña
            <Input className={`mt-1.5 ${control}`} value={form.title} maxLength={100} required
              onChange={e => setForm(s => ({ ...s, title: e.target.value }))} placeholder="Ej.: Fin de semana burger" />
          </label>

          <fieldset>
            <legend className="mb-2 text-[12px] font-medium text-neutral-700">Aplicar oferta a</legend>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Alcance del descuento">
              <button type="button" aria-pressed={targetKind === 'category'}
                onClick={() => { setTargetKind('category'); setForm(current => ({ ...current, product_id: null, product_ids: [] })); }}
                className={`min-h-11 rounded-[11px] px-3 py-2 text-[12px] font-medium transition-colors duration-200 ${targetKind === 'category' ? 'bg-[#191b20] text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                Categorías
              </button>
              <button type="button" aria-pressed={targetKind === 'product'}
                onClick={() => { setTargetKind('product'); setForm(current => ({ ...current, category_ids: [], product_id: null })); }}
                className={`min-h-11 rounded-[11px] px-3 py-2 text-[12px] font-medium transition-colors duration-200 ${targetKind === 'product' ? 'bg-[#191b20] text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                Productos
              </button>
            </div>
          </fieldset>
          {targetKind === 'category' ? (
            <fieldset>
              <legend className="mb-2 text-[12px] font-medium text-neutral-700">Categorías incluidas</legend>
            <div className="grid max-h-[190px] grid-cols-1 gap-x-3 gap-y-1.5 overflow-y-auto sm:grid-cols-2">
              {categorias.map(c => (
                <label key={c.id} className="group flex min-h-8 cursor-pointer items-center gap-2.5 rounded-[8px] px-1.5 py-1 text-[12px] font-normal text-neutral-700 transition-colors duration-200 hover:bg-neutral-50">
                  <span className="relative grid h-[16px] w-[16px] shrink-0 place-items-center">
                    <input
                      type="checkbox"
                      checked={form.category_ids.includes(c.id)}
                      className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                      onChange={e => setForm(s => ({ ...s, category_ids: e.target.checked
                        ? [...s.category_ids, c.id] : s.category_ids.filter(id => id !== c.id) }))}
                    />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[4px] border border-neutral-300 bg-white transition-colors duration-200 peer-checked:border-central-orange peer-checked:bg-central-orange peer-focus-visible:ring-2 peer-focus-visible:ring-central-orange/35 peer-focus-visible:ring-offset-2" />
                    <Check aria-hidden="true" size={12} strokeWidth={2.8} className="pointer-events-none relative text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100" />
                  </span>
                  <span className="min-w-0">{c.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          ) : (
            <fieldset className="min-w-0">
              <legend className="mb-2 text-[12px] font-medium text-neutral-700">Productos incluidos</legend>
              <Input
                type="search"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Buscar productos o categorías..."
                aria-label="Buscar productos para la oferta"
                className={control}
              />
              <div className="mt-2 flex min-h-8 items-center justify-between gap-3">
                <span aria-live="polite" className="text-[11px] font-medium text-neutral-500">
                  {form.product_ids.length} {form.product_ids.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                </span>
                {form.product_ids.length > 0 ? (
                  <button type="button" onClick={() => setForm(current => ({ ...current, product_ids: [] }))}
                    className="min-h-8 text-[11px] font-medium text-neutral-500 transition-colors duration-200 hover:text-red-600">
                    Limpiar selección
                  </button>
                ) : null}
              </div>
              <div className="custom-scrollbar mt-1 max-h-[260px] space-y-0.5 overflow-y-auto" role="group" aria-label="Seleccionar productos de la promoción">
                {filteredProducts.length === 0 ? (
                  <p className="py-5 text-center text-[12px] text-neutral-500">No encontramos productos con esa búsqueda.</p>
                ) : filteredProducts.map(product => {
                  const checked = selectedProductIds.has(product.id);
                  return (
                    <label key={product.id} className={`group flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 transition-colors duration-200 ${checked ? 'bg-central-orange/10' : 'hover:bg-neutral-50'}`}>
                      <span className="relative grid h-[18px] w-[18px] shrink-0 place-items-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                          onChange={(event) => setForm(current => ({
                            ...current,
                            product_id: null,
                            product_ids: event.target.checked
                              ? [...current.product_ids, product.id]
                              : current.product_ids.filter(id => id !== product.id),
                          }))}
                        />
                        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[5px] border border-neutral-300 bg-white transition-colors duration-200 peer-checked:border-central-orange peer-checked:bg-central-orange peer-focus-visible:ring-2 peer-focus-visible:ring-central-orange/30" />
                        <Check size={13} strokeWidth={2.8} aria-hidden="true" className="pointer-events-none relative text-white opacity-0 peer-checked:opacity-100" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-[12px] font-medium text-neutral-800">{product.name}</span>
                        <span className="block text-[11px] text-neutral-400">{categoriesById.get(product.categoryId) ?? 'Sin categoría'}{!product.active ? ' · Inactivo' : ''}</span>
                      </span>
                      <span className="shrink-0 text-right text-[11px] tabular-nums text-neutral-500">
                        {checked ? (
                          <>
                            <span className="block text-[10px] line-through">{formatCurrency(product.currentPrice)}</span>
                            <span className="block font-semibold text-emerald-700">{formatCurrency(Math.round(product.currentPrice * (1 - form.discount_percent / 100)))}</span>
                          </>
                        ) : formatCurrency(product.currentPrice)}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] leading-5 text-neutral-500">
                Todos los productos marcados reciben el mismo porcentaje. Los demás conservan su precio, salvo que tengan otra oferta.
              </p>
            </fieldset>
          )}
          <label className="block text-[12px] font-medium text-neutral-700">
            Descuento (%)
            <Input className={`mt-1.5 ${control}`} type="number" min="0.01" max="99.99" step="0.01" required
              value={form.discount_percent} onChange={e => setForm(s => ({ ...s, discount_percent: Number(e.target.value) }))} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <span className="block text-[12px] font-medium text-neutral-700">Fecha de inicio</span>
              <DatePickerField
                value={form.starts_on}
                ariaLabel="Fecha de inicio de la campaña"
                allowClear={false}
                className={`mt-1.5 ${control} !px-3 !shadow-none`}
                onChange={starts_on => setForm(s => ({
                  ...s,
                  starts_on,
                  // La fecha de finalización nunca puede quedar antes del inicio.
                  ends_on: s.ends_on < starts_on ? starts_on : s.ends_on,
                }))}
              />
            </div>
            <div className="min-w-0">
              <span className="block text-[12px] font-medium text-neutral-700">Fecha de fin (incluida)</span>
              <DatePickerField
                value={form.ends_on}
                minDate={form.starts_on}
                ariaLabel="Fecha de fin de la campaña (incluida)"
                allowClear={false}
                className={`mt-1.5 ${control} !px-3 !shadow-none`}
                onChange={ends_on => setForm(s => ({ ...s, ends_on }))}
              />
            </div>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1 text-[12px] font-medium text-neutral-700">
            <span>Campaña habilitada</span>
            <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
              <input
                type="checkbox"
                className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                checked={form.enabled}
                onChange={e => setForm(s => ({ ...s, enabled: e.target.checked }))}
                aria-label="Campaña habilitada"
              />
              <span aria-hidden="true" className="pointer-events-none h-6 w-11 rounded-full bg-neutral-200 transition-colors duration-200 peer-checked:bg-central-orange peer-focus-visible:ring-2 peer-focus-visible:ring-central-orange/35 peer-focus-visible:ring-offset-2" />
              <span aria-hidden="true" className="pointer-events-none absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
            </span>
          </label>
          <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}
              className="!h-9 !rounded-[10px] !border-neutral-200 !px-4 !text-[12px] !font-medium !shadow-none">Cancelar</Button>
            <Button type="submit" disabled={saving || !validTarget || !form.title.trim() || !form.starts_on || !form.ends_on || form.ends_on < form.starts_on}
              className="!h-9 !rounded-[10px] !bg-[#191b20] !px-4 !text-[12px] !font-medium !text-white !shadow-none hover:!bg-neutral-700">
              {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear campaña'}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(deleting)} onCancel={() => setDeleting(null)} onConfirm={remove}
        title="Eliminar campaña" description="¿Eliminar esta campaña definitivamente? Los pedidos históricos conservarán el precio que se cobró."
        confirmLabel="Eliminar" tone="danger" theme="light" isLoading={saving} />
    </div>
  );
}
