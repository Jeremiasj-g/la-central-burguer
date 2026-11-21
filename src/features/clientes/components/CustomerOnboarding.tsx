'use client';

import { useState, type FormEvent } from 'react';
import { Check, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { isCustomerAccountComplete, saveCustomerAccount, type CustomerAccount } from '../services/customer-account.service';

type Props = {
  account: CustomerAccount;
  dark: boolean;
  onCompleted: (account: CustomerAccount) => void;
};

export function CustomerOnboarding({ account, dark, onCompleted }: Props) {
  const [phone, setPhone] = useState(account.phone);
  const [address, setAddress] = useState(account.address);
  const [name, setName] = useState(account.name);
  const [saving, setSaving] = useState(false);
  const input = dark
    ? 'border-white/15 bg-[#1d1d1d] text-white placeholder:text-white/35 focus:border-central-orange'
    : 'border-neutral-200 bg-[#F7F7F8] text-[#191b20] placeholder:text-neutral-400 focus:border-central-orange';
  const muted = dark ? 'text-white/55' : 'text-neutral-500';
  const valid = isCustomerAccountComplete({ name, phone, address });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!valid) {
      toast.warning('Completá un teléfono válido y una dirección con calle y número o referencia.');
      return;
    }
    setSaving(true);
    try {
      await saveCustomerAccount(name.trim(), phone.trim(), address.trim());
      toast.success('¡Tu cuenta ya está lista!');
      onCompleted({ ...account, name: name.trim(), phone: phone.trim(), address: address.trim() });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar tus datos.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="lcb-account-section mx-auto w-full max-w-[560px] py-6 sm:py-12">
    <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-full bg-central-orange/10 text-central-orange">
      <ShieldCheck size={23} strokeWidth={1.8} />
    </div>
    <h1 className="text-[29px] font-semibold tracking-tight sm:text-[34px]">¡Ya casi está todo listo!</h1>
    <p className={`mt-3 max-w-[460px] text-[13px] leading-6 ${muted}`}>
      Completá estos datos para terminar de configurar tu cuenta y acceder a tus pedidos.
    </p>
    <form onSubmit={event => void submit(event)} className="mt-8 space-y-5">
      <label className={`block space-y-2 text-[12px] font-medium ${muted}`}>
        Nombre completo
        <input value={name} onChange={event => setName(event.target.value)}
          maxLength={120} autoComplete="name" required placeholder="Nombre y apellido"
          className={`h-11 w-full rounded-[11px] border px-3.5 text-[13px] font-normal outline-none transition-colors duration-200 ${input}`} />
        <span className="block text-[11px] font-normal">Si tu nombre ya figura, podés corregirlo si hace falta.</span>
      </label>
      <label className={`block space-y-2 text-[12px] font-medium ${muted}`}>
        <span className="flex items-center gap-2"><Phone size={14}/> Número de teléfono</span>
        <input type="tel" value={phone} onChange={event => setPhone(event.target.value)}
          maxLength={40} inputMode="tel" autoComplete="tel" required placeholder="Ej.: 3794123456"
          className={`h-11 w-full rounded-[11px] border px-3.5 text-[13px] font-normal outline-none transition-colors duration-200 ${input}`}/>
      </label>
      <label className={`block space-y-2 text-[12px] font-medium ${muted}`}>
        <span className="flex items-center gap-2"><MapPin size={14}/> Dirección de referencia</span>
        <input value={address} onChange={event => setAddress(event.target.value)}
          maxLength={240} autoComplete="street-address" required placeholder="Calle, número, barrio y localidad"
          className={`h-11 w-full rounded-[11px] border px-3.5 text-[13px] font-normal outline-none transition-colors duration-200 ${input}`}/>
      </label>
      <p className={`text-[11px] leading-5 ${muted}`}>
        La dirección queda guardada como referencia. La entrega de cada pedido se confirma con los datos que ingreses al comprar.
      </p>
      <button type="submit" disabled={saving || !valid}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[11px] bg-central-orange px-5 text-[13px] font-semibold text-[#171717] transition-colors duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
        <Check size={17}/>{saving ? 'Guardando tus datos…' : 'Completar mi cuenta'}
      </button>
    </form>
  </section>;
}
