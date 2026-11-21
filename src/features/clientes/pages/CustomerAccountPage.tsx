'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Gift, Heart, Home, LogOut, MapPin, Menu, Package, Save, Settings2, UserRound, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { PublicThemeToggle, usePublicTheme } from '@/shared/components/layout/PublicThemeProvider';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';
import { useAnimatedPresence } from '@/shared/hooks/useAnimatedPresence';
import { useCustomerAuth } from '../components/CustomerAuthProvider';
import { CustomerGoogleAvatar } from '../components/CustomerGoogleAvatar';
import {
  claimPendingCustomerOrder, getCustomerAccount, getMyCustomerOrders,
  saveCustomerAccount, signOutCustomer,
  type CustomerAccount, type CustomerOrderSummary,
} from '../services/customer-account.service';

type Section = 'profile' | 'orders' | 'benefits' | 'preferences';
const navigation = [
  {id:'profile',label:'Mi perfil',icon:UserRound},
  {id:'orders',label:'Mis pedidos',icon:Package},
  {id:'benefits',label:'Beneficios',icon:Gift},
  {id:'preferences',label:'Preferencias',icon:Settings2},
] as const;

const money = (value:number) =>
  new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(value);

export function CustomerAccountPage(){
  const {user,loading:authLoading,openAuth}=useCustomerAuth();
  const theme=usePublicTheme();
  const dark=theme==='dark';
  const [mobileOpen,setMobileOpen]=useState(false);
  const drawerCloseRef=useRef<HTMLButtonElement>(null);
  useBodyScrollLock(mobileOpen);
  const drawerMounted=useAnimatedPresence(mobileOpen,200);
  const [section,setSection]=useState<Section>('profile');
  const [renderedSection,setRenderedSection]=useState<Section>('profile');
  const [sectionLoading,setSectionLoading]=useState(false);
  const [pendingAction,setPendingAction]=useState<Section|'logout'|null>(null);
  const [account,setAccount]=useState<CustomerAccount|null>(null);
  const [draft,setDraft]=useState<CustomerAccount|null>(null);
  const [orders,setOrders]=useState<CustomerOrderSummary[]>([]);
  const [loading,setLoading]=useState(Boolean(user));
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const [signingOut,setSigningOut]=useState(false);
  const userId=user?.id;
  const profileMatchesSession=Boolean(userId && account?.id===userId);
  const dirty=Boolean(account && draft &&
    (account.name!==draft.name || account.phone!==draft.phone || account.address!==draft.address));

  useEffect(()=>{
    if(!userId)return;
    let active=true;
    async function load(){
      try{
        const profile=await getCustomerAccount();
        if(profile.id!==userId)throw new Error('La cuenta recibida no corresponde a la sesión actual.');
        if(!active)return;
        setAccount(profile);setDraft(profile);setError('');
        try{await claimPendingCustomerOrder();}
        catch{if(active)toast.info('No se pudo vincular el pedido anterior; tus datos siguen guardados.');}
        const history=await getMyCustomerOrders();
        if(active)setOrders(history);
      }catch(cause){
        if(active)setError(cause instanceof Error?cause.message:'No se pudieron cargar tus datos.');
      }finally{if(active)setLoading(false);}
    }
    void load();
    return()=>{active=false;};
  },[userId]);

  useEffect(()=>{
    if(section===renderedSection)return;
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeout=window.setTimeout(()=>{
      setRenderedSection(section);
      setSectionLoading(false);
    },reducedMotion?0:180);
    return()=>window.clearTimeout(timeout);
  },[section,renderedSection]);

  useEffect(()=>{
    if(!mobileOpen)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    drawerCloseRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobileOpen(false);};
    document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('keydown',onKey);previous?.focus();};
  },[mobileOpen]);

  useEffect(()=>{
    if(!dirty)return;
    const onUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',onUnload);
    return()=>window.removeEventListener('beforeunload',onUnload);
  },[dirty]);

  async function save(){
    if(!draft || saving)return;
    if(draft.name.trim().length<2 || draft.name.length>120 || draft.phone.length>40 || draft.address.length>240){
      toast.warning('Revisá nombre, teléfono y dirección.');return;
    }
    setSaving(true);
    try{
      await saveCustomerAccount(draft.name,draft.phone,draft.address);
      const saved={...draft,name:draft.name.trim()};
      setAccount(saved);setDraft(saved);
      toast.success('Tus datos se guardaron correctamente.');
    }catch(cause){toast.error(cause instanceof Error?cause.message:'No se pudo guardar el perfil.');}
    finally{setSaving(false);}
  }

  async function logout(){
    if(signingOut)return;
    setSigningOut(true);
    try{await signOutCustomer();setAccount(null);setDraft(null);setOrders([]);setSection('profile');}
    catch(cause){toast.error(cause instanceof Error?cause.message:'No se pudo cerrar la sesión.');}
    finally{setSigningOut(false);}
  }

  function navigate(next:Section){
    setMobileOpen(false);
    if(next===section)return;
    if(dirty){setPendingAction(next);return;}
    setSectionLoading(true);
    setSection(next);
  }
  function requestLogout(){
    setMobileOpen(false);
    if(dirty)setPendingAction('logout');
    else void logout();
  }
  function discard(){
    setDraft(account);
    const target=pendingAction;
    setPendingAction(null);
    if(target==='logout')void logout();
    else if(target){setSectionLoading(true);setSection(target);}
  }

  const surface=dark?'bg-[#111216] text-white':'bg-[#F7F7F8] text-[#191b20]';
  const panel=dark?'bg-[#191b20] border-white/10':'bg-white border-neutral-200';
  const primary=dark?'text-white':'text-[#191b20]';
  const muted=dark?'text-white/55':'text-neutral-500';
  const border=dark?'border-white/10':'border-neutral-200';
  const input=dark
    ? 'border-white/15 bg-white/[.055] text-white placeholder:text-white/35 focus:border-central-orange'
    : 'border-neutral-200 bg-[#F8F8FA] text-neutral-900 placeholder:text-neutral-400 focus:border-central-orange';
  const action='inline-flex min-h-9 items-center justify-center gap-2 rounded-[11px] border px-3 text-[12px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-central-orange';
  const secondary=dark?'border-white/15 text-white/80 hover:bg-white/5':'border-neutral-200 text-neutral-700 hover:bg-neutral-50';

  const sidebar=<aside aria-label="Opciones de mi cuenta" className={`flex h-full w-[264px] flex-col border-r ${panel}`}>
    <div className={`border-b px-5 py-7 ${border}`}>
      <div className="mb-3"><CustomerGoogleAvatar user={user}/></div>
      <p className={`truncate text-[14px] font-semibold ${primary}`}>{account?.name||'Mi cuenta'}</p>
      <p className={`mt-1 truncate text-[11px] ${muted}`}>{user?.email||'Cuenta de cliente'}</p>
    </div>
    <nav aria-label="Secciones del perfil" className="flex-1 space-y-1 p-3">
      {navigation.map(item=>{
        const Icon=item.icon,active=section===item.id;
        return <button key={item.id} type="button" onClick={()=>navigate(item.id)}
          aria-current={active?'page':undefined}
          className={`flex min-h-11 w-full items-center gap-3 rounded-[11px] px-3 text-left text-[13px] font-medium transition-[background-color,color] duration-200 focus-visible:outline-2 focus-visible:outline-central-orange ${active
            ? dark?'bg-white/10 text-white':'bg-[#F1F2F4] text-neutral-900'
            : dark?'text-white/60 hover:bg-white/5 hover:text-white':'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'}`}>
          <Icon size={17} className={active?'text-central-orange':''}/><span className="flex-1">{item.label}</span>
          {(item.id==='benefits'||item.id==='preferences')&&<span className={`rounded px-1.5 py-1 text-[9px] ${dark?'bg-white/5 text-white/45':'bg-neutral-100 text-neutral-500'}`}>Pronto</span>}
        </button>;
      })}
    </nav>
    <div className={`border-t p-3 ${border}`}>
      <button type="button" disabled={!user||signingOut} onClick={requestLogout}
        className={`flex min-h-10 w-full items-center gap-3 rounded-[11px] px-3 text-[12px] transition-colors duration-200 ${muted} hover:text-central-orange disabled:opacity-40`}>
        <LogOut size={17}/>Cerrar sesión
      </button>
    </div>
  </aside>;

  return <div className={`min-h-screen ${surface}`}>
    <header className={`sticky top-0 z-40 border-b ${panel}`}>
      <div className="flex h-[66px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <button type="button" onClick={()=>setMobileOpen(true)} aria-label="Abrir menú de mi cuenta"
            className={`${action} ${secondary} h-10 w-10 !px-0 lg:hidden`}><Menu size={19}/></button>
          <Link href="/" title="Ir al inicio" aria-label="Ir al inicio"
            className={`${action} ${secondary} h-10 w-10 !px-0`}><Home size={18}/></Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="[&_span]:!hidden"><PublicThemeToggle/></span>
          {user&&<button type="button" onClick={requestLogout} disabled={signingOut}
            title="Cerrar sesión" aria-label="Cerrar sesión"
            className={`${action} ${secondary} h-10 w-10 !px-0 disabled:opacity-40`}><LogOut size={18}/></button>}
        </div>
      </div>
    </header>

    <div className="flex min-h-[calc(100vh-66px)]">
      <div className="hidden shrink-0 lg:block">{sidebar}</div>
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-9 sm:py-11 xl:px-12">
        {authLoading||Boolean(user&&(loading||(!profileMatchesSession&&!error)))?<>
          <div className={`h-7 w-40 animate-pulse rounded ${dark?'bg-white/10':'bg-neutral-200'}`}/>
          <div className={`mt-7 h-52 max-w-3xl animate-pulse rounded-[14px] ${dark?'bg-white/5':'bg-neutral-100'}`}/>
        </>:!user?
          <div className="mx-auto max-w-lg py-16 text-center">
            <UserRound size={32} className="mx-auto text-central-orange"/>
            <h1 className="mt-5 text-[28px] font-semibold">Mi cuenta</h1>
            <p className={`mt-3 text-[13px] leading-6 ${muted}`}>Iniciá sesión con Google para ver tus pedidos y editar tus datos. También podés comprar sin registrarte.</p>
            <button type="button" onClick={()=>openAuth('header')} className="mt-6 h-10 rounded-[11px] bg-central-orange px-5 text-[12px] font-semibold text-[#171717]">Iniciar sesión con Google</button>
          </div>:
          error||!account||!draft?
          <div className="py-8"><h1 className="text-[23px] font-semibold">No pudimos cargar tu perfil</h1>
            <p role="alert" className={`mt-3 text-[13px] ${muted}`}>{error||'No se encontraron datos.'}</p>
            <button type="button" className="mt-4 rounded-[11px] bg-central-orange px-4 py-2 text-[12px] font-medium text-black" onClick={()=>window.location.reload()}>Reintentar</button>
          </div>:
          <>
            <div className="mb-9">
              <h1 className="text-[29px] font-semibold tracking-tight">{navigation.find(item=>item.id===section)?.label}</h1>
            </div>
            {sectionLoading?<div aria-label="Cargando sección" role="status" className="lcb-account-section max-w-[900px] space-y-5" aria-live="polite">
              {section==='profile'?<>
                <div className="grid gap-5 sm:grid-cols-2">
                  {[0,1].map(index=><div key={index} className="space-y-2">
                    <div className={`h-3 w-24 animate-pulse rounded ${dark?'bg-white/10':'bg-neutral-200/80'}`}/>
                    <div className={`h-11 animate-pulse rounded-[11px] ${dark?'bg-white/10':'bg-neutral-200/80'}`}/>
                  </div>)}
                </div>
                <div className={`h-11 animate-pulse rounded-[11px] ${dark?'bg-white/10':'bg-neutral-200/80'}`}/>
                <div className={`ml-auto h-10 w-40 animate-pulse rounded-[11px] ${dark?'bg-white/10':'bg-neutral-200/80'}`}/>
              </>:section==='orders'?
                Array.from({length:3},(_,index)=><div key={index} className={`space-y-3 border-b py-3 ${border}`}>
                  <div className="flex justify-between gap-4">
                    <div className={`h-4 w-48 max-w-[65%] animate-pulse rounded ${dark?'bg-white/10':'bg-neutral-200/80'}`}/>
                    <div className={`h-4 w-20 animate-pulse rounded ${dark?'bg-white/10':'bg-neutral-200/80'}`}/>
                  </div>
                  <div className={`h-3 w-24 animate-pulse rounded ${dark?'bg-white/10':'bg-neutral-200/80'}`}/>
                  <div className={`h-3 w-56 max-w-full animate-pulse rounded ${dark?'bg-white/10':'bg-neutral-200/80'}`}/>
                </div>):
                <div className="flex items-center justify-center py-16">
                  <div className={`h-24 w-56 animate-pulse rounded-[11px] ${dark?'bg-white/10':'bg-neutral-200/80'}`}/>
                </div>}
            </div>:<div key={renderedSection} className="lcb-account-section">
            {renderedSection==='profile'&&<div className="max-w-[900px] space-y-9">
              <form onSubmit={event=>{event.preventDefault();void save();}} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className={`block space-y-2 text-[12px] font-medium ${muted}`}>Nombre completo
                    <input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}
                      placeholder="Nombre y apellido" maxLength={120} required
                      className={`h-11 w-full rounded-[11px] border px-3.5 text-[13px] font-normal outline-none transition-colors duration-200 ${input}`}/>
                  </label>
                  <label className={`block space-y-2 text-[12px] font-medium ${muted}`}>Teléfono de contacto
                    <input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}
                      placeholder="Ej.: 3794123456" maxLength={40} inputMode="tel"
                      className={`h-11 w-full rounded-[11px] border px-3.5 text-[13px] font-normal outline-none transition-colors duration-200 ${input}`}/>
                  </label>
                </div>
                <label className={`block space-y-2 text-[12px] font-medium ${muted}`}>Dirección de referencia
                  <input value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})}
                    placeholder="Calle, número y localidad" maxLength={240}
                    className={`h-11 w-full rounded-[11px] border px-3.5 text-[13px] font-normal outline-none transition-colors duration-200 ${input}`}/>
                </label>
                <p className={`flex items-start gap-2 text-[11px] leading-5 ${muted}`}><MapPin size={15} className="mt-0.5 shrink-0"/>
                  Esta dirección es solo informativa. Cada pedido se entrega según la ubicación y los datos que indiques en el checkout.</p>
                <div className="flex justify-end">
                  <button type="submit" disabled={!dirty||saving}
                    className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-central-orange px-4 text-[12px] font-semibold text-[#1a1a1a] transition-colors duration-200 hover:brightness-110 disabled:opacity-45">
                    <Save size={15}/>{saving?'Guardando…':'Guardar cambios'}</button>
                </div>
              </form>
              <section className={`border-t pt-7 ${border}`}>
                <h2 className="text-[16px] font-semibold">Acceso con Google</h2>
                <p className={`mt-3 text-[12px] ${muted}`}>Correo vinculado: <span className={primary}>{account.email}</span></p>
                <p className={`mt-2 text-[11px] ${muted}`}>Tu identidad se administra desde Google. No necesitás una contraseña propia para La Central Burger.</p>
              </section>
            </div>}
            {renderedSection==='orders'&&<div className="max-w-[900px]">
              {!orders.length?<div className={`border-t py-12 text-[13px] ${border} ${muted}`}>
                Todavía no hay pedidos vinculados a esta cuenta. Las compras como invitado no se asocian automáticamente por teléfono.
              </div>:orders.map(order=><article key={order.id} className={`border-b py-5 ${border}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="text-[14px] font-semibold">Pedido {order.code}</h2>
                    <p className={`mt-1 text-[11px] ${muted}`}>{new Date(order.createdAt).toLocaleDateString('es-AR')} · {order.status}</p>
                  </div><span className="text-[15px] font-semibold tabular-nums text-central-orange">{money(Number(order.total))}</span>
                </div>
                <p className={`mt-3 text-[12px] leading-6 ${muted}`}>{order.items.map(item=>`${item.quantity} × ${item.name}`).join(' · ')}</p>
              </article>)}
            </div>}
            {(renderedSection==='benefits'||renderedSection==='preferences')&&<div className={`flex max-w-[700px] flex-col items-center border-t py-16 text-center ${border}`}>
              {renderedSection==='benefits'?<Gift size={34} className="text-central-orange"/>:<Heart size={34} className="text-central-orange"/>}
              <h2 className="mt-4 text-[20px] font-semibold">Próximamente</h2>
              <p className={`mt-2 max-w-md text-[13px] leading-6 ${muted}`}>
                {renderedSection==='benefits'?'Estamos preparando nuevas novedades para nuestros clientes. Los beneficios se anunciarán cuando estén disponibles.'
                  :'Pronto vas a tener más opciones para personalizar tu experiencia en La Central Burger.'}
              </p>
            </div>}
            </div>}
          </>}
      </main>
    </div>

    {drawerMounted&&<div data-state={mobileOpen?'open':'closed'} aria-hidden={!mobileOpen} className={`lcb-account-drawer-overlay fixed inset-0 z-[70] lg:hidden ${!mobileOpen?'pointer-events-none':''}`}>
      <button type="button" aria-label="Cerrar menú" onClick={()=>setMobileOpen(false)}
        className="lcb-account-drawer-backdrop absolute inset-0 bg-black/65"/>
      <div role="dialog" aria-modal={mobileOpen} aria-label="Menú de mi cuenta" className="lcb-account-drawer-panel relative h-full w-[264px] max-w-[85vw]">
        <div className="absolute right-3 top-3 z-10">
          <button ref={drawerCloseRef} type="button" aria-label="Cerrar menú" onClick={()=>setMobileOpen(false)} className="rounded-lg p-2 text-central-orange"><X size={18}/></button>
        </div>
        {sidebar}
      </div>
    </div>}
    <ConfirmDialog open={pendingAction!==null} theme={theme} title="Cambios sin guardar"
      description="Tenés modificaciones pendientes. Si salís ahora, se perderán los cambios no guardados."
      confirmLabel="Salir sin guardar" cancelLabel="Seguir editando"
      onConfirm={discard} onCancel={()=>setPendingAction(null)}/>
  </div>;
}
