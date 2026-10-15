'use client';

import { useState } from 'react';
import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { DatePickerField } from '@/shared/components/ui/DatePickerField';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import type { ReportDatePreset, ReportFilters } from '../types/reporte.types';

interface ReportFiltersProps {
  filters: ReportFilters;
  preset: ReportDatePreset;
  isLoading: boolean;
  hasPendingChanges?: boolean;
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
  { value: 'allTime', label: 'Desde siempre' },
  { value: 'custom', label: 'Elegir fechas' },
];

const STATUS_OPTIONS = [
  { value: 'valid', label: 'Ventas válidas' },
  { value: 'all', label: 'Todos los estados' },
  { value: 'aceptado', label: 'Aceptados' },
  { value: 'cancelado', label: 'Cancelados' },
] as const;

const PAYMENT_OPTIONS = [
  { value: 'all', label: 'Todos los métodos' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
] as const;

const DELIVERY_OPTIONS = [
  { value: 'all', label: 'Todas las entregas' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'retiro_local', label: 'Retiro local' },
] as const;

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Todos los orígenes' },
  { value: 'web', label: 'Web' },
  { value: 'admin', label: 'Venta mostrador' },
  { value: 'import', label: 'Importado' },
] as const;

const compactSelect = '!h-9 !rounded-[11px] !border-neutral-200/80 !bg-[#f8f8f9] !px-2.5 !text-[12px] !font-medium !shadow-none';
const compactDate = '!h-9 !rounded-[11px] !border-neutral-200/80 !bg-[#f8f8f9] !px-2.5 !text-[12px]';
const labelClass = 'mb-1.5 block text-[11px] font-semibold text-neutral-500';

export function ReportFilters({
  filters,
  preset,
  isLoading,
  hasPendingChanges = false,
  onPresetChange,
  onChange,
  onApply,
  onReset,
}: ReportFiltersProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function patch(values: Partial<ReportFilters>) {
    onChange({ ...filters, ...values });
  }

  const activeCriteria = [
    filters.status !== 'valid',
    filters.paymentMethod !== 'all',
    filters.deliveryMethod !== 'all',
    (filters.source ?? 'all') !== 'all',
    Boolean(filters.search.trim()),
  ].filter(Boolean).length;

  return (
    <aside aria-label="Filtros del reporte" className="flex min-w-0 flex-col rounded-[22px] border border-neutral-200/80 bg-white p-4 shadow-[0_8px_30px_-24px_rgba(20,20,20,.35)] sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-[-.025em] text-neutral-900">Personalizá el análisis</h2>
          <p className="mt-0.5 text-[11px] leading-5 text-neutral-500">Elegí qué movimientos querés ver.</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
          <SlidersHorizontal size={17} strokeWidth={1.9} />
        </span>
      </div>

      <div className="min-w-0">
        <span className={labelClass}>Período</span>
        <div>
          <Select
            aria-label="Período del reporte"
            variant="light"
            value={preset}
            options={PRESETS}
            onValueChange={(next) => onPresetChange(next as ReportDatePreset)}
            className={compactSelect}
          />
        </div>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
        <div className="min-w-0">
          <span className={labelClass}>Desde</span>
          <DatePickerField
            value={filters.from}
            onChange={(from) => patch({ from, allTime: false })}
            ariaLabel="Fecha desde del reporte"
            className={compactDate}
          />
        </div>
        <div className="min-w-0">
          <span className={labelClass}>Hasta</span>
          <DatePickerField
            value={filters.to}
            onChange={(to) => patch({ to, allTime: false })}
            ariaLabel="Fecha hasta del reporte"
            className={compactDate}
          />
        </div>
      </div>
      {preset === 'allTime' ? (
        <p className="mt-2 text-[11px] leading-4 text-neutral-500">
          Se incluye todo el historial. Al cambiar una fecha, pasás al período personalizado.
        </p>
      ) : null}

      <div className="mt-4 border-t border-neutral-100 pt-3">
        <button
          type="button"
          aria-expanded={advancedOpen}
          aria-controls="report-advanced-filters"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="flex w-full cursor-pointer items-center justify-between rounded-lg px-0.5 py-1.5 text-left text-[12px] font-semibold text-neutral-600 transition-colors duration-200 hover:text-central-orange"
        >
          <span className="flex items-center gap-2">
            Más criterios
            {activeCriteria > 0 ? (
              <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-central-orange/10 px-1.5 text-[10px] font-bold text-central-orange">
                {activeCriteria}
              </span>
            ) : null}
          </span>
          <ChevronDown size={15} className={`transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`} />
        </button>

        <div id="report-advanced-filters" aria-hidden={!advancedOpen} inert={!advancedOpen} className={`grid min-w-0 transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${advancedOpen ? 'mt-3 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
          <div className="grid min-h-0 min-w-0 grid-cols-2 gap-3 overflow-hidden">
          <div className="min-w-0">
            <span className={labelClass}>Estado</span>
            <Select
              aria-label="Estado de las ventas"
              variant="light"
              value={filters.status}
              options={STATUS_OPTIONS}
              onValueChange={(status) => patch({ status: status as ReportFilters['status'] })}
              className={compactSelect}
            />
          </div>
          <div className="min-w-0">
            <span className={labelClass}>Pago</span>
            <Select
              aria-label="Método de pago"
              variant="light"
              value={filters.paymentMethod}
              options={PAYMENT_OPTIONS}
              onValueChange={(paymentMethod) => patch({ paymentMethod: paymentMethod as ReportFilters['paymentMethod'] })}
              className={compactSelect}
            />
          </div>
          <div className="min-w-0">
            <span className={labelClass}>Entrega</span>
            <Select
              aria-label="Tipo de entrega"
              variant="light"
              value={filters.deliveryMethod}
              options={DELIVERY_OPTIONS}
              onValueChange={(deliveryMethod) => patch({ deliveryMethod: deliveryMethod as ReportFilters['deliveryMethod'] })}
              className={compactSelect}
            />
          </div>
          <div className="min-w-0">
            <span className={labelClass}>Origen</span>
            <Select
              aria-label="Origen de la venta"
              variant="light"
              value={filters.source ?? 'all'}
              options={SOURCE_OPTIONS}
              onValueChange={(source) => patch({ source: source as ReportFilters['source'] })}
              className={compactSelect}
            />
          </div>
          <label className="col-span-2 min-w-0">
            <span className={labelClass}>Buscar pedidos o clientes</span>
            <span className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input
                value={filters.search}
                onChange={(event) => patch({ search: event.target.value })}
                placeholder="Código, nombre o teléfono"
                className="!h-9 !rounded-[11px] !border-neutral-200/80 !bg-[#f8f8f9] !pl-9 !pr-3 !text-[12px] !text-neutral-900 !shadow-none placeholder:!text-neutral-400"
              />
            </span>
          </label>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4">
        <button
          type="button"
          onClick={onApply}
          disabled={isLoading}
          className="inline-flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[11px] bg-central-carbon px-3 text-[12px] font-semibold text-white transition duration-200 hover:bg-neutral-800 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Actualizando…' : 'Aplicar filtros'}
          {hasPendingChanges && !isLoading ? <span className="h-1.5 w-1.5 rounded-full bg-central-orange" aria-label="Cambios pendientes" /> : null}
        </button>
        <button
          type="button"
          onClick={onReset}
          title="Restablecer todos los filtros"
          aria-label="Restablecer todos los filtros"
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[11px] border border-neutral-200 bg-white text-neutral-500 transition duration-200 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <RotateCcw size={15} />
        </button>
      </div>
    </aside>
  );
}
