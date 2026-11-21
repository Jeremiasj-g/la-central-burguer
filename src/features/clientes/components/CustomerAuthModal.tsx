'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PasswordInput } from '@/shared/components/ui/PasswordInput';
import { toast } from 'react-toastify';
import { Modal } from '@/shared/components/ui/Modal';
import { usePublicTheme } from '@/shared/components/layout/PublicThemeProvider';
import { signInCustomerWithGoogle, signInCustomerWithPassword } from '../services/customer-account.service';

export function CustomerAuthModal({
  open, onClose, afterOrder=false,
}:{
  open:boolean;onClose:()=>void;afterOrder?:boolean;
}) {
  const [busy,setBusy]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const theme=usePublicTheme();
  const dark=theme==='dark';
  const description=dark?'text-white/65':'text-neutral-600';
  const guest=dark?'text-white/80 hover:text-white':'text-neutral-600 hover:text-neutral-900';
  const caption=dark?'text-white/40':'text-neutral-500';

  async function google(){
    if(busy)return;
    setBusy(true);
    try{
      await signInCustomerWithGoogle();
    }catch(error){
      toast.error(error instanceof Error?error.message:'No se pudo iniciar sesión con Google.');
      setBusy(false);
    }
  }

  async function credentials(event:React.FormEvent){
    event.preventDefault();
    if(busy)return;
    setBusy(true);
    try{await signInCustomerWithPassword(email,password);setPassword('');onClose();}
    catch(error){toast.error(error instanceof Error?error.message:'No se pudo iniciar sesión.');}
    finally{setBusy(false);}
  }

  return <Modal open={open} onClose={busy?()=>{}:onClose}
    title="Iniciar sesión" titleClassName="!text-[23px] sm:!text-[27px] !font-semibold !leading-[1.2] !tracking-tight" size="sm" theme={theme}
    panelClassName={dark?'!rounded-[22px] !bg-[#1a1a1d]':'!rounded-[22px] !bg-white'}>
    <div className="space-y-5 py-1">
      <p className={`text-[13px] leading-6 ${description}`}>
        Accedé a tu cuenta para consultar tus pedidos y guardar tus datos.
      </p>
      <form onSubmit={event=>void credentials(event)} className="space-y-3">
        <label className={`block space-y-1.5 text-[12px] font-medium ${description}`}>Correo electrónico
          <input type="email" required autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} placeholder="cliente@correo.com" className={`h-11 w-full rounded-[11px] border px-3 text-[13px] outline-none focus:border-central-orange ${dark?'border-white/15 bg-white/5 text-white':'border-neutral-200 bg-[#f7f7f9] text-neutral-900'}`}/>
        </label>
        <label className={`block space-y-1.5 text-[12px] font-medium ${description}`}>Contraseña
          <PasswordInput variant={theme} value={password} onChange={event=>setPassword(event.target.value)} placeholder="Tu contraseña" autoComplete="current-password" required/>
        </label>
        <button type="submit" disabled={busy} className="h-11 w-full rounded-[11px] bg-central-orange px-4 text-[13px] font-semibold text-[#191919] transition-colors duration-200 disabled:opacity-50">{busy?'Ingresando…':'Iniciar sesión'}</button>
      </form>
      <div className={`flex items-center gap-3 text-[11px] ${caption}`}><span className="h-px flex-1 bg-current opacity-20"/>o continuá con<span className="h-px flex-1 bg-current opacity-20"/></div>
      <button type="button" disabled={busy} onClick={()=>void google()}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-[11px] border border-neutral-200 bg-white px-4 text-[13px] font-semibold text-[#202124] transition-colors duration-200 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-central-orange disabled:opacity-50">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48" className="shrink-0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.74 7.18l7.73 6C44.44 38.03 46.98 31.88 46.98 24.55z"/>
          <path fill="#FBBC05" d="M10.53 28.59A14.46 14.46 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.97-6.2A23.98 23.98 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.92-2.13 15.89-5.8l-7.73-6C30.01 37.65 27.25 38.5 24 38.5c-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        {busy?'Conectando con Google…':'Continuar con Google'}
      </button>
      <button type="button" onClick={onClose} disabled={busy}
        className={`block w-full py-2 text-center text-[12px] font-medium transition-colors duration-200 disabled:opacity-40 ${guest}`}>
        {afterOrder?'Ahora no, continuar sin cuenta':'Continuar como invitado'}
      </button>
      <p className={`flex items-start justify-center gap-2 text-center text-[11px] leading-5 ${caption}`}>
        <ShieldCheck size={15} className="shrink-0"/>
        {afterOrder?'Tu pedido ya está guardado. Crear una cuenta es opcional.':'Podés comprar sin registrarte. Tu información de cuenta se guarda por separado.'}
      </p>
    </div>
  </Modal>;
}
