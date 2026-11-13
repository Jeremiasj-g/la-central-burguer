'use client';

import { useEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, FocusEvent, ChangeEvent } from 'react';
import { Input } from './Input';
import { displayLocalizedNumber, parseLocalizedNumber, type LocalizedNumberKind } from '@/shared/utils/localized-number.utils';

type NumericInputProps = Omit<ComponentPropsWithoutRef<'input'>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step' | 'inputMode'> & {
  value: number | null | undefined;
  onValueChange: (value: number | undefined) => void;
  kind?: LocalizedNumberKind;
  min?: number;
  max?: number;
  maxDecimals?: number;
  zeroAsEmpty?: boolean;
};

/**
 * Guarda el borrador textual separado del valor numérico. Se puede borrar 0,
 * escribir 0,9/0.9, y dejar 0, hasta completar los decimales.
 * Las pantallas siguen recibiendo números, no cadenas formateadas.
 */
export function NumericInput({
  value,
  onValueChange,
  kind = 'decimal',
  min,
  max,
  maxDecimals = kind === 'money' ? 2 : kind === 'integer' ? 0 : 4,
  zeroAsEmpty = true,
  onFocus,
  onBlur,
  ...props
}: NumericInputProps) {
  // El texto que se está editando (p. ej. "0.", "0,0") no equivale
  // todavía al valor numérico que el formulario debe guardar.
  const editingRef = useRef(false);
  const [draft, setDraft] = useState(() => displayLocalizedNumber(value, kind, zeroAsEmpty));

  useEffect(() => {
    // No sobrescribir el separador decimal al re-renderizar el formulario.
    if (!editingRef.current) setDraft(displayLocalizedNumber(value, kind, zeroAsEmpty));
  }, [value, kind, zeroAsEmpty]);

  function errorMessage(text: string) {
    const parsed = parseLocalizedNumber(text, kind, maxDecimals);
    if (parsed === null) return 'Ingresá un número válido con el formato correcto.';
    if (parsed === undefined) return '';
    if (min !== undefined && parsed < min) return `El valor mínimo es ${min}.`;
    if (max !== undefined && parsed > max) return `El valor máximo es ${max}.`;
    return '';
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    // Letras, signos extraños y decimales mal formados nunca llegan al dominio.
    // Un importe también puede pegarse como "$ 26.000,50".
    const characters = kind === 'money'
      ? text.replace(/[\s\u00a0\u202f]/g, '').replace(/^\$/, '')
      : text;
    if (!/^-?[\d.,]*$/.test(characters) || text.length > 40) return;
    setDraft(text);
    event.currentTarget.setCustomValidity(errorMessage(text));
    const parsed = parseLocalizedNumber(text, kind, maxDecimals);
    if (text.trim() === '') {
      onValueChange(undefined);
      return;
    }
    // Conservar prefijos de edición como "0." y "0," hasta escribir
    // el siguiente decimal: no disparar cálculos ni reformateos al padre.
    if (/[.,]$/.test(text.trim()) || parsed === null || parsed === undefined) return;
    if (parsed !== value) onValueChange(parsed);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    editingRef.current = false;
    const parsed = parseLocalizedNumber(draft, kind, maxDecimals);
    if (parsed !== null && parsed !== undefined) {
      if (parsed !== value) onValueChange(parsed);
      setDraft(displayLocalizedNumber(parsed, kind, false));
    } else if (parsed === undefined) {
      setDraft('');
    }
    event.currentTarget.setCustomValidity(errorMessage(draft));
    onBlur?.(event);
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode={kind === 'integer' ? 'numeric' : 'decimal'}
      autoComplete="off"
      value={draft}
      onChange={handleChange}
      onFocus={(event) => { editingRef.current = true; onFocus?.(event); }}
      onBlur={handleBlur}
    />
  );
}
