'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Modal } from '@/shared/components/ui/Modal';
import { PasswordInput } from '@/shared/components/ui/PasswordInput';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { TablePagination } from '@/shared/components/ui/TablePagination';
import { useAdminUnsavedChanges } from '@/shared/components/layout/AdminUnsavedChanges';
import {
  getCustomerDirectory, adminUpdateCustomer, adminCreateCustomerAccount,
  adminDeleteCommercialCustomer, type CustomerDirectory, type CustomerDirectoryEntry,
} from '../services/customer-account.service';

const blank={id:'',name:'',email:'',phone:'',address:'',createdAt:'',orders:0};
const control='h-10 w-full rounded-[11px] border border-neutral-200 bg-[#f7f7f9] px-3 text-[13px] text-neutral-900 outline-none transition-colors duration-200 placeholder:text-neutral-400 focus:border-central-orange';
const field=(name:string,value:string,onChange:(value:string)=>void,placeholder:string,required=false)=>
  <label className="block space-y-1.5 text-[11px] font-medium text-neutral-600">{name}
   <input value={value} required={required} maxLength={name==='Dirección de referencia'?240:name==='Nombre completo'?120:40}
    placeholder={placeholder} onChange={e=>onChange(e.target.value)} className={control}/>
  </label>;
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function CustomerAdminPage(){
 const [data,setData]=useState<CustomerDirectory>({registered:[],commercial:[]});
 const [tab,setTab]=useState<'registered'|'commercial'>('registered');
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState<'name'|'recent'>('recent');
 const [page,setPage]=useState(1);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [editing,setEditing]=useState<CustomerDirectoryEntry|null>(null);
 const [original,setOriginal]=useState<CustomerDirectoryEntry|null>(null);
 const [creating,setCreating]=useState(false);
 const [password,setPassword]=useState('');
 const [deleting,setDeleting]=useState<CustomerDirectoryEntry|null>(null);
 const [error,setError]=useState('');
 const dirty=Boolean(editing&&original&&(JSON.stringify(editing)!==JSON.stringify(original)||(creating&&password.length>0)));
 const requestNavigation=useAdminUnsavedChanges(dirty);
 const rows=useMemo(()=>{
  const key=normalize(search.trim());
  return [...data[tab]].filter(x=>!key||normalize([x.name,x.email,x.phone].join(' ')).includes(key))
   .sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'es-AR'):b.createdAt.localeCompare(a.createdAt));
 },[data,tab,search,sort]);
 const pageSize=12;
 const current=Math.min(page,Math.max(1,Math.ceil(rows.length/pageSize)));
 const visible=rows.slice((current-1)*pageSize,current*pageSize);
 async function refresh(){
  setLoading(true);
  try{setData(await getCustomerDirectory());setError('');}
  catch(e){const message=e instanceof Error?e.message:'No se pudieron obtener los clientes';setError(message);toast.error(message);}
  finally{setLoading(false);}
 }
 useEffect(()=>{queueMicrotask(()=>{void refresh();});},[]);
 const switchTab=(next:'registered'|'commercial')=>{
  setTab(next);setPage(1);setSearch('');
 };
 function edit(row?:CustomerDirectoryEntry){
  const value=row??{...blank};
  setOriginal({...value});
  setEditing({...value});
  setCreating(!row);
  setPassword('');
 }
 const close=()=>requestNavigation(()=>{setEditing(null);setOriginal(null);setCreating(false);});
 async function save(event:React.FormEvent){
  event.preventDefault();
  if(!editing||busy)return;
  if(editing.name.trim().length<2||editing.phone.length>40||(editing.address??'').length>240){
   toast.warning('Revisá nombre, teléfono y dirección.');return;
  }
  setBusy(true);
  try{
   if(creating){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email??''))throw new Error('Ingresá un correo válido.');
    if(password.length<8)throw new Error('La contraseña debe tener al menos ocho caracteres.');
    if(editing.phone && editing.phone.replace(/\D/g,'').length<6)throw new Error('Ingresá al menos seis dígitos de teléfono.');
    await adminCreateCustomerAccount({name:editing.name,email:editing.email??'',password,phone:editing.phone,address:editing.address??''});
    setTab('registered');setPage(1);
   }else await adminUpdateCustomer(tab,editing.id,editing.name,editing.phone,editing.address??'');
   setEditing(null);setOriginal(null);setCreating(false);setPassword('');
   toast.success(creating?'Cuenta de cliente creada. Ya puede iniciar sesión con correo y contraseña.':'Datos del cliente guardados.');
   await refresh();
  }catch(e){toast.error(e instanceof Error?e.message:'No se pudo guardar el cliente.');}
  finally{setBusy(false);}
 }
 async function remove(){
  if(!deleting||busy)return;
  setBusy(true);
  try{await adminDeleteCommercialCustomer(deleting.id);toast.success('Cliente eliminado.');setDeleting(null);await refresh();}
  catch(e){toast.error(e instanceof Error?e.message:'No se pudo eliminar el cliente.');}
  finally{setBusy(false);}
 }
 return <main className="w-full min-w-0 space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h1 className="text-[27px] font-semibold tracking-tight text-neutral-950">Clientes</h1>
   <div className="flex gap-2">
    <button type="button" disabled={loading} onClick={()=>void refresh()}
      className="inline-flex h-9 items-center gap-2 rounded-[11px] border border-neutral-200 bg-white px-3 text-[12px] text-neutral-700 transition-colors duration-200 hover:bg-neutral-50">
      <RefreshCw size={14}/>Actualizar
    </button>
    {<button type="button" onClick={()=>edit()} className="inline-flex h-9 items-center gap-2 rounded-[11px] bg-[#191b20] px-3.5 text-[12px] font-medium text-white hover:bg-neutral-700">
     <Plus size={15}/>Nuevo cliente</button>}
   </div>
  </div>
  <div className="flex gap-1 border-b border-neutral-200">
   {([{id:'registered',label:'Cuentas registradas'},{id:'commercial',label:'Clientes de pedidos'}] as const).map(item=>
    <button key={item.id} type="button" onClick={()=>switchTab(item.id)}
     className={'border-b-2 px-4 py-3 text-[13px] transition-colors duration-200 '+(tab===item.id?'border-central-orange text-neutral-900':'border-transparent text-neutral-500 hover:text-neutral-800')}>
     {item.label} <span className="ml-1 text-[11px] text-neutral-400">{data[item.id].length}</span>
    </button>)}
  </div>
  <label className="flex max-w-[360px] items-center gap-2 rounded-[11px] border border-neutral-200 bg-white px-3">
   <Search size={15} className="text-neutral-400"/>
   <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Buscar nombre, correo o teléfono"
    aria-label="Buscar clientes" className="h-10 w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-400"/>
  </label>
  {error&&<p role="alert" className="text-[12px] text-red-600">{error}</p>}
  <div className="overflow-hidden rounded-[15px] border border-neutral-200/80 bg-white">
   <div className="overflow-x-auto">
    <table className="w-full min-w-[730px] border-collapse text-[12px]">
     <thead className="bg-[#F3F4F6] text-[11px] text-neutral-600"><tr>
      <th className="px-4 py-3 text-left font-medium"><button type="button" onClick={()=>setSort('name')}>Cliente ↕</button></th>
      <th className="px-4 py-3 text-left font-medium">Correo</th>
      <th className="px-4 py-3 text-left font-medium">Teléfono</th>
      <th className="px-4 py-3 text-left font-medium">Dirección</th>
      <th className="px-4 py-3 text-right font-medium">Pedidos</th>
      <th className="px-4 py-3 text-right font-medium"><button type="button" onClick={()=>setSort('recent')}>Acciones</button></th>
     </tr></thead>
     <tbody>
      {loading?Array.from({length:5},(_,i)=><tr key={i} className="border-t border-neutral-100"><td colSpan={6} className="px-4 py-3"><div className="h-5 animate-pulse rounded bg-neutral-100"/></td></tr>):
      visible.map(row=><tr key={row.id} className="border-t border-neutral-100 hover:bg-neutral-50/50">
       <td className="px-4 py-3 font-medium text-neutral-900">{row.name||'Sin nombre'}</td>
       <td className="px-4 py-3 text-neutral-600">{row.email||'—'}</td>
       <td className="px-4 py-3 text-neutral-600">{row.phone||'—'}</td>
       <td className="max-w-48 truncate px-4 py-3 text-neutral-600" title={row.address??''}>{row.address||'—'}</td>
       <td className="px-4 py-3 text-right tabular-nums">{row.orders}</td>
       <td className="px-4 py-3 text-right">
        <button type="button" onClick={()=>edit(row)} className="h-8 rounded-[9px] border border-neutral-200 px-3 text-[11px] text-neutral-700 hover:bg-neutral-100">Editar</button>
        {tab==='commercial'&&row.orders===0&&<button type="button" title="Eliminar cliente sin historial" onClick={()=>setDeleting(row)}
          className="ml-2 inline-flex h-8 items-center rounded-[9px] border border-red-100 px-2 text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>}
       </td>
      </tr>)}
      {!loading&&!visible.length&&<tr><td colSpan={6} className="px-4 py-12 text-center text-neutral-500">No se encontraron clientes.</td></tr>}
     </tbody>
    </table>
   </div>
   <TablePagination page={current} pageSize={pageSize} totalItems={rows.length} onPageChange={setPage}/>
  </div>
  <p className="text-[11px] leading-5 text-neutral-500">Las cuentas registradas y los clientes comerciales son entidades diferentes. Los pedidos históricos no se vinculan por coincidencia de teléfono. Las direcciones del perfil nunca sustituyen los datos de entrega de cada pedido.</p>
  <Modal open={editing!==null} onClose={close} theme="light" title={creating?'Nuevo cliente':'Editar cliente'} size="sm"
   footer={<div className="flex justify-end gap-2 border-t border-neutral-100 px-4 py-4 sm:px-5">
    <Button type="button" size="sm" variant="secondary" onClick={close} disabled={busy}>Cancelar</Button>
    <Button form="customer-admin-form" size="sm" type="submit" disabled={busy}>{busy?'Guardando…':creating?'Crear cliente':'Guardar cambios'}</Button>
   </div>}>
   {editing&&<form id="customer-admin-form" onSubmit={event=>void save(event)} className="space-y-4">
    {field('Nombre completo',editing.name,value=>setEditing({...editing,name:value}),'Nombre y apellido',true)}
    {creating&&<label className="block space-y-1.5 text-[11px] font-medium text-neutral-600">Correo de acceso
      <input type="email" required autoComplete="email" value={editing.email??''} onChange={event=>setEditing({...editing,email:event.target.value})} maxLength={254} placeholder="cliente@correo.com" className={control}/>
    </label>}
    {creating&&<label className="block space-y-1.5 text-[11px] font-medium text-neutral-600">Contraseña inicial
      <PasswordInput variant="light" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} autoComplete="new-password" required/>
    </label>}
    {field('Teléfono',editing.phone,value=>setEditing({...editing,phone:value}),'Ej.: 3794123456',creating)}
    {field('Dirección de referencia',editing.address??'',value=>setEditing({...editing,address:value}),'Calle, número y localidad')}
    {!creating&&editing.email&&<p className="text-[11px] leading-5 text-neutral-500">Correo asociado: {editing.email}. Los correos de cuentas registradas deben cambiarse mediante verificación de Supabase Auth.</p>}
    <p className="text-[11px] leading-5 text-neutral-500">{creating?'Se creará una cuenta para iniciar sesión con correo y contraseña. Los pedidos anteriores no se vinculan automáticamente por teléfono.':'La dirección de referencia no modifica los datos de entrega de pedidos anteriores.'}</p>
   </form>}
  </Modal>
  <ConfirmDialog open={Boolean(deleting)} theme="light" tone="danger" title="Eliminar cliente"
   description="Solo se puede eliminar un cliente comercial que no tenga pedidos históricos. ¿Querés continuar?"
   confirmLabel="Eliminar" onConfirm={remove} onCancel={()=>setDeleting(null)} isLoading={busy}/>
 </main>;
}
