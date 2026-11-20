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

function throwIfError(error: {message:string}|null) { if(error) throw new Error(error.message); }
export const customerAuth = () => getSupabaseBrowserClient().auth;
export async function currentCustomerUser():Promise<User|null> {
  const {data,error}=await customerAuth().getUser();
  if(error) return null;
  return data.user;
}
export async function signUpCustomer(email:string,password:string) {
  const {data,error}=await customerAuth().signUp({
    email:email.trim().toLowerCase(), password,
    options:{emailRedirectTo:typeof window!=='undefined' ? `${window.location.origin}/mi-cuenta`:undefined},
  });
  throwIfError(error);
  return { needsConfirmation:!data.session };
}
export async function signInCustomer(email:string,password:string) {
  const {error}=await customerAuth().signInWithPassword({email:email.trim(),password});
  throwIfError(error);
}
export async function signInCustomerWithGoogle() {
  const {error}=await customerAuth().signInWithOAuth({
    provider:'google',options:{redirectTo:`${window.location.origin}/mi-cuenta`},
  });
  throwIfError(error);
}
export async function signOutCustomer(){const {error}=await customerAuth().signOut();throwIfError(error);}
export async function resetCustomerPassword(email:string) {
  const {error}=await customerAuth().resetPasswordForEmail(email.trim(),{
    redirectTo:`${window.location.origin}/mi-cuenta?recuperar=1`,
  });
  throwIfError(error);
}
export async function updateCustomerPassword(password:string) {
  const {error}=await customerAuth().updateUser({password});throwIfError(error);
}
export async function updateCustomerEmail(email:string){
  const {error}=await customerAuth().updateUser({email:email.trim().toLowerCase()});throwIfError(error);
}
export async function getCustomerAccount():Promise<CustomerAccount> {
  const {data,error}=await getSupabaseBrowserClient().rpc('my_customer_account');
  throwIfError(error);
  return data as unknown as CustomerAccount;
}
export async function saveCustomerAccount(name:string,phone:string,address:string){
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
