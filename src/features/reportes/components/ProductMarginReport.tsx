'use client';

import { useMemo, useState } from 'react';
import { ArrowDownUp, Info, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { formatCurrency } from '@/shared/utils/format.utils';
import type { ProductMarginAnalysis, ProductMarginRow } from '../utils/product-margin.utils';

type MarginFilter = 'all' | 'positive' | 'negative' | 'missing';
type SortMode = 'margin-desc' | 'margin-asc' | 'sales-desc' | 'units-desc';

function money(value: number) { return formatCurrency(value); }

export function ProductMarginReport({ analysis, isLoading }: { analysis: ProductMarginAnalysis; isLoading: boolean }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MarginFilter>('all');
  const [sort, setSort] = useState<SortMode>('margin-desc');
  const [page, setPage] = useState(1);
  const { rows, summary } = analysis;

  const filtered = useMemo(() => rows
    .filter(row => !query.trim() || `${row.productName} ${row.categoryName}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')))
    .filter(row => filter === 'all'
      || (filter === 'missing' && row.missingUnits > 0)
      || (filter === 'positive' && row.knownUnits > 0 && row.margin > 0)
      || (filter === 'negative' && row.knownUnits > 0 && row.margin < 0))
    .sort((a,b) => {
      const val = sort === 'margin-asc' ? a.margin-b.margin
        : sort === 'sales-desc' ? b.sales-a.sales
        : sort === 'units-desc' ? b.units-a.units
        : b.margin-a.margin;
      return val || a.productName.localeCompare(b.productName,'es');
    }), [rows, query, filter, sort]);
  const maxPage = Math.max(1,Math.ceil(filtered.length/12));
  const currentPage = Math.min(page,maxPage);
  const visible = filtered.slice((currentPage-1)*12,currentPage*12);
  const lossCount = rows.filter(row=>row.knownUnits>0 && row.margin<0).length;

  return (
    <section className="min-w-0" aria-label="Rentabilidad bruta por producto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-[-.035em] text-neutral-950">Margen por producto</h2>
        <span className="text-[11px] font-medium text-neutral-500">Costos de recetas registrados por venta</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Ventas de productos', value: money(summary.revenue), note: 'Sin tarifa de envío' },
          { label: 'Costo identificado', value: money(summary.cost), note: `${summary.coveredUnits} unidades con costo` },
          { label: 'Margen bruto identificado', value: money(summary.grossMargin), note: `${summary.marginPercent.toFixed(1)}% sobre ventas costeadas` },
          { label: 'Ventas sin costo completo', value: money(summary.uncoveredRevenue), note: `${summary.uncoveredUnits} unidades pendientes` },
        ].map(item=>(
          <div key={item.label} className="min-w-0 border-b border-neutral-200 py-3">
            <p className="text-[11px] font-medium text-neutral-500">{item.label}</p>
            <p className="mt-1 truncate text-[20px] font-semibold tracking-[-.025em] tabular-nums text-neutral-900" title={item.value}>{isLoading?'—':item.value}</p>
            <p className="mt-1 text-[11px] text-neutral-400">{item.note}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-neutral-500">
        <Info size={15} className="mt-0.5 shrink-0" strokeWidth={1.8}/>
        <p>Margen bruto de productos = ingreso de productos − costo de ingredientes conocido. <strong className="font-semibold">No es ganancia neta:</strong> aún faltan sueldos, gastos fijos, impuestos y otros costos. Los productos sin receta completa se excluyen del margen, no se toman como costo cero.
        {summary.estimatedUnits > 0 ? ` ${summary.estimatedUnits} unidades tienen costo reconstruido. Para las ventas desde el 31/10/2026 se utilizaron recetas y precios confirmados por el cliente; no fueron costos capturados originalmente al vender.` : ''}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ['all','Todos'],['positive','Mayor ganancia'],['negative','Pérdidas'],['missing','Sin costear'],
          ] as const).map(([id,label])=>(
            <button key={id} type="button" onClick={()=>{setFilter(id);setPage(1);}} aria-pressed={filter===id}
              className={cn('min-h-9 rounded-[10px] border px-3 text-[11px] font-medium transition-colors duration-200',filter===id?'border-[#d99536]/50 bg-[#fff5e8] text-[#98611b]':'border-neutral-200 text-neutral-600 hover:bg-neutral-50')}>
              {label}{id==='negative' && lossCount>0 ? ` (${lossCount})` : ''}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-neutral-200 bg-white px-3 sm:w-[195px]">
            <Search size={14} className="shrink-0 text-neutral-400"/>
            <input aria-label="Buscar producto" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Buscar producto" className="min-w-0 w-full bg-transparent text-[12px] text-neutral-900 outline-none placeholder:text-neutral-400" />
          </label>
          <label className="flex h-9 items-center gap-1 rounded-[10px] border border-neutral-200 bg-white px-2">
            <ArrowDownUp size={13} className="text-neutral-400"/>
            <select aria-label="Ordenar margen por producto" value={sort} onChange={e=>{setSort(e.target.value as SortMode);setPage(1);}} className="max-w-[150px] bg-transparent text-[11px] font-medium text-neutral-700 outline-none">
              <option value="margin-desc">Mayor margen</option>
              <option value="margin-asc">Menor margen</option>
              <option value="sales-desc">Más facturación</option>
              <option value="units-desc">Más unidades</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 min-w-0 overflow-x-auto rounded-[16px] border border-neutral-200/80 bg-white">
        <table className="w-full min-w-[780px] border-collapse text-left">
          <thead className="bg-[#f8f8f9] text-[11px] font-medium text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-3 py-3 text-right font-medium">Unidades</th>
              <th className="px-3 py-3 text-right font-medium">Precio medio</th>
              <th className="px-3 py-3 text-right font-medium">Costo/u.</th>
              <th className="px-3 py-3 text-right font-medium">Ventas</th>
              <th className="px-3 py-3 text-right font-medium">Costo</th>
              <th className="px-4 py-3 text-right font-medium">Margen bruto</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && visible.map((row:ProductMarginRow)=>(
              <tr key={row.key} className="border-t border-neutral-100 text-[12px] text-neutral-700 transition-colors duration-200 hover:bg-[#fafafa]">
                <td className="px-4 py-3">
                  <p className="max-w-[260px] truncate font-medium text-neutral-900" title={row.productName}>{row.productName}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-400">{row.missingUnits ? `${row.missingUnits} u. sin costo · ` : ''}{row.categoryName}</p>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{row.units}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(row.averageSalePrice)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{row.unitCost!==null?money(row.unitCost):'—'}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(row.sales)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{row.knownUnits ? money(row.cost) : '—'}</td>
                <td className={cn('px-4 py-3 text-right font-semibold tabular-nums',row.knownUnits===0?'text-neutral-400':row.margin<0?'text-rose-700':'text-emerald-700')}>
                  {row.knownUnits ? (
                    <span className="inline-flex items-center justify-end gap-1">
                      {row.margin<0?<TrendingDown size={13}/>:<TrendingUp size={13}/>}
                      {money(row.margin)}
                    </span>
                  ):'Sin costo'}
                  {row.knownUnits>0 && <p className="mt-0.5 text-[10px] font-normal text-neutral-400">{row.marginPercent.toFixed(1)}%{row.missingUnits>0?' · parcial':''}</p>}
                </td>
              </tr>
            ))}
            {!isLoading && visible.length===0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-[12px] text-neutral-500">No hay productos para estos filtros.</td></tr>}
            {isLoading && <tr><td colSpan={7} className="px-4 py-12 text-center text-[12px] text-neutral-500">Calculando márgenes…</td></tr>}
          </tbody>
        </table>
      </div>
      {filtered.length>12 && (
        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-neutral-500">
          <span>{filtered.length} productos · Página {currentPage} de {maxPage}</span>
          <div className="flex gap-2">
            <button type="button" disabled={currentPage<=1} onClick={()=>setPage(p=>p-1)} className="rounded-[9px] border border-neutral-200 px-3 py-2 disabled:opacity-40">Anterior</button>
            <button type="button" disabled={currentPage>=maxPage} onClick={()=>setPage(p=>p+1)} className="rounded-[9px] border border-neutral-200 px-3 py-2 disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      )}
    </section>
  );
}
