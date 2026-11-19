/* eslint-disable @typescript-eslint/no-require-imports -- Node tests and CLI scripts intentionally use CommonJS. */
'use strict';
/*
 * Uso voluntario (únicamente DEV):
 *   QA_SUPABASE_DATABASE_URL="postgresql://postgres.<REF>:...@.../postgres" npm run test:personal:db
 * Requiere psql. No captura credenciales ni edita datos de forma persistente:
 * cada archivo usa BEGIN/ROLLBACK; cualquier error aborta el proceso.
 */
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const ref='vsfcjmyiiviyydvbdlrn';
const connection=process.env.QA_SUPABASE_DATABASE_URL;
if(!connection) {
  console.error('✖ Falta QA_SUPABASE_DATABASE_URL. Consultá docs/STAFF_PAYROLL_QA.md. No se ejecutó ninguna prueba SQL.');
  process.exit(1);
}
let url;
try { url=new URL(connection); } catch { console.error('✖ URL de conexión inválida.');process.exit(1); }
if(!['postgresql:','postgres:'].includes(url.protocol)
 || !(url.hostname.includes(ref) || url.username.includes(ref))) {
  console.error('✖ Seguridad: solo se permite central-burguer-dev. No se ejecutaron pruebas.');
  process.exit(1);
}
const check=spawnSync('psql',['--version'],{encoding:'utf8',stdio:'pipe'});
if(check.error || check.status!==0) {
  console.error('✖ No se encontró psql. Instalá el cliente PostgreSQL para ejecutar estas pruebas.');
  process.exit(1);
}
const scripts=[
  'supabase/tests/20261116_staff_payroll_v1.sql',
  'supabase/tests/20261116_staff_factual_dates.sql',
  'supabase/tests/20261119_staff_payroll_v2.sql',
];
for(const script of scripts){
  const result=spawnSync('psql',['--no-psqlrc','--set','ON_ERROR_STOP=1','--dbname',connection,'--file',path.resolve(script)],{
    stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:90000,
  });
  if(result.status!==0){
    console.error('✖ '+script+' FALLÓ');
    console.error((result.stderr || result.error?.message || '').replaceAll(connection,'[CONEXIÓN OCULTA]').slice(-3000));
    process.exit(1);
  }
  if(!/ROLLBACK/i.test(result.stdout??'')){
    console.error('✖ '+script+' no confirmó el ROLLBACK final');
    process.exit(1);
  }
  console.log('✔ '+script+' · transacción revertida');
}
console.log('✔ Suite SQL DEV terminada: no se persistieron cambios de prueba.');
