'use client';

import { useEffect, useState } from 'react';
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
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => displayLocalizedNumber(value, kind, zeroAsEmpty));

  useEffect(() => {
    if (!focused) setDraft(displayLocalizedNumber(value, kind, zeroAsEmpty));
  }, [value, kind, focused, zeroAsEmpty]);

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
    if (!/^-?[\d.,]*$/.test(text) || text.length > 32) return;
    setDraft(text);
    event.currentTarget.setCustomValidity(errorMessage(text));
    const parsed = parseLocalizedNumber(text, kind, maxDecimals);
    onValueChange(parsed === null ? undefined : parsed);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setFocused(false);
    const parsed = parseLocalizedNumber(draft, kind, maxDecimals);
    if (parsed !== null && parsed !== undefined) {
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
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={handleBlur}
    />
  );
}
