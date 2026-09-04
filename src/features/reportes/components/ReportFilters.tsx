'use client';

import { CalendarDays, Filter, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import type {
  ReportDatePreset,
  ReportFilters,
} from '../types/reporte.types';

interface ReportFiltersProps {
  filters: ReportFilters;
  preset: ReportDatePreset;
  isLoading: boolean;
  onPresetChange: (preset: ReportDatePreset) => void;
  onChange: (next: ReportFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

const PRESETS: { value: ReportDatePreset; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'last7', label: 'Últimos 7 días' },
  { value: 'last30', label: 'Últimos 30 días' },
  { value: 'thisMonth', label: 'Este mes' },
  { value: 'previousMonth', label: 'Mes anterior' },
  { value: 'allTime', label: 'Histórico completo' },
  { value: 'custom', label: 'Rango personalizado' },
];

const adminSelectClass = '!border-neutral-200 !bg-white !text-central-carbon disabled:cursor-not-allowed disabled:!bg-neutral-100 disabled:!text-neutral-400 [&>option]:bg-white [&>option]:text-central-carbon';
const adminInputClass = '!border-neutral-200 !bg-white !text-central-carbon placeholder:!text-neutral-400 disabled:cursor-not-allowed disabled:!bg-neutral-100 disabled:!text-neutral-400';

export function ReportFilters({
  filters,
  preset,
  isLoading,
  onPresetChange,
  onChange,
  onApply,
  onReset,
}: ReportFiltersProps) {
  function patch(patchValues: Partial<ReportFilters>) {
    onChange({ ...filters, ...patchValues });
  }

  return (
    <section className="mb-6 min-w-0 overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-central-orange/10 text-central-orange">
            <Filter size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-central-carbon">Filtros del reporte</p>
            <p className="mt-0.5 text-xs leading-5 text-neutral-500">Definí período y criterios antes de consolidar la información.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex shrink-0 items-center gap-2 self-start text-xs font-bold text-neutral-500 transition hover:text-central-orange sm:self-auto"
        >
          <RotateCcw size={14} /> Restablecer
        </button>
      </div>

      <div className="grid min-w-0 gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-12">
        <label className="min-w-0 md:col-span-2 xl:col-span-3">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Período</span>
          <Select
            value={preset}
            onChange={(event) => onPresetChange(event.target.value as ReportDatePreset)}
            className={adminSelectClass}
          >
            {PRESETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </label>

        <label className="min-w-0 xl:col-span-2">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Desde</span>
          <div className="relative min-w-0">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <Input
              type="date"
              value={filters.from}
              disabled={filters.allTime}
              onChange={(event) => patch({ from: event.target.value, allTime: false })}
              className={`min-w-0 pl-9 ${adminInputClass}`}
            />
          </div>
          {filters.allTime ? <span className="mt-1 block text-[11px] text-neutral-400">Desde el primer pedido registrado.</span> : null}
        </label>

        <label className="min-w-0 xl:col-span-2">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Hasta</span>
          <div className="relative min-w-0">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <Input
              type="date"
              value={filters.to}
              disabled={filters.allTime}
              onChange={(event) => patch({ to: event.target.value, allTime: false })}
              className={`min-w-0 pl-9 ${adminInputClass}`}
            />
          </div>
          {filters.allTime ? <span className="mt-1 block text-[11px] text-neutral-400">Incluye todo el historial disponible.</span> : null}
        </label>

        <label className="min-w-0 xl:col-span-2">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Estado</span>
          <Select
            value={filters.status}
            onChange={(event) => patch({ status: event.target.value as ReportFilters['status'] })}
            className={adminSelectClass}
          >
            <option value="valid">Ventas válidas</option>
            <option value="all">Todos</option>
            <option value="aceptado">Aceptados</option>
            <option value="cancelado">Cancelados</option>
          </Select>
        </label>

        <label className="min-w-0 md:col-span-2 xl:col-span-3">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Buscar</span>
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <Input
              value={filters.search}
              onChange={(event) => patch({ search: event.target.value })}
              placeholder="Pedido, cliente o teléfono"
              className={`min-w-0 pl-9 ${adminInputClass}`}
            />
          </div>
        </label>

        <label className="min-w-0 xl:col-span-3">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Método de pago</span>
          <Select
            value={filters.paymentMethod}
            onChange={(event) => patch({ paymentMethod: event.target.value as ReportFilters['paymentMethod'] })}
            className={adminSelectClass}
          >
            <option value="all">Todos los métodos</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </Select>
        </label>

        <label className="min-w-0 xl:col-span-3">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Tipo de entrega</span>
          <Select
            value={filters.deliveryMethod}
            onChange={(event) => patch({ deliveryMethod: event.target.value as ReportFilters['deliveryMethod'] })}
            className={adminSelectClass}
          >
            <option value="all">Todas las entregas</option>
            <option value="delivery">Delivery</option>
            <option value="retiro_local">Retiro local</option>
          </Select>
        </label>

        <div className="flex min-w-0 items-end md:col-span-2 xl:col-span-6 xl:justify-end">
          <Button type="button" onClick={onApply} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? 'Procesando…' : 'Aplicar filtros'}
          </Button>
        </div>
      </div>
    </section>
  );
}
