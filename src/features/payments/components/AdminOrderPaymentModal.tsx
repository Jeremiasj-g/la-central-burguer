'use client';

import { useEffect, useRef, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, History, RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import type { Order } from '@/features/pedidos/types/pedido.types';
import { Modal } from '@/shared/components/ui/Modal';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';
import {
  getAdminOrderPaymentState,
  setAdminOrderPaymentPlan,
  confirmAdminOrderPayment,
  reverseAdminOrderPayment,
  refundAdminOrderPayment,
  type AdminOrderPaymentState,
} from '../services/admin-payments.service';
import { splitPayment } from '../utils/payment.utils';
import type { PaymentMethod } from '../types/payment.types';

const fieldClass = '!h-11 !rounded-[11px] !border-neutral-200 !bg-white !text-neutral-900 !text-[13px] !font-normal placeholder:!text-neutral-400';

function moneyInput(value: string): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const result = Number(value.replace(',', '.'));
  return Number.isFinite(result) ? result : null;
}

export function AdminOrderPaymentModal({ order, onClose, onSaved }: {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<AdminOrderPaymentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transferInput, setTransferInput] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('transferencia');
  const [amountInput, setAmountInput] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reversalId, setReversalId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reverseConfirmOpen, setReverseConfirmOpen] = useState(false);
  const [adjustmentKind, setAdjustmentKind] = useState<'reversal' | 'refund'>('reversal');
  const paymentKey = useRef<string | null>(null);
  const reverseKey = useRef<string | null>(null);

  async function load(firstLoad = false) {
    setLoadError(null);
    try {
      const result = await getAdminOrderPaymentState(order.id);
      setData(result);
      if (firstLoad) {
        const proposal = result.plan?.transfer ??
          (result.preference === 'transferencia' ? result.total : 0);
        setTransferInput(String(proposal));
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudieron consultar los cobros.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
    // Order is fixed for the lifetime of the modal (keyed by id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const transfer = moneyInput(transferInput);
  const split = data && transfer !== null
    ? (() => { try { return splitPayment(data.total, transfer); } catch { return null; } })()
    : null;
  const plannedTransfer = data?.plan?.transfer ?? 0;
  const plannedCash = data?.plan?.cash ?? 0;
  const planChanged = Boolean(split && data?.plan &&
    (split.transfer !== plannedTransfer || split.cash !== plannedCash));
  const isCanceled = data?.status === 'cancelado';
  const canSavePlan = Boolean(split && !busy && !loading && !isCanceled
    && (!data?.plan || planChanged));
  const paidTransfer = data?.summary.transfer ?? 0;
  const paidCash = data?.summary.cash ?? 0;
  const remainingTransfer = Math.max(0, plannedTransfer - paidTransfer);
  const remainingCash = Math.max(0, plannedCash - paidCash);
  const amount = moneyInput(amountInput);
  const methodRemaining = method === 'transferencia' ? remainingTransfer : remainingCash;
  const deliveryCashBlocked = method === 'efectivo' && data?.deliveryMethod === 'delivery';
  const canConfirm = Boolean(data?.plan && !planChanged && !busy && !isCanceled
    && amount !== null && amount > 0 && amount <= methodRemaining && !deliveryCashBlocked);
  const selectedReversal = data?.movements.find(m => m.id === reversalId);
  const isReversed = (id: string) => Boolean(data?.movements.some(m => m.relatedMovementId === id));
  const canReverse = Boolean(selectedReversal?.kind === 'payment'
    && (adjustmentKind === 'refund'
      ? ['admin','counter'].includes(selectedReversal.source)
      : selectedReversal.source === 'admin')
    && !isReversed(selectedReversal.id) && reverseReason.trim().length >= 8 && !busy);

  async function savePlan() {
    if (!split || !data || !canSavePlan) return;
    setBusy(true);
    try {
      await setAdminOrderPaymentPlan(order.id, split.transfer, split.cash);
      await load();
      setAmountInput('');
      paymentKey.current = null;
      toast.success('Distribución de cobro guardada.');
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la distribución.');
    } finally { setBusy(false); }
  }

  async function confirmPayment() {
    if (!canConfirm || amount === null) return;
    setBusy(true);
    try {
      paymentKey.current ??= crypto.randomUUID();
      await confirmAdminOrderPayment(order.id, method, amount, paymentKey.current);
      paymentKey.current = null;
      setConfirmOpen(false);
      setAmountInput('');
      await load();
      onSaved();
      toast.success('Cobro confirmado y registrado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo confirmar el cobro.');
    } finally { setBusy(false); }
  }

  async function reversePayment() {
    if (!selectedReversal || !canReverse) return;
    setBusy(true);
    try {
      reverseKey.current ??= crypto.randomUUID();
      if (adjustmentKind === 'refund') {
        await refundAdminOrderPayment(selectedReversal.id, reverseReason, reverseKey.current);
      } else {
        await reverseAdminOrderPayment(selectedReversal.id, reverseReason, reverseKey.current);
      }
      reverseKey.current = null;
      setReverseConfirmOpen(false);
      setReversalId(null);
      setReverseReason('');
      await load();
      onSaved();
      toast.success(adjustmentKind === 'refund' ? 'Reintegro registrado con su motivo.' : 'Corrección registrada con su motivo.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo corregir el cobro.');
    } finally { setBusy(false); }
  }

  const summary = data?.summary;
  const statusLabel = summary?.status === 'cobrado' ? 'Cobrado'
    : summary?.status === 'parcial' ? 'Cobrado parcialmente'
    : summary?.status === 'excedente' ? 'Requiere revisión' : 'Sin cobrar';

  return (
    <>
      <Modal open onClose={() => { if (!busy) onClose(); }}
        title={`Cobro · ${order.orderCode}`} size="md" theme="light"
        panelClassName="!rounded-[20px]" titleClassName="!text-[17px] !font-semibold"
        footerClassName="border-t border-neutral-100 px-4 py-3 sm:px-5"
        footer={<Button type="button" variant="secondary" onClick={onClose} disabled={busy}
          className="!h-10 !rounded-[11px] !text-[12px]">Cerrar</Button>}>
        {loading ? (
          <p role="status" className="py-8 text-center text-[12px] text-neutral-500">Consultando cobros...</p>
        ) : loadError || !data ? (
          <div role="alert" className="space-y-3 py-3 text-[12px] text-red-600">
            <p>{loadError ?? 'No hay datos del pedido.'}</p>
            <Button variant="secondary" onClick={() => { setLoading(true); void load(true); }}>Reintentar</Button>
          </div>
        ) : (
          <div className="space-y-5 text-[13px] text-neutral-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] text-neutral-500">Total del pedido</p>
                <p className="mt-1 text-[28px] font-semibold leading-none tracking-[-.045em] text-neutral-950">
                  {formatCurrency(data.total)}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${summary?.status === 'cobrado'
                ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{statusLabel}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 border-y border-neutral-100 py-3">
              <div>
                <p className="text-[11px] text-neutral-500">Recibido</p>
                <p className="mt-1 text-[17px] font-semibold tabular-nums">{formatCurrency(summary?.received ?? 0)}</p>
              </div>
              <div>
                <p className="text-[11px] text-neutral-500">Pendiente del cliente</p>
                <p className="mt-1 text-[17px] font-semibold tabular-nums">{formatCurrency(summary?.pending ?? 0)}</p>
              </div>
            </div>

            {data.legacy && !data.plan && data.movements.length === 0 ? (
              <p className="text-[11px] leading-5 text-amber-800">
                Pedido anterior al nuevo registro de cobros. Su medio de pago declarado
                no demuestra que el dinero haya sido recibido.
              </p>
            ) : null}
            {summary && summary.overpaid > 0 ? (
              <p role="alert" className="text-[11px] text-red-600">
                Hay {formatCurrency(summary.overpaid)} cobrados de más. Requiere un ajuste autorizado.
              </p>
            ) : null}

            <section aria-label="Distribución prevista del cobro" className="space-y-2">
              <h3 className="text-[14px] font-semibold text-neutral-900">Distribución del pago</h3>
              <p className="text-[11px] leading-5 text-neutral-500">
                Indicá cuánto se pagará por transferencia. El efectivo se calcula solo.
                Esto no confirma dinero recibido.
              </p>
              <label htmlFor="payment-transfer-plan" className="block text-[12px] font-medium text-neutral-700">
                Transferencia prevista
              </label>
              <Input id="payment-transfer-plan" type="text" inputMode="decimal" value={transferInput}
                onChange={event => setTransferInput(event.target.value)} disabled={busy || isCanceled}
                placeholder="0" className={fieldClass} />
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-[12px] text-neutral-500">Efectivo previsto</span>
                <strong className="tabular-nums">{split ? formatCurrency(split.cash) : '—'}</strong>
              </div>
              {!split ? <p role="alert" className="text-[11px] text-red-600">Ingresá un importe válido entre $0 y el total.</p> : null}
              <Button type="button" onClick={() => void savePlan()} disabled={!canSavePlan}
                className="!h-10 !w-full !rounded-[11px] !bg-[#191b20] !text-[12px] !font-medium">
                Guardar distribución
              </Button>
            </section>

            <section aria-label="Confirmar dinero recibido" className="space-y-2 border-t border-neutral-100 pt-4">
              <h3 className="text-[14px] font-semibold text-neutral-900">Confirmar cobro recibido</h3>
              <p className="text-[11px] leading-5 text-neutral-500">
                Confirmá una transferencia solo después de verla acreditada.
                El efectivo se confirma al recibirlo.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(['transferencia','efectivo'] as const).map(value => (
                  <button key={value} type="button" disabled={busy}
                    aria-pressed={method === value}
                    onClick={() => {
                      setMethod(value);
                      setAmountInput('');
                      paymentKey.current = null;
                    }}
                    className={`flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[12px] font-medium transition-colors duration-200 ${method === value
                      ? 'bg-[#191b20] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
                    {value === 'transferencia' ? <CreditCard size={15} /> : <Banknote size={15} />}
                    {value === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-neutral-500">
                Disponible para confirmar: <strong className="text-neutral-800">{formatCurrency(methodRemaining)}</strong>
              </p>
              {deliveryCashBlocked ? (
                <p className="text-[11px] leading-5 text-amber-800">
                  El efectivo de delivery lo confirmará el repartidor cuando entregue el pedido.
                </p>
              ) : null}
              {planChanged ? (
                <p className="text-[11px] text-amber-800">Guardá primero la nueva distribución.</p>
              ) : null}
              <label htmlFor="payment-amount" className="block text-[12px] font-medium text-neutral-700">
                Importe recibido
              </label>
              <Input id="payment-amount" type="text" inputMode="decimal"
                value={amountInput} onChange={event => {
                  setAmountInput(event.target.value);
                  paymentKey.current = null;
                }}
                disabled={busy || isCanceled || !data.plan || deliveryCashBlocked}
                placeholder="Importe recibido" className={fieldClass} />
              <Button type="button" disabled={!canConfirm} onClick={() => setConfirmOpen(true)}
                className="!h-10 !w-full !rounded-[11px] !bg-emerald-700 !text-[12px] !font-medium hover:!bg-emerald-800">
                <CheckCircle2 size={16} /> Confirmar {method === 'transferencia' ? 'transferencia' : 'efectivo'}
              </Button>
            </section>

            <section aria-label="Historial de movimientos" className="space-y-2 border-t border-neutral-100 pt-4">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
                <History size={16} /> Movimientos registrados
              </h3>
              {data.movements.length === 0 ? (
                <p className="text-[11px] text-neutral-500">Todavía no hay cobros confirmados en este registro.</p>
              ) : (
                <div className="max-h-56 divide-y divide-neutral-100 overflow-y-auto">
                  {data.movements.map(movement => (
                    <div key={movement.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-neutral-800">
                          {movement.kind === 'payment' ? 'Cobro' : movement.kind === 'refund' ? 'Reintegro' : 'Corrección'}
                          {' · '}{movement.method === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                        </p>
                        <p className="mt-0.5 text-[10px] text-neutral-500">{formatDateTime(movement.confirmedAt)}</p>
                        {movement.reason ? <p className="mt-1 text-[10px] text-neutral-500">{movement.reason}</p> : null}
                        {movement.kind === 'payment' && ['admin','counter'].includes(movement.source) && !isReversed(movement.id) && !isCanceled ? (
                          <button type="button" onClick={() => {
                            setReversalId(movement.id);
                            setAdjustmentKind(movement.source === 'counter' ? 'refund' : 'reversal');
                            setReverseReason('');
                            reverseKey.current = null;
                          }} className="mt-1 inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline">
                            <RotateCcw size={12}/> {movement.source === 'counter' ? 'Registrar reintegro' : 'Corregir o reintegrar'}
                          </button>
                        ) : null}
                      </div>
                      <strong className="shrink-0 text-[12px] tabular-nums">
                        {movement.kind === 'payment' ? '+' : '−'}{formatCurrency(movement.amount)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
              {selectedReversal && !isReversed(selectedReversal.id) ? (
                <div className="space-y-2 border-t border-neutral-100 pt-3">
                  <p className="text-[12px] font-medium text-neutral-700">
                    {adjustmentKind === 'refund' ? 'Reintegrar' : 'Corregir'} {formatCurrency(selectedReversal.amount)} de {selectedReversal.method}
                  </p>
                  {selectedReversal.source === 'admin' ? (
                    <div className="flex gap-2 text-[11px]">
                      <button type="button" className={adjustmentKind === 'reversal' ? 'font-semibold text-neutral-900' : 'text-neutral-500'} onClick={() => { setAdjustmentKind('reversal'); reverseKey.current = null; }}>Error de registro</button>
                      <button type="button" className={adjustmentKind === 'refund' ? 'font-semibold text-neutral-900' : 'text-neutral-500'} onClick={() => { setAdjustmentKind('refund'); reverseKey.current = null; }}>Dinero devuelto</button>
                    </div>
                  ) : null}
                  {adjustmentKind === 'refund' ? (
                    <p className="text-[11px] text-amber-800">Registrá este reintegro únicamente después de devolver la totalidad del importe al cliente.</p>
                  ) : null}
                  <label htmlFor="payment-reversal-reason" className="text-[11px] text-neutral-600">
                    Motivo de corrección
                  </label>
                  <Input id="payment-reversal-reason" value={reverseReason} maxLength={400}
                    onChange={event => { setReverseReason(event.target.value); reverseKey.current = null; }}
                    placeholder="Ej.: se registró como transferencia por error"
                    className={fieldClass} disabled={busy} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setReversalId(null)}
                      disabled={busy} className="!rounded-[10px] !text-[11px]">Cancelar</Button>
                    <Button type="button" variant="danger" size="sm" disabled={!canReverse}
                      onClick={() => setReverseConfirmOpen(true)} className="!rounded-[10px] !text-[11px]">
                      {adjustmentKind === 'refund' ? 'Registrar reintegro' : 'Confirmar corrección'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={confirmOpen} theme="light" title="Confirmar dinero recibido"
        description={`¿Verificaste que recibiste ${formatCurrency(amount ?? 0)} por ${method}? Este movimiento quedará registrado.`}
        confirmLabel="Sí, registrar cobro" isLoading={busy}
        onCancel={() => { if (!busy) setConfirmOpen(false); }}
        onConfirm={() => void confirmPayment()} />
      <ConfirmDialog open={reverseConfirmOpen} theme="light" title={adjustmentKind === 'refund' ? 'Registrar dinero reintegrado' : 'Revertir cobro'}
        tone="danger"
        description={adjustmentKind === 'refund' ? `¿Confirmás que ya devolviste ${formatCurrency(selectedReversal?.amount ?? 0)} al cliente por ${selectedReversal?.method}? Quedará registrado en el historial.` : `Se registrará la reversión de ${formatCurrency(selectedReversal?.amount ?? 0)}. El movimiento original permanecerá en el historial.`}
        confirmLabel="Sí, corregir" isLoading={busy}
        onCancel={() => { if (!busy) setReverseConfirmOpen(false); }}
        onConfirm={() => void reversePayment()} />
    </>
  );
}
