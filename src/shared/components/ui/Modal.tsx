'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/utils/cn';
import { useSmartModalViewport } from '@/shared/hooks/useSmartModalViewport';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';

interface ModalProps {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  panelClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'light' | 'dark';
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

function isFormControl(element: Element | null): element is HTMLElement {
  return Boolean(element?.matches('input, textarea, select, [role="combobox"], [contenteditable="true"]'));
}

export function Modal({ open, title, children, onClose, className, panelClassName, size = 'md', theme = 'light' }: ModalProps) {
  const viewport = useSmartModalViewport(16);
  const panelRef = useRef<HTMLElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    let timeout = 0;
    function keepFocusedControlVisible(target?: EventTarget | null) {
      const element = target instanceof Element ? target : document.activeElement;
      if (!isFormControl(element) || !panelRef.current?.contains(element)) return;

      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }, 180);
    }

    function onFocusIn(event: FocusEvent) {
      keepFocusedControlVisible(event.target);
    }

    function onViewportChange() {
      keepFocusedControlVisible();
    }

    const panel = panelRef.current;
    panel?.addEventListener('focusin', onFocusIn);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);

    return () => {
      window.clearTimeout(timeout);
      panel?.removeEventListener('focusin', onFocusIn);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const isDark = theme === 'dark';

  return createPortal(
    <div
      data-lcb-scroll-lock-overlay="true"
      className={cn('fixed z-[100] flex items-start justify-center overflow-hidden bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4', className)}
      style={{
        top: viewport.offsetTop,
        left: viewport.offsetLeft,
        width: viewport.width,
        height: viewport.height,
      }}
      onMouseDown={onClose}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Ventana de diálogo'}
        className={cn(
          'my-auto flex w-full min-w-0 flex-col overflow-hidden rounded-sm border shadow-dark',
          sizes[size],
          isDark ? 'border-white/10 bg-[#191919] text-white skeleton-dark' : 'border-neutral-200 bg-white text-central-carbon',
          panelClassName,
        )}
        style={{ maxHeight: viewport.maxHeight }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-current/10 px-3.5 py-3 sm:px-5 sm:py-4">
          {title ? <h2 className="min-w-0 text-base font-black tracking-tight sm:text-xl">{title}</h2> : <span />}
          <button className="shrink-0 rounded-full p-2 text-current/70 transition hover:bg-current/10 hover:text-current" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>
        <div
          ref={scrollAreaRef}
          className="keyboard-aware-scroll custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3.5 py-3.5 pb-[calc(.875rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-4"
        >
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}
