import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface CustomerAccount {
  id: string; name: string; email: string; phone: string; address: string;
}
export interface CustomerOrderSummary {
  id:string; code:string; createdAt:string;status:string;total:number;
  deliveryMethod:string;items:Array<{name:string;quantity:number;price:number}>;
}
export type CustomerDirectoryEntry = {
  id:string;name:string;email:string|null;phone:string;address:string|null;
  createdAt:string;orders:number;
};
export type CustomerDirectory = {
  registered:CustomerDirectoryEntry[];commercial:CustomerDirectoryEntry[];
};
export const PENDING_CUSTOMER_ORDER_KEY='lcb_pending_order_claim_v1';

function throwIfError(error: {message:string}|null) {
  if(!error)return;
  const message=error.message;
  if(/provider is not enabled|unsupported provider|provider not enabled/i.test(message))
    throw new Error('Google todavía no está habilitado. Podés continuar comprando sin cuenta.');
  throw new Error(message);
}
export const customerAuth = () => getSupabaseBrowserClient().auth;
export async function currentCustomerUser():Promise<User|null> {
  const {data,error}=await customerAuth().getUser();
  if(error) return null;
  return data.user;
}
export async function signInCustomerWithGoogle() {
  const {error}=await customerAuth().signInWithOAuth({
    provider:'google',options:{redirectTo:`${window.location.origin}/mi-cuenta`},
  });
  throwIfError(error);
}
export async function signOutCustomer(){const {error}=await customerAuth().signOut();throwIfError(error);}
export async function getCustomerAccount():Promise<CustomerAccount> {
  const {data,error}=await getSupabaseBrowserClient().rpc('my_customer_account');
  throwIfError(error);
  return data as unknown as CustomerAccount;
}
export async function saveCustomerAccount(name:string,phone:string,address:string){
  const digits=phone.replace(/\D/g,'');
  if(name.trim().length<2||name.length>120||phone.length>40||address.length>240
    ||(phone.trim() && (digits.length<6 || !/^[+()\d\s.-]+$/.test(phone.trim())))){
    throw new Error('Revisá nombre, teléfono y dirección. El teléfono debe tener al menos seis números.');
  }
  const {error}=await getSupabaseBrowserClient().rpc('save_my_customer_account',{
    new_name:name,new_phone:phone,new_address:address,
  });
  throwIfError(error);
}
export async function getMyCustomerOrders():Promise<CustomerOrderSummary[]> {
  const {data,error}=await getSupabaseBrowserClient().rpc('my_customer_orders');
  throwIfError(error);
  return (data??[]) as unknown as CustomerOrderSummary[];
}
export async function claimPendingCustomerOrder() {
  if(typeof window==='undefined') return false;
  const token=window.sessionStorage.getItem(PENDING_CUSTOMER_ORDER_KEY);
  if(!token) return false;
  const {data,error}=await getSupabaseBrowserClient().rpc('claim_my_customer_order',{claim_token:token});
  throwIfError(error);
  // Invalid/expired tokens are cleared too; they must not retry indefinitely.
  window.sessionStorage.removeItem(PENDING_CUSTOMER_ORDER_KEY);
  return Boolean(data);
}
export async function getCustomerDirectory():Promise<CustomerDirectory>{
  const {data,error}=await getSupabaseBrowserClient().rpc('admin_customer_directory');
  throwIfError(error);
  return data as unknown as CustomerDirectory;
}
export async function adminUpdateCustomer(kind:'registered'|'commercial',id:string,name:string,phone:string,address:string){
  const {error}=await getSupabaseBrowserClient().rpc('admin_update_customer_directory',{
    kind,target_id:id,new_name:name,new_phone:phone,new_address:address,
  });
  throwIfError(error);
}

export async function adminCreateCommercialCustomer(name:string,phone:string,address:string){
  const {data,error}=await getSupabaseBrowserClient().rpc('admin_create_customer',{
    new_name:name,new_phone:phone,new_address:address,
  });
  throwIfError(error);
  return data;
}
export async function adminDeleteCommercialCustomer(id:string){
  const {error}=await getSupabaseBrowserClient().rpc('admin_delete_customer_without_orders',{target_id:id});
  throwIfError(error);
}

export async function adminCreateCustomerAccount(input: {name:string;email:string;password:string;phone:string;address:string}) {
  const {data,error}=await getSupabaseBrowserClient().functions.invoke('create-customer-account',{body:input});
  if(error){
    const response='context' in error && error.context instanceof Response?error.context:null;
    const payload=response?await response.clone().json().catch(()=>null) as {error?:string}|null:null;
    throw new Error(payload?.error??'No se pudo crear la cuenta del cliente.');
  }
  if(data?.error)throw new Error(String(data.error));
  if(!data?.ok)throw new Error('No se confirmó el alta de la cuenta.');
}
export async function signInCustomerWithPassword(email:string,password:string) {
  const {error}=await customerAuth().signInWithPassword({email:email.trim().toLowerCase(),password});
  if(error)throw new Error('No se pudo iniciar sesión. Revisá el correo y la contraseña.');
}
