import type { StaffPayment } from '../types/staff-payroll.types';

// Escapar celdas y neutralizar fórmulas al abrir el CSV en Excel.
function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? '');
  const escaped = /^[=+@\-\t\r]/.test(text.trimStart()) ? '\'' + text : text;
  return '"' + escaped.replace(/"/g, '""') + '"';
}
export function toStaffMovementsCsv(payments: StaffPayment[], employeeName: (id:string)=>string) {
  const columns = ['ID','Fecha','Empleado','Tipo','Importe ARS','Estado','Liquidación ID','Observaciones','Motivo reversión'];
  const rows = payments.map(p => [
    p.id, p.paid_on, employeeName(p.employee_id),
    p.payment_kind === 'advance' ? 'Anticipo' : 'Pago de liquidación',
    Number(p.amount), p.reversed_at ? 'Revertido' : 'Registrado',
    p.payroll_id ?? '', p.notes ?? '', p.reversal_reason ?? '',
  ]);
  return [columns,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
