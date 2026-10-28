'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowDownUp, ArrowRight, ArrowUp, Calculator, ChevronLeft, ChevronRight, Info, PencilLine } from 'lucide-react';
import type { Category } from '@/features/categorias/types/categoria.types';
import type { Product } from '@/features/productos/types/producto.types';
import { formatCurrency } from '@/shared/utils/format.utils';
import { cn } from '@/shared/utils/cn';

export type RecipeProfitRow = {
  product: Product;
  cost: number;
  complete: boolean;
  grossProfit: number;
  marginPercent: number;
  foodCostPercent: number;
  markup: number;
};

type SortKey = 'name' | 'status' | 'cost' | 'sale' | 'profit' | 'margin' | 'foodCost' | 'suggested' | 'difference';
type Direction = 'asc' | 'desc';

const PAGE_SIZE = 20;
const QUICK_MARGINS = [20, 30, 40, 50, 60];
const SORTABLE_HEADERS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'name', label: 'Producto', hint: 'Ordenar por nombre' },
  { key: 'status', label: 'Estado', hint: 'Ordenar por estado de costeado' },
  { key: 'cost', label: 'Costo receta', hint: 'Ordenar por costo de ingredientes' },
  { key: 'sale', label: 'Precio venta', hint: 'Ordenar por precio de venta' },
  { key: 'profit', label: 'Ganancia/u.', hint: 'Ordenar por ganancia bruta unitaria' },
  { key: 'margin', label: 'Margen', hint: 'Ordenar por margen bruto' },
  { key: 'foodCost', label: 'Food cost', hint: 'Ordenar por porcentaje de costo' },
  { key: 'suggested', label: 'Precio objetivo', hint: 'Ordenar por precio simulado' },
  { key: 'difference', label: 'Diferencia', hint: 'Ordenar por ajuste de precio simulado' },
];

function marginPercent(value: number) {
  return value.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

/** Margen sobre el precio final, no un porcentaje agregado al costo. */
function suggestedPrice(cost: number, margin: number): number {
  return Math.ceil(cost / (1 - margin / 100));
}

function sortValue(item: RecipeProfitRow, key: SortKey, margin: number): number | string | null {
  const complete = item.complete && item.product.currentPrice > 0;
  switch (key) {
    case 'name': return item.product.name.toLocaleLowerCase('es');
    case 'status': return item.complete ? 1 : 0;
    case 'sale': return item.product.currentPrice;
    case 'cost': return item.complete ? item.cost : null;
    case 'profit': return complete ? item.grossProfit : null;
    case 'margin': return complete ? item.marginPercent : null;
    case 'foodCost': return complete ? item.foodCostPercent : null;
    case 'suggested': return item.complete ? suggestedPrice(item.cost, margin) : null;
    case 'difference': return item.complete ? suggestedPrice(item.cost, margin) - item.product.currentPrice : null;
  }
}

export function RentabilidadOverview({
  items,
  categoryById,
  onEdit,
}: {
  items: RecipeProfitRow[];
  categoryById: ReadonlyMap<string, Category>;
  onEdit: (id: string) => void;
}) {
  const [targetMargin, setTargetMargin] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [direction, setDirection] = useState<Direction>('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = sortValue(a, sortKey, targetMargin);
      const bv = sortValue(b, sortKey, targetMargin);
      // Valores sin costo completo siempre quedan al final, con cualquier orden.
      if (av === null) return bv === null ? a.product.name.localeCompare(b.product.name, 'es') : 1;
      if (bv === null) return -1;
      const comparison = typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv, 'es')
        : Number(av) - Number(bv);
      return (direction === 'asc' ? comparison : -comparison) || a.product.name.localeCompare(b.product.name, 'es');
    });
  }, [items, sortKey, direction, targetMargin]);

  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, lastPage);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const completeCount = items.filter((item) => item.complete).length;
  const incompleteCount = items.length - completeCount;
  const start = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(currentPage * PAGE_SIZE, filtered.length);

  function updateMargin(next: number) {
    if (!Number.isFinite(next)) return;
    setTargetMargin(Math.min(95, Math.max(1, Math.round(next))));
    setPage(1);
  }

  function selectSort(next: SortKey) {
    if (sortKey === next) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(next);
      setDirection(next === 'name' ? 'asc' : 'desc');
    }
    setPage(1);
  }

  return (
    <div className="min-w-0 space-y-4">
      <section aria-label="Simulador de márgenes" className="relative min-w-0 overflow-hidden rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.035)] sm:p-5">
        <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#fff5e7] text-[#b87725]"><Calculator size={17} strokeWidth={1.8}/></span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-.025em] text-neutral-900">Simulador de precios</h2>
                <p className="mt-0.5 text-[11px] text-neutral-500">Definí el margen bruto que querés alcanzar.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {QUICK_MARGINS.map((value) => (
                <button key={value} type="button" onClick={() => updateMargin(value)} aria-pressed={targetMargin === value}
                  className={cn('h-8 min-w-[46px] rounded-full border px-3 text-[11px] font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#d99536]',
                    targetMargin === value ? 'border-[#d99536] bg-[#fff4e2] text-[#a86919]' : 'border-neutral-200 bg-[#fafafa] text-neutral-500 hover:bg-neutral-100')}>
                  {value}%
                </button>
              ))}
            </div>
          </div>
          <div className="w-full min-w-0 lg:w-[310px]">
            <label htmlFor="recipe-target-margin" className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-neutral-600">Margen objetivo</span>
              <span className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-neutral-300 bg-white px-2">
                <input id="recipe-target-margin" type="number" inputMode="numeric" min={1} max={95} step={1}
                  value={targetMargin} onChange={(event) => updateMargin(Number(event.target.value))}
                  className="w-[42px] bg-transparent text-right text-[15px] font-semibold tabular-nums text-neutral-900 outline-none" />
                <span className="text-[12px] text-neutral-500">%</span>
              </span>
            </label>
            <input type="range" aria-label="Ajustar margen bruto objetivo" min={1} max={95} step={1} value={targetMargin}
              onChange={(event) => updateMargin(Number(event.target.value))}
              className="w-full cursor-pointer accent-[#df992e]" />
            <div className="mt-0.5 flex justify-between text-[10px] text-neutral-400"><span>1%</span><span>95%</span></div>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 border-t border-neutral-100 pt-3 text-[11px] leading-5 text-neutral-500">
          <Info size={15} className="mt-0.5 shrink-0 text-[#be883c]" />
          <p>Precio objetivo = costo de ingredientes ÷ (1 − margen objetivo). Los resultados se redondean hacia arriba al peso y <strong className="font-semibold text-neutral-700">no modifican los precios del catálogo</strong>.</p>
        </div>
      </section>

      <section aria-label="Tabla de rentabilidad" className="min-w-0 overflow-hidden rounded-[20px] border border-neutral-200/70 bg-white shadow-[0_8px_24px_rgba(15,23,42,.035)]">
        <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-[-.025em] text-neutral-900">Análisis de productos</h2>
              <span className="rounded-full bg-[#f4f4f5] px-2.5 py-1 text-[10px] font-semibold tabular-nums text-neutral-500">{items.length}</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">{completeCount} costeados · {incompleteCount} pendientes · Valores por unidad de producto</p>
          </div>

        </div>

        <div className="min-w-0 overflow-x-auto custom-scrollbar" role="region" aria-label="Desplazar tabla de rentabilidad horizontalmente" tabIndex={0}>
          <table className="w-full min-w-[1300px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-[#f8f8f9]">
                {SORTABLE_HEADERS.map(({ key, label, hint }, index) => (
                  <th key={key} scope="col" aria-sort={sortKey === key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}
                    className={cn('whitespace-nowrap border-b border-neutral-200/70 px-3 py-3 text-[10px] font-medium text-neutral-500', index === 0 && 'sticky left-0 z-10 min-w-[235px] bg-[#f8f8f9] pl-5')}>
                    <button type="button" title={hint} onClick={() => selectSort(key)}
                      className={cn('inline-flex items-center gap-1.5 rounded px-0.5 py-1 transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-[#d99536]', sortKey === key && 'text-[#b77922]')}>
                      {label}
                      {sortKey === key ? direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowDownUp size={12} className="text-neutral-300" />}
                    </button>
                  </th>
                ))}
                <th scope="col" className="border-b border-neutral-200/70 px-4 py-3 text-right text-[10px] font-medium text-neutral-500">Acción</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((item) => {
                const canCalculate = item.complete && item.product.currentPrice > 0;
                const target = item.complete ? suggestedPrice(item.cost, targetMargin) : null;
                const difference = target === null ? null : target - item.product.currentPrice;
                return (
                  <tr key={item.product.id} className="group transition-colors duration-150 hover:bg-[#fffaf3]">
                    <td className="sticky left-0 z-[1] border-b border-neutral-100 bg-white py-3 pl-5 pr-3 group-hover:bg-[#fffaf3]">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px] bg-neutral-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.product.imageUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[195px] truncate text-[12px] font-semibold text-neutral-900" title={item.product.name}>{item.product.name}</p>
                          <p className="mt-0.5 max-w-[195px] truncate text-[10px] text-neutral-400">{categoryById.get(item.product.categoryId)?.name ?? 'Sin categoría'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold', item.complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', item.complete ? 'bg-emerald-500' : 'bg-amber-400')} />
                        {item.complete ? 'Costeado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3">
                      {item.complete ? <span className="whitespace-nowrap text-[12px] font-medium tabular-nums text-neutral-800">{formatCurrency(item.cost)}</span> : (
                        <div>
                          <span className="text-[12px] text-neutral-400">—</span>
                          {item.cost > 0 ? <p className="mt-0.5 whitespace-nowrap text-[10px] text-amber-700">Parcial {formatCurrency(item.cost)}</p> : null}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 text-[12px] font-semibold tabular-nums text-neutral-800">{formatCurrency(item.product.currentPrice)}</td>
                    <td className={cn('whitespace-nowrap border-b border-neutral-100 px-3 py-3 text-[12px] font-medium tabular-nums', canCalculate ? item.grossProfit < 0 ? 'text-red-600' : 'text-neutral-800' : 'text-neutral-400')}>
                      {canCalculate ? formatCurrency(item.grossProfit) : '—'}
                    </td>
                    <td className={cn('whitespace-nowrap border-b border-neutral-100 px-3 py-3 text-[12px] font-semibold tabular-nums', canCalculate ? item.marginPercent < 0 ? 'text-red-600' : item.marginPercent >= targetMargin ? 'text-emerald-700' : 'text-[#b77922]' : 'text-neutral-400')}>
                      {canCalculate ? marginPercent(item.marginPercent) : '—'}
                    </td>
                    <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 text-[12px] tabular-nums text-neutral-700">{canCalculate ? marginPercent(item.foodCostPercent) : '—'}</td>
                    <td className="whitespace-nowrap border-b border-neutral-100 bg-[#fffbf5] px-3 py-3 text-[12px] font-semibold tabular-nums text-[#a66a1e]">{target !== null ? formatCurrency(target) : '—'}</td>
                    <td className="border-b border-neutral-100 px-3 py-3">
                      {difference !== null ? (
                        <div className={cn('flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold tabular-nums', difference > 0 ? 'text-amber-700' : difference < 0 ? 'text-emerald-700' : 'text-neutral-500')}>
                          {difference === 0 ? 'Sin cambios' : (
                            <>
                              <ArrowRight size={13} aria-hidden="true"/>
                              {difference > 0 ? 'Subir ' : 'Bajar '}{formatCurrency(Math.abs(difference))}
                            </>
                          )}
                        </div>
                      ) : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 text-right">
                      <button type="button" onClick={() => onEdit(item.product.id)}
                        aria-label={'Editar receta de ' + item.product.name}
                        className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-neutral-200 bg-white px-2.5 text-[11px] font-semibold text-neutral-700 transition-colors hover:border-[#dcaf70] hover:bg-[#fff4e3] hover:text-[#97601c] focus-visible:outline-2 focus-visible:outline-[#d99536]">
                        <PencilLine size={13} /> Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!pageRows.length ? (
            <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
              <Info size={24} className="text-neutral-300" />
              <p className="mt-3 text-[13px] font-semibold text-neutral-700">No hay productos para mostrar</p>
              <p className="mt-1 text-[11px] text-neutral-400">Revisá la búsqueda o cambiá el filtro de estado.</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-3 text-[11px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p><strong className="font-semibold tabular-nums text-neutral-800">{start}–{end}</strong> de {filtered.length} productos
            <span className="ml-2 hidden text-neutral-400 sm:inline">· Deslizá horizontalmente para ver todas las columnas</span>
          </p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Página anterior"
              className="grid h-8 w-8 place-items-center rounded-[9px] border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-16 text-center text-[11px] font-medium tabular-nums text-neutral-600">{currentPage} / {lastPage}</span>
            <button type="button" disabled={currentPage >= lastPage} onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
              aria-label="Página siguiente"
              className="grid h-8 w-8 place-items-center rounded-[9px] border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
