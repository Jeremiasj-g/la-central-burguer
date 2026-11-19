'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { DatePickerField } from '@/shared/components/ui/DatePickerField';
import { StaffCheckbox } from './StaffCheckbox';
import { formatCurrency } from '@/shared/utils/format.utils';
import type { StaffDashboard } from '../types/staff-payroll.types';

export interface PayrollPreviewRow {
  id: string;
  name: string;
  days: number;
  gross: number;
  pending: number;
  overlap: boolean;
  ready: boolean;
}
export function calculatePayrollPreview(
  data: StaffDashboard, from: string, to: string, filterIds: string[],
): PayrollPreviewRow[] {
  const allowed = new Set(filterIds);
  const paidAttendance = new Set(data.lines.map(line => line.attendance_id));
  return data.employees.filter(e => allowed.has(e.id)).map(employee => {
    const attendance = data.attendance.filter(a => a.employee_id === employee.id && a.work_date >= from && a.work_date <= to);
    const eligible = attendance.filter(a => a.approval_status === 'approved' && !paidAttendance.has(a.id));
    const pending = attendance.filter(a => a.approval_status === 'pending').length;
    const overlap = data.payrolls.some(p => p.employee_id === employee.id && p.period_from <= to && p.period_to >= from);
    const gross = eligible.reduce((total,a) => total + Number(a.amount_snapshot ?? 0),0);
    return {
      id: employee.id, name: employee.full_name, days: eligible.length, gross, pending, overlap,
      ready: eligible.length > 0 && pending === 0 && !overlap,
    };
  });
}
export function PayrollBatchReview({
  data, from, to, onFrom, onTo, today, onBatch, busy, employees,
}: {
  data: StaffDashboard; from: string; to: string;
  onFrom: (value:string)=>void; onTo:(value:string)=>void;
  today:string; onBatch:(ids:string[])=>void; busy:boolean; employees:string[];
}) {
  const rows = useMemo(() => calculatePayrollPreview(data,from,to,employees),[data,from,to,employees]);
  const [selected,setSelected] = useState<string[]>([]);
  const valid = from.length===10 && to.length===10 && from<=to && to<=today
    && Math.floor((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)<=92;
  const ready = valid ? rows.filter(row=>row.ready) : [];
  const chosen = ready.filter(row => selected.includes(row.id));
  const blocked = rows.filter(row=>!row.ready);
  return (
    <section className="overflow-hidden rounded-[15px] border border-neutral-200/80 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-[14px] font-semibold text-neutral-900">Vista previa de liquidaciones</h2>
          <p className="mt-1 text-[11px] text-neutral-500">Solo jornadas aprobadas. No se presuponen ausencias ni días trabajados.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="w-[150px]"><span className="mb-1 block text-[11px] text-neutral-500">Desde</span>
            <DatePickerField ariaLabel="Inicio del período" value={from} maxDate={today} allowClear={false} onChange={value=>{setSelected([]);onFrom(value);}}/>
          </label>
          <label className="w-[150px]"><span className="mb-1 block text-[11px] text-neutral-500">Hasta</span>
            <DatePickerField ariaLabel="Fin del período" value={to} maxDate={today} allowClear={false} onChange={value=>{setSelected([]);onTo(value);}}/>
          </label>
        </div>
      </div>
      {!valid ? <p role="alert" className="px-5 py-3 text-[12px] text-red-600">Seleccioná un período válido de hasta 93 días, sin fechas futuras.</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12px] text-neutral-700">
          <thead className="bg-central-orange text-[11px] text-white">
            <tr>
              <th scope="col" className="w-12 px-4 py-3">
                <StaffCheckbox onOrange label="Seleccionar todos los empleados elegibles"
                  disabled={!ready.length || busy}
                  checked={ready.length>0 && ready.every(row=>selected.includes(row.id))}
                  mixed={ready.some(row=>selected.includes(row.id)) && !ready.every(row=>selected.includes(row.id))}
                  onChange={value=>setSelected(value?ready.map(row=>row.id):[])} />
              </th>
              <th scope="col" className="px-3 py-3 text-left font-medium">Empleado</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Jornadas</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Devengado</th>
              <th scope="col" className="px-4 py-3 text-left font-medium">Validación</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row=><tr key={row.id} className="border-t border-neutral-100">
              <td className="px-4 py-3">
                <StaffCheckbox label={`Seleccionar ${row.name}`} disabled={!valid || !row.ready || busy}
                  checked={row.ready && selected.includes(row.id)}
                  onChange={value=>setSelected(old=>value?[...old,row.id]:old.filter(id=>id!==row.id))}/>
              </td>
              <td className="px-3 py-3 font-medium text-neutral-900">{row.name}</td>
              <td className="px-3 py-3 text-right tabular-nums">{row.days}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.gross)}</td>
              <td className="px-4 py-3">
                {row.overlap ? <span className="text-red-600">Período ya liquidado</span>
                  : row.pending ? <span className="inline-flex items-center gap-1 text-amber-700"><AlertCircle size={13}/>{row.pending} pendiente(s) de aprobar</span>
                  : !row.days ? <span className="text-neutral-500">Sin jornadas aprobadas</span>
                  : <span className="inline-flex items-center gap-1 text-emerald-700"><Check size={13}/>Lista para liquidar</span>}
              </td>
            </tr>)}
            {!rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-neutral-500">No hay empleados para los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 sm:px-5">
        <p className="text-[11px] text-neutral-500">{blocked.length} con incidencias · {ready.length} elegible(s) · {chosen.length} seleccionado(s) · {formatCurrency(chosen.reduce((sum,r)=>sum+r.gross,0))}</p>
        <Button variant="primary" disabled={busy || !valid || !chosen.length} onClick={()=>onBatch(chosen.map(row=>row.id))}>
          Liquidar seleccionados
        </Button>
      </div>
    </section>
  );
}
