/* eslint-disable @typescript-eslint/no-require-imports -- Node tests and CLI scripts intentionally use CommonJS. */
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { employee, attendance, payroll } = require('./helpers/fixtures.cjs');

const layout = loadSource('src/features/personal/components/WeeklyAttendanceGrid.tsx', {
  '@/shared/components/ui/Button': { Button: ({children,disabled}) => React.createElement('button',{disabled},children) },
  '@/shared/components/ui/TablePagination': { TablePagination: ()=>null },
  './StaffCheckbox': { StaffCheckbox: ({label,checked,disabled})=>
    React.createElement('input', {type:'checkbox','aria-label':label,checked,disabled,readOnly:true}) },
  './staff-button.styles': {
    staffButtonAccent:'', staffButtonSecondary:'', staffButtonTable:'', staffButtonIcon:'',
  },
});
const { attendanceWeek, attendanceKey, WeeklyAttendanceGrid } = layout;

describe('Asistencia / semanas y calendarios',()=>{
  test('semana normal comienza lunes y termina domingo',()=>{
    assert.deepEqual(attendanceWeek('2026-11-19').map(d=>d.day),
      ['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22']);
  });
  test('lunes ya es primer día de semana',()=>assert.equal(attendanceWeek('2026-11-16')[0].day,'2026-11-16'));
  test('domingo continúa en la misma semana',()=>assert.equal(attendanceWeek('2026-11-22')[0].day,'2026-11-16'));
  test('semana cruza el fin de mes sin desplazar fechas',()=>{
    assert.equal(attendanceWeek('2026-12-01')[0].day,'2026-11-30');
    assert.equal(attendanceWeek('2026-12-01')[6].day,'2026-12-06');
  });
  test('semana cruza año nuevo',()=>{
    assert.equal(attendanceWeek('2027-01-01')[0].day,'2026-12-28');
    assert.equal(attendanceWeek('2027-01-01')[6].day,'2027-01-03');
  });
  test('clave de selección identifica inequívocamente empleado y día',()=>{
    assert.equal(attendanceKey('emp1','2026-11-16'),'emp1:2026-11-16');
    assert.notEqual(attendanceKey('emp1','2026-11-16'),attendanceKey('emp2','2026-11-16'));
  });
});

function renderWeek(overrides={}) {
  return renderToStaticMarkup(React.createElement(WeeklyAttendanceGrid, {
    employees:[employee('e1'),employee('e2')],attendance:[],payrolls:[],lines:[],
    today:'2026-11-19',weekAnchor:'2026-11-19',draft:{},
    onWeekChange:()=>{},onDraft:()=>{},onSave:()=>{},onApprove:()=>{},
    onApproveAll:()=>{},onCorrect:()=>{},busy:false,
    ...overrides,
  }));
}

describe('Asistencias / estructura y estados del panel',()=>{
  test('solo presenta una fila por empleado, no una por asistencia',()=>{
    const html=renderWeek({attendance:[
      attendance('a1','e1','2026-11-16'),
      attendance('a2','e1','2026-11-17'),
    ]});
    assert.equal((html.match(/scope="row"/g)||[]).length,2);
  });
  test('se muestran siete días y siete checks de selección general',()=>{
    const html=renderWeek();
    assert.equal((html.match(/Marcar todos los empleados presentes el/g)||[]).length,7);
    assert.match(html,/LU/);
    assert.match(html,/DO/);
  });
  test('los días futuros no se pueden seleccionar',()=>{
    const html=renderWeek();
    assert.match(html,/aria-label="Gabriel presente el Viernes"[^>]*disabled/);
    assert.match(html,/aria-label="Gabriel presente el Sábado"[^>]*disabled/);
  });
  test('las jornadas aprobadas permanecen bloqueadas',()=>{
    const html=renderWeek({attendance:[attendance('a1','e1','2026-11-16')]});
    assert.match(html,/aria-label="Gabriel presente el Lunes"[^>]*disabled/);
  });
  test('los períodos liquidados bloquean incluso días sin asistencia',()=>{
    const html=renderWeek({payrolls:[payroll('p1','e1','2026-11-16','2026-11-18')]});
    assert.match(html,/aria-label="Gabriel presente el Martes"[^>]*disabled/);
  });
  test('empleados inactivos no tienen checks editables',()=>{
    const html=renderWeek({employees:[employee('e1',{active:false})]});
    assert.match(html,/aria-label="Gabriel presente el Lunes"[^>]*disabled/);
  });
  test('los borradores se identifican como cambios por revisar',()=>{
    const html=renderWeek({draft:{'e1:2026-11-17':'present'}});
    assert.match(html,/Revisar y guardar \(1\)/);
  });
  test('sin cambios deshabilita el guardado',()=>{
    const html=renderWeek();
    assert.match(html,/<button disabled="">Revisar y guardar \(0\)<\/button>/);
  });
  test('tabla vacía informa ausencia de resultados',()=>{
    assert.match(renderWeek({employees:[]}),/No hay empleados para estos filtros/);
  });
  test('detalle cerrado permanece oculto para el teclado',()=>{
    const html=renderWeek();
    assert.match(html,/aria-hidden="true" inert=""/);
  });
});

const modal=loadSource('src/features/personal/components/AttendanceSaveConfirmModal.tsx',{
  '@/shared/components/ui/Button': { Button:({children,disabled})=>React.createElement('button',{disabled},children) },
  '@/shared/components/ui/Modal': { Modal:({children,footer,title})=>React.createElement('div',null,React.createElement('h2',null,title),children,footer) },
  './staff-button.styles': {staffButtonAccent:'',staffButtonSecondary:''},
});

describe('Confirmación / revisión por empleado',()=>{
  test('agrupa por empleado, ordena fechas y separa estados presentes/ausentes',()=>{
    const html=renderToStaticMarkup(React.createElement(modal.AttendanceSaveConfirmModal,{
      open:true,changes:[
        {employee_id:'e1',day:'2026-11-18',kind:'absent'},
        {employee_id:'e2',day:'2026-11-16',kind:'present'},
        {employee_id:'e1',day:'2026-11-16',kind:'present'},
      ],
      nameFor:id=>id==='e1'?'Gabriel':'Jeremias',busy:false,onConfirm:()=>{},onClose:()=>{},
    }));
    assert.match(html,/Detalle por empleado/);
    assert.match(html,/Gabriel/);
    assert.match(html,/Jeremias/);
    assert.ok(html.indexOf('16/11/2026')<html.lastIndexOf('18/11/2026'));
    assert.match(html,/Ausente/);
    assert.match(html,/Presente/);
    assert.match(html,/no generarán pagos automáticamente/);
  });
  test('bloquea confirmación cuando no hay cambios',()=>{
    const html=renderToStaticMarkup(React.createElement(modal.AttendanceSaveConfirmModal,{
      open:true,changes:[],nameFor:id=>id,busy:false,onConfirm:()=>{},onClose:()=>{},
    }));
    assert.match(html,/<button disabled="">Guardar registros<\/button>/);
  });
  test('bloquea ambos botones mientras se guarda',()=>{
    const html=renderToStaticMarkup(React.createElement(modal.AttendanceSaveConfirmModal,{
      open:true,changes:[{employee_id:'e1',day:'2026-11-16',kind:'present'}],
      nameFor:()=> 'Gabriel',busy:true,onConfirm:()=>{},onClose:()=>{},
    }));
    assert.match(html,/<button disabled="">Cancelar<\/button>/);
    assert.match(html,/<button disabled="">Guardando…<\/button>/);
  });
});
