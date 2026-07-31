'use client';

import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      theme="dark"
      panelClassName="w-[min(100%,28rem)] border-white/10 bg-[#191919]"
    >
      <div className="flex min-w-0 gap-3 sm:gap-4">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-sm border sm:h-11 sm:w-11 ${tone === 'danger' ? 'border-red-500/35 bg-red-500/10 text-red-300' : 'border-central-orange/35 bg-central-orange/10 text-central-orange'}`}>
          <AlertTriangle size={19} />
        </span>
        <p className="min-w-0 break-words text-sm leading-6 text-white/70">{description}</p>
      </div>
      <div className="mt-5 grid min-w-0 grid-cols-2 gap-2 border-t border-white/10 pt-4 sm:mt-6 sm:gap-3">
        <Button
          type="button"
          variant="dark"
          className="min-w-0 rounded-sm bg-white/10 px-2 text-sm hover:bg-white/15 sm:px-4"
          onClick={onCancel}
          disabled={isLoading}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={tone === 'danger' ? 'danger' : 'primary'}
          className="min-w-0 rounded-sm px-2 text-sm sm:px-4"
          onClick={() => void onConfirm()}
          disabled={isLoading}
        >
          {isLoading ? 'Procesando...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
