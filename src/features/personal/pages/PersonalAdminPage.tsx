'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, Download, Plus, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { formatCurrency } from '@/shared/utils/format.utils';
import { ROUTES } from '@/shared/constants/routes';
import { useAdminUnsavedChanges } from '@/shared/components/layout/AdminUnsavedChanges';
import {
  addStaffRate, applyStaffAdvance, approveStaffAttendance, createStaffPayroll,
  readStaffDashboard, recordStaffPayment, reverseStaffAllocation, reverseStaffPayment,
  saveStaffAttendance, saveStaffWeek, createStaffPayrollBatch, approveStaffWeek,
} from '../services/staff-payroll.service';
import { StaffEditorModal, type StaffEditor } from '../components/StaffEditorModal';
import { StaffTable, type StaffColumn } from '../components/StaffTable';
import { WeeklyAttendanceGrid, attendanceWeek, type AttendanceDraft } from '../components/WeeklyAttendanceGrid';
import { PayrollBatchReview } from '../components/PayrollBatchReview';
import { PayrollReceiptModal } from '../components/PayrollReceiptModal';
import { AttendanceSaveConfirmModal } from '../components/AttendanceSaveConfirmModal';
import { exportStaffMovementsExcel } from '../utils/staff-ledger-export.utils';
import {
  staffButtonPrimary, staffButtonSecondary, staffButtonExport, staffButtonTable,
} from '../components/staff-button.styles';
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
const actionClass = staffButtonTable;

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
  const [weeklyDraft, setWeeklyDraft] = useState<AttendanceDraft>({});
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [confirmOperation, setConfirmOperation] = useState<'week' | 'batch' | 'approve' | null>(null);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [approvalIds, setApprovalIds] = useState<string[]>([]);
  const [paymentView, setPaymentView] = useState<'all' | 'advance' | 'payroll'>('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dashboard, setDashboard] = useState<StaffDashboard>(EMPTY);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<StaffEditor | null>(null);
  const [receipt, setReceipt] = useState<{payroll:StaffPayroll; data:StaffDashboard}|null>(null);
  const editorInitial = useRef('');
  const dirty = Boolean(editor && JSON.stringify(editor) !== editorInitial.current)
    || Object.keys(weeklyDraft).length > 0;
  const requestNavigation = useAdminUnsavedChanges(dirty);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Include the selected attendance week alongside the payroll preview period.
    const days = attendanceWeek(weekAnchor);
    const weekFrom = days[0].day;
    const weekTo = days[6].day;
    // A cleared/invalid preview range must not break the weekly attendance lookup.
    const validPeriod = from.length===10 && to.length===10 && from<=to;
    const periodFrom = validPeriod ? from : weekFrom;
    const periodTo = validPeriod ? to : weekTo;
    const start = periodFrom < weekFrom ? periodFrom : weekFrom;
    const end = periodTo > weekTo ? periodTo : weekTo;
    const spanDays = Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000);
    const request = spanDays <= 366
      ? readStaffDashboard(start,end)
      : Promise.all([
          readStaffDashboard(periodFrom,periodTo),
          readStaffDashboard(weekFrom,weekTo),
        ]).then(([period,weekly]) => ({
          ...period,
          attendance: Array.from(new Map(
            [...period.attendance,...weekly.attendance].map(a=>[a.id,a])
          ).values()),
        }));
    request.then((result) => {
      if (!active) return;
      setDashboard(result);
      setError('');
    }).catch((caught: unknown) => {
      if (!active) return;
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los datos del personal.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, weekAnchor, revision]);

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
  const displayedPayrolls = dashboard.payrolls.filter((item) => eligible(item.employee_id));
  const displayedPayments = dashboard.payments.filter((item) => eligible(item.employee_id)
    && (paymentView === 'all' || item.payment_kind === paymentView));
  const displayedAllocations = dashboard.allocations.filter((item) =>
    eligible(dashboard.payrolls.find((p) => p.id === item.payroll_id)?.employee_id ?? ''));

  const openEditor = (next: StaffEditor) => {
    editorInitial.current = JSON.stringify(next);
    setEditor(next);
  };
  const closeEditor = () => requestNavigation(() => setEditor(null));
  const refresh = () => setRevision((value) => value + 1);
  const discardAndRefresh = () => requestNavigation(() => { setWeeklyDraft({}); setEditor(null); refresh(); });
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

  function exportMovements() {
    if (!displayedPayments.length) return;
    try {
      exportStaffMovementsExcel(displayedPayments, nameFor, `movimientos-personal-${today}.xlsx`);
      toast.success('Movimientos exportados a Excel.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el archivo Excel.');
    }
  }

  async function showReceipt(payroll: StaffPayroll) {
    if (busy) return;
    setBusy(true);
    try {
      const detail = await readStaffDashboard(payroll.period_from, payroll.period_to);
      setReceipt({ payroll, data: detail });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'No se pudo abrir el comprobante.');
    } finally {
      setBusy(false);
    }
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
      advanceId: available?.id ?? '', amount: undefined, requestKey: crypto.randomUUID() });
  }

  const weeklyEntries = () => Object.entries(weeklyDraft).map(([key,kind]) => {
    const separator = key.lastIndexOf(':');
    const id = key.slice(0, separator);
    const day = key.slice(separator+1);
    const expected = dashboard.attendance.find(a => a.employee_id === id && a.work_date === day);
    return { employee_id:id, day, kind, expected_id:expected?.id ?? null };
  });
  async function confirmChanges() {
    const operation = confirmOperation;
    setConfirmOperation(null);
    if (operation === 'week') {
      const changes = weeklyEntries();
      if (!changes.length) return;
      await runAction(async () => {
        await saveStaffWeek(changes);
        setWeeklyDraft({});
      }, `${changes.length} asistencias guardadas. Quedan pendientes de aprobación.`);
    } else if (operation === 'approve') {
      const ids = [...approvalIds];
      if (!ids.length) return;
      await runAction(() => approveStaffWeek(ids), `${ids.length} asistencias aprobadas.`);
      setApprovalIds([]);
    } else if (operation === 'batch') {
      const ids = [...batchIds];
      if (!ids.length) return;
      await runAction(() => createStaffPayrollBatch(ids,from,to),
        `${ids.length} liquidaciones generadas correctamente.`);
      setBatchIds([]);
    }
  }

  async function saveEditor() {
    if (!editor) return;
    // Evitar reabrir asistencias sin modificaciones.
    if (editor.type === 'attendance' && editor.locked
      && JSON.stringify(editor) === editorInitial.current) {
      setEditor(null);
      return;
    }
    const draft = editor;
    await runAction(async () => {
      switch (draft.type) {
        case 'rate':
          if (!draft.employeeId || !draft.from || [draft.weekday, draft.saturday, draft.sunday]
            .some((value) => value === undefined || value < 0)) throw Error('Completá el empleado, la fecha y las tres tarifas.');
          return addStaffRate(draft.employeeId, draft.from, draft.weekday!, draft.saturday!, draft.sunday!);
        case 'attendance':
          if (!draft.employeeId || !draft.day) throw Error('Seleccioná empleado y fecha.');
          if (draft.day > argentinaDay()) throw Error('No se puede registrar una asistencia posterior a hoy.');
          if (draft.previouslyApproved && draft.reason.trim().length < 5) throw Error('Ingresá un motivo de corrección.');
          return saveStaffAttendance(draft.employeeId, draft.day, draft.kind, draft.notes, draft.reason);
        case 'payroll':
          if (!draft.employeeId || !draft.from || !draft.to || draft.to < draft.from) throw Error('Ingresá un período válido.');
          if (draft.to > argentinaDay()) throw Error('El período de liquidación no puede terminar después de hoy.');
          return createStaffPayroll(draft.employeeId, draft.from, draft.to, draft.notes);
        case 'payment':
          if (!draft.employeeId || !draft.day || !(draft.amount && draft.amount > 0)) throw Error('Completá empleado, fecha e importe.');
          if (draft.day > argentinaDay()) throw Error('No se puede registrar un pago con fecha futura.');
          return recordStaffPayment(draft.employeeId, draft.payrollId, draft.amount, draft.day,
            draft.payrollId ? 'payroll' : 'advance', draft.notes, draft.requestKey);
        case 'apply':
          if (!draft.advanceId || !(draft.amount && draft.amount > 0)) throw Error('Seleccioná anticipo e importe.');
          return applyStaffAdvance(draft.advanceId, draft.payrollId, draft.amount, draft.requestKey);
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
      <button type="button" className={actionClass} disabled={!row.active} onClick={() => newRate(row.id)}>Tarifas</button>
    </div> },
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
        <button type="button" className={actionClass} disabled={busy}
          onClick={() => void showReceipt(row)}>Comprobante</button>
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

  const weeklyChangeList = weeklyEntries();

  const pendingApproval = dashboard.attendance.filter((item) => item.approval_status === 'pending').length;
  const pendingBalance = dashboard.payrolls.reduce((total, row) => total + getPayrollBalance(row.id, dashboard).pending, 0);
  const unallocated = dashboard.payments.reduce((total, pay) =>
    total + (pay.payment_kind === 'advance' ? getUnallocatedAdvance(pay.id, dashboard) : 0), 0);

  return (
    <div className="min-w-0 space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-[28px] font-semibold tracking-[-.045em] text-neutral-950 sm:text-[34px]">Pago a empleados</h1></div>
        <Button type="button" variant="secondary" size="sm" className={staffButtonSecondary}
          onClick={discardAndRefresh} disabled={loading} title="Actualizar información">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Actualizar
        </Button>
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
            onClick={() => requestNavigation(() => { setWeeklyDraft({}); setEditor(null); setTab(id); })}
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
              placeholder="Buscar por nombre"
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
          {tab === 'employees' ? <Button variant="dark" asChild href={ROUTES.adminUsuarios} className={staffButtonPrimary}>
            Gestionar personal
          </Button> : null}
          {tab === 'attendance' ? <Button variant="dark" type="button" className={staffButtonPrimary}
            onClick={() => requestNavigation(() => { setWeeklyDraft({}); editAttendance(); })}>
            <Plus size={14} className="mr-1 inline"/>Asistencia
          </Button> : null}
          {tab === 'payrolls' ? <Button variant="dark" type="button" className={staffButtonPrimary} onClick={() => newPayroll()}>
            <Wallet size={14} className="mr-1 inline"/>Liquidar
          </Button> : null}
          {tab === 'payments' ? <Button variant="dark" type="button" className={staffButtonPrimary} onClick={() => newPayment()}>
            <CreditCard size={14} className="mr-1 inline"/>Anticipo
          </Button> : null}
        </div>
      </div>

      {error ? <div role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
        {error}. Revisá que estés conectado a Supabase <strong className="font-semibold">central-burguer-dev</strong> y que la migración del módulo esté aplicada.
      </div> : null}

      {loading ? <TableLoading/> : null}
      <div className={tab === 'employees' && !loading ? '' : 'hidden'}>
        <StaffTable rows={displayedEmployees} columns={employeeColumns} getId={rowId}
          initialSort="name" emptyMessage="No hay usuarios con rol Personal. Asigná ese rol desde Usuarios para comenzar."/>
      </div>
      <div className={tab === 'attendance' && !loading ? '' : 'hidden'}>
        <WeeklyAttendanceGrid employees={displayedEmployees}
          attendance={dashboard.attendance} lines={dashboard.lines} payrolls={dashboard.payrolls}
          today={today} weekAnchor={weekAnchor}
          onWeekChange={date=>setWeekAnchor(date)}
          draft={weeklyDraft} onDraft={setWeeklyDraft} busy={busy}
          onSave={()=>setConfirmOperation('week')}
          onApproveAll={ids=>{setApprovalIds(ids);setConfirmOperation('approve');}}
          onApprove={id=>{
            if (Object.keys(weeklyDraft).length) {
              toast.warning('Guardá o descartá los cambios de la semana antes de aprobar.');
              return;
            }
            void runAction(()=>approveStaffAttendance(id),'Asistencia aprobada.');
          }}
          onCorrect={row=>requestNavigation(()=>{setWeeklyDraft({});editAttendance(row);})}/>
      </div>
      <div className={tab === 'payrolls' && !loading ? 'space-y-4' : 'hidden'}>
        <PayrollBatchReview data={dashboard} from={from} to={to}
          onFrom={setFrom} onTo={setTo} today={today} busy={busy}
          employees={displayedEmployees.map(e=>e.id)}
          onBatch={ids=>{setBatchIds(ids);setConfirmOperation('batch');}}/>
        <StaffTable rows={displayedPayrolls} columns={payrollColumns} getId={rowId}
          initialSort="period" emptyMessage="Todavía no hay liquidaciones. Primero aprobá asistencias."/>
      </div>
      <div className={tab === 'payments' && !loading ? 'space-y-4' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-[11px] bg-neutral-100 p-1">
            {([
              ['all','Todos'],
              ['advance','Anticipos'],
              ['payroll','Pagos de liquidación'],
            ] as const).map(([value,label])=>
              <button key={value} type="button" aria-pressed={paymentView===value}
                onClick={()=>setPaymentView(value)}
                className={'rounded-[9px] px-3 py-2 text-[12px] font-medium transition-colors duration-200 ' +
                  (paymentView===value?'bg-white text-neutral-900 shadow-sm':'text-neutral-500 hover:text-neutral-900')}>
                {label}
              </button>)}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[12px] text-neutral-500">
              {displayedPayments.length} movimientos · Total entregado:
              <span className="ml-1 font-semibold tabular-nums text-neutral-900">
                {money(displayedPayments.filter(p=>!p.reversed_at).reduce((total,p)=>total+Number(p.amount),0))}
              </span>
            </p>
            <Button variant="secondary" size="sm" className={staffButtonExport}
              disabled={!displayedPayments.length} onClick={exportMovements} title="Exportar movimientos filtrados a Excel">
              <Download size={14}/>Exportar Excel
            </Button>
          </div>
        </div>
        <StaffTable rows={displayedPayments} columns={paymentColumns} getId={rowId}
          initialSort="date" emptyMessage="Todavía no hay pagos ni anticipos registrados."/>
        <h2 className="text-[14px] font-semibold text-neutral-800">Anticipos aplicados a liquidaciones</h2>
        <StaffTable rows={displayedAllocations} columns={allocationColumns} getId={rowId}
          initialSort="period" emptyMessage="No hay anticipos aplicados."/>
      </div>

      <p className="text-[11px] text-neutral-500">Versión de desarrollo: las tarifas aplican por jornada completa y día de semana. Feriados especiales, horarios parciales y automatizaciones no están habilitados.</p>

      <AttendanceSaveConfirmModal open={confirmOperation==='week'}
        changes={weeklyChangeList} nameFor={nameFor} busy={busy}
        onConfirm={()=>void confirmChanges()}
        onClose={()=>{if(!busy)setConfirmOperation(null);}}/>
      <ConfirmDialog open={confirmOperation==='approve' || confirmOperation==='batch'}
        title={confirmOperation==='approve'?'Aprobar asistencias':'Confirmar liquidaciones'}
        theme="light" isLoading={busy}
        confirmLabel={confirmOperation==='approve'?'Aprobar registros':'Generar liquidaciones'}
        description={confirmOperation==='approve'
          ? `Vas a aprobar ${approvalIds.length} asistencias en una sola operación. Sus importes quedarán fijados según la tarifa vigente en cada día.`
          : `Vas a generar ${batchIds.length} liquidaciones del ${dayLabel(from)} al ${dayLabel(to)}. Esta operación fija los importes históricos y no puede deshacerse desde la interfaz.`}
        onConfirm={confirmChanges} onCancel={()=>{if(!busy)setConfirmOperation(null);}}/>
      {receipt ? <PayrollReceiptModal payroll={receipt.payroll} dashboard={receipt.data}
        employeeName={receipt.data.employees.find(e=>e.id===receipt.payroll.employee_id)?.full_name ?? 'Empleado'}
        onClose={()=>setReceipt(null)} /> : null}
      {editor ? <StaffEditorModal draft={editor} onChange={setEditor} onClose={closeEditor}
        onSave={() => void saveEditor()} busy={busy} dashboard={dashboard}/> : null}
    </div>
  );
}
