'use client';

import { Check } from 'lucide-react';
import type { StaffAttendance, StaffEmployee, StaffPayrollLine } from '../types/staff-payroll.types';

export type WeeklyAttendanceDraft = Record<string, boolean>;

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

export function currentAttendanceWeek(today: string) {
  const monday = new Date(today + 'T12:00:00Z');
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return DAYS.map((name, index) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + index);
    return { name, iso: date.toISOString().slice(0, 10) };
  });
}

export const attendanceSelectionKey = (employeeId: string, day: string) => employeeId + ':' + day;

function AttendanceCheckbox({
  checked, disabled, title, onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label title={title}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors duration-200 hover:bg-neutral-100 has-[:disabled]:hover:bg-transparent">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)}
        aria-label={title}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
      <span aria-hidden="true"
        className="grid h-[18px] w-[18px] place-items-center rounded-[5px] border border-neutral-300 bg-white text-white transition-colors duration-200 peer-checked:border-central-orange peer-checked:bg-central-orange peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-central-orange peer-disabled:opacity-40">
        {checked ? <Check size={13} strokeWidth={2.5} /> : null}
      </span>
    </label>
  );
}

export function WeeklyAttendanceColumn({
  employees, attendance, lines, today, draft, onChange, employeeId,
}: {
  employees: StaffEmployee[];
  attendance: StaffAttendance[];
  lines: StaffPayrollLine[];
  today: string;
  draft: WeeklyAttendanceDraft;
  onChange: (next: WeeklyAttendanceDraft) => void;
  employeeId?: string;
}) {
  const week = currentAttendanceWeek(today);
  const records = new Map(attendance.map(row => [attendanceSelectionKey(row.employee_id, row.work_date), row]));
  const settled = new Set(lines.map(line => line.attendance_id));

  const selected = (id: string, day: string) => {
    const key = attendanceSelectionKey(id, day);
    return Object.prototype.hasOwnProperty.call(draft, key)
      ? draft[key]
      : records.get(key)?.attendance_kind === 'present';
  };
  const disabled = (employee: StaffEmployee, day: string) => {
    const record = records.get(attendanceSelectionKey(employee.id, day));
    return !employee.active || day > today
      || Boolean(record && (record.approval_status === 'approved' || settled.has(record.id)));
  };

  return (
    <div className="min-w-[290px]">
      {employeeId === undefined ? <span className="mb-1 block text-center text-[11px] font-medium">Semana actual</span> : null}
      <div className="grid grid-cols-7 gap-0.5">
        {week.map(({ iso, name }) => {
          const employee = employeeId ? employees.find(item => item.id === employeeId) : undefined;
          const available = employeeId ? [] : employees.filter(item => !disabled(item, iso));
          const checked = employee
            ? selected(employee.id, iso)
            : available.length > 0 && available.every(item => selected(item.id, iso));
          const isDisabled = employee ? disabled(employee, iso) : available.length === 0;
          const record = employee ? records.get(attendanceSelectionKey(employee.id, iso)) : undefined;
          const state = record?.attendance_kind === 'present' ? 'Presente' : record?.attendance_kind === 'absent' ? 'Ausente' : 'Sin registrar';
          const title = employee
            ? `${employee.full_name} · ${name} · ${state}${isDisabled ? ' (solo lectura)' : ''}`
            : `Marcar o desmarcar a todos el ${name.toLowerCase()}`;
          return <div key={iso} className="flex min-w-0 flex-col items-center justify-center">
            {employeeId === undefined ? <span className="mb-0.5 text-[10px] text-neutral-500" title={iso}>
              {name.slice(0, 2).toUpperCase()}
            </span> : null}
            <AttendanceCheckbox checked={checked} disabled={isDisabled} title={title}
              onChange={value => {
                const next = { ...draft };
                if (employee) next[attendanceSelectionKey(employee.id, iso)] = value;
                else available.forEach(item => { next[attendanceSelectionKey(item.id, iso)] = value; });
                onChange(next);
              }}/>
          </div>;
        })}
      </div>
    </div>
  );
}
