import type { StaffPayment } from '../types/staff-payroll.types';
import { exportSimpleTableToExcel } from '@/features/reportes/utils/xlsx-export.utils';

/** Excel real: mismos importes históricos, filtro y estado de reversión de la tabla. */
export function exportStaffMovementsExcel(
  payments: StaffPayment[], employeeName: (id: string) => string, filename: string,
) {
  exportSimpleTableToExcel({
    filename,
    sheetName: 'Movimientos personal',
    columns: [
      { key: 'id', header: 'ID', width: 39 },
      { key: 'fecha', header: 'Fecha', width: 16 },
      { key: 'empleado', header: 'Empleado', width: 32 },
      { key: 'tipo', header: 'Tipo', width: 23 },
      { key: 'importe', header: 'Importe ARS', width: 19, kind: 'currency' },
      { key: 'estado', header: 'Estado', width: 16 },
      { key: 'liquidacion', header: 'Liquidación ID', width: 39 },
      { key: 'observaciones', header: 'Observaciones', width: 44 },
      { key: 'reversion', header: 'Motivo reversión', width: 42 },
    ],
    rows: payments.map(payment => ({
      id: payment.id,
      fecha: payment.paid_on,
      empleado: employeeName(payment.employee_id),
      tipo: payment.payment_kind === 'advance' ? 'Anticipo' : 'Pago de liquidación',
      importe: Number(payment.amount),
      estado: payment.reversed_at ? 'Revertido' : 'Registrado',
      liquidacion: payment.payroll_id ?? '',
      observaciones: payment.notes ?? '',
      reversion: payment.reversal_reason ?? '',
    })),
  });
}
