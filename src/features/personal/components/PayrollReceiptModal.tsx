'use client';

import { Printer } from 'lucide-react';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { formatCurrency } from '@/shared/utils/format.utils';
import { getPayrollBalance, type StaffDashboard, type StaffPayroll } from '../types/staff-payroll.types';

const dateLabel = (value: string) => value.split('-').reverse().join('/');

export function PayrollReceiptModal({
  payroll, dashboard, employeeName, onClose,
}: {
  payroll: StaffPayroll;
  dashboard: StaffDashboard;
  employeeName: string;
  onClose: () => void;
}) {
  const lines = dashboard.lines.filter(line=>line.payroll_id===payroll.id)
    .map(line=>({line,attendance:dashboard.attendance.find(a=>a.id===line.attendance_id)}));
  const balance = getPayrollBalance(payroll.id,dashboard);
  const payments = dashboard.payments.filter(p=>p.payroll_id===payroll.id && !p.reversed_at);
  const advances = dashboard.allocations.filter(a=>a.payroll_id===payroll.id && !a.reversed_at);
  return <Modal open title="Detalle de liquidación" size="lg" theme="light" onClose={onClose}
    footer={<div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 px-4 py-3 sm:px-5">
      <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      <Button variant="primary" onClick={()=>window.print()}><Printer size={15} className="mr-1 inline"/>Imprimir / PDF</Button>
    </div>}>
    <style>{`@media print {
      body * { visibility: hidden !important; }
      #staff-receipt-print-area, #staff-receipt-print-area * { visibility: visible !important; }
      #staff-receipt-print-area { position: fixed !important; left: 0 !important; top: 0 !important; padding: 22mm !important; width: 100% !important; background: white !important; color: black !important; }
      @page { size: A4 portrait; margin: 0; }
    }`}</style>
    <article id="staff-receipt-print-area" className="space-y-5 text-[13px] text-neutral-800">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div><h2 className="text-xl font-semibold text-neutral-950">Resumen de liquidación</h2>
          <p className="mt-1 text-[11px] text-neutral-500">Comprobante de uso interno · No es un recibo de sueldo legal</p></div>
        <p className="text-right text-[11px] text-neutral-500">Liquidación {payroll.id.slice(0,8).toUpperCase()}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><p className="text-[11px] text-neutral-500">Personal</p><p className="font-medium">{employeeName}</p></div>
        <div><p className="text-[11px] text-neutral-500">Período</p><p className="font-medium">{dateLabel(payroll.period_from)} – {dateLabel(payroll.period_to)}</p></div>
      </div>
      <div>
        <p className="mb-2 font-semibold">Jornadas liquidadas</p>
        <table className="w-full border-collapse text-[12px]">
          <thead className="border-y border-neutral-200 bg-central-orange text-left text-white"><tr>
            <th className="py-2 font-medium">Fecha</th>
            <th className="py-2 font-medium">Registro</th>
            <th className="py-2 text-right font-medium">Tarifa aplicada</th>
          </tr></thead>
          <tbody>{lines.map(({line,attendance})=><tr key={line.id} className="border-b border-neutral-100">
            <td className="py-2">{attendance ? dateLabel(attendance.work_date) : 'Registro histórico'}</td>
            <td className="py-2">{attendance?.attendance_kind==='absent' ? 'Ausente' : 'Presente'}</td>
            <td className="py-2 text-right tabular-nums">{formatCurrency(Number(line.rate_amount_snapshot))}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="space-y-2 border-t border-neutral-200 pt-3 text-[12px]">
        <div className="flex justify-between gap-3"><span>Importe devengado</span><strong className="font-semibold">{formatCurrency(balance.gross)}</strong></div>
        {payments.map(payment=><div key={payment.id} className="flex justify-between gap-3 text-neutral-600">
          <span>Pago · {dateLabel(payment.paid_on)}</span><span className="tabular-nums">−{formatCurrency(Number(payment.amount))}</span>
        </div>)}
        {advances.map(allocation=><div key={allocation.id} className="flex justify-between gap-3 text-neutral-600">
          <span>Anticipo aplicado</span><span className="tabular-nums">−{formatCurrency(Number(allocation.amount))}</span>
        </div>)}
        <div className="flex justify-between gap-3 border-t border-neutral-200 pt-3 text-[14px] font-semibold">
          <span>Saldo pendiente</span><span className="tabular-nums">{formatCurrency(balance.pending)}</span>
        </div>
      </div>
      <p className="text-[11px] leading-5 text-neutral-500">
        Los importes corresponden a los valores históricos fijados al aprobar y liquidar.
        Este documento es informativo; el registro de pagos no implica transferencias bancarias automáticas.
      </p>
    </article>
  </Modal>;
}
