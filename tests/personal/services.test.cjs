'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');

const config={ env:{supabaseUrl:'https://vsfcjmyiiviyydvbdlrn.supabase.co'}, requireSupabaseConfigured:()=>{} };
const requests=[];
let error=null;
const client={ rpc:async(name,args)=>{requests.push({name,args});return {data:'ok',error};} };
const services=loadSource('src/features/personal/services/staff-payroll.service.ts',{
  '@/lib/config/env':config,
  '@/lib/supabase/client':{getSupabaseBrowserClient:()=>client},
});

describe('Seguridad / cliente de Supabase exclusivo de DEV',()=>{
  test('bloquea producción antes de intentar llamar RPC',async()=>{
    requests.length=0;
    config.env.supabaseUrl='https://nryrcodrtmsrsqstozjj.supabase.co';
    await assert.rejects(()=>services.readStaffDashboard('2026-11-01','2026-11-19'),/únicamente para Supabase/);
    assert.equal(requests.length,0);
    config.env.supabaseUrl='https://vsfcjmyiiviyydvbdlrn.supabase.co';
  });
  test('bloquea dominios que intenten imitar DEV',async()=>{
    requests.length=0;
    config.env.supabaseUrl='https://vsfcjmyiiviyydvbdlrn.supabase.co.evil.example';
    await assert.rejects(()=>services.saveStaffWeek([]),/únicamente/);
    assert.equal(requests.length,0);
    config.env.supabaseUrl='https://vsfcjmyiiviyydvbdlrn.supabase.co';
  });
  test('el error de RPC se propaga sin falso éxito',async()=>{
    error={message:'No autorizado'};
    await assert.rejects(()=>services.approveStaffWeek(['a1']),/No autorizado/);
    error=null;
  });
});

describe('Contratos / parámetros de RPC',()=>{
  async function call(run,name,params) {
    requests.length=0;
    await run();
    assert.equal(requests.length,1);
    assert.equal(requests[0].name,name);
    assert.deepEqual(requests[0].args,params);
  }
  test('consulta tablero por fechas',()=>call(
    ()=>services.readStaffDashboard('2026-11-01','2026-11-19'),
    'admin_staff_dashboard',{from_day:'2026-11-01',to_day:'2026-11-19'}));
  test('tarifas por tipo de jornada y vigencia',()=>call(
    ()=>services.addStaffRate('e1','2026-11-19',15000,18000,20000),
    'admin_staff_add_rate',{employee_uuid:'e1',valid_from:'2026-11-19',weekday_value:15000,saturday_value:18000,sunday_value:20000}));
  test('asistencia individual con motivo de corrección',()=>call(
    ()=>services.saveStaffAttendance('e1','2026-11-16','present','nota','motivo'),
    'admin_staff_save_attendance',{employee_uuid:'e1',attendance_day:'2026-11-16',attendance_value:'present',attendance_notes:'nota',correction_reason:'motivo'}));
  test('guardado de semana conserva snapshot esperado para concurrencia',()=>call(
    ()=>services.saveStaffWeek([{employee_id:'e1',day:'2026-11-16',kind:'absent',expected_id:'a1'}]),
    'admin_staff_save_week',{jsonb_changes:[{employee_id:'e1',day:'2026-11-16',kind:'absent',expected_id:'a1'}]}));
  test('aprobación individual',()=>call(
    ()=>services.approveStaffAttendance('a1'),
    'admin_staff_approve_attendance',{attendance_uuid:'a1'}));
  test('aprobación por lote',()=>call(
    ()=>services.approveStaffWeek(['a1','a2']),
    'admin_staff_approve_week',{attendance_uuids:['a1','a2']}));
  test('liquidación individual',()=>call(
    ()=>services.createStaffPayroll('e1','2026-11-01','2026-11-19','observación'),
    'admin_staff_create_payroll',{employee_uuid:'e1',from_day:'2026-11-01',to_day:'2026-11-19',payroll_notes:'observación'}));
  test('liquidación por lote',()=>call(
    ()=>services.createStaffPayrollBatch(['e1','e2'],'2026-11-01','2026-11-19'),
    'admin_staff_create_payroll_batch',{employee_uuids:['e1','e2'],from_day:'2026-11-01',to_day:'2026-11-19'}));
  test('pago con clave idempotente',()=>call(
    ()=>services.recordStaffPayment('e1','p1',3000,'2026-11-19','payroll','nota','key-1'),
    'admin_staff_record_payment',{employee_uuid:'e1',payroll_uuid:'p1',payment_value:3000,payment_day:'2026-11-19',payment_type:'payroll',payment_notes:'nota',request_uuid:'key-1'}));
  test('anticipo sin liquidación',()=>call(
    ()=>services.recordStaffPayment('e1',null,1000,'2026-11-19','advance','','key-2'),
    'admin_staff_record_payment',{employee_uuid:'e1',payroll_uuid:null,payment_value:1000,payment_day:'2026-11-19',payment_type:'advance',payment_notes:'',request_uuid:'key-2'}));
  test('aplicar anticipo a una liquidación',()=>call(
    ()=>services.applyStaffAdvance('adv1','p1',2500,'key-3'),
    'admin_staff_apply_advance',{advance_uuid:'adv1',payroll_uuid:'p1',allocation_value:2500,request_uuid:'key-3'}));
  test('revertir pago con motivo',()=>call(
    ()=>services.reverseStaffPayment('m1','Error en fecha'),
    'admin_staff_reverse_payment',{payment_uuid:'m1',reverse_reason:'Error en fecha'}));
  test('revertir aplicación de anticipo con motivo',()=>call(
    ()=>services.reverseStaffAllocation('x1','Error de aplicación'),
    'admin_staff_reverse_allocation',{allocation_uuid:'x1',reverse_reason:'Error de aplicación'}));
});
