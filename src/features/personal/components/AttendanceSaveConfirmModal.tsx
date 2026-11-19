'use client';

import { useMemo } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Modal } from '@/shared/components/ui/Modal';
import type { StaffAttendanceKind } from '../types/staff-payroll.types';

interface AttendanceChange {
  employee_id: string;
  day: string;
  kind: StaffAttendanceKind;
}

interface AttendanceSaveConfirmModalProps {
  open: boolean;
  changes: AttendanceChange[];
  nameFor: (employeeId: string) => string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const formattedDay = (day: string) => day.split('-').reverse().join('/');

export function AttendanceSaveConfirmModal({
  open, changes, nameFor, busy, onConfirm, onClose,
}: AttendanceSaveConfirmModalProps) {
  const groups = useMemo(() => {
    const byEmployee = new Map<string, AttendanceChange[]>();
    for (const change of changes) {
      const current = byEmployee.get(change.employee_id) ?? [];
      current.push(change);
      byEmployee.set(change.employee_id, current);
    }
    return Array.from(byEmployee, ([id, entries]) => ({
      id,
      name: nameFor(id),
      entries: entries.sort((a, b) => a.day.localeCompare(b.day)),
    })).sort((a, b) => a.name.localeCompare(b.name, 'es-AR'));
  }, [changes, nameFor]);

  const distinctDays = new Set(changes.map(change => change.day)).size;
  const count = changes.length;

  return (
    <Modal open={open} onClose={onClose} title="Guardar asistencias"
      theme="light" size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 px-3.5 py-3.5 sm:px-5 sm:py-4">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" disabled={busy || count === 0} onClick={onConfirm}>
            {busy ? 'Guardando…' : 'Guardar registros'}
          </Button>
        </div>
      }>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 border-b border-neutral-100 pb-4">
          {([
            ['Cambios', count],
            ['Empleados', groups.length],
            ['Fechas', distinctDays],
          ] as const).map(([label, value]) => (
            <div key={label} className="min-w-0">
              <p className="text-[11px] text-neutral-500">{label}</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums text-neutral-900">{value}</p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-2 text-[12px] font-semibold text-neutral-800">Detalle por empleado</h3>
          <div className="custom-scrollbar max-h-[min(44vh,340px)] space-y-3 overflow-y-auto pr-1"
            role="region" aria-label="Cambios de asistencia agrupados por empleado" tabIndex={0}>
            {groups.map(group => (
              <section key={group.id} className="border-b border-neutral-100 pb-3 last:border-b-0 last:pb-0">
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-1.5">
                  <h4 className="min-w-0 break-words text-[12px] font-semibold text-neutral-900">{group.name}</h4>
                  <span className="text-[10px] text-neutral-400">
                    {group.entries.length} {group.entries.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>
                <ul className="space-y-1">
                  {group.entries.map(change => (
                    <li key={change.employee_id + ':' + change.day}
                      className="flex items-center justify-between gap-3 py-1 text-[12px]">
                      <span className="tabular-nums text-neutral-600">{formattedDay(change.day)}</span>
                      <span className={'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ' +
                        (change.kind === 'present'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700')}>
                        {change.kind === 'present' ? 'Presente' : 'Ausente'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>

        <p className="border-t border-neutral-100 pt-3 text-[11px] leading-5 text-neutral-500">
          Los registros quedarán pendientes de aprobación y no generarán pagos automáticamente.
        </p>
      </div>
    </Modal>
  );
}
