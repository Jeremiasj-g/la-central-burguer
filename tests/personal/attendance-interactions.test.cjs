'use strict';
const {test,describe}=require('node:test');
const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const {employee,attendance,payroll}=require('./helpers/fixtures.cjs');

// Modelo de elementos JSX: inspecciona callbacks de la UI real, sin browser ni mocks de reglas.
const h=(type,props,key)=>({type,props:props??{},key});
const runtime={jsx:h,jsxs:h,Fragment:Symbol.for('react.fragment')};
const react={Fragment:runtime.Fragment,useMemo:fn=>fn(),useState:value=>[value,()=>{}]};
const icons={};
const code=loadSource('src/features/personal/components/WeeklyAttendanceGrid.tsx',{
  'react':react,'react/jsx-runtime':runtime,'lucide-react':icons,
  '@/shared/components/ui/Button':{Button:'Button'},
  '@/shared/components/ui/TablePagination':{TablePagination:'Pagination'},
  './StaffCheckbox':{StaffCheckbox:'StaffCheckbox'},
  './staff-button.styles':{staffButtonAccent:'',staffButtonSecondary:'',staffButtonTable:'',staffButtonIcon:''},
});

function walk(node,list=[]) {
  if (node===null||node===undefined||typeof node==='boolean') return list;
  if (Array.isArray(node)){node.forEach(child=>walk(child,list));return list;}
  if (typeof node==='object'&&'type' in node){
    list.push(node);
    walk(node.props.children,list);
  }
  return list;
}
function build(overrides={}) {
  let changed;
  let saved=0, approved=[];
  const props={
    employees:[employee('e1'),employee('e2')],attendance:[],payrolls:[],lines:[],
    today:'2026-11-19',weekAnchor:'2026-11-19',draft:{},
    onWeekChange:()=>{},onDraft:next=>{changed=next;},
    onSave:()=>{saved++;},onApprove:()=>{},
    onApproveAll:ids=>{approved=ids;},onCorrect:()=>{},busy:false,
    ...overrides,
  };
  const tree=walk(code.WeeklyAttendanceGrid(props));
  const input=label=>tree.find(node=>node.type==='input'&&node.props['aria-label']===label);
  const checkbox=label=>tree.find(node=>node.type==='StaffCheckbox'&&node.props.label===label);
  const button=label=>tree.find(node=>node.type==='button'&&node.props['aria-label']===label);
  return {tree,input,checkbox,button,getDraft:()=>changed,getSave:()=>saved,getApproved:()=>approved};
}

describe('Asistencias / interacción de checks reales',()=>{
  test('tildar empleado sin registro genera sólo una asistencia presente en el borrador',()=>{
    const ui=build();
    ui.input('Gabriel presente el Lunes').props.onChange({target:{checked:true}});
    assert.deepEqual(ui.getDraft(),{'e1:2026-11-16':'present'});
  });
  test('desmarcar un presente existente genera ausencia explícita',()=>{
    const ui=build({attendance:[attendance('a1','e1','2026-11-16',{approval_status:'pending'})]});
    ui.input('Gabriel presente el Lunes').props.onChange({target:{checked:false}});
    assert.deepEqual(ui.getDraft(),{'e1:2026-11-16':'absent'});
  });
  test('marcar ausencia explícitamente no modifica al otro empleado',()=>{
    const ui=build();
    const absent=ui.button('Marcar ausente: Gabriel, Martes');
    absent.props.onClick();
    assert.deepEqual(ui.getDraft(),{'e1:2026-11-17':'absent'});
  });
  test('si el valor coincide con el registro original elimina el cambio redundante',()=>{
    const ui=build({attendance:[attendance('a1','e1','2026-11-16',{approval_status:'pending',attendance_kind:'present'})],
      draft:{'e1:2026-11-16':'absent'}});
    ui.input('Gabriel presente el Lunes').props.onChange({target:{checked:true}});
    assert.deepEqual(ui.getDraft(),{});
  });
  test('checkbox general marca todos los empleados habilitados',()=>{
    const ui=build();
    ui.checkbox('Marcar todos los empleados presentes el Lunes').props.onChange(true);
    assert.deepEqual(ui.getDraft(),{'e1:2026-11-16':'present','e2:2026-11-16':'present'});
  });
  test('marcado general no toca empleado inactivo',()=>{
    const ui=build({employees:[employee('e1'),employee('e2',{active:false})]});
    ui.checkbox('Marcar todos los empleados presentes el Lunes').props.onChange(true);
    assert.deepEqual(ui.getDraft(),{'e1:2026-11-16':'present'});
  });
  test('marcado general no altera jornadas aprobadas',()=>{
    const ui=build({attendance:[attendance('a1','e1','2026-11-16')]});
    ui.checkbox('Marcar todos los empleados presentes el Lunes').props.onChange(true);
    assert.deepEqual(ui.getDraft(),{'e2:2026-11-16':'present'});
  });
  test('desmarcar general descarta selecciones sin crear ausencias masivas',()=>{
    const ui=build({draft:{'e1:2026-11-16':'present','e2:2026-11-16':'present'}});
    ui.checkbox('Marcar todos los empleados presentes el Lunes').props.onChange(false);
    assert.deepEqual(ui.getDraft(),{});
  });
  test('fechas futuras mantienen bloqueada toda la columna',()=>{
    const ui=build();
    const friday=ui.checkbox('Marcar todos los empleados presentes el Viernes');
    assert.equal(friday.props.disabled,true);
    assert.equal(ui.input('Gabriel presente el Viernes').props.disabled,true);
  });
  test('períodos liquidados bloquean marcación general del empleado afectado',()=>{
    const ui=build({payrolls:[payroll('p1','e1','2026-11-16','2026-11-22')]});
    ui.checkbox('Marcar todos los empleados presentes el Lunes').props.onChange(true);
    assert.deepEqual(ui.getDraft(),{'e2:2026-11-16':'present'});
  });
  test('un detalle pendiente permite aprobación pero no aprueba en guardado',()=>{
    const ui=build({attendance:[attendance('a1','e1','2026-11-16',{approval_status:'pending'})]});
    const approve=ui.tree.find(node=>node.type==='Button'&&String(node.props.children).includes('Aprobar pendientes'));
    assert.ok(approve);
    approve.props.onClick();
    assert.deepEqual(ui.getApproved(),['a1']);
    assert.equal(ui.getSave(),0);
  });
  test('guardar exige habilitación y delega en la confirmación',()=>{
    const ui=build({draft:{'e1:2026-11-16':'present'}});
    const save=ui.tree.find(node=>node.type==='Button'&&String(node.props.children).includes('Revisar y guardar'));
    assert.equal(save.props.disabled,false);
    save.props.onClick();
    assert.equal(ui.getSave(),1);
  });
});
