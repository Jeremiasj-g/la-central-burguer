'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, History, Minus, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Ingredient } from '../types/ingrediente.types';
import { getIngredientCostHistory, type IngredientCostHistory } from '../services/ingredient-cost-history.service';
import { Modal } from '@/shared/components/ui/Modal';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';

type Props = { ingredient: Ingredient | null; onClose: () => void };

function formatChange(event: IngredientCostHistory): number | null {
  if (!event.previous_unit_cost || event.previous_unit_cost <= 0 || event.previous_unit !== event.unit) return null;
  return (event.new_unit_cost - event.previous_unit_cost) / event.previous_unit_cost * 100;
}

function percentage(value: number) {
  return new Intl.NumberFormat('es-AR', { signDisplay: 'always', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value) + '%';
}

function ChangeLabel({ change }: { change: number | null }) {
  if (change === null) return <span className="text-[11px] text-neutral-400">Sin comparación</span>;
  const up = change > 0;
  const down = change < 0;
  return (
    <span className={'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ' + (up ? 'bg-amber-50 text-amber-700' : down ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500')}>
      {up ? <ArrowUpRight size={13} /> : down ? <ArrowDownRight size={13} /> : <Minus size={13} />}
      {percentage(change)}
    </span>
  );
}

function CostHistoryContent({ ingredient }: { ingredient: Ingredient }) {
  const [events, setEvents] = useState<IngredientCostHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    getIngredientCostHistory(ingredient.id)
      .then(rows => { if (active) { setEvents(rows); setError(null); } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'No se pudo consultar el historial.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ingredient.id, retryCount]);

  const latest = events[0];
  const change = latest ? formatChange(latest) : null;
  const chartData = useMemo(() => [...events]
    .filter(event => event.unit === ingredient.unit)
    .reverse()
    .map(event => ({
      label: new Date(event.recorded_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
      fullDate: formatDateTime(event.recorded_at),
      cost: Number(event.new_unit_cost),
      id: event.id,
    })), [events, ingredient.unit]);
  const hasOtherUnits = events.some(event => event.unit !== ingredient.unit);

  if (loading) return (
    <div className="space-y-3 py-2" aria-label="Cargando historial">
      <div className="h-24 animate-pulse rounded-[15px] bg-neutral-100" />
      <div className="h-52 animate-pulse rounded-[15px] bg-neutral-100" />
      <div className="h-20 animate-pulse rounded-[15px] bg-neutral-100" />
    </div>
  );

  if (error) return (
    <div className="rounded-[15px] border border-red-100 bg-red-50 p-5 text-[12px] text-red-700">
      <p>{error}</p>
      <button type="button" onClick={() => { setLoading(true); setRetryCount(n => n + 1); }} className="mt-3 rounded-[10px] border border-red-200 bg-white px-3 py-2 font-semibold">Reintentar</button>
    </div>
  );

  return (
    <div className="space-y-5 pb-1">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[15px] bg-[#191b20] p-4 text-white">
          <p className="text-[11px] text-white/60">Costo actual / {ingredient.unit}</p>
          <p className="mt-2 text-[clamp(1.45rem,3vw,1.8rem)] font-semibold tracking-[-.045em] tabular-nums">{formatCurrency(ingredient.unitCost)}</p>
          <p className="mt-1 text-[10px] text-white/50">{ingredient.supplier ? 'Proveedor actual: ' + ingredient.supplier : 'Proveedor no especificado'}</p>
        </div>
        <div className="rounded-[15px] border border-neutral-200 bg-[#fafafb] p-4">
          <p className="text-[11px] text-neutral-500">Última variación</p>
          <div className="mt-2 min-h-8 flex items-center">
            <ChangeLabel change={change} />
          </div>
          <p className="mt-1 text-[10px] leading-4 text-neutral-400">{latest ? formatDateTime(latest.recorded_at) : 'Sin cambios registrados'}</p>
        </div>
        <div className="rounded-[15px] border border-neutral-200 bg-[#fafafb] p-4">
          <p className="text-[11px] text-neutral-500">Movimientos registrados</p>
          <p className="mt-2 text-[25px] font-semibold leading-none tracking-[-.04em] tabular-nums text-neutral-900">{events.length}{events.length === 100 ? '+' : ''}</p>
          <p className="mt-2 text-[10px] text-neutral-400">Cambios en costo o unidad</p>
        </div>
      </div>

      {change !== null && change >= 10 ? (
        <div className="flex gap-2.5 rounded-[12px] border border-amber-200 bg-[#fff9ed] px-3.5 py-3 text-[11px] leading-5 text-[#8d6228]">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <p><strong className="font-semibold">Aumento relevante:</strong> el último costo registrado subió {percentage(change)} respecto del anterior.</p>
        </div>
      ) : null}

      <section aria-label="Gráfico de evolución de costos" className="min-w-0 rounded-[16px] border border-neutral-200/80 bg-white p-3.5 sm:p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900"><TrendingUp size={16} className="text-[#bd853e]"/> Evolución del costo</h3>
            <p className="mt-1 text-[11px] text-neutral-500">Valores registrados por {ingredient.unit}</p>
          </div>
          <span className="rounded-full bg-[#f7f7f8] px-2.5 py-1 text-[10px] text-neutral-500">ARS</span>
        </div>
        {chartData.length > 1 ? (
          <div className="h-[205px] w-full min-w-0 sm:h-[235px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="ingredient-cost-history-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d99a3f" stopOpacity={0.19}/>
                    <stop offset="95%" stopColor="#d99a3f" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#eceef0"/>
                <XAxis dataKey="label" tick={{ fill: '#9b9ca3', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={20}/>
                <YAxis tick={{ fill: '#9b9ca3', fontSize: 10 }} tickLine={false} axisLine={false} width={65} tickFormatter={v => '$' + new Intl.NumberFormat('es-AR',{notation:'compact'}).format(Number(v))}/>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e6e7e9', boxShadow: '0 7px 25px rgba(15,23,42,.08)', fontSize: 12 }}
                  formatter={value => [formatCurrency(Number(value)), 'Costo']}
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullDate ?? ''}
                />
                <Area type="monotone" dataKey="cost" stroke="#ce8c30" strokeWidth={2.2} fill="url(#ingredient-cost-history-fill)" activeDot={{ r: 5 }} dot={{ r: 3, fill: '#ce8c30', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex min-h-[145px] flex-col items-center justify-center rounded-[12px] bg-[#fafafa] px-5 py-6 text-center">
            <History size={21} className="text-neutral-300"/>
            <p className="mt-2 text-[12px] font-medium text-neutral-700">Todavía no hay una tendencia para graficar</p>
            <p className="mt-1 max-w-sm text-[11px] leading-5 text-neutral-400">{chartData.length === 1 ? 'Cuando el costo se vuelva a actualizar, verás su evolución acá.' : 'Los cambios futuros de costo aparecerán automáticamente.'}</p>
          </div>
        )}
        {hasOtherUnits ? <p className="mt-2 text-[10px] leading-4 text-amber-700">El gráfico muestra solo registros en {ingredient.unit}; las otras unidades permanecen en el detalle inferior.</p> : null}
      </section>

      <section aria-label="Detalle del historial de costos">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock size={17} className="text-neutral-400"/>
          <h3 className="text-[14px] font-semibold text-neutral-900">Movimientos de costo</h3>
        </div>
        {events.length ? (
          <div className="max-h-[310px] overflow-y-auto rounded-[15px] border border-neutral-200/80 bg-white">
            {events.map(event => {
              const variation = formatChange(event);
              const baseline = event.change_type === 'baseline';
              const initial = event.change_type === 'initial';
              const unitsChanged = event.previous_unit !== null && event.previous_unit !== event.unit;
              return (
                <div key={event.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-3.5 py-3 last:border-b-0 sm:px-4">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-neutral-800">{baseline ? 'Valor inicial registrado' : initial ? 'Primer costo cargado' : unitsChanged ? 'Cambio de costo / unidad' : 'Actualización de costo'}</p>
                    <p className="mt-1 text-[10px] text-neutral-400">{formatDateTime(event.recorded_at)}</p>
                    <p className="mt-1 truncate text-[10px] text-neutral-500">{event.supplier || 'Proveedor no especificado'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-[12px] font-semibold tabular-nums text-neutral-900">{formatCurrency(Number(event.new_unit_cost))} <span className="font-normal text-neutral-400">/ {event.unit}</span></p>
                    <div className="flex items-center gap-2">
                      {event.previous_unit_cost !== null ? (
                        <span className="text-[10px] text-neutral-400">Antes: {formatCurrency(Number(event.previous_unit_cost))} / {event.previous_unit ?? event.unit}</span>
                      ) : null}
                      {variation !== null ? <ChangeLabel change={variation}/> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-neutral-200 bg-[#fafafa] px-5 py-7 text-center">
            <p className="text-[12px] font-medium text-neutral-700">No hay movimientos registrados</p>
            <p className="mt-1 text-[11px] text-neutral-500">Guardá un costo nuevo para empezar el historial.</p>
          </div>
        )}
        <p className="mt-3 text-[10px] leading-5 text-neutral-400">
          El registro comienza desde la activación del historial; los valores previos se muestran como referencia inicial, no como compras. Los costos son base administrativa y no alteran automáticamente los precios de venta.
          {events.length === 100 ? ' Se muestran los 100 movimientos más recientes.' : ''}
        </p>
      </section>
    </div>
  );
}

export function IngredientCostHistoryModal({ ingredient, onClose }: Props) {
  return (
    <Modal open={Boolean(ingredient)} onClose={onClose} size="lg" theme="light"
      title={ingredient ? 'Historial de costos · ' + ingredient.name : 'Historial de costos'}
      panelClassName="!rounded-[20px] !border-neutral-200/80 !bg-white">
      {ingredient ? <CostHistoryContent key={ingredient.id} ingredient={ingredient}/> : null}
    </Modal>
  );
}
