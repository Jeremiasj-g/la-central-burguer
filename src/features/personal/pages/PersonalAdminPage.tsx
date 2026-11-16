'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CreditCard, Plus, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/shared/components/ui/Button';
import { DatePickerField } from '@/shared/components/ui/DatePickerField';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { formatCurrency } from '@/shared/utils/format.utils';
import { useAdminUnsavedChanges } from '@/shared/components/layout/AdminUnsavedChanges';
import {
  addStaffRate, applyStaffAdvance, approveStaffAttendance, createStaffPayroll,
  readStaffDashboard, recordStaffPayment, reverseStaffAllocation, reverseStaffPayment,
  saveStaffAttendance, saveStaffEmployee,
} from '../services/staff-payroll.service';
import { StaffEditorModal, type StaffEditor } from '../components/StaffEditorModal';
import { StaffTable, type StaffColumn } from '../components/StaffTable';
import {
  getPayrollBalance, getUnallocatedAdvance, type StaffAttendance,
  type StaffDashboard, type StaffEmployee, type StaffPayment, type StaffPayroll,
  type StaffAdvanceAllocation,
} from '../types/staff-payroll.types';

type Tab = 'employees' | 'attendance' | 'payrolls' | 'payments';
const TABS: { id: Tab; label: string }[] = [
  { id: 'employees', label: 'Personal' },
  { id: 'attendance', label: 'Asistencias' },
  { id: 'payrolls', label: 'Liquidaciones' },
  { id: 'payments', label: 'Pagos' },
];
const EMPTY: StaffDashboard = {
  employees: [], rates: [], attendance: [], payrolls: [], lines: [], payments: [], allocations: [],
};
const rowId = <T extends { id: string }>(row: T) => row.id;
function argentinaDay() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
const dayLabel = (date: string) => date.split('-').reverse().join('/');
const money = (value: number) => formatCurrency(Math.round(value * 100) / 100);
const actionClass = 'rounded-[9px] border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 transition-colors duration-200 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-central-orange disabled:opacity-40';

function TableLoading() {
  return <div className="animate-pulse overflow-hidden rounded-[15px] border border-neutral-200 bg-white">
    <div className="h-11 bg-neutral-100"/>
    {Array.from({ length: 6 }, (_, index) => (
      <div key={index} className="flex h-14 items-center gap-5 border-t border-neutral-100 px-4">
        <div className="h-3 w-1/3 rounded bg-neutral-100"/><div className="h-3 w-1/4 rounded bg-neutral-100"/>
        <div className="ml-auto h-3 w-1/6 rounded bg-neutral-100"/>
      </div>
    ))}
  </div>;
}

export function PersonalAdminPage() {
  const today = argentinaDay();
  const [from, setFrom] = useState(today.slice(0, 7) + '-01');
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<Tab>('employees');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dashboard, setDashboard] = useState<StaffDashboard>(EMPTY);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<StaffEditor | null>(null);
  const editorInitial = useRef('');
  const dirty = Boolean(editor && JSON.stringify(editor) !== editorInitial.current);
  const requestNavigation = useAdminUnsavedChanges(dirty);

  useEffect(() => {
    let active = true;
    setLoading(true);
    readStaffDashboard(from, to).then((result) => {
      if (!active) return;
      setDashboard(result);
      setError('');
    }).catch((caught: unknown) => {
      if (!active) return;
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los datos del personal.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, revision]);

  const employeesById = useMemo(() => new Map(dashboard.employees.map((employee) => [employee.id, employee])), [dashboard]);
  const latestRates = useMemo(() => {
    const result = new Map<string, StaffDashboard['rates'][number]>();
    for (const rate of [...dashboard.rates].sort((a, b) => b.effective_from.localeCompare(a.effective_from))) {
      if (!result.has(rate.employee_id) && rate.effective_from <= today) result.set(rate.employee_id, rate);
    }
    return result;
  }, [dashboard.rates, today]);
  const nameFor = (employeeId: string) => employeesById.get(employeeId)?.full_name ?? 'Empleado';
  const eligible = (employeeId: string) =>
    (employeeFilter === 'all' || employeeFilter === employeeId)
    && nameFor(employeeId).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .includes(search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());
  const displayedEmployees = dashboard.employees.filter((employee) => eligible(employee.id));
  const displayedAttendance = dashboard.attendance.filter((item) => eligible(item.employee_id));
  const displayedPayrolls = dashboard.payrolls.filter((item) => eligible(item.employee_id));
  const displayedPayments = dashboard.payments.filter((item) => eligible(item.employee_id));
  const displayedAllocations = dashboard.allocations.filter((item) =>
    eligible(dashboard.payrolls.find((p) => p.id === item.payroll_id)?.employee_id ?? ''));

  const openEditor = (next: StaffEditor) => {
    editorInitial.current = JSON.stringify(next);
    setEditor(next);
  };
  const closeEditor = () => requestNavigation(() => setEditor(null));
  const refresh = () => setRevision((value) => value + 1);
  async function runAction(task: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
      setEditor(null);
      toast.success(success);
      refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }

  function editEmployee(employee?: StaffEmployee) {
    openEditor({
      type: 'employee', id: employee?.id ?? null, name: employee?.full_name ?? '',
      notes: employee?.notes ?? '', active: employee?.active ?? true,
    });
  }
  function editAttendance(attendance?: StaffAttendance) {
    openEditor({
      type: 'attendance', employeeId: attendance?.employee_id ?? '',
      day: attendance?.work_date ?? today, kind: attendance?.attendance_kind ?? 'present',
      notes: attendance?.notes ?? '', reason: '',
      previouslyApproved: attendance?.approval_status === 'approved',
      locked: Boolean(attendance),
    });
  }
  function newRate(employeeId = '') {
    openEditor({ type: 'rate', employeeId, from: today, weekday: undefined, saturday: undefined, sunday: undefined });
  }
  function newPayroll(employeeId = '') {
    openEditor({ type: 'payroll', employeeId, from, to, notes: '' });
  }
  function newPayment(payroll?: StaffPayroll) {
    openEditor({
      type: 'payment', employeeId: payroll?.employee_id ?? '', payrollId: payroll?.id ?? null,
      amount: undefined, day: today, notes: '', requestKey: crypto.randomUUID(),
    });
  }
  function newAllocation(payroll: StaffPayroll) {
    const available = dashboard.payments.find((payment) =>
      payment.employee_id === payroll.employee_id && payment.payment_kind === 'advance'
      && getUnallocatedAdvance(payment.id, dashboard) > 0);
    openEditor({ type: 'apply', employeeId: payroll.employee_id, payrollId: payroll.id,
      advanceId: available?.id ?? '', amount: undefined });
  }

  async function saveEditor() {
    if (!editor) return;
    // No reabrir asistencias aprobadas ni tocar perfiles sin cambios reales.
    if (((editor.type === 'employee' && editor.id) || (editor.type === 'attendance' && editor.locked))
      && JSON.stringify(editor) === editorInitial.current) {
      setEditor(null);
      return;
    }
    const draft = editor;
    await runAction(async () => {
      switch (draft.type) {
        case 'employee':
          if (draft.name.trim().length < 2) throw Error('Ingresá el nombre del empleado.');
          return saveStaffEmployee(draft.id, draft.name, draft.notes, draft.active);
        case 'rate':
          if (!draft.employeeId || !draft.from || [draft.weekday, draft.saturday, draft.sunday]
            .some((value) => value === undefined || value < 0)) throw Error('Completá el empleado, la fecha y las tres tarifas.');
          return addStaffRate(draft.employeeId, draft.from, draft.weekday!, draft.saturday!, draft.sunday!);
        case 'attendance':
          if (!draft.employeeId || !draft.day) throw Error('Seleccioná empleado y fecha.');
          if (draft.previouslyApproved && draft.reason.trim().length < 5) throw Error('Ingresá un motivo de corrección.');
          return saveStaffAttendance(draft.employeeId, draft.day, draft.kind, draft.notes, draft.reason);
        case 'payroll':
          if (!draft.employeeId || !draft.from || !draft.to || draft.to < draft.from) throw Error('Ingresá un período válido.');
          return createStaffPayroll(draft.employeeId, draft.from, draft.to, draft.notes);
        case 'payment':
          if (!draft.employeeId || !draft.day || !(draft.amount && draft.amount > 0)) throw Error('Completá empleado, fecha e importe.');
          return recordStaffPayment(draft.employeeId, draft.payrollId, draft.amount, draft.day,
            draft.payrollId ? 'payroll' : 'advance', draft.notes, draft.requestKey);
        case 'apply':
          if (!draft.advanceId || !(draft.amount && draft.amount > 0)) throw Error('Seleccioná anticipo e importe.');
          return applyStaffAdvance(draft.advanceId, draft.payrollId, draft.amount);
        case 'reverse':
          if (draft.reason.trim().length < 5) throw Error('Ingresá un motivo de reversión.');
          return draft.kind === 'payment'
            ? reverseStaffPayment(draft.id, draft.reason)
            : reverseStaffAllocation(draft.id, draft.reason);
      }
    }, 'Cambios guardados correctamente.');
  }

  const employeeColumns: StaffColumn<StaffEmployee>[] = [
    { id: 'name', title: 'Empleado', value: (row) => row.full_name,
      render: (row) => <span className="font-medium text-neutral-900">{row.full_name}</span> },
    { id: 'active', title: 'Estado', value: (row) => row.active ? 1 : 0,
      render: (row) => <span className={'rounded-full px-2 py-1 text-[11px] ' +
        (row.active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500')}>
        {row.active ? 'Activo' : 'Inactivo'}</span> },
    { id: 'rate', title: 'Tarifa L–V', numeric: true, value: (row) => latestRates.get(row.id)?.weekday_rate ?? null,
      render: (row) => latestRates.has(row.id) ? money(latestRates.get(row.id)!.weekday_rate) : 'Sin tarifa' },
    { id: 'weekend', title: 'Sáb. / Dom.', numeric: true, value: (row) => latestRates.get(row.id)?.saturday_rate ?? null,
      render: (row) => latestRates.has(row.id)
        ? money(latestRates.get(row.id)!.saturday_rate) + ' / ' + money(latestRates.get(row.id)!.sunday_rate)
        : '—' },
    { id: 'action', title: 'Acción', render: (row) => <div className="flex flex-wrap gap-2">
      <button type="button" className={actionClass} onClick={() => editEmployee(row)}>Editar</button>
      <button type="button" className={actionClass} disabled={!row.active} onClick={() => newRate(row.id)}>Tarifas</button>
    </div> },
  ];

  const attendanceColumns: StaffColumn<StaffAttendance>[] = [
    { id: 'work_date', title: 'Fecha', value: (row) => row.work_date, render: (row) => dayLabel(row.work_date) },
    { id: 'employee', title: 'Empleado', value: (row) => nameFor(row.employee_id), render: (row) => nameFor(row.employee_id) },
    { id: 'kind', title: 'Registro', value: (row) => row.attendance_kind, render: (row) => row.attendance_kind === 'present' ? 'Presente' : 'Ausente' },
    { id: 'amount', title: 'Importe aprobado', numeric: true, value: (row) => row.amount_snapshot,
      render: (row) => row.amount_snapshot !== null ? money(Number(row.amount_snapshot)) : '—' },
    { id: 'status', title: 'Estado', value: (row) => row.approval_status,
      render: (row) => row.approval_status === 'approved' ? 'Aprobada' : 'Pendiente' },
    { id: 'action', title: 'Acción', render: (row) => (
      <div className="flex flex-wrap gap-2">
        {!dashboard.lines.some((line) => line.attendance_id === row.id) ? <>
          {row.approval_status === 'pending' ? <button type="button" className={actionClass} disabled={busy}
            onClick={() => void runAction(() => approveStaffAttendance(row.id), 'Asistencia aprobada.')}>
            <Check size={12} className="mr-1 inline"/>Aprobar</button> : null}
          <button type="button" className={actionClass} onClick={() => editAttendance(row)}>Corregir</button>
        </> : <span className="text-[11px] text-emerald-700">Liquidada</span>}
      </div>
    ) },
  ];

  const payrollColumns: StaffColumn<StaffPayroll>[] = [
    { id: 'period', title: 'Período', value: (row) => row.period_from,
      render: (row) => dayLabel(row.period_from) + ' – ' + dayLabel(row.period_to) },
    { id: 'employee', title: 'Empleado', value: (row) => nameFor(row.employee_id), render: (row) => nameFor(row.employee_id) },
    { id: 'gross', title: 'Devengado', numeric: true, value: (row) => getPayrollBalance(row.id, dashboard).gross,
      render: (row) => money(getPayrollBalance(row.id, dashboard).gross) },
    { id: 'paid', title: 'Pagado / anticipos', numeric: true, value: (row) => {
      const b = getPayrollBalance(row.id, dashboard); return b.paid + b.applied;
    }, render: (row) => {
      const b = getPayrollBalance(row.id, dashboard); return money(b.paid + b.applied);
    } },
    { id: 'pending', title: 'Saldo', numeric: true, value: (row) => getPayrollBalance(row.id, dashboard).pending,
      render: (row) => <span className="font-medium text-neutral-900">{money(getPayrollBalance(row.id, dashboard).pending)}</span> },
    { id: 'action', title: 'Acción', render: (row) => {
      const due = getPayrollBalance(row.id, dashboard).pending;
      const advanceAvailable = dashboard.payments.some((payment) =>
        payment.employee_id === row.employee_id && payment.payment_kind === 'advance'
        && getUnallocatedAdvance(payment.id, dashboard) > 0);
      return <div className="flex flex-wrap gap-2">
        <button type="button" className={actionClass} disabled={due <= 0} onClick={() => newPayment(row)}>Pagar</button>
        <button type="button" className={actionClass} disabled={due <= 0 || !advanceAvailable}
          onClick={() => newAllocation(row)}>Aplicar anticipo</button>
      </div>;
    } },
  ];

  const paymentColumns: StaffColumn<StaffPayment>[] = [
    { id: 'date', title: 'Fecha', value: (row) => row.paid_on, render: (row) => dayLabel(row.paid_on) },
    { id: 'employee', title: 'Empleado', value: (row) => nameFor(row.employee_id), render: (row) => nameFor(row.employee_id) },
    { id: 'type', title: 'Tipo', value: (row) => row.payment_kind,
      render: (row) => row.payment_kind === 'advance' ? 'Anticipo' : 'Pago de liquidación' },
    { id: 'amount', title: 'Importe', numeric: true, value: (row) => Number(row.amount),
      render: (row) => money(Number(row.amount)) },
    { id: 'status', title: 'Estado', value: (row) => row.reversed_at ? 'reversed' : 'active',
      render: (row) => row.reversed_at ? 'Revertido' :
        row.payment_kind === 'advance' ? 'Disponible ' + money(getUnallocatedAdvance(row.id, dashboard)) : 'Registrado' },
    { id: 'action', title: 'Acción', render: (row) => row.reversed_at ? '—' :
      <button type="button" className={actionClass} onClick={() =>
        openEditor({ type: 'reverse', kind: 'payment', id: row.id, reason: '' })}>Revertir</button> },
  ];

  const allocationColumns: StaffColumn<StaffAdvanceAllocation>[] = [
    { id: 'employee', title: 'Empleado', value: (row) =>
      nameFor(dashboard.payrolls.find((p) => p.id === row.payroll_id)?.employee_id ?? ''),
      render: (row) => nameFor(dashboard.payrolls.find((p) => p.id === row.payroll_id)?.employee_id ?? '') },
    { id: 'period', title: 'Liquidación', value: (row) => dashboard.payrolls.find((p) => p.id === row.payroll_id)?.period_from ?? '',
      render: (row) => {
        const p = dashboard.payrolls.find((item) => item.id === row.payroll_id);
        return p ? dayLabel(p.period_from) + ' – ' + dayLabel(p.period_to) : '—';
      } },
    { id: 'amount', title: 'Anticipo aplicado', numeric: true, value: (row) => Number(row.amount),
      render: (row) => money(Number(row.amount)) },
    { id: 'status', title: 'Estado', value: (row) => row.reversed_at ? 'reversed' : 'active',
      render: (row) => row.reversed_at ? 'Revertido' : 'Aplicado' },
    { id: 'action', title: 'Acción', render: (row) => row.reversed_at ? '—' :
      <button type="button" className={actionClass} onClick={() =>
        openEditor({ type: 'reverse', kind: 'allocation', id: row.id, reason: '' })}>Revertir</button> },
  ];

  const pendingApproval = dashboard.attendance.filter((item) => item.approval_status === 'pending').length;
  const pendingBalance = dashboard.payrolls.reduce((total, row) => total + getPayrollBalance(row.id, dashboard).pending, 0);
  const unallocated = dashboard.payments.reduce((total, pay) =>
    total + (pay.payment_kind === 'advance' ? getUnallocatedAdvance(pay.id, dashboard) : 0), 0);

  return (
    <div className="min-w-0 space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-[28px] font-semibold tracking-[-.045em] text-neutral-950 sm:text-[34px]">Pago a empleados</h1></div>
        <button type="button" onClick={refresh} disabled={loading}
          className={actionClass + ' inline-flex items-center gap-2'}>
          <RefreshCw size={14}/> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-neutral-200 pb-4 sm:grid-cols-4">
        {([
          ['Empleados activos', dashboard.employees.filter((row) => row.active).length.toString()],
          ['Pendientes de aprobar', pendingApproval.toString()],
          ['Saldo a pagar', money(pendingBalance)],
          ['Anticipos disponibles', money(unallocated)],
        ] as const).map(([label, value]) => (
          <div key={label}><p className="text-[11px] text-neutral-500">{label}</p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums text-neutral-950">{value}</p></div>
        ))}
      </div>

      <div role="tablist" aria-label="Secciones de pago a empleados"
        className="flex flex-wrap gap-1 border-b border-neutral-200">
        {TABS.map(({ id, label }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            onClick={() => requestNavigation(() => setTab(id))}
            className={'border-b-2 px-4 py-3 text-[13px] font-medium transition-colors duration-200 ' +
              (tab === id ? 'border-central-orange text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900')}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-3">
          <div className="min-w-[180px] flex-1 sm:max-w-[290px]">
            <span className="mb-1 block text-[11px] text-neutral-500">Buscar empleado</span>
            <Input value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre y apellido"
              className="!h-10 !rounded-[11px] !border-neutral-200 !bg-white !text-[13px] !text-neutral-900 !placeholder:text-neutral-400"/>
          </div>
          <div className="min-w-[180px] flex-1 sm:max-w-[270px]">
            <span className="mb-1 block text-[11px] text-neutral-500">Personal</span>
            <Select variant="light" value={employeeFilter}
              options={[{ value: 'all', label: 'Todos los empleados' }, ...dashboard.employees.map((e) => ({ value: e.id, label: e.full_name }))]}
              onValueChange={setEmployeeFilter} className="!rounded-[11px]"/>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === 'employees' ? <Button variant="dark" type="button" onClick={() => editEmployee()}>
            <Plus size={14} className="mr-1 inline"/>Empleado
          </Button> : null}
          {tab === 'attendance' ? <Button variant="dark" type="button" onClick={() => editAttendance()}>
            <Plus size={14} className="mr-1 inline"/>Asistencia
          </Button> : null}
          {tab === 'payrolls' ? <Button variant="dark" type="button" onClick={() => newPayroll()}>
            <Wallet size={14} className="mr-1 inline"/>Liquidar
          </Button> : null}
          {tab === 'payments' ? <Button variant="dark" type="button" onClick={() => newPayment()}>
            <CreditCard size={14} className="mr-1 inline"/>Anticipo
          </Button> : null}
        </div>
      </div>

      <div className={tab === 'attendance' ? 'flex flex-wrap gap-3' : 'hidden'}>
        <div className="w-[170px]"><span className="mb-1 block text-[11px] text-neutral-500">Desde</span>
          <DatePickerField ariaLabel="Filtrar asistencias desde" value={from} onChange={setFrom}/></div>
        <div className="w-[170px]"><span className="mb-1 block text-[11px] text-neutral-500">Hasta</span>
          <DatePickerField ariaLabel="Filtrar asistencias hasta" value={to} onChange={setTo}/></div>
      </div>

      {error ? <div role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
        {error}. Revisá que estés conectado a Supabase <strong className="font-semibold">central-burguer-dev</strong> y que la migración del módulo esté aplicada.
      </div> : null}

      {loading ? <TableLoading/> : null}
      <div className={tab === 'employees' && !loading ? '' : 'hidden'}>
        <StaffTable rows={displayedEmployees} columns={employeeColumns} getId={rowId}
          initialSort="name" emptyMessage="Todavía no hay empleados. Agregá el primero para empezar."/>
      </div>
      <div className={tab === 'attendance' && !loading ? '' : 'hidden'}>
        <StaffTable rows={displayedAttendance} columns={attendanceColumns} getId={rowId}
          initialSort="work_date" emptyMessage="No hay asistencias para ese período."/>
      </div>
      <div className={tab === 'payrolls' && !loading ? '' : 'hidden'}>
        <StaffTable rows={displayedPayrolls} columns={payrollColumns} getId={rowId}
          initialSort="period" emptyMessage="Todavía no hay liquidaciones. Primero aprobá asistencias."/>
      </div>
      <div className={tab === 'payments' && !loading ? 'space-y-5' : 'hidden'}>
        <StaffTable rows={displayedPayments} columns={paymentColumns} getId={rowId}
          initialSort="date" emptyMessage="Todavía no hay pagos ni anticipos registrados."/>
        <h2 className="text-[14px] font-semibold text-neutral-800">Anticipos aplicados a liquidaciones</h2>
        <StaffTable rows={displayedAllocations} columns={allocationColumns} getId={rowId}
          initialSort="period" emptyMessage="No hay anticipos aplicados."/>
      </div>

      <p className="text-[11px] text-neutral-500">V1 de prueba: las tarifas aplican por jornada completa y día de semana. Feriados especiales, horarios parciales y automatizaciones no están habilitados.</p>

      {editor ? <StaffEditorModal draft={editor} onChange={setEditor} onClose={closeEditor}
        onSave={() => void saveEditor()} busy={busy} dashboard={dashboard}/> : null}
    </div>
  );
}
