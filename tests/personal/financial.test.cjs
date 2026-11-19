/* eslint-disable @typescript-eslint/no-require-imports -- Node tests and CLI scripts intentionally use CommonJS. */
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { employee, attendance, payroll, line, payment, allocation, dashboard } = require('./helpers/fixtures.cjs');

const { getPayrollBalance, getUnallocatedAdvance } = loadSource('src/features/personal/types/staff-payroll.types.ts');

describe('Personal / saldo de liquidaciones', () => {
  test('suma jornadas históricas del período, pagos y anticipos aplicados', () => {
    const db = dashboard({
      lines: [line(), line('l2','p1','a2',25000), line('l3','p2','a3',100000)],
      payments: [payment(), payment('m2',{amount:7000}), payment('m3',{payroll_id:'p2',amount:9000})],
      allocations: [allocation(), allocation('x2',{payroll_id:'p2',amount:15000})],
    });
    assert.deepEqual(getPayrollBalance('p1', db), { gross:40000, paid:10000, applied:2000, pending:28000 });
  });
  test('ignora pagos y aplicaciones revertidos', () => {
    const db = dashboard({
      lines:[line()],
      payments:[payment('m1',{amount:5000,reversed_at:'2026-11-18'}),payment('m2',{amount:1000})],
      allocations:[allocation('x1',{amount:3000,reversed_at:'2026-11-18'}),allocation('x2',{amount:2000})],
    });
    assert.deepEqual(getPayrollBalance('p1', db), {gross:15000,paid:1000,applied:2000,pending:12000});
  });
  test('no deja saldo negativo si los registros están sobreaplicados', () => {
    const db = dashboard({lines:[line('l1','p1','a1',1000)],payments:[payment('m1',{amount:1100})]});
    assert.equal(getPayrollBalance('p1', db).pending, 0);
  });
  test('mantiene el valor histórico aunque se modifiquen las tarifas vigentes', () => {
    const db = dashboard({lines:[line('l1','p1','a1',12500)],rates:[{weekday_rate:999999}]});
    assert.equal(getPayrollBalance('p1', db).gross,12500);
  });
  test('separa exactamente dos liquidaciones del mismo empleado', () => {
    const db=dashboard({lines:[line('l1','p1','a1',15000),line('l2','p2','a2',22000)]});
    assert.equal(getPayrollBalance('p1',db).gross,15000);
    assert.equal(getPayrollBalance('p2',db).gross,22000);
  });
  test('suma correctamente importes decimales en pesos y redondea saldo a centavos',()=>{
    const db=dashboard({lines:[line('l1','p1','a1',100.5)],payments:[payment('m1',{amount:30.22})],allocations:[allocation('x1',{amount:10.17})]});
    assert.equal(getPayrollBalance('p1',db).pending,60.11);
  });
  test('sin movimientos devuelve saldo e importes cero',()=>{
    assert.deepEqual(getPayrollBalance('no-existe',dashboard()),{gross:0,paid:0,applied:0,pending:0});
  });
});

describe('Personal / anticipos',()=>{
  test('calcula saldo disponible luego de aplicar el anticipo',()=>{
    const db=dashboard({
      payments:[payment('adv1',{payment_kind:'advance',payroll_id:null,amount:25000})],
      allocations:[allocation('x1',{amount:10000}),allocation('x2',{amount:2500})],
    });
    assert.equal(getUnallocatedAdvance('adv1',db),12500);
  });
  test('ignora aplicaciones revertidas',()=>{
    const db=dashboard({payments:[payment('adv1',{payment_kind:'advance',amount:10000})],
      allocations:[allocation('x1',{amount:9000,reversed_at:'2026-11-19'}), allocation('x2',{amount:2000})]});
    assert.equal(getUnallocatedAdvance('adv1',db),8000);
  });
  test('anticipo revertido no queda disponible',()=>{
    const db=dashboard({payments:[payment('adv1',{payment_kind:'advance',amount:10000,reversed_at:'2026-11-19'})]});
    assert.equal(getUnallocatedAdvance('adv1',db),0);
  });
  test('un pago normal no es un anticipo',()=>{
    assert.equal(getUnallocatedAdvance('m1',dashboard({payments:[payment()]})),0);
  });
  test('un ID no existente no genera saldo disponible',()=>{
    assert.equal(getUnallocatedAdvance('inexistente',dashboard()),0);
  });
  test('no mezcla aplicaciones de anticipos diferentes',()=>{
    const db=dashboard({payments:[payment('adv1',{payment_kind:'advance',amount:10000})],
      allocations:[allocation('x1',{advance_id:'adv2',amount:9000})]});
    assert.equal(getUnallocatedAdvance('adv1',db),10000);
  });
  test('no devuelve un disponible negativo',()=>{
    const db=dashboard({payments:[payment('adv1',{payment_kind:'advance',amount:500})],
      allocations:[allocation('x1',{amount:999})]});
    assert.equal(getUnallocatedAdvance('adv1',db),0);
  });
  test('redondea correctamente a dos decimales',()=>{
    const db=dashboard({payments:[payment('adv1',{payment_kind:'advance',amount:200.5})],
      allocations:[allocation('x1',{amount:30.22})]});
    assert.equal(getUnallocatedAdvance('adv1',db),170.28);
  });
});

const { calculatePayrollPreview } = loadSource('src/features/personal/components/PayrollBatchReview.tsx',{
  '@/shared/components/ui/Button':{},
  '@/shared/components/ui/DatePickerField':{},
  '@/shared/utils/format.utils':{},
  './StaffCheckbox':{},
  './staff-button.styles':{},
});

describe('Personal / vista previa de liquidaciones',()=>{
  test('detecta jornadas aprobadas y calcula el devengado',()=>{
    const db=dashboard({attendance:[attendance(),attendance('a2','e1','2026-11-17',{amount_snapshot:20000})]});
    assert.deepEqual(calculatePayrollPreview(db,'2026-11-16','2026-11-22',['e1']),[
      {id:'e1',name:'Gabriel',days:2,gross:35000,pending:0,overlap:false,ready:true}
    ]);
  });
  test('incluye ambos extremos de fecha del período',()=>{
    const db=dashboard({attendance:[attendance(),attendance('a2','e1','2026-11-22'),attendance('a3','e1','2026-11-23')]});
    assert.equal(calculatePayrollPreview(db,'2026-11-16','2026-11-22',['e1'])[0].days,2);
  });
  test('bloquea empleado con asistencia pendiente aunque otras jornadas estén aprobadas',()=>{
    const db=dashboard({attendance:[attendance(),attendance('a2','e1','2026-11-17',{approval_status:'pending',amount_snapshot:null})]});
    const row=calculatePayrollPreview(db,'2026-11-16','2026-11-22',['e1'])[0];
    assert.equal(row.pending,1);
    assert.equal(row.days,1);
    assert.equal(row.ready,false);
  });
  test('una asistencia ausente aprobada cuenta como jornada de cero pesos',()=>{
    const db=dashboard({attendance:[attendance('a1','e1','2026-11-16',{attendance_kind:'absent',amount_snapshot:0})]});
    const row=calculatePayrollPreview(db,'2026-11-16','2026-11-22',['e1'])[0];
    assert.equal(row.days,1);
    assert.equal(row.gross,0);
    assert.equal(row.ready,true);
  });
  test('sin jornadas no permite liquidar',()=>{
    const row=calculatePayrollPreview(dashboard({attendance:[]}), '2026-11-16','2026-11-22',['e1'])[0];
    assert.equal(row.ready,false);
    assert.equal(row.days,0);
  });
  test('no reutiliza jornadas ya liquidadas',()=>{
    const db=dashboard({lines:[line()]});
    assert.equal(calculatePayrollPreview(db,'2026-11-16','2026-11-22',['e1'])[0].ready,false);
  });
  test('bloquea períodos que se solapan por fecha inicial',()=>{
    const db=dashboard({payrolls:[payroll('p1','e1','2026-11-10','2026-11-16')]});
    assert.equal(calculatePayrollPreview(db,'2026-11-16','2026-11-22',['e1'])[0].overlap,true);
  });
  test('bloquea períodos que se solapan por fecha final',()=>{
    const db=dashboard({payrolls:[payroll('p1','e1','2026-11-22','2026-11-25')]});
    assert.equal(calculatePayrollPreview(db,'2026-11-16','2026-11-22',['e1'])[0].ready,false);
  });
  test('un período anterior que no se solapa permite procesar',()=>{
    const db=dashboard({payrolls:[payroll('p1','e1','2026-11-01','2026-11-15')]});
    assert.equal(calculatePayrollPreview(db,'2026-11-16','2026-11-22',['e1'])[0].ready,true);
  });
  test('filtro por empleados no mezcla identidades',()=>{
    const db=dashboard({employees:[employee('e1'),employee('e2')],attendance:[
      attendance('a1','e1'),attendance('a2','e2','2026-11-16',{amount_snapshot:27000})
    ]});
    assert.deepEqual(calculatePayrollPreview(db,'2026-11-16','2026-11-22',['e2']).map(r=>[r.id,r.gross]),[['e2',27000]]);
  });
});
