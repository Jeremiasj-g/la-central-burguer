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
  { value: 'custom', label: 'Rango personalizado' },
];

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
    <section className="mb-6 rounded-sm border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-sm bg-central-orange/10 text-central-orange">
            <Filter size={18} />
          </span>
          <div>
            <p className="text-sm font-extrabold text-central-carbon">Filtros del reporte</p>
            <p className="text-xs text-neutral-500">Definí período y criterios antes de consolidar.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 transition hover:text-central-orange"
        >
          <RotateCcw size={14} /> Restablecer
        </button>
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-12">
        <label className="xl:col-span-3">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Período</span>
          <Select value={preset} onChange={(event) => onPresetChange(event.target.value as ReportDatePreset)}>
            {PRESETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Desde</span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <Input
              type="date"
              value={filters.from}
              onChange={(event) => patch({ from: event.target.value })}
              className="pl-9"
            />
          </div>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Hasta</span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <Input
              type="date"
              value={filters.to}
              onChange={(event) => patch({ to: event.target.value })}
              className="pl-9"
            />
          </div>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Estado</span>
          <Select value={filters.status} onChange={(event) => patch({ status: event.target.value as ReportFilters['status'] })}>
            <option value="valid">Ventas válidas</option>
            <option value="all">Todos</option>
            <option value="aceptado">Aceptados</option>
            <option value="cancelado">Cancelados</option>
          </Select>
        </label>

        <label className="xl:col-span-3">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Buscar</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <Input
              value={filters.search}
              onChange={(event) => patch({ search: event.target.value })}
              placeholder="Pedido, cliente o teléfono"
              className="pl-9"
            />
          </div>
        </label>

        <label className="xl:col-span-3">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Método de pago</span>
          <Select value={filters.paymentMethod} onChange={(event) => patch({ paymentMethod: event.target.value as ReportFilters['paymentMethod'] })}>
            <option value="all">Todos los métodos</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </Select>
        </label>

        <label className="xl:col-span-3">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Tipo de entrega</span>
          <Select value={filters.deliveryMethod} onChange={(event) => patch({ deliveryMethod: event.target.value as ReportFilters['deliveryMethod'] })}>
            <option value="all">Todas las entregas</option>
            <option value="delivery">Delivery</option>
            <option value="retiro_local">Retiro local</option>
          </Select>
        </label>

        <div className="flex items-end xl:col-span-6 xl:justify-end">
          <Button type="button" onClick={onApply} disabled={isLoading} className="w-full xl:w-auto">
            {isLoading ? 'Procesando…' : 'Aplicar filtros'}
          </Button>
        </div>
      </div>
    </section>
  );
}
