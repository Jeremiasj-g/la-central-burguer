'use client';

import { Fragment, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Minus, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { TablePagination } from '@/shared/components/ui/TablePagination';
import type { StaffAttendance, StaffEmployee, StaffPayroll, StaffPayrollLine } from '../types/staff-payroll.types';

export type AttendanceDraft = Record<string, 'present' | 'absent'>;

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
const PAGE_SIZE = 10;
export function attendanceWeek(today: string) {
  const date = new Date(today + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return DAYS.map((name, offset) => {
    const copy = new Date(date);
    copy.setUTCDate(date.getUTCDate() + offset);
    return { name, day: copy.toISOString().slice(0, 10) };
  });
}
export const attendanceKey = (id: string, day: string) => id + ':' + day;

interface Props {
  employees: StaffEmployee[];
  attendance: StaffAttendance[];
  lines: StaffPayrollLine[];
  payrolls: StaffPayroll[];
  today: string;
  weekAnchor: string;
  onWeekChange: (date: string) => void;
  draft: AttendanceDraft;
  onDraft: (next: AttendanceDraft) => void;
  onSave: () => void;
  onApprove: (id: string) => void;
  onApproveAll: (ids: string[]) => void;
  onCorrect: (row: StaffAttendance) => void;
  busy: boolean;
}
export function WeeklyAttendanceGrid({
  employees, attendance, lines, payrolls, today, weekAnchor, onWeekChange, draft, onDraft, onSave, onApprove, onApproveAll, onCorrect, busy,
}: Props) {
  const week = useMemo(() => attendanceWeek(weekAnchor), [weekAnchor]);
  const moveWeek = (offset: number) => {
    const day = new Date(week[0].day + 'T12:00:00Z');
    day.setUTCDate(day.getUTCDate() + offset * 7);
    onWeekChange(day.toISOString().slice(0,10));
    setPage(1);
    setExpanded(null);
  };
  const canNext = week[6].day < today;
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const byKey = useMemo(() =>
    new Map(attendance.map(a => [attendanceKey(a.employee_id, a.work_date), a])), [attendance]);
  const settled = useMemo(() => new Set(lines.map(l => l.attendance_id)), [lines]);
  const pageSafe = Math.min(page, Math.max(1, Math.ceil(employees.length / PAGE_SIZE)));
  const visible = employees.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const keys = Object.keys(draft);
  const pendingIds = attendance.filter(a =>
    a.approval_status === 'pending' && a.work_date <= today
    && week.some(w=>w.day===a.work_date)
    && employees.some(e=>e.id===a.employee_id)
    && !settled.has(a.id)
    && !payrolls.some(p=>p.employee_id===a.employee_id && a.work_date>=p.period_from && a.work_date<=p.period_to)
  ).map(a=>a.id);
  const getState = (employee: StaffEmployee, day: string) => {
    const key = attendanceKey(employee.id, day);
    return draft[key] ?? byKey.get(key)?.attendance_kind ?? null;
  };
  const disabled = (employee: StaffEmployee, day: string) => {
    const record = byKey.get(attendanceKey(employee.id, day));
    return busy || !employee.active || day > today
      || payrolls.some(p => p.employee_id === employee.id && day >= p.period_from && day <= p.period_to)
      || Boolean(record && (record.approval_status === 'approved' || settled.has(record.id)));
  };
  const setDay = (employee: StaffEmployee, day: string, kind: 'present' | 'absent') => {
    if (disabled(employee, day)) return;
    const key = attendanceKey(employee.id, day);
    const next = { ...draft };
    // Revert to original value without generating a redundant update.
    if (byKey.get(key)?.attendance_kind === kind) delete next[key];
    else next[key] = kind;
    onDraft(next);
  };
  const bulkDay = (day: string, checked: boolean) => {
    const next = { ...draft };
    employees.filter(employee => !disabled(employee, day)).forEach(employee => {
      const key = attendanceKey(employee.id, day);
      // Desmarcar el encabezado restaura la selección previa: no crea ausencias masivas.
      if (!checked || byKey.get(key)?.attendance_kind === 'present') delete next[key];
      else next[key] = 'present';
    });
    onDraft(next);
  };

  return (
    <section aria-label="Asistencias semanales" className="min-w-0 overflow-hidden rounded-[15px] border border-neutral-200/80 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[14px] font-semibold text-neutral-900">Asistencias por semana</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {week[0].day.split('-').reverse().join('/')} – {week[6].day.split('-').reverse().join('/')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Semana anterior" disabled={busy || keys.length>0} onClick={()=>moveWeek(-1)}
            className="grid h-9 w-9 place-items-center rounded-[9px] border border-neutral-200 text-neutral-600 disabled:opacity-40"><ChevronLeft size={15}/></button>
          <button type="button" aria-label="Semana siguiente" disabled={busy || keys.length>0 || !canNext} onClick={()=>moveWeek(1)}
            className="grid h-9 w-9 place-items-center rounded-[9px] border border-neutral-200 text-neutral-600 disabled:opacity-40"><ChevronRight size={15}/></button>
          <button type="button" disabled={busy || !keys.length} onClick={() => onDraft({})}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-neutral-200 px-3 py-2 text-[11px] font-medium text-neutral-600 transition-colors duration-200 hover:bg-neutral-50 disabled:opacity-40">
            <RotateCcw size={13}/> Descartar
          </button>
          <Button variant="secondary" disabled={busy || keys.length>0 || !pendingIds.length}
            onClick={()=>onApproveAll(pendingIds)}>Aprobar pendientes ({pendingIds.length})</Button>
          <Button variant="primary" disabled={busy || !keys.length} onClick={onSave}>
            {busy ? 'Guardando…' : `Revisar y guardar (${keys.length})`}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[12px] text-neutral-700">
          <thead className="bg-[#f8f8f9] text-[11px] font-medium text-neutral-500">
            <tr className="border-b border-neutral-200">
              <th scope="col" rowSpan={2} className="min-w-[210px] px-4 py-3 text-left font-medium sm:px-5">Empleado</th>
              {week.map(({name,day}) => <th key={day} scope="col" className="px-1.5 py-2 text-center font-medium">
                {name.slice(0,2).toUpperCase()}
                <span className="block text-[10px] font-normal text-neutral-400">{day.slice(8)}</span>
              </th>)}
              <th scope="col" rowSpan={2} className="px-3 py-3 text-right font-medium">Detalle</th>
            </tr>
            <tr className="border-b border-neutral-200">
              {week.map(({day,name}) => {
                const eligible = employees.filter(e => !disabled(e,day));
                const all = eligible.length > 0 && eligible.every(e => getState(e,day) === 'present');
                return <th key={day} className="px-1 py-1 text-center">
                  <input type="checkbox" aria-label={`Marcar todos los empleados presentes el ${name}`}
                    title={`Marcar a todos como presentes el ${name}; al desmarcar se descarta esa selección masiva`} checked={all} disabled={!eligible.length}
                    onChange={event => bulkDay(day,event.target.checked)}
                    className="h-[17px] w-[17px] cursor-pointer accent-[#D88918] disabled:cursor-not-allowed disabled:opacity-40"/>
                </th>;
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map(employee => {
              const weeklyRows = week.map(w => byKey.get(attendanceKey(employee.id,w.day))).filter((r): r is StaffAttendance => Boolean(r));
              return <Fragment key={employee.id}>
                <tr className="border-b border-neutral-100 transition-colors duration-200 hover:bg-neutral-50/60">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-neutral-900 sm:px-5">
                    {employee.full_name}
                    {!employee.active ? <span className="block text-[10px] font-normal text-neutral-400">Inactivo</span> : null}
                  </th>
                  {week.map(({day,name}) => {
                    const value = getState(employee,day);
                    const key = attendanceKey(employee.id,day);
                    const locked = disabled(employee,day);
                    const changed = Object.prototype.hasOwnProperty.call(draft,key);
                    return <td key={day} className={'px-1 py-1 text-center ' + (changed ? 'bg-amber-50/65' : '')}>
                      <div className="flex flex-col items-center gap-0.5">
                        <label className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] hover:bg-neutral-100 has-[:disabled]:cursor-not-allowed">
                          <input type="checkbox" aria-label={`${employee.full_name} presente el ${name}`}
                            checked={value === 'present'} disabled={locked}
                            onChange={event => setDay(employee,day,event.target.checked ? 'present' : 'absent')}
                            className="peer absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"/>
                          <span aria-hidden="true" className="grid h-[18px] w-[18px] place-items-center rounded-[5px] border border-neutral-300 bg-white text-white transition-colors duration-200 peer-checked:border-central-orange peer-checked:bg-central-orange peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-central-orange peer-disabled:opacity-40">
                            {value === 'present' ? <Check size={13} strokeWidth={2.5}/> : null}
                          </span>
                        </label>
                        <button type="button" disabled={locked} title={`Marcar ausente: ${employee.full_name}, ${name}`}
                          aria-label={`Marcar ausente: ${employee.full_name}, ${name}`}
                          onClick={() => setDay(employee,day,'absent')}
                          className={'grid h-5 w-6 place-items-center rounded text-[10px] transition-colors duration-200 disabled:opacity-40 ' +
                            (value === 'absent' ? 'bg-red-50 text-red-600' : 'text-neutral-300 hover:bg-neutral-100 hover:text-neutral-700')}>
                          <Minus size={12}/>
                        </button>
                      </div>
                    </td>;
                  })}
                  <td className="px-3 py-2 text-right">
                    <button type="button" aria-expanded={expanded===employee.id}
                      onClick={() => setExpanded(prev=>prev===employee.id?null:employee.id)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-[11px] text-neutral-600 hover:text-central-orange focus-visible:outline-2 focus-visible:outline-central-orange">
                      Ver <ChevronDown size={14} className={expanded===employee.id ? 'rotate-180':''}/>
                    </button>
                  </td>
                </tr>
                {expanded===employee.id ? <tr><td colSpan={9} className="bg-neutral-50/70 px-4 py-3 sm:px-5">
                  <div className="space-y-2">
                    {weeklyRows.length ? weeklyRows.map(row =>
                      <div key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-100 py-2 text-[11px] last:border-0">
                        <span className="min-w-20 text-neutral-700">{row.work_date.split('-').reverse().join('/')}</span>
                        <span>{row.attendance_kind==='present' ? 'Presente' : 'Ausente'}</span>
                        <span className={row.approval_status==='approved'?'text-emerald-700':'text-amber-700'}>
                          {settled.has(row.id)?'Liquidada':row.approval_status==='approved'?'Aprobada':'Pendiente'}
                        </span>
                        <span className="tabular-nums">{row.amount_snapshot==null?'Sin importe aprobado':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(Number(row.amount_snapshot))}</span>
                        {!settled.has(row.id) && <span className="ml-auto flex gap-2">
                          {row.approval_status==='pending' && row.work_date<=today &&
                            <button type="button" disabled={busy} onClick={()=>onApprove(row.id)} className="rounded border border-neutral-200 bg-white px-2 py-1 hover:border-central-orange">Aprobar</button>}
                          <button type="button" disabled={busy || row.work_date>today} onClick={()=>onCorrect(row)}
                            className="rounded border border-neutral-200 bg-white px-2 py-1 hover:border-central-orange">Corregir</button>
                        </span>}
                      </div>)
                      : <p className="py-2 text-[11px] text-neutral-500">Todavía no hay asistencias registradas esta semana.</p>}
                  </div>
                </td></tr> : null}
              </Fragment>;
            })}
            {!employees.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-neutral-500">No hay empleados para estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="border-t border-neutral-100 px-4 py-3 text-[11px] text-neutral-500 sm:px-5">
        <span className="mr-2 text-emerald-700">✓ Presente</span>
        <span className="mr-2 text-red-600">— Ausente</span>
        <span className="mr-2">Vacío: sin registrar</span>
        <span>Los cambios requieren confirmación; jornadas aprobadas, períodos liquidados y fechas futuras están protegidos.</span>
      </div>
      <TablePagination page={pageSafe} pageSize={PAGE_SIZE} totalItems={employees.length} onPageChange={setPage}/>
    </section>
  );
}
