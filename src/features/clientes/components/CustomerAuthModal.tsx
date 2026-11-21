'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { Modal } from '@/shared/components/ui/Modal';
import { usePublicTheme } from '@/shared/components/layout/PublicThemeProvider';
import { signInCustomerWithGoogle } from '../services/customer-account.service';

export function CustomerAuthModal({
  open, onClose, afterOrder=false,
}:{
  open:boolean;onClose:()=>void;afterOrder?:boolean;
}) {
  const [busy,setBusy]=useState(false);
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

  return <Modal open={open} onClose={busy?()=>{}:onClose}
    title="¡Registrate para obtener más beneficios!" size="sm" theme={theme}
    panelClassName={dark?'!rounded-[22px] !bg-[#1a1a1d]':'!rounded-[22px] !bg-white'}>
    <div className="space-y-5 py-1">
      <p className={`text-[13px] leading-6 ${description}`}>
        Iniciá sesión con Google para guardar tus datos, consultar tus pedidos y comprar más rápido la próxima vez.
      </p>
      <button type="button" disabled={busy} onClick={()=>void google()}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-[11px] border border-neutral-200 bg-white px-4 text-[13px] font-semibold text-[#202124] transition-colors duration-200 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-central-orange disabled:opacity-50">
        <span aria-hidden="true" className="text-[19px] font-semibold"><span className="text-[#4285f4]">G</span></span>
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
