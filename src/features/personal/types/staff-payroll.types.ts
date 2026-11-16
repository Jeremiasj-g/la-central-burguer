export type StaffAttendanceKind = 'present' | 'absent';
export type StaffApprovalStatus = 'pending' | 'approved';
export type StaffPaymentKind = 'advance' | 'payroll';

export interface StaffEmployee {
  id: string;
  full_name: string;
  notes: string | null;
  profile_id: string | null;
  active: boolean;
  created_at: string;
}
export interface StaffRate {
  id: string;
  employee_id: string;
  effective_from: string;
  weekday_rate: number;
  saturday_rate: number;
  sunday_rate: number;
}
export interface StaffAttendance {
  id: string;
  employee_id: string;
  work_date: string;
  attendance_kind: StaffAttendanceKind;
  approval_status: StaffApprovalStatus;
  notes: string | null;
  rate_id: string | null;
  amount_snapshot: number | null;
}
export interface StaffPayroll {
  id: string;
  employee_id: string;
  period_from: string;
  period_to: string;
  notes: string | null;
  posted_at: string;
}
export interface StaffPayrollLine {
  id: string;
  payroll_id: string;
  attendance_id: string;
  rate_amount_snapshot: number;
}
export interface StaffPayment {
  id: string;
  employee_id: string;
  payroll_id: string | null;
  payment_kind: StaffPaymentKind;
  amount: number;
  paid_on: string;
  notes: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
}
export interface StaffAdvanceAllocation {
  id: string;
  advance_id: string;
  payroll_id: string;
  amount: number;
  reversed_at: string | null;
  reversal_reason: string | null;
}
export interface StaffDashboard {
  employees: StaffEmployee[];
  rates: StaffRate[];
  attendance: StaffAttendance[];
  payrolls: StaffPayroll[];
  lines: StaffPayrollLine[];
  payments: StaffPayment[];
  allocations: StaffAdvanceAllocation[];
}
export interface StaffPayrollBalance {
  gross: number;
  paid: number;
  applied: number;
  pending: number;
}
export function getPayrollBalance(id: string, dashboard: StaffDashboard): StaffPayrollBalance {
  const gross = dashboard.lines.filter((line) => line.payroll_id === id)
    .reduce((sum, line) => sum + Number(line.rate_amount_snapshot), 0);
  const paid = dashboard.payments.filter((pay) => pay.payroll_id === id && !pay.reversed_at)
    .reduce((sum, pay) => sum + Number(pay.amount), 0);
  const applied = dashboard.allocations.filter((allocation) => allocation.payroll_id === id && !allocation.reversed_at)
    .reduce((sum, allocation) => sum + Number(allocation.amount), 0);
  return { gross, paid, applied, pending: Math.max(0, Math.round((gross - paid - applied) * 100) / 100) };
}
export function getUnallocatedAdvance(id: string, dashboard: StaffDashboard): number {
  const advance = dashboard.payments.find((payment) => payment.id === id);
  if (!advance || advance.payment_kind !== 'advance' || advance.reversed_at) return 0;
  const allocated = dashboard.allocations.filter((item) => item.advance_id === id && !item.reversed_at)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  return Math.max(0, Math.round((Number(advance.amount) - allocated) * 100) / 100);
}
