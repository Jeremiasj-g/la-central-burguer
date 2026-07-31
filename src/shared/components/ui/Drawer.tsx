'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/utils/cn';
import { useSmartModalViewport } from '@/shared/hooks/useSmartModalViewport';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Drawer({ open, onClose, title, children, footer, className }: DrawerProps) {
  const viewport = useSmartModalViewport(0);

  useBodyScrollLock(open);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-lcb-scroll-lock-overlay="true"
      className="fixed z-[90] bg-black/60 backdrop-blur-sm"
      style={{ top: viewport.offsetTop, left: viewport.offsetLeft, width: viewport.width, height: viewport.height }}
      onMouseDown={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('my-2 mr-2 ml-auto flex h-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md flex-col overflow-hidden rounded-sm border border-white/10 bg-central-ink text-white shadow-dark skeleton-dark sm:my-0 sm:mr-0 sm:h-full sm:max-h-dvh sm:w-full sm:rounded-none sm:border-0', className)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between px-4 py-3.5 sm:px-6 sm:py-5">
          <h2 className="text-xl font-black sm:text-2xl">{title}</h2>
          <button className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        <div className="keyboard-aware-scroll custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-3 pr-5 sm:px-6 sm:pb-4 sm:pr-7">{children}</div>
        {footer ? <footer className="shrink-0 border-t border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  );
}
