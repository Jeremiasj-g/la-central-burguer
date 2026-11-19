/* eslint-disable @typescript-eslint/no-require-imports -- Node tests and CLI scripts intentionally use CommonJS. */
'use strict';
const {test,describe}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');

const source=name=>readFileSync(path.resolve(process.cwd(),name),'utf8');
const page=source('src/features/personal/pages/PersonalAdminPage.tsx');
const week=source('src/features/personal/components/WeeklyAttendanceGrid.tsx');
const modal=source('src/features/personal/components/StaffEditorModal.tsx');
const receipt=source('src/features/personal/components/PayrollReceiptModal.tsx');
const access=source('src/features/personal/services/staff-payroll.service.ts');

describe('Contratos de UI / estados, navegación y accesibilidad',()=>{
  test('guardado y aprobación permanecen operaciones distintas',()=>{
    assert.match(page,/saveStaffWeek\(changes\)/);
    assert.match(page,/approveStaffWeek\(ids\)/);
    assert.match(page,/confirmOperation === 'week'|confirmOperation==='week'/);
  });
  test('liquidaciones por lote requieren una confirmación explícita',()=>{
    assert.match(page,/createStaffPayrollBatch\(ids,from,to\)/);
    assert.match(page,/ConfirmDialog/);
    assert.match(page,/Generar liquidaciones/);
  });
  test('borradores sin guardar bloquean navegación',()=>{
    assert.match(page,/useAdminUnsavedChanges\(dirty\)/);
    assert.match(page,/Object\.keys\(weeklyDraft\)\.length/);
  });
  test('guardado masivo no intenta registrar jornadas mediante clic directo',()=>{
    assert.match(week,/onSave/);
    assert.doesNotMatch(week,/saveStaffWeek\(/);
  });
  test('se distinguen presente, ausente y sin registrar',()=>{
    assert.match(week,/✓ Presente/);
    assert.match(week,/— Ausente/);
    assert.match(week,/Vacío: sin registrar/);
  });
  test('detalle de asistencias se expande mediante altura, no mediante fade',()=>{
    assert.match(week,/grid-rows-\[1fr\]/);
    assert.match(week,/grid-rows-\[0fr\]/);
    assert.match(week,/transition-\[grid-template-rows\]/);
    assert.match(week,/motion-reduce:transition-none/);
    assert.match(week,/aria-expanded/);
    assert.match(week,/inert=\{expanded!==employee\.id\}/);
  });
  test('tabla semanal permite navegación a semanas anteriores',()=>{
    assert.match(week,/Semana anterior/);
    assert.match(week,/Semana siguiente/);
  });
  test('campos históricos bloquean fechas futuras',()=>{
    assert.match(modal,/maxDate=\{today\}/);
    assert.match(page,/No se puede registrar una asistencia posterior a hoy/);
  });
  test('los usuarios con rol Personal se enlazan sin alta independiente',()=>{
    assert.doesNotMatch(page,/saveStaffEmployee/);
    assert.match(page,/ROUTES\.adminUsuarios/);
  });
  test('exportación es .xlsx y usa los movimientos filtrados',()=>{
    assert.match(page,/exportStaffMovementsExcel\(displayedPayments/);
    assert.match(page,/movimientos-personal-\$\{today\}\.xlsx/);
  });
  test('comprobante señala explícitamente que no es recibo legal',()=>{
    assert.match(receipt,/No es un recibo de sueldo legal/);
    assert.match(receipt,/Imprimir \/ PDF/);
  });
  test('no se confía en ocultar el botón para proteger la base',()=>{
    assert.match(access,/admin_staff_save_week/);
    assert.match(access,/admin_staff_approve_week/);
    assert.match(access,/central-burguer-dev/);
  });
});
