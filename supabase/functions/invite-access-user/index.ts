import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return out({error:'Método no permitido.'},405);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return out({error:'Configuración incompleta.'},500);
 const token=(req.headers.get('Authorization')??'').replace(/^Bearer\s+/i,'').trim();
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data:auth,error:authError}=await db.auth.getUser(token);
 if(authError||!auth.user)return out({error:'Sesión inválida o vencida.'},401);
 const {data:profile}=await db.from('profiles').select('active,archived_at').eq('id',auth.user.id).maybeSingle();
 const {data:role}=await db.from('roles').select('id').eq('code','admin').eq('active',true).maybeSingle();
 if(!profile?.active||profile.archived_at||!role)return out({error:'No autorizado.'},403);
 const {data:member}=await db.from('user_roles').select('user_id').eq('user_id',auth.user.id).eq('role_id',role.id).maybeSingle();
 if(!member)return out({error:'No autorizado.'},403);
 try{
  const body=await req.json();
  const email=String(body.email??'').trim().toLowerCase(),fullName=String(body.fullName??'').trim(),redirectTo=String(body.redirectTo??'').trim();
  const roleCodes=Array.isArray(body.roleCodes)?body.roleCodes.map(String):[];
  if(!email||!fullName)throw new Error('Nombre y email son obligatorios.');
  const {data,error}=await db.auth.admin.inviteUserByEmail(email,{redirectTo:redirectTo||undefined,data:{full_name:fullName,onboarding_required:true,app_name:'La Central Burger',role_codes:roleCodes}});
  if(error||!data.user)throw error??new Error('No se pudo enviar la invitación.');
  return out({ok:true,userId:data.user.id});
 }catch(error){return out({error:error instanceof Error?error.message:'No se pudo enviar la invitación.'},400);}
});