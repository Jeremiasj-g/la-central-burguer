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
  const sql=fs.readFileSync('supabase/migrations/20261120235820_prod_customer_order_claims_private.sql','utf8');
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


describe('Clientes / diseño responsive y aislamiento de identidad',()=>{
 test('Mi cuenta utiliza layout dedicado sin footer ni header de tienda',()=>{
   const page=fs.readFileSync('src/app/(public)/mi-cuenta/page.tsx','utf8');
   assert.match(page,/CustomerAuthProvider/);
   assert.doesNotMatch(page,/PublicShell|PublicFooter|PublicHeader/);
 });
 test('El header personal sólo ofrece casa, tema y salida; drawer para móvil',()=>{
   const page=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
   assert.match(page,/aria-label="Ir al inicio"/);
   assert.match(page,/PublicThemeToggle/);
   assert.match(page,/aria-label="Cerrar sesión"/);
   assert.match(page,/aria-label="Abrir menú de mi cuenta"/);
   assert.match(page,/aria-label="Cerrar menú"/);
 });
 test('Cada sección está disponible y las futuras indican Próximamente',()=>{
   const page=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
   for(const section of ["Configuración del perfil","Mis pedidos","Beneficios","Preferencias","Próximamente"]){
     assert.ok(page.includes(section),section);
   }
 });
 test('Perfil respeta modo claro y oscuro desde el proveedor público',()=>{
   const page=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
   assert.match(page,/usePublicTheme\(\)/);
   assert.match(page,/theme==='dark'/);
   assert.match(page,/bg-\[#F7F7F8\]/);
   assert.match(page,/bg-\[#111111\]/);
   assert.match(page,/bg-\[#20201f\]/);
 });
 test('el tema oscuro de Mi cuenta reutiliza la paleta de las tarjetas del Home',()=>{
   const account=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
   const card=fs.readFileSync('src/features/productos/components/ProductoCard.tsx','utf8');
   const onboarding=fs.readFileSync('src/features/clientes/components/CustomerOnboarding.tsx','utf8');
   assert.ok(card.includes('bg-[#20201f]'));
   assert.ok(account.includes('bg-[#20201f]'));
   assert.ok(account.includes('bg-[#111111]'));
   assert.ok(onboarding.includes('bg-[#1d1d1d]'));
   assert.ok(!account.includes('bg-[#111216]'));
   assert.ok(!account.includes('bg-[#191b20]'));
 });
 test('checkout autocompleta contacto verificado sin pisar ediciones ni ubicación GPS',()=>{
   const checkout=fs.readFileSync('src/features/checkout/components/CheckoutModal.tsx','utf8');
   assert.ok(checkout.includes('getCustomerAccount().then(profile'));
   assert.ok(checkout.includes('profile.id !== user.id'));
   assert.ok(checkout.includes('customerName: !contactEditedRef.current.name'));
   assert.ok(checkout.includes('customerPhone: !contactEditedRef.current.phone'));
   assert.ok(checkout.includes("key === 'customerName'"));
   assert.ok(checkout.includes("key === 'customerPhone'"));
   assert.ok(checkout.includes('getCheckoutDraft()'));
   assert.ok(checkout.includes('requestLocation()'));
   assert.ok(checkout.includes('deliveryQuoteToken: quote.quoteToken'));
 });
 test('No renderiza un perfil ajeno mientras cambia la sesión OAuth',()=>{
   const page=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
   assert.match(page,/profile\.id!==userId/);
   assert.match(page,/account\?\.id===userId/);
 });
 test('Clientes usa el ancho completo del shell administrativo',()=>{
   const page=fs.readFileSync('src/features/clientes/pages/CustomerAdminPage.tsx','utf8');
   assert.match(page,/w-full min-w-0 space-y-5/);
   assert.doesNotMatch(page,/max-w-\[1440px\]/);
 });
});


describe('Clientes / animaciones de navegación y skeletons',()=>{
 test('el drawer permanece montado para animar apertura y cierre',()=>{
  const page=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
  const css=fs.readFileSync('src/app/(public)/mi-cuenta/account-motion.css','utf8');
  assert.match(page,/useAnimatedPresence\(mobileOpen,200\)/);
  assert.match(page,/data-state=\{mobileOpen\?'open':'closed'\}/);
  assert.match(css,/lcb-account-drawer-in/);
  assert.match(css,/lcb-account-drawer-out/);
  assert.match(css,/prefers-reduced-motion: reduce/);
 });
 test('navegar muestra skeletons con la forma de cada sección',()=>{
  const page=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
  assert.match(page,/setSectionLoading\(true\)/);
  assert.match(page,/aria-label="Cargando sección"/);
  assert.match(page,/section==='orders'\?/);
  assert.match(page,/setRenderedSection\(section\)/);
 });
 test('la sección entra suavemente y no usa transiciones de solo opacidad',()=>{
  const css=fs.readFileSync('src/app/(public)/mi-cuenta/account-motion.css','utf8');
  assert.match(css,/lcb-account-content-enter/);
  assert.match(css,/translateY\(9px\)/);
  assert.match(css,/clip-path: inset/);
 });
 test('no quedan subtítulos ornamentales ni textos duplicados',()=>{
  const page=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
  assert.doesNotMatch(page,/Espacio personal|Administrá tus datos personales|Consultá las compras vinculadas a tu cuenta/);
 });
});


describe('Clientes / identidad Google y controles públicos consistentes',()=>{
 test('avatar redondo prioriza foto verificada de Google con fallback de usuario',()=>{
  const avatar=fs.readFileSync('src/features/clientes/components/CustomerGoogleAvatar.tsx','utf8');
  const page=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
  assert.match(avatar,/googleIdentity\?\.identity_data\?\.avatar_url/);
  assert.match(avatar,/metadata\?\.picture/);
  assert.match(avatar,/key=\{src\}/);
  assert.match(avatar,/referrerPolicy="no-referrer"/);
  assert.match(avatar,/googleusercontent\.com/);
  assert.match(avatar,/rounded-full/);
  assert.match(avatar,/onError=\{\(\)=>setFailed\(true\)\}/);
  assert.match(page,/<CustomerGoogleAvatar user=\{user\}/);
 });
 test('modal de Google respeta el tema público y nunca fuerza modo oscuro',()=>{
  const modal=fs.readFileSync('src/features/clientes/components/CustomerAuthModal.tsx','utf8');
  assert.match(modal,/usePublicTheme\(\)/);
  assert.match(modal,/theme=\{theme\}/);
  assert.match(modal,/text-neutral-600/);
  assert.doesNotMatch(modal,/theme="dark"/);
  assert.match(modal,/¡Registrate para obtener más beneficios!/);
 });
 test('header público usa carta ilustrada y controles móviles de 40px uniformes',()=>{
  const header=fs.readFileSync('src/shared/components/layout/PublicHeader.tsx','utf8');
  const css=fs.readFileSync('src/app/(public)/light.css','utf8');
  assert.match(header,/BookOpenText/);
  assert.match(header,/aria-label="Ver carta"/);
  assert.doesNotMatch(header,/>\s*Menú\s*<\/Link>/);
  assert.match(header,/lcb-public-header-theme/);
  assert.match(css,/lcb-public-header-action/);
  assert.match(css,/max-width: 639px/);
  assert.match(css,/min-width: 40px/);
  assert.match(css,/data-public-theme="light"/);
 });
});


describe('Clientes / refinamiento de registro y drawer',()=>{
 test('título de beneficios más protagonista sin romper estilos de modal compartida',()=>{
  const modal=fs.readFileSync('src/features/clientes/components/CustomerAuthModal.tsx','utf8');
  assert.ok(modal.includes('titleClassName="!text-[23px] sm:!text-[27px]'));
  assert.ok(modal.includes('!font-semibold'));
  assert.ok(modal.includes('theme={theme}'));
 });
 test('el login oscuro usa el carbón de las cards y no cambia el tema claro',()=>{
  const modal=fs.readFileSync('src/features/clientes/components/CustomerAuthModal.tsx','utf8');
  const product=fs.readFileSync('src/features/productos/components/ProductoCard.tsx','utf8');
  const css=fs.readFileSync('src/app/(public)/public.css','utf8');
  assert.ok(product.includes('bg-[#20201f]'));
  assert.ok(modal.includes('lcb-customer-auth-panel !rounded-[22px] !border-white/10 !bg-[#20201f]'));
  assert.ok(modal.includes("border-white/15 bg-[#1d1d1d] text-white placeholder:text-white/35"));
  assert.ok(modal.includes("!h-11 !rounded-[11px] !border-white/15 !bg-[#1d1d1d]"));
  assert.ok(modal.includes('border border-neutral-200 bg-white px-4'));
  assert.ok(modal.includes('text-[#202124] transition-colors duration-200 hover:bg-neutral-100'));
  assert.ok(!modal.includes("bg-[#292725]"));
  assert.ok(css.includes('[data-theme="dark"] section.lcb-customer-auth-panel[role="dialog"]'));
  assert.ok(!modal.includes('!bg-[#1a1a1d]'));
 });
 test('logo de Google usa marca multicolor y no una G azul textual',()=>{
  const modal=fs.readFileSync('src/features/clientes/components/CustomerAuthModal.tsx','utf8');
  for(const color of ['#EA4335','#4285F4','#FBBC05','#34A853']) assert.ok(modal.includes(color),color);
  assert.equal(modal.includes('>G</span>'),false);
 });
 test('drawer aplica blur real al fondo y mantiene el panel nítido',()=>{
  const css=fs.readFileSync('src/app/(public)/mi-cuenta/account-motion.css','utf8');
  assert.ok(css.includes('.lcb-account-drawer-backdrop {'));
  assert.ok(css.includes('backdrop-filter: blur(6px)'));
  assert.ok(css.includes('lcb-account-drawer-out'));
  assert.ok(css.includes('prefers-reduced-motion: reduce'));
  const panelRule=css.split('.lcb-account-drawer-panel {')[1]?.split('}')[0]??'';
  assert.equal(panelRule.includes('backdrop-filter'),false);
 });
});

describe('Clientes / cierre de sesión sin pantalla intermedia',()=>{
 test('el diálogo permanece mientras Supabase cierra sesión y el router llega al Home',()=>{
   const page=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
   const logout=page.split('  async function logout(){')[1]?.split('  function navigate(')[0] ?? '';
   assert.match(logout,/await signOutCustomer\(\)/);
   assert.match(logout,/router\.replace\('\/'\)/);
   assert.match(logout,/logoutFallbackRef\.current=window\.setTimeout/);
   assert.doesNotMatch(logout,/setLogoutOpen\(false\)|setAccount\(null\)|setDraft\(null\)|setOrders\(\[\]\)/);
   assert.match(page,/displayUser=user \?\? \(signingOut \? lastSessionUserRef\.current : null\)/);
   assert.match(page,/!user&&!signingOut/);
   assert.match(page,/isLoading=\{signingOut\}/);
 });
 test('si Supabase falla la modal continúa y se puede volver a intentar',()=>{
   const page=fs.readFileSync('src/features/clientes/pages/CustomerAccountPage.tsx','utf8');
   const logout=page.split('  async function logout(){')[1]?.split('  function navigate(')[0] ?? '';
   assert.match(logout,/catch\(cause\)\{[\s\S]*setSigningOut\(false\)/);
   assert.match(logout,/toast\.error/);
   assert.match(page,/if\(!signingOut\)setLogoutOpen\(false\)/);
   assert.match(page,/if\(!dirty \|\| signingOut\)return/);
 });
});
