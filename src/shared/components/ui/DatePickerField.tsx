'use client';

import { ChevronDown, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/shared/utils/cn';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

function parseIsoDate(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    parsed.getFullYear() !== Number(year)
    || parsed.getMonth() !== Number(month) - 1
    || parsed.getDate() !== Number(day)
  ) {
    return undefined;
  }

  return parsed;
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function sameDay(left: Date | undefined, right: Date) {
  return Boolean(
    left
    && left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate(),
  );
}

function buildCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function DatePickerField({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  ariaLabel,
  disabled = false,
  className,
}: DatePickerFieldProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<'days' | 'months'>('days');
  const [position, setPosition] = useState({ top: 0, left: 0, width: 336 });

  const selected = useMemo(() => parseIsoDate(value), [value]);
  const [visibleMonth, setVisibleMonth] = useState<Date>(selected ?? new Date());
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (selected) setVisibleMonth(selected);
  }, [selected]);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isMobile = viewportWidth <= 560;
      const width = Math.min(336, viewportWidth - 24);
      const measuredHeight = popoverRef.current?.getBoundingClientRect().height ?? 390;

      if (isMobile) {
        setPosition({
          width,
          left: Math.max(12, (viewportWidth - width) / 2),
          top: Math.max(12, (viewportHeight - measuredHeight) / 2),
        });
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const left = Math.min(Math.max(12, rect.left), viewportWidth - width - 12);
      const preferredTop = rect.bottom + 8;
      const top = preferredTop + measuredHeight <= viewportHeight - 12
        ? preferredTop
        : Math.max(12, rect.top - measuredHeight - 8);

      setPosition({ width, left, top });
    }

    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
        setCalendarView('days');
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (calendarView === 'months') setCalendarView('days');
      else setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [calendarView, open]);

  function chooseDate(date: Date) {
    onChange(formatIsoDate(date));
    setVisibleMonth(date);
    setOpen(false);
    setCalendarView('days');
  }

  function handleToday() {
    chooseDate(new Date());
  }

  function handleClear() {
    onChange('');
    setOpen(false);
    setCalendarView('days');
  }

  function changeMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function changeYear(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear() + offset, current.getMonth(), 1));
  }

  function chooseMonth(monthIndex: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), monthIndex, 1));
    setCalendarView('days');
  }

  const visibleYear = visibleMonth.getFullYear();
  const visibleMonthIndex = visibleMonth.getMonth();
  const today = new Date();

  const popover = open && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Calendario para ${ariaLabel}`}
          className="lcb-calendar-popover fixed z-[140] rounded-[20px] border border-neutral-200 bg-white p-3.5 text-central-carbon shadow-[0_24px_70px_rgba(17,16,15,.18),0_4px_18px_rgba(17,16,15,.09)] backdrop-blur-xl"
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          <div className="grid grid-cols-[34px_minmax(0,1fr)_34px] items-center gap-2">
            <button
              type="button"
              className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-neutral-100 text-neutral-700 transition hover:bg-central-orange/10 hover:text-central-orange active:scale-95"
              onClick={() => calendarView === 'days' ? changeMonth(-1) : changeYear(-1)}
              aria-label={calendarView === 'days' ? 'Mes anterior' : 'Año anterior'}
            >
              <ChevronLeft size={17} />
            </button>

            <button
              type="button"
              className={cn(
                'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[10px] px-2.5 py-2 text-sm font-extrabold capitalize transition',
                calendarView === 'months'
                  ? 'bg-central-orange/10 text-central-orange'
                  : 'text-central-carbon hover:bg-central-orange/10 hover:text-central-orange',
              )}
              onClick={() => setCalendarView((current) => current === 'days' ? 'months' : 'days')}
              aria-label={calendarView === 'days' ? 'Elegir mes y año' : 'Volver al calendario'}
              aria-expanded={calendarView === 'months'}
            >
              <span className="truncate">
                {calendarView === 'days' ? `${MONTHS[visibleMonthIndex]} de ${visibleYear}` : visibleYear}
              </span>
              <ChevronDown size={13} className={cn('shrink-0 transition-transform', calendarView === 'months' && 'rotate-180')} />
            </button>

            <button
              type="button"
              className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-neutral-100 text-neutral-700 transition hover:bg-central-orange/10 hover:text-central-orange active:scale-95"
              onClick={() => calendarView === 'days' ? changeMonth(1) : changeYear(1)}
              aria-label={calendarView === 'days' ? 'Mes siguiente' : 'Año siguiente'}
            >
              <ChevronRight size={17} />
            </button>
          </div>

          {calendarView === 'months' ? (
            <div className="grid min-h-[286px] grid-cols-3 content-center gap-2 py-3">
              {MONTHS.map((monthName, monthIndex) => {
                const isVisible = monthIndex === visibleMonthIndex;
                const isSelected = selected?.getFullYear() === visibleYear && selected?.getMonth() === monthIndex;
                const isCurrent = today.getFullYear() === visibleYear && today.getMonth() === monthIndex;

                return (
                  <button
                    key={monthName}
                    type="button"
                    className={cn(
                      'relative min-h-14 rounded-[14px] border border-transparent bg-neutral-100 text-xs font-bold capitalize text-neutral-700 transition hover:bg-neutral-200 active:scale-[.97]',
                      isVisible && 'border-central-orange/30 text-central-orange',
                      isSelected && 'border-central-orange bg-central-orange text-central-carbon shadow-[0_7px_16px_rgba(216,137,24,.22)]',
                    )}
                    onClick={() => chooseMonth(monthIndex)}
                  >
                    {monthName.slice(0, 3)}
                    {isCurrent && !isSelected ? <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-central-orange" /> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-2">
              <div className="grid grid-cols-7 py-1">
                {WEEKDAYS.map((day) => (
                  <span key={day} className="grid h-7 place-items-center text-[10px] font-black uppercase tracking-wide text-neutral-400">{day}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-0.5">
                {calendarDays.map((date) => {
                  const outside = date.getMonth() !== visibleMonthIndex;
                  const isSelected = sameDay(selected, date);
                  const isToday = sameDay(today, date);

                  return (
                    <button
                      key={formatIsoDate(date)}
                      type="button"
                      onClick={() => chooseDate(date)}
                      className={cn(
                        'mx-auto grid h-9 w-9 place-items-center rounded-[11px] text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 active:scale-90',
                        outside && 'text-neutral-300',
                        isToday && !isSelected && 'bg-central-orange/10 font-black text-central-orange',
                        isSelected && 'bg-central-orange font-black text-central-carbon shadow-[0_5px_12px_rgba(216,137,24,.24)] hover:bg-central-orange',
                      )}
                      aria-label={new Intl.DateTimeFormat('es-AR', { dateStyle: 'full' }).format(date)}
                      aria-pressed={isSelected}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-2.5 flex items-center justify-between border-t border-neutral-100 px-1 pt-2.5">
            <button
              type="button"
              onClick={handleClear}
              disabled={!selected}
              className="rounded-[9px] px-2.5 py-1.5 text-xs font-bold text-central-orange transition hover:bg-central-orange/10 disabled:cursor-default disabled:opacity-30"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="rounded-[9px] px-2.5 py-1.5 text-xs font-bold text-central-orange transition hover:bg-central-orange/10"
            >
              Hoy
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-10 w-full min-w-0 items-center justify-between gap-3 rounded-sm border border-neutral-200 bg-white px-3 text-left text-sm text-central-carbon outline-none transition',
          'hover:border-central-orange/60 focus-visible:border-central-orange focus-visible:ring-2 focus-visible:ring-central-orange/15',
          open && 'border-central-orange ring-2 ring-central-orange/15',
          disabled && 'cursor-not-allowed bg-neutral-100 text-neutral-400 hover:border-neutral-200',
          className,
        )}
      >
        <span className={cn('truncate', selected ? 'font-medium text-central-carbon' : 'text-neutral-400', disabled && 'text-neutral-400')}>
          {selected ? formatDisplayDate(selected) : placeholder}
        </span>
        <CalendarDays size={16} className={cn('shrink-0 text-central-orange', disabled && 'text-neutral-300')} />
      </button>
      {popover}
    </>
  );
}
