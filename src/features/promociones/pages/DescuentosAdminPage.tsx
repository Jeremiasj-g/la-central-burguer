'use client';

import { useEffect, useState } from 'react';
import { BadgePercent, CalendarDays, PauseCircle, PlayCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useCategorias } from '@/features/categorias/hooks/useCategorias';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { Button } from '@/shared/components/ui/Button';
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
  return { title: '', category_ids: [], discount_percent: 25, starts_on: today, ends_on: today, enabled: true };
}
function displayDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function DescuentosAdminPage() {
  const { categorias, error: categoriesError, refresh: refreshCategories } = useCategorias({ active: 'all' });
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
  const [form, setForm] = useState<CategoryDiscountInput>(() => emptyForm(businessDate(new Date())));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CategoryDiscountCampaign | null>(null);

  const categoriesById = new Map(categorias.map(c => [c.id, c.name]));
  const activeCount = campaigns.filter(c => campaignStatus(c, today) === 'active').length;
  const futureCount = campaigns.filter(c => campaignStatus(c, today) === 'scheduled').length;

  function startNew() {
    setEditingId(undefined);
    setForm(emptyForm(today));
    setOpen(true);
  }
  function startEdit(c: CategoryDiscountCampaign) {
    setEditingId(c.id);
    setForm({ title: c.title, category_ids: c.category_ids, discount_percent: Number(c.discount_percent),
      starts_on: c.starts_on, ends_on: c.ends_on, enabled: c.enabled });
    setOpen(true);
  }
  async function save() {
    if (saving) return;
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
          <h1 className="text-[30px] font-semibold tracking-[-.045em] text-neutral-950">Descuentos por categoría</h1>
          <p className="mt-1 text-[13px] text-neutral-500">Programá porcentajes y fechas sin modificar los precios de lista.</p>
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

      {error || categoriesError ? (
        <DataLoadError message={error ?? categoriesError ?? 'No se pudieron cargar los datos.'}
          onRetry={async () => { await Promise.all([refresh(), refreshCategories()]); }} />
      ) : (
        <section className="overflow-hidden rounded-[20px] border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-neutral-900">Campañas programadas</h2>
            <p className="text-[11px] text-neutral-400">El mayor descuento se aplica si coinciden campañas</p>
          </div>
          {loading ? <p className="px-5 py-10 text-[13px] text-neutral-500">Cargando campañas…</p> : campaigns.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <BadgePercent size={29} className="mx-auto text-neutral-300" />
              <p className="mt-3 text-[14px] font-medium text-neutral-800">Todavía no hay campañas</p>
              <p className="mt-1 text-[12px] text-neutral-500">Creá una y elegí qué categoría, porcentaje y días tendrá la oferta.</p>
            </div>
          ) : campaigns.map(c => {
            const status = campaignStatus(c, today);
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-neutral-100 px-5 py-4 last:border-b-0">
                <div className="min-w-[200px] flex-1">
                  <p className="text-[13px] font-semibold text-neutral-900">{c.title}</p>
                  <p className="mt-1 text-[11px] text-neutral-500">{c.category_ids.map(id => categoriesById.get(id) ?? 'Categoría no disponible').join(' · ')}</p>
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
      <p className="mt-4 text-[11px] leading-5 text-neutral-500">Las campañas se activan al comenzar el día de inicio y terminan al finalizar el día de cierre. No se acumulan entre sí.</p>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Editar campaña' : 'Nueva campaña'} size="md" theme="light">
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
          <label className="block text-[12px] font-medium text-neutral-700">
            Nombre de la campaña
            <Input className={`mt-1.5 ${control}`} value={form.title} maxLength={100} required
              onChange={e => setForm(s => ({ ...s, title: e.target.value }))} placeholder="Ej.: Fin de semana burger" />
          </label>
          <fieldset>
            <legend className="mb-2 text-[12px] font-medium text-neutral-700">Categorías incluidas</legend>
            <div className="grid max-h-[190px] grid-cols-1 gap-x-3 gap-y-2 overflow-y-auto sm:grid-cols-2">
              {categorias.map(c => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 py-1 text-[12px] text-neutral-700">
                  <input type="checkbox" checked={form.category_ids.includes(c.id)} className="accent-[#d99536]"
                    onChange={e => setForm(s => ({ ...s, category_ids: e.target.checked
                      ? [...s.category_ids, c.id] : s.category_ids.filter(id => id !== c.id) }))} />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-[12px] font-medium text-neutral-700">
            Descuento (%)
            <Input className={`mt-1.5 ${control}`} type="number" min="0.01" max="99.99" step="0.01" required
              value={form.discount_percent} onChange={e => setForm(s => ({ ...s, discount_percent: Number(e.target.value) }))} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[12px] font-medium text-neutral-700">
              Fecha de inicio
              <Input className={`mt-1.5 ${control}`} type="date" value={form.starts_on} required
                onChange={e => setForm(s => ({ ...s, starts_on: e.target.value }))} />
            </label>
            <label className="block text-[12px] font-medium text-neutral-700">
              Fecha de fin (incluida)
              <Input className={`mt-1.5 ${control}`} type="date" min={form.starts_on} value={form.ends_on} required
                onChange={e => setForm(s => ({ ...s, ends_on: e.target.value }))} />
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 py-1 text-[12px] text-neutral-700">
            <input type="checkbox" checked={form.enabled} onChange={e => setForm(s => ({ ...s, enabled: e.target.checked }))} className="accent-[#d99536]" />
            Campaña habilitada
          </label>
          <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving || !form.category_ids.length || !form.title.trim() || form.ends_on < form.starts_on}
              className="!bg-[#191b20] !text-white">{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear campaña'}</Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(deleting)} onCancel={() => setDeleting(null)} onConfirm={remove}
        title="Eliminar campaña" description="¿Eliminar esta campaña definitivamente? Los pedidos históricos conservarán el precio que se cobró."
        confirmLabel="Eliminar" tone="danger" theme="light" isLoading={saving} />
    </div>
  );
}
