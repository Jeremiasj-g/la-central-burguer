import { env, requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { StaffDashboard, StaffAttendanceKind, StaffPaymentKind } from '../types/staff-payroll.types';

type RpcError = { message: string } | null;
type RpcInvoker = <T>(name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError }>;

async function staffRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  requireSupabaseConfigured('gestionar pagos a empleados');
  // Primera versión de prueba: no permitir lecturas ni operaciones contra producción.
  if (new URL(env.supabaseUrl).hostname !== 'vsfcjmyiiviyydvbdlrn.supabase.co') {
    throw new Error('Pago a empleados V1 está habilitado únicamente para Supabase central-burguer-dev. Revisá .env.local.');
  }
  const client = getSupabaseBrowserClient();
  const invoke = client.rpc.bind(client) as unknown as RpcInvoker;
  const { data, error } = await invoke<T>(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const readStaffDashboard = (fromDay: string, toDay: string) =>
  staffRpc<StaffDashboard>('admin_staff_dashboard', { from_day: fromDay, to_day: toDay });

export const addStaffRate = (employeeId: string, effectiveFrom: string, weekday: number, saturday: number, sunday: number) =>
  staffRpc<string>('admin_staff_add_rate', {
    employee_uuid: employeeId, valid_from: effectiveFrom,
    weekday_value: weekday, saturday_value: saturday, sunday_value: sunday,
  });

export const saveStaffAttendance = (
  employeeId: string, day: string, kind: StaffAttendanceKind, notes: string, reason: string,
) => staffRpc<string>('admin_staff_save_attendance', {
  employee_uuid: employeeId, attendance_day: day, attendance_value: kind,
  attendance_notes: notes, correction_reason: reason || null,
});

export const approveStaffAttendance = (id: string) =>
  staffRpc<number>('admin_staff_approve_attendance', { attendance_uuid: id });

export const createStaffPayroll = (employeeId: string, fromDay: string, toDay: string, notes: string) =>
  staffRpc<string>('admin_staff_create_payroll', {
    employee_uuid: employeeId, from_day: fromDay, to_day: toDay, payroll_notes: notes,
  });

export const recordStaffPayment = (
  employeeId: string, payrollId: string | null, amount: number, date: string,
  kind: StaffPaymentKind, notes: string, requestKey: string,
) => staffRpc<string>('admin_staff_record_payment', {
  employee_uuid: employeeId, payroll_uuid: payrollId, payment_value: amount,
  payment_day: date, payment_type: kind, payment_notes: notes, request_uuid: requestKey,
});

export const applyStaffAdvance = (advanceId: string, payrollId: string, amount: number, requestKey: string) =>
  staffRpc<string>('admin_staff_apply_advance', {
    advance_uuid: advanceId, payroll_uuid: payrollId, allocation_value: amount, request_uuid: requestKey,
  });

export const reverseStaffPayment = (id: string, reason: string) =>
  staffRpc<void>('admin_staff_reverse_payment', { payment_uuid: id, reverse_reason: reason });

export const reverseStaffAllocation = (id: string, reason: string) =>
  staffRpc<void>('admin_staff_reverse_allocation', { allocation_uuid: id, reverse_reason: reason });

export interface StaffWeekChange {
  employee_id: string;
  day: string;
  kind: StaffAttendanceKind;
  expected_id: string | null;
}
export const saveStaffWeek = (changes: StaffWeekChange[]) =>
  staffRpc<number>('admin_staff_save_week', { jsonb_changes: changes });

export const createStaffPayrollBatch = (ids: string[], fromDay: string, toDay: string) =>
  staffRpc<{ employee_id: string; payroll_id: string }[]>('admin_staff_create_payroll_batch', {
    employee_uuids: ids, from_day: fromDay, to_day: toDay,
  });
