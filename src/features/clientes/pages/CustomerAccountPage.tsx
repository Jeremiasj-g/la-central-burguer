'use client';

import { useEffect, useState } from 'react';
import { LogOut, Save, ShoppingBag, UserRound } from 'lucide-react';
import { toast } from 'react-toastify';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { useCustomerAuth } from '../components/CustomerAuthProvider';
import {
 claimPendingCustomerOrder, getCustomerAccount, getMyCustomerOrders,
 saveCustomerAccount, signOutCustomer, updateCustomerEmail, updateCustomerPassword,
 type CustomerAccount, type CustomerOrderSummary,
} from '../services/customer-account.service';

type Tab='profile'|'orders';
const input='h-11 w-full rounded-[11px] border border-white/15 bg-white/[.055] px-3.5 text-[13px] font-normal text-white outline-none transition-colors duration-200 placeholder:text-white/35 focus:border-central-orange';
const formatMoney=(n:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(n);
export function CustomerAccountPage() {
 const {user,loading:authLoading,openAuth}=useCustomerAuth();
 const [account,setAccount]=useState<CustomerAccount|null>(null);
 const [draft,setDraft]=useState<CustomerAccount|null>(null);
 const [orders,setOrders]=useState<CustomerOrderSummary[]>([]);
 const [loading,setLoading]=useState(true);
 const [accountOwner,setAccountOwner]=useState<string|null>(null);
 const [loadError,setLoadError]=useState('');
 const [saving,setSaving]=useState(false);
 const [tab,setTab]=useState<Tab>('profile');
 const [pendingTab,setPendingTab]=useState<Tab|null>(null);
 const [emailDraft,setEmailDraft]=useState('');
 const [newPassword,setNewPassword]=useState('');
 const [securityBusy,setSecurityBusy]=useState(false);
 const dirty=Boolean(draft&&account&&JSON.stringify({
  name:draft.name,phone:draft.phone,address:draft.address
 })!==JSON.stringify({name:account.name,phone:account.phone,address:account.address}));
 const userId=user?.id;
 useEffect(()=>{
  if(!userId){return;}
  let cancelled=false;
  async function load(){
   try{
    const profile=await getCustomerAccount();
    await claimPendingCustomerOrder();
    const history=await getMyCustomerOrders();
    if(cancelled)return;
    setAccount(profile);setDraft(profile);setEmailDraft(profile.email??'');setOrders(history);setAccountOwner(profile.id);setLoadError('');
   }catch(e){if(!cancelled){const message=e instanceof Error?e.message:'No se pudo cargar tu cuenta.';setLoadError(message);toast.error(message);}}
   finally{if(!cancelled)setLoading(false);}
  }
  void load();
  return()=>{cancelled=true;};
 },[userId]);
 useEffect(()=>{
  if(!dirty)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',warn);
  return()=>window.removeEventListener('beforeunload',warn);
 },[dirty]);
 async function save(){
  if(!draft||saving)return;
  if(draft.name.trim().length<2||draft.name.length>120||draft.phone.length>40||draft.address.length>240){
   toast.warning('Revisá tu nombre (2 a 120 caracteres), teléfono y dirección.');return;
  }
  setSaving(true);
  try{
   await saveCustomerAccount(draft.name,draft.phone,draft.address);
   setAccount({...draft,name:draft.name.trim()});setDraft({...draft,name:draft.name.trim()});
   toast.success('Tus datos se guardaron correctamente.');
  }catch(e){toast.error(e instanceof Error?e.message:'No se pudieron guardar los cambios.');}
  finally{setSaving(false);}
 }
 async function updateEmail(){
  if(!emailDraft.includes('@')||securityBusy)return;
  setSecurityBusy(true);
  try{await updateCustomerEmail(emailDraft);toast.info('Revisá tu correo para confirmar el cambio de dirección.');}
  catch(e){toast.error(e instanceof Error?e.message:'No se pudo actualizar el correo.');}
  finally{setSecurityBusy(false);}
 }
 async function updatePassword(){
  if(newPassword.length<8||securityBusy)return;
  setSecurityBusy(true);
  try{await updateCustomerPassword(newPassword);setNewPassword('');toast.success('Contraseña actualizada.');}
  catch(e){toast.error(e instanceof Error?e.message:'No se pudo cambiar la contraseña.');}
  finally{setSecurityBusy(false);}
 }
 if(authLoading||(user&&loading)||Boolean(user&&accountOwner&&accountOwner!==user.id))return <main className="mx-auto min-h-[55vh] max-w-4xl px-4 py-14 text-white">
  <div className="h-9 w-48 animate-pulse rounded bg-white/10"/>
  <div className="mt-8 h-64 animate-pulse rounded-[18px] bg-white/5"/>
 </main>;
 if(!user)return <main className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center gap-5 px-5 py-16 text-center text-white">
  <UserRound size={34} className="text-central-orange"/>
  <h1 className="text-[28px] font-semibold">Tu cuenta de cliente</h1>
  <p className="text-[13px] leading-6 text-white/60">Iniciá sesión para guardar tus datos y consultar tus pedidos. También podés comprar sin una cuenta.</p>
  <button onClick={()=>openAuth('header')} className="h-11 rounded-[11px] bg-central-orange px-6 text-[13px] font-semibold text-[#191919]">Iniciar sesión o registrarme</button>
 </main>;
 if(loadError||!account||!draft)return <main className="mx-auto min-h-[55vh] max-w-xl space-y-4 px-5 py-16 text-white">
  <h1 className="text-[25px] font-semibold">No pudimos cargar tu cuenta</h1>
  <p role="alert" className="text-[13px] text-white/65">{loadError||'No se encontraron datos de la cuenta.'}</p>
  <button type="button" onClick={()=>window.location.reload()} className="rounded-[11px] bg-central-orange px-4 py-2.5 text-[12px] font-medium text-[#191919]">Reintentar</button>
 </main>;
 return <main className="mx-auto min-h-[60vh] max-w-4xl px-4 py-12 text-white sm:px-6">
  <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-[11px] font-medium uppercase tracking-wider text-central-orange">La Central Burger</p>
    <h1 className="mt-1 text-[29px] font-semibold tracking-tight">Mi cuenta</h1></div>
   <button type="button" onClick={()=>void signOutCustomer().catch(e=>toast.error(e instanceof Error?e.message:'No se pudo cerrar sesión.'))}
    className="inline-flex h-9 items-center gap-2 rounded-[11px] border border-white/15 px-3 text-[12px] text-white/75 hover:border-white/30">
    <LogOut size={15}/> Cerrar sesión
   </button>
  </div>
  <div className="mb-7 flex gap-1 border-b border-white/15">
   {([{key:'profile',name:'Mis datos',icon:UserRound},{key:'orders',name:'Mis pedidos',icon:ShoppingBag}] as const).map(item=>
    <button key={item.key} type="button" onClick={()=>dirty?setPendingTab(item.key):setTab(item.key)}
     className={'inline-flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] transition-colors duration-200 '+(tab===item.key?'border-central-orange text-white':'border-transparent text-white/55 hover:text-white')}>
     <item.icon size={15}/>{item.name}
    </button>)}
  </div>
  {tab==='profile'&&draft&&<div className="space-y-7">
   <form onSubmit={e=>{e.preventDefault();void save();}} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
     <label className="space-y-1.5 text-[12px] text-white/75">Nombre completo
      <input className={input} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Nombre y apellido" maxLength={120} required/>
     </label>
     <label className="space-y-1.5 text-[12px] text-white/75">Teléfono de contacto
      <input className={input} value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})} placeholder="Ej.: 3794123456" maxLength={40} inputMode="tel"/>
     </label>
    </div>
    <label className="block space-y-1.5 text-[12px] text-white/75">Dirección de referencia
     <input className={input} value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})} placeholder="Calle, número y localidad" maxLength={240}/>
    </label>
    <p className="text-[11px] leading-5 text-white/45">Esta dirección es solo información de tu perfil. <strong className="font-medium text-white/70">Cada pedido utiliza exclusivamente los datos y la ubicación que indiques en el checkout.</strong></p>
    <div className="flex justify-end">
     <button type="submit" disabled={saving||!dirty} className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-central-orange px-4 text-[12px] font-semibold text-[#191919] transition-colors duration-200 hover:bg-[#ffc04a] disabled:opacity-50"><Save size={15}/>{saving?'Guardando…':'Guardar cambios'}</button>
    </div>
   </form>
   <section className="space-y-4 border-t border-white/10 pt-6">
    <h2 className="text-[16px] font-semibold">Seguridad de la cuenta</h2>
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
     <label className="space-y-1.5 text-[12px] text-white/75">Correo electrónico
      <input className={input} type="email" value={emailDraft} onChange={e=>setEmailDraft(e.target.value)} placeholder="tu@email.com"/>
     </label>
     <button type="button" disabled={securityBusy||emailDraft===account?.email} onClick={()=>void updateEmail()}
      className="h-11 rounded-[11px] border border-white/20 px-4 text-[12px] text-white/80 disabled:opacity-40">Cambiar correo</button>
    </div>
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
     <label className="space-y-1.5 text-[12px] text-white/75">Nueva contraseña
      <input className={input} type="password" autoComplete="new-password" minLength={8}
       value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres"/>
     </label>
     <button type="button" disabled={securityBusy||newPassword.length<8} onClick={()=>void updatePassword()}
      className="h-11 rounded-[11px] border border-white/20 px-4 text-[12px] text-white/80 disabled:opacity-40">Cambiar contraseña</button>
    </div>
    <p className="text-[11px] text-white/45">Si accediste con Google, podés seguir usando ese método sin crear una contraseña.</p>
   </section>
  </div>}
  {tab==='orders'&&<section className="space-y-3">
   {!orders.length?<div className="py-12 text-center text-[13px] text-white/55">Todavía no hay pedidos vinculados a tu cuenta. Los pedidos como invitado no se asocian por coincidencias de teléfono.</div>:
    orders.map(order=><article key={order.id} className="border-b border-white/10 py-4">
     <div className="flex flex-wrap justify-between gap-3"><div>
      <p className="text-[14px] font-semibold text-white">Pedido {order.code}</p>
      <p className="mt-1 text-[11px] text-white/50">{new Date(order.createdAt).toLocaleDateString('es-AR')} · {order.status}</p>
     </div><strong className="text-[15px] font-semibold tabular-nums text-central-orange">{formatMoney(Number(order.total))}</strong></div>
     <p className="mt-3 text-[12px] leading-6 text-white/60">{order.items.map(i=>`${i.quantity} × ${i.name}`).join(' · ')}</p>
    </article>)}
  </section>}
  <ConfirmDialog open={pendingTab!==null} theme="dark" title="Cambios sin guardar"
   description="Si cambiás de pestaña ahora, se perderán las modificaciones de tu perfil."
   confirmLabel="Salir sin guardar" cancelLabel="Seguir editando"
   onConfirm={()=>{setDraft(account);setTab(pendingTab??'profile');setPendingTab(null);}}
   onCancel={()=>setPendingTab(null)}/>
 </main>;
}
