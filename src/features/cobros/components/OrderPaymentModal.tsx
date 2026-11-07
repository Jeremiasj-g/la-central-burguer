'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, History, Info, RotateCcw, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Modal } from '@/shared/components/ui/Modal';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';
import {
  confirmOrderPayment, getOrderPaymentDetail, paymentAmounts,
  reverseOrderPayment, saveOrderPaymentPlan,
  type OrderPaymentDetail, type PaymentMethod,
} from '../services/payment.service';

const moneyInput = '!h-11 !rounded-[11px] !border-neutral-200 !bg-white !text-[14px] !text-neutral-950 placeholder:!text-neutral-400';

function MoneyInput({ id, label, value, onChange, max, disabled }: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  max: number;
  disabled?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[12px] font-medium text-neutral-700">{label}</span>
      <Input id={id} type="number" inputMode="decimal" min={0} max={max} step={0.01}
        disabled={disabled} value={value} onChange={event => onChange(event.target.value)}
        placeholder="Importe en pesos" className={moneyInput}/>
    </label>
  );
}

const preferenceLabel: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mixto: 'Efectivo y transferencia',
};

export function OrderPaymentModal({ orderId, onClose, onSaved }: {
  orderId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [detail, setDetail] = useState<OrderPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [planValue, setPlanValue] = useState('');
  const [transferValue, setTransferValue] = useState('');
  const [cashValue, setCashValue] = useState('');
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const reload = useCallback(async () => {
    const next = await getOrderPaymentDetail(orderId);
    setDetail(next);
    setPlanValue(next.transferExpected === null ? '' : String(next.transferExpected));
    return next;
  }, [orderId]);

  useEffect(() => {
    let active = true;
    void getOrderPaymentDetail(orderId)
      .then(next => {
        if (!active) return;
        setDetail(next);
        setPlanValue(next.transferExpected === null ? '' : String(next.transferExpected));
      })
      .catch(error => {
        if (active) toast.error(error instanceof Error ? error.message : 'No se pudo cargar el cobro.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId]);

  async function perform(action: () => Promise<OrderPaymentDetail>, message: string) {
    if (busy) return;
    setBusy(true);
    try {
      const next = await action();
      setDetail(next);
      setPlanValue(next.transferExpected === null ? '' : String(next.transferExpected));
      setCashValue('');
      setTransferValue('');
      setCorrectionId(null);
      setReason('');
      toast.success(message);
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo completar la operación.');
      // No se cambia el estado visual si la operación fue rechazada.
      await reload().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (!detail && !loading) {
    return <Modal open onClose={onClose} title="Cobro del pedido" theme="light" size="md">
      <p className="py-6 text-[13px] text-neutral-600">No pudimos cargar el estado de cobro.</p>
      <Button variant="secondary" onClick={() => { setLoading(true); void reload().finally(() => setLoading(false)); }}>
        Reintentar
      </Button>
    </Modal>;
  }

  const confirmed = detail ? paymentAmounts(detail) : null;
  const editingPlan = detail && planValue !== '' && Number.isFinite(Number(planValue))
    && Number(planValue) >= 0 && Number(planValue) <= detail.total
    && Number(planValue) !== detail.transferExpected;
  const allowed = detail?.status !== 'cancelado' && (detail?.deliveryMethod === 'retiro_local' || detail?.status !== 'entregado');
  const planReady = detail?.trackingEnabled && detail.transferExpected !== null;
  const transferAmount = Number(transferValue);
  const cashAmount = Number(cashValue);
  const transferAvailable = detail && confirmed && planReady
    ? Math.min(confirmed.remaining, Math.max(0, detail.transferExpected! - detail.transferConfirmed))
    : 0;
  const cashAvailable = detail && confirmed && planReady
    ? Math.min(confirmed.remaining, Math.max(0, detail.total - detail.transferExpected! - detail.cashConfirmed))
    : 0;
  const hasValidTransfer = transferValue.trim() && transferAmount > 0 && transferAmount <= transferAvailable && Number.isFinite(transferAmount);
  const hasValidCash = cashValue.trim() && cashAmount > 0 && cashAmount <= cashAvailable && Number.isFinite(cashAmount);

  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} title={detail ? `Cobro · ${detail.orderCode}` : 'Cobro del pedido'}
      theme="light" size="lg" panelClassName="!rounded-[20px]">
      {loading || !detail || !confirmed ? (
        <p role="status" className="py-10 text-center text-[13px] text-neutral-500">Consultando el cobro...</p>
      ) : (
        <div className="space-y-5 pb-1">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[.09em] text-neutral-400">Total del pedido</p>
              <p className="mt-1 text-[28px] font-semibold tracking-[-.045em] tabular-nums text-neutral-950">
                {formatCurrency(detail.total)}
              </p>
              <p className="mt-1 text-[12px] text-neutral-500">
                El cliente eligió: {preferenceLabel[detail.preference] ?? detail.preference}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${confirmed.remaining===0 ? 'bg-emerald-50 text-emerald-700' : confirmed.confirmed>0 ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-600'}`}>
              {confirmed.remaining===0 ? 'Cobrado' : confirmed.confirmed>0 ? 'Pago parcial' : 'Sin cobrar'}
            </span>
          </div>

          {!detail.trackingEnabled ? (
            <p role="note" className="flex gap-2 text-[12px] leading-5 text-amber-800">
              <Info size={17} className="mt-0.5 shrink-0" />
              Este pedido es anterior al sistema de cobros verificados. Su medio declarado no prueba que el dinero se haya recibido. Al registrar un cobro comenzarás un historial nuevo.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <div><p className="text-[11px] text-neutral-500">Transferencia verificada</p><p className="mt-1 text-[17px] font-semibold tabular-nums text-neutral-900">{formatCurrency(detail.transferConfirmed)}</p></div>
            <div><p className="text-[11px] text-neutral-500">Efectivo recibido</p><p className="mt-1 text-[17px] font-semibold tabular-nums text-neutral-900">{formatCurrency(detail.cashConfirmed)}</p></div>
            <div><p className="text-[11px] text-neutral-500">Saldo pendiente</p><p className="mt-1 text-[17px] font-semibold tabular-nums text-central-orange">{formatCurrency(confirmed.remaining)}</p></div>
          </div>

          {detail.requiresRefund ? (
            <p role="alert" className="text-[12px] leading-5 text-red-700">Pedido cancelado con dinero recibido. Requiere registrar su devolución para conciliar los cobros.</p>
          ) : null}

          {allowed ? (
            <>
              <section className="space-y-3 border-t border-neutral-100 pt-4">
                <div className="flex items-center gap-2"><Wallet size={17} className="text-neutral-500"/><h3 className="text-[14px] font-semibold text-neutral-900">Distribución acordada</h3></div>
                <p className="text-[12px] leading-5 text-neutral-500">Ingresá solo cuánto va a transferir el cliente. El sistema calcula el efectivo restante.</p>
                <MoneyInput id="payment-plan-transfer" label="Transferencia prevista" value={planValue} onChange={setPlanValue} max={detail.total} disabled={busy}/>
                {planValue.trim() !== '' && Number(planValue) >= 0 && Number(planValue) <= detail.total ? (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-neutral-500">Efectivo previsto</span>
                    <strong className="text-neutral-900">{formatCurrency(detail.total - Number(planValue))}</strong>
                  </div>
                ) : null}
                <Button type="button" size="sm" disabled={!editingPlan || busy}
                  onClick={() => void perform(() => saveOrderPaymentPlan(orderId, Number(planValue)), 'Desglose actualizado.')}>
                  Guardar desglose
                </Button>
                {detail.transferExpected === null ? <p className="text-[11px] text-amber-700">Definí el desglose antes de confirmar cobros o asignar un reparto.</p> : null}
              </section>

              {planReady && confirmed.remaining > 0 ? (
                <section className="space-y-3 border-t border-neutral-100 pt-4">
                  <h3 className="text-[14px] font-semibold text-neutral-900">Confirmar dinero recibido</h3>
                  <p className="text-[11px] leading-5 text-neutral-500">Confirmá transferencias únicamente después de verificar su acreditación bancaria.</p>
                  {transferAvailable > 0 ? (
                    <div className="space-y-2">
                      <MoneyInput id="payment-transfer-received" label={`Transferencia acreditada · máx. ${formatCurrency(transferAvailable)}`}
                        value={transferValue} onChange={setTransferValue} max={transferAvailable} disabled={busy}/>
                      <Button size="sm" type="button" disabled={!hasValidTransfer || busy}
                        onClick={() => void perform(() => confirmOrderPayment(orderId,'transferencia',transferAmount,crypto.randomUUID()),'Transferencia verificada.')}>
                        <CreditCard size={15}/> Confirmar transferencia
                      </Button>
                    </div>
                  ) : null}
                  {cashAvailable > 0 ? (
                    <div className="space-y-2">
                      <MoneyInput id="payment-cash-received" label={`Efectivo recibido en el local · máx. ${formatCurrency(cashAvailable)}`}
                        value={cashValue} onChange={setCashValue} max={cashAvailable} disabled={busy}/>
                      <Button size="sm" type="button" variant="secondary" disabled={!hasValidCash || busy}
                        onClick={() => void perform(() => confirmOrderPayment(orderId,'efectivo',cashAmount,crypto.randomUUID()),'Efectivo registrado.')}>
                        <Banknote size={15}/> Confirmar efectivo
                      </Button>
                      {detail.deliveryMethod === 'delivery' ? <p className="text-[11px] text-neutral-500">Si ya se asignó el reparto, el efectivo debe confirmarlo el repartidor al entregar.</p> : null}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}

          <section className="border-t border-neutral-100 pt-4">
            <div className="mb-3 flex items-center gap-2"><History size={16} className="text-neutral-500"/><h3 className="text-[14px] font-semibold text-neutral-900">Movimientos registrados</h3></div>
            {detail.movements.length === 0 ? <p className="text-[12px] text-neutral-500">Todavía no hay cobros verificados para este pedido.</p> : (
              <div className="max-h-[250px] divide-y divide-neutral-100 overflow-y-auto">
                {detail.movements.map(movement => {
                  const reversed = detail.movements.some(m => m.reversedPaymentId === movement.id);
                  return <div key={movement.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-900">
                          {movement.movementType === 'receipt' ? <CheckCircle2 size={14} className="text-emerald-600"/> : <RotateCcw size={14} className="text-red-500"/>}
                          {movement.method === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                          {movement.movementType !== 'receipt' ? ' · Reversión/devolución' : ''}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">{formatDateTime(movement.confirmedAt)} · {movement.source === 'driver' ? 'Repartidor' : 'Local'}</p>
                        {movement.note ? <p className="mt-1 break-words text-[11px] text-neutral-500">{movement.note}</p> : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[13px] font-semibold tabular-nums text-neutral-900">
                          {movement.movementType === 'receipt' ? '+' : '−'}{formatCurrency(movement.amount)}
                        </p>
                        {movement.movementType === 'receipt' && !reversed ? (
                          <button type="button" disabled={busy} onClick={() => { setCorrectionId(movement.id); setReason(''); }}
                            className="mt-1 min-h-8 text-[11px] font-medium text-neutral-500 underline underline-offset-2 hover:text-red-600">
                            Corregir
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {correctionId === movement.id ? (
                      <div className="mt-3 space-y-2">
                        <label className="block text-[11px] font-medium text-neutral-600" htmlFor="payment-correction-reason">Motivo de la corrección o devolución</label>
                        <Input id="payment-correction-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={300}
                          placeholder="Ej.: registrado en el medio equivocado" className={moneyInput}/>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setCorrectionId(null)} disabled={busy}>Cancelar</Button>
                          <Button size="sm" disabled={reason.trim().length < 8 || busy}
                            onClick={() => void perform(() => reverseOrderPayment(movement.id,reason,crypto.randomUUID()),'Corrección registrada con historial.')}>
                            Confirmar corrección
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>;
                })}
              </div>
            )}
          </section>

          {detail.issues.some(issue => issue.status==='open') ? (
            <section className="border-t border-neutral-100 pt-4">
              <h3 className="text-[13px] font-semibold text-red-700">Incidencias informadas por reparto</h3>
              {detail.issues.filter(issue=>issue.status==='open').map(issue => (
                <p key={issue.id} className="mt-2 text-[12px] leading-5 text-neutral-600">{issue.details}</p>
              ))}
            </section>
          ) : null}
          <p className="border-t border-neutral-100 pt-3 text-[11px] leading-5 text-neutral-500">
            La preferencia del cliente no confirma un pago. Los movimientos se registran con fecha y responsable; la rendición de los repartidores es independiente del cobro al cliente.
          </p>
        </div>
      )}
    </Modal>
  );
}
