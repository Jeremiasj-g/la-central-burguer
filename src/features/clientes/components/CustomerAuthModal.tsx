'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { Modal } from '@/shared/components/ui/Modal';
import { PasswordInput } from '@/shared/components/ui/PasswordInput';
import {
  signInCustomer, signInCustomerWithGoogle, signUpCustomer, resetCustomerPassword,
} from '../services/customer-account.service';

type Mode='signup'|'login'|'reset';
export function CustomerAuthModal({
  open, onClose, afterOrder=false, initialMode='signup', onAuthenticated,
}:{
  open:boolean;onClose:()=>void;afterOrder?:boolean;initialMode?:Mode;onAuthenticated:()=>void;
}) {
  const router=useRouter();
  const [mode,setMode]=useState<Mode>(initialMode);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const canSubmit=email.includes('@') && (mode==='reset'||password.length>=8);
  async function submit(event:React.FormEvent){
    event.preventDefault();
    if(busy||!canSubmit)return;
    setBusy(true);setMessage('');
    try {
      if(mode==='reset') {
        await resetCustomerPassword(email);
        setMessage('Si ese correo está registrado, recibirás un enlace para recuperar tu cuenta.');
      } else if(mode==='signup'){
        const result=await signUpCustomer(email,password);
        if(result.needsConfirmation){
          setMessage('Revisá tu correo para confirmar la cuenta. Tu pedido ya está registrado.');
        }else{
          toast.success('Cuenta creada correctamente.');
          onAuthenticated();router.push('/mi-cuenta');
        }
      }else{
        await signInCustomer(email,password);
        onAuthenticated();router.push('/mi-cuenta');
      }
    }catch(e){toast.error(e instanceof Error?e.message:'No se pudo completar el acceso.');}
    finally{setBusy(false);}
  }
  async function google(){
    if(busy)return;setBusy(true);
    try{await signInCustomerWithGoogle();}
    catch(e){toast.error(e instanceof Error?e.message:'No se pudo iniciar sesión con Google.');setBusy(false);}
  }
  const title=mode==='login'?'Iniciar sesión':mode==='reset'?'Recuperar contraseña':'Registrate y obtené más beneficios';
  return <Modal open={open} onClose={busy?()=>{}:onClose} title={title} size="sm" theme="dark"
    panelClassName="!rounded-[22px] !bg-[#1a1a1d]">
    <div className="space-y-5 py-1">
      <p className="text-[13px] leading-6 text-white/65">
        {mode==='signup'?'Guardá tus datos, consultá tus pedidos y comprá más rápido la próxima vez.':
         mode==='reset'?'Te enviaremos un enlace para recuperar el acceso.':
         'Accedé a tu cuenta para ver tus pedidos y editar tu perfil.'}
      </p>
      {mode!=='reset'&&<button type="button" disabled={busy} onClick={()=>void google()}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-[11px] bg-white px-4 text-[13px] font-semibold text-[#202124] transition-colors duration-200 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-central-orange disabled:opacity-50">
        <span aria-hidden="true" className="text-[19px] font-semibold"><span className="text-[#4285f4]">G</span></span>
        Continuar con Google
      </button>}
      {mode!=='reset'&&<div className="flex items-center gap-3 text-[11px] text-white/45"><span className="h-px flex-1 bg-white/15"/>o con tu correo<span className="h-px flex-1 bg-white/15"/></div>}
      <form className="space-y-3.5" onSubmit={event=>void submit(event)}>
        <label className="block space-y-1.5 text-[12px] font-medium text-white/85">
          Correo electrónico
          <input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}
            required placeholder="tu@email.com"
            className="h-11 w-full rounded-[11px] border border-white/15 bg-white/[.055] px-3.5 text-[13px] font-normal text-white outline-none transition-colors duration-200 placeholder:text-white/35 focus:border-central-orange"/>
        </label>
        {mode!=='reset'&&<label className="block space-y-1.5 text-[12px] font-medium text-white/85">
          Contraseña
          <PasswordInput variant="dark" autoComplete={mode==='signup'?'new-password':'current-password'} value={password}
            onChange={e=>setPassword(e.target.value)} minLength={8} required
            placeholder="Mínimo 8 caracteres"
            className="!h-11 !rounded-[11px] !border-white/15 !bg-white/[.055] !text-[13px]"/>
        </label>}
        {message&&<p role="status" className="rounded-[10px] bg-emerald-500/10 p-3 text-[12px] leading-5 text-emerald-200">{message}</p>}
        <button type="submit" disabled={busy||!canSubmit}
          className="h-11 w-full rounded-[11px] bg-central-orange px-3 text-[13px] font-semibold text-[#191919] transition-colors duration-200 hover:bg-[#ffc04a] disabled:opacity-50">
          {busy?'Procesando…':mode==='signup'?'Crear mi cuenta':mode==='reset'?'Enviar enlace':'Iniciar sesión'}
        </button>
      </form>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[12px]">
        {mode!=='login'&&<button type="button" onClick={()=>{setMode('login');setMessage('');}} className="text-central-orange hover:underline">Ya tengo cuenta</button>}
        {mode!=='signup'&&<button type="button" onClick={()=>{setMode('signup');setMessage('');}} className="text-white/75 hover:underline">Crear cuenta</button>}
        {mode==='login'&&<button type="button" onClick={()=>{setMode('reset');setMessage('');}} className="text-white/75 hover:underline">Olvidé mi contraseña</button>}
      </div>
      <button type="button" onClick={onClose} disabled={busy}
        className="block w-full py-2 text-center text-[12px] font-medium text-white/80 transition-colors duration-200 hover:text-white">
        {afterOrder?'Ahora no, continuar sin cuenta':'Continuar como invitado'}
      </button>
      <p className="flex items-start justify-center gap-2 text-center text-[11px] leading-5 text-white/40"><ShieldCheck size={15} className="shrink-0"/>
        {afterOrder?'Tu pedido ya está guardado. Crear una cuenta es opcional.':'Podés comprar sin registrarte. Tu información de cuenta se guarda por separado.'}
      </p>
    </div>
  </Modal>;
}
