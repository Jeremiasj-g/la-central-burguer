'use client';

import { Button } from '@/shared/components/ui/Button';
import { staffButtonAccent, staffButtonSecondary } from './staff-button.styles';
import { DatePickerField } from '@/shared/components/ui/DatePickerField';
import { Modal } from '@/shared/components/ui/Modal';
import { NumericInput } from '@/shared/components/ui/NumericInput';
import { Select } from '@/shared/components/ui/Select';
import { Textarea } from '@/shared/components/ui/Textarea';
import type { StaffDashboard, StaffAttendanceKind } from '../types/staff-payroll.types';
import { getUnallocatedAdvance } from '../types/staff-payroll.types';
import { formatCurrency } from '@/shared/utils/format.utils';

export type StaffEditor =
  | { type: 'rate'; employeeId: string; from: string; weekday: number | undefined; saturday: number | undefined; sunday: number | undefined }
  | { type: 'attendance'; employeeId: string; day: string; kind: StaffAttendanceKind; notes: string; reason: string; previouslyApproved: boolean; locked: boolean }
  | { type: 'payroll'; employeeId: string; from: string; to: string; notes: string }
  | { type: 'payment'; employeeId: string; payrollId: string | null; amount: number | undefined; day: string; notes: string; requestKey: string }
  | { type: 'apply'; payrollId: string; employeeId: string; advanceId: string; amount: number | undefined; requestKey: string }
  | { type: 'reverse'; id: string; kind: 'payment' | 'allocation'; reason: string };

const controlClass = '!h-10 !rounded-[11px] !border-neutral-200 !bg-[#f7f7f9] !px-3 !text-[13px] !font-normal !text-neutral-900 !shadow-none !placeholder:text-neutral-400';
const labelClass = 'mb-1.5 block text-[11px] font-medium text-neutral-600';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className={labelClass}>{label}</span>{children}</label>;
}

export function StaffEditorModal({
  draft, onChange, onClose, onSave, busy, dashboard,
}: {
  draft: StaffEditor;
  onChange: (next: StaffEditor) => void;
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
  dashboard: StaffDashboard;
}) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const employees = dashboard.employees.filter((employee) => employee.active || draft.type === 'payroll' || (draft.type === 'payment' && Boolean(draft.payrollId)))
    .map((employee) => ({ value: employee.id, label: employee.full_name }));
  const employeeName = (id: string) => dashboard.employees.find((employee) => employee.id === id)?.full_name ?? 'Empleado';
  const advances = dashboard.payments
    .filter((payment) => payment.employee_id === (draft.type === 'apply' ? draft.employeeId : '') && payment.payment_kind === 'advance')
    .filter((payment) => getUnallocatedAdvance(payment.id, dashboard) > 0)
    .map((payment) => ({ value: payment.id, label: payment.paid_on + ' · Disponible ' + formatCurrency(getUnallocatedAdvance(payment.id, dashboard)) }));
  const title = {
    rate: 'Nueva tarifa',
    attendance: 'Registrar asistencia',
    payroll: 'Generar liquidación',
    payment: draft.type === 'payment' && draft.payrollId ? 'Registrar pago' : 'Registrar anticipo',
    apply: 'Aplicar anticipo',
    reverse: 'Revertir movimiento',
  }[draft.type];

  const employeeSelector = (id: string, change: (value: string) => void, disabled = false) => (
    <Field label="Empleado">
      <Select variant="light" value={id || undefined} placeholder="Seleccionar empleado"
        options={employees} onValueChange={change} disabled={disabled} className="!rounded-[11px] !border-neutral-200 !bg-[#f7f7f9]" />
    </Field>
  );

  return (
    <Modal open title={title} theme="light" onClose={onClose} size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 px-3.5 py-3.5 sm:px-5 sm:py-4">
          <Button variant="secondary" size="sm" className={staffButtonSecondary} type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant={draft.type === 'reverse' ? 'danger' : 'primary'} size="sm" className={staffButtonAccent} type="submit" form="staff-editor" disabled={busy}>
            {busy ? 'Guardando…' : draft.type === 'reverse' ? 'Confirmar reversión' : 'Guardar'}
          </Button>
        </div>
      }>
      <form id="staff-editor" onSubmit={(event) => { event.preventDefault(); onSave(); }} className="space-y-4">
        {draft.type === 'rate' ? (
          <>
            {employeeSelector(draft.employeeId, (value) => onChange({ ...draft, employeeId: value }))}
            <Field label="Tarifa vigente desde">
              <DatePickerField ariaLabel="Fecha de inicio de tarifa" value={draft.from} onChange={(value) => onChange({ ...draft, from: value })}/>
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                ['weekday', 'Lunes a viernes'],
                ['saturday', 'Sábado'],
                ['sunday', 'Domingo'],
              ] as const).map(([field, label]) => (
                <Field key={field} label={label}>
                  <NumericInput kind="money" min={0} value={draft[field]} onValueChange={(value) => onChange({ ...draft, [field]: value })}
                    className={controlClass} placeholder="Ej.: 2500,50"/>
                </Field>
              ))}
            </div>
            <p className="text-[12px] text-neutral-500">Cada cambio crea una nueva versión. No modifica jornadas ya aprobadas.</p>
          </>
        ) : null}

        {draft.type === 'attendance' ? (
          <>
            {employeeSelector(draft.employeeId, (value) => onChange({ ...draft, employeeId: value }), draft.locked)}
            <Field label="Fecha">
              <DatePickerField ariaLabel="Fecha de asistencia" disabled={draft.locked} maxDate={today} value={draft.day} onChange={(value) => onChange({ ...draft, day: value })}/>
            </Field>
            <Field label="Registro">
              <Select variant="light" value={draft.kind} onValueChange={(value) => onChange({ ...draft, kind: value as StaffAttendanceKind })}
                options={[{ value: 'present', label: 'Presente' }, { value: 'absent', label: 'Ausente' }]}
                className="!rounded-[11px] !border-neutral-200 !bg-[#f7f7f9]"/>
            </Field>
            <Field label="Observaciones">
              <Textarea value={draft.notes} rows={2} className={controlClass + ' !h-auto !py-3'} placeholder="Detalle de la asistencia"
                onChange={(event) => onChange({ ...draft, notes: event.target.value })}/>
            </Field>
            {draft.previouslyApproved ? (
              <Field label="Motivo obligatorio de corrección">
                <Textarea value={draft.reason} required minLength={5} rows={2} placeholder="Motivo de la corrección" className={controlClass + ' !h-auto !py-3'}
                  onChange={(event) => onChange({ ...draft, reason: event.target.value })}/>
              </Field>
            ) : null}
            <p className="text-[12px] text-neutral-500">El registro queda pendiente hasta la aprobación del administrador.</p>
          </>
        ) : null}

        {draft.type === 'payroll' ? (
          <>
            {employeeSelector(draft.employeeId, (value) => onChange({ ...draft, employeeId: value }))}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Desde">
                <DatePickerField ariaLabel="Desde" maxDate={today} value={draft.from} onChange={(value) => onChange({ ...draft, from: value })}/>
              </Field>
              <Field label="Hasta">
                <DatePickerField ariaLabel="Hasta" maxDate={today} value={draft.to} onChange={(value) => onChange({ ...draft, to: value })}/>
              </Field>
            </div>
            <Field label="Observaciones">
              <Textarea rows={2} value={draft.notes} placeholder="Detalle de la liquidación" className={controlClass + ' !h-auto !py-3'}
                onChange={(event) => onChange({ ...draft, notes: event.target.value })}/>
            </Field>
            <p className="text-[12px] text-amber-700">La liquidación fija los importes de las asistencias aprobadas y no se puede editar después. No incluye feriados especiales ni jornadas parciales.</p>
          </>
        ) : null}

        {draft.type === 'payment' ? (
          <>
            {draft.payrollId ? (
              <p className="text-[13px] text-neutral-700">Liquidación de <strong className="font-semibold">{employeeName(draft.employeeId)}</strong></p>
            ) : employeeSelector(draft.employeeId, (value) => onChange({ ...draft, employeeId: value }))}
            <Field label="Importe entregado">
              <NumericInput kind="money" value={draft.amount} min={0.01} onValueChange={(value) => onChange({ ...draft, amount: value })}
                className={controlClass} placeholder="Ej.: 2500,50"/>
            </Field>
            <Field label="Fecha de pago">
              <DatePickerField ariaLabel="Fecha del pago" maxDate={today} value={draft.day} onChange={(value) => onChange({ ...draft, day: value })}/>
            </Field>
            <Field label="Observaciones">
              <Textarea rows={2} value={draft.notes} placeholder="Detalle del pago" className={controlClass + ' !h-auto !py-3'}
                onChange={(event) => onChange({ ...draft, notes: event.target.value })}/>
            </Field>
            <p className="text-[12px] text-neutral-500">Registrá únicamente dinero efectivamente entregado. No se puede superar el saldo.</p>
          </>
        ) : null}

        {draft.type === 'apply' ? (
          <>
            <p className="text-[13px] text-neutral-700">Aplicar un anticipo disponible de <strong className="font-semibold">{employeeName(draft.employeeId)}</strong> a esta liquidación.</p>
            <Field label="Anticipo">
              <Select variant="light" value={draft.advanceId || undefined} placeholder="Seleccionar anticipo"
                options={advances} onValueChange={(value) => onChange({ ...draft, advanceId: value })}
                className="!rounded-[11px] !border-neutral-200 !bg-[#f7f7f9]"/>
            </Field>
            <Field label="Importe a aplicar">
              <NumericInput kind="money" min={0.01} value={draft.amount} onValueChange={(value) => onChange({ ...draft, amount: value })}
                className={controlClass} placeholder="Ej.: 2500,50"/>
            </Field>
            <p className="text-[12px] text-neutral-500">Aplicar un anticipo descuenta el saldo, pero no registra una nueva salida de dinero.</p>
          </>
        ) : null}

        {draft.type === 'reverse' ? (
          <>
            <p className="text-[13px] text-neutral-600">La operación quedará en el historial como revertida. No se borrarán los registros originales.</p>
            <Field label="Motivo de reversión">
              <Textarea value={draft.reason} required minLength={5} rows={3} placeholder="Motivo de la reversión" className={controlClass + ' !h-auto !py-3'}
                onChange={(event) => onChange({ ...draft, reason: event.target.value })}/>
            </Field>
          </>
        ) : null}
      </form>
    </Modal>
  );
}
