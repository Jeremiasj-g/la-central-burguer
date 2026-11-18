'use client';

import { useMemo, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { TablePagination } from '@/shared/components/ui/TablePagination';
import type { StaffAttendance, StaffEmployee, StaffPayrollLine } from '../types/staff-payroll.types';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
const PAGE_SIZE = 10;

/** Operar con fechas calendario evita desplazamientos de día por zona horaria. */
function currentWeek(today: string) {
  const current = new Date(today + 'T12:00:00Z');
  const mondayOffset = (current.getUTCDay() + 6) % 7;
  current.setUTCDate(current.getUTCDate() - mondayOffset);
  return DAYS.map((name, index) => {
    const date = new Date(current);
    date.setUTCDate(date.getUTCDate() + index);
    return {
      name,
      iso: date.toISOString().slice(0, 10),
      short: String(date.getUTCDate()).padStart(2, '0'),
    };
  });
}

function AttendanceCheckbox({
  checked, disabled, title, onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="relative inline-flex h-9 w-9 items-center justify-center rounded-[9px] transition-colors duration-200 hover:bg-neutral-100 has-[:disabled]:hover:bg-transparent"
      title={title}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)}
        aria-label={title}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
      <span aria-hidden="true"
        className="grid h-[18px] w-[18px] place-items-center rounded-[5px] border border-neutral-300 bg-white text-white transition-colors duration-200 peer-checked:border-central-orange peer-checked:bg-central-orange peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-central-orange peer-disabled:opacity-45">
        {checked ? <Check size={13} strokeWidth={2.5} /> : null}
      </span>
    </label>
  );
}

export function WeeklyAttendanceGrid({
  employees, attendance, lines, today,
}: {
  employees: StaffEmployee[];
  attendance: StaffAttendance[];
  lines: StaffPayrollLine[];
  today: string;
}) {
  const week = useMemo(() => currentWeek(today), [today]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const registered = useMemo(() =>
    new Map(attendance.map(item => [item.employee_id + ':' + item.work_date, item])),
  [attendance]);
  const liquidated = useMemo(() => new Set(lines.map(line => line.attendance_id)), [lines]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(employees.length / PAGE_SIZE)));
  const visible = employees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const keyFor = (employeeId: string, day: string) => employeeId + ':' + day;
  const recorded = (employeeId: string, day: string) => registered.get(keyFor(employeeId, day));
  const selected = (employeeId: string, day: string) => {
    const key = keyFor(employeeId, day);
    return Object.prototype.hasOwnProperty.call(draft, key)
      ? draft[key]
      : recorded(employeeId, day)?.attendance_kind === 'present';
  };
  const locked = (employee: StaffEmployee, day: string) => {
    const row = recorded(employee.id, day);
    return !employee.active || day > today || Boolean(row && (row.approval_status === 'approved' || liquidated.has(row.id)));
  };
  const toggle = (employeeId: string, day: string, value: boolean) =>
    setDraft(current => ({ ...current, [keyFor(employeeId, day)]: value }));

  return (
    <section aria-label="Asistencia semanal del personal" className="min-w-0 overflow-hidden rounded-[15px] border border-neutral-200/80 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[14px] font-semibold text-neutral-900">Semana actual</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {week[0].short}/{week[0].iso.slice(5, 7)} – {week[6].short}/{week[6].iso.slice(5, 7)}/{week[6].iso.slice(0, 4)}
          </p>
        </div>
        <button type="button" onClick={() => setDraft({})} disabled={!Object.keys(draft).length}
          className="inline-flex items-center gap-1.5 rounded-[9px] border border-neutral-200 px-3 py-2 text-[11px] font-medium text-neutral-700 transition-colors duration-200 hover:bg-neutral-50 disabled:opacity-40">
          <RotateCcw size={13} /> Restablecer selección
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-[12px] text-neutral-700">
          <thead className="bg-[#f8f8f9] text-[11px] font-medium text-neutral-600">
            <tr className="border-b border-neutral-200/80">
              <th scope="col" rowSpan={2} className="min-w-[205px] px-4 py-3 text-left font-medium sm:px-5">Personal</th>
              {week.map(day => <th key={day.iso} scope="col" className="px-2 pt-3 pb-1.5 text-center font-medium">
                <span className="block">{day.name.slice(0, 2).toUpperCase()}</span>
                <span className="mt-0.5 block text-[10px] font-normal text-neutral-400">{day.short}/{day.iso.slice(5, 7)}</span>
              </th>)}
            </tr>
            <tr className="border-b border-neutral-200/80">
              {week.map(day => {
                const available = employees.filter(employee => !locked(employee, day.iso));
                const allSelected = available.length > 0 && available.every(employee => selected(employee.id, day.iso));
                return <th key={day.iso} className="px-2 py-1.5 text-center">
                  <AttendanceCheckbox
                    checked={allSelected}
                    disabled={available.length === 0}
                    title={`Marcar o desmarcar todo el personal el ${day.name.toLowerCase()} ${day.short}/${day.iso.slice(5, 7)}`}
                    onChange={value => setDraft(current => {
                      const next = { ...current };
                      available.forEach(employee => { next[keyFor(employee.id, day.iso)] = value; });
                      return next;
                    })}
                  />
                </th>;
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map(employee => (
              <tr key={employee.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/60">
                <th scope="row" className="max-w-[280px] px-4 py-3 text-left font-medium text-neutral-900 sm:px-5">
                  <span className="block truncate" title={employee.full_name}>{employee.full_name}</span>
                  {!employee.active ? <span className="text-[10px] font-normal text-neutral-400">Inactivo</span> : null}
                </th>
                {week.map(day => {
                  const row = recorded(employee.id, day.iso);
                  const readonly = locked(employee, day.iso);
                  const current = selected(employee.id, day.iso);
                  const state = row?.attendance_kind === 'absent' ? 'Ausente' : row?.attendance_kind === 'present' ? 'Presente' : 'Sin registrar';
                  return <td key={day.iso} className="px-2 py-2 text-center">
                    <AttendanceCheckbox
                      checked={current}
                      disabled={readonly}
                      title={`${employee.full_name} · ${day.name} ${day.short}/${day.iso.slice(5, 7)} · ${state}${readonly ? ' (solo lectura)' : ''}`}
                      onChange={value => toggle(employee.id, day.iso, value)}
                    />
                  </td>;
                })}
              </tr>
            ))}
            {!employees.length ? <tr><td colSpan={8} className="px-4 py-12 text-center text-neutral-500">
              No hay empleados para los filtros seleccionados.
            </td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="border-t border-neutral-100 px-4 py-3 text-[11px] leading-5 text-neutral-500 sm:px-5">
        <span className="font-medium text-amber-700">Vista previa:</span> los cambios en los checks son temporales y no registran ni aprueban asistencias todavía.
        Los días futuros y los registros aprobados o liquidados están bloqueados.
      </div>
      <TablePagination page={currentPage} pageSize={PAGE_SIZE} totalItems={employees.length} onPageChange={setPage} />
    </section>
  );
}
