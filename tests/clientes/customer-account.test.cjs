/* eslint-disable @typescript-eslint/no-require-imports -- Node QA uses CommonJS. */
'use strict';
const {test,describe}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadSource}=require('../personal/helpers/load-source.cjs');

const authCalls=[];
const rpcCalls=[];
let fakeSession={access_token:'test-access-token'};
const auth={
  getUser:async()=>({data:{user:{id:'user1',email:'cliente@example.com'}},error:null}),
  getSession:async()=>({data:{session:fakeSession},error:null}),
  signUp:async args=>{authCalls.push(['signup',args]);return {data:{user:{id:'user1'},session:null},error:null};},
  signInWithPassword:async args=>{authCalls.push(['password',args]);return {error:null};},
  signInWithOAuth:async args=>{authCalls.push(['oauth',args]);return {error:null};},
  resetPasswordForEmail:async(...args)=>{authCalls.push(['reset',args]);return {error:null};},
  updateUser:async args=>{authCalls.push(['update',args]);return {error:null};},
  signOut:async()=>({error:null}),
};
const client={
  auth,
  rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:name==='claim_my_customer_order'?true:{id:'user1',name:'Cliente'},error:null};},
};
const service=loadSource('src/features/clientes/services/customer-account.service.ts',{
  '@/lib/supabase/client':{getSupabaseBrowserClient:()=>client},
});
const browser=()=>{global.window={location:{origin:'http://localhost:3000'},sessionStorage:{
  data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);},removeItem(k){this.data.delete(k);},
}};};
describe('Clientes / autenticación opcional',()=>{
 test('Google usa OAuth oficial y regresa al perfil',async()=>{
  browser();authCalls.length=0;
  await service.signInCustomerWithGoogle();
  assert.equal(authCalls[0][0],'oauth');
  assert.equal(authCalls[0][1].provider,'google');
  assert.equal(authCalls[0][1].options.redirectTo,'http://localhost:3000/mi-cuenta');
 });
 test('el acceso público no ofrece correo ni contraseña como métodos',()=>{
  const dialog=fs.readFileSync('src/features/clientes/components/CustomerAuthModal.tsx','utf8');
  const page=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
  assert.match(dialog,/¡Registrate para obtener más beneficios!/);
  assert.match(dialog,/Continuar con Google/);
  assert.match(dialog,/Continuar como invitado/);
  assert.doesNotMatch(dialog,/signUpCustomer|signInCustomer\(|PasswordInput|Recuperar contraseña|resetCustomerPassword/);
  assert.doesNotMatch(page,/updateCustomerPassword|updateCustomerEmail|Cambiar contraseña|Cambiar correo/);
 });
 test('se conserva OAuth como único método público de acceso',()=>{
  const source=fs.readFileSync('src/features/clientes/services/customer-account.service.ts','utf8');
  assert.match(source,/signInWithOAuth/);
  assert.doesNotMatch(source,/signUp\(|signInWithPassword\(|resetPasswordForEmail\(/);
 });
});
describe('Clientes / perfil independiente del checkout',()=>{
 test('guardar perfil solo envía nombre teléfono y dirección de referencia',async()=>{
  rpcCalls.length=0;
  await service.saveCustomerAccount('Gabriel','3794555555','Calle de perfil 123');
  assert.deepEqual(rpcCalls[0],{name:'save_my_customer_account',
   args:{new_name:'Gabriel',new_phone:'3794555555',new_address:'Calle de perfil 123'}});
 });
 test('el historial no admite teléfono ni ID arbitrario como parámetro',async()=>{
  rpcCalls.length=0;await service.getMyCustomerOrders();
  assert.deepEqual(rpcCalls[0],{name:'my_customer_orders',args:undefined});
 });
 test('el comprobante de pedido de invitado se reclama una sola vez',async()=>{
  browser();rpcCalls.length=0;
  window.sessionStorage.setItem(service.PENDING_CUSTOMER_ORDER_KEY,'token-seguro');
  assert.equal(await service.claimPendingCustomerOrder(),true);
  assert.equal(rpcCalls[0].name,'claim_my_customer_order');
  assert.equal(rpcCalls[0].args.claim_token,'token-seguro');
  assert.equal(window.sessionStorage.getItem(service.PENDING_CUSTOMER_ORDER_KEY),null);
  assert.equal(await service.claimPendingCustomerOrder(),false);
  assert.equal(rpcCalls.length,1);
 });
 test('nunca genera vínculo de propiedad basado en nombre, correo o teléfono',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261120122000_customer_order_claims.sql','utf8');
  assert.match(sql,/token_hash=encode\(sha256/);
  assert.match(sql,/claimed_at is null and expires_at>now\(\)/);
  assert.doesNotMatch(sql,/where\s+(?:phone|customer_phone|normalized_phone)\s*=/i);
 });
 test('checkout no envía la dirección del perfil al pedido',()=>{
  const checkout=fs.readFileSync('src/features/checkout/services/checkout.service.ts','utf8');
  assert.match(checkout,/address: ''/);
  assert.doesNotMatch(checkout,/getCustomerAccount/);
 });
});
describe('Clientes / administración protegida',()=>{
 test('directorio de administradores usa RPC sin exponer auth.users a clientes',async()=>{
  rpcCalls.length=0;await service.getCustomerDirectory();
  assert.equal(rpcCalls[0].name,'admin_customer_directory');
 });
 test('edición distingue cuentas y clientes comerciales',async()=>{
  rpcCalls.length=0;
  await service.adminUpdateCustomer('registered','u1','Nombre','379','Dirección');
  await service.adminUpdateCustomer('commercial','c1','Comercial','379','Dirección');
  assert.deepEqual(rpcCalls.map(x=>x.args.kind),['registered','commercial']);
 });
 test('los clientes comerciales solo se eliminan a través de RPC controlada',async()=>{
  rpcCalls.length=0;await service.adminDeleteCommercialCustomer('c1');
  assert.deepEqual(rpcCalls[0],{name:'admin_delete_customer_without_orders',args:{target_id:'c1'}});
 });
});
