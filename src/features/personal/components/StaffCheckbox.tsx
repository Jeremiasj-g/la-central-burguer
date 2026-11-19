'use client';

import { Check, Minus } from 'lucide-react';

export function StaffCheckbox({
  label, checked, disabled = false, mixed = false, onChange, title,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  mixed?: boolean;
  title?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label title={title ?? label}
      className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] transition-colors duration-200 hover:bg-neutral-100 has-[:disabled]:cursor-not-allowed has-[:disabled]:hover:bg-transparent">
      <input type="checkbox" checked={checked} disabled={disabled}
        ref={node=>{ if(node) node.indeterminate=mixed; }}
        onChange={event=>onChange(event.target.checked)}
        aria-label={label}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"/>
      <span aria-hidden="true" className={'grid h-[18px] w-[18px] place-items-center rounded-[5px] border text-white transition-colors duration-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-central-orange peer-disabled:opacity-40 ' +
        (checked || mixed ? 'border-central-orange bg-central-orange' : 'border-neutral-300 bg-white')}>
        {mixed ? <Minus size={13} strokeWidth={2.5}/> : checked ? <Check size={13} strokeWidth={2.5}/> : null}
      </span>
    </label>
  );
}
