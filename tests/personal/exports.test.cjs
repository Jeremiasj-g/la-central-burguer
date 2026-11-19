/* eslint-disable @typescript-eslint/no-require-imports -- Node tests and CLI scripts intentionally use CommonJS. */
'use strict';
const {test,describe}=require('node:test');
const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const {payment}=require('./helpers/fixtures.cjs');

let captured;
const excel=loadSource('src/features/personal/utils/staff-ledger-export.utils.ts',{
  '@/features/reportes/utils/xlsx-export.utils':{
    exportSimpleTableToExcel:args=>{captured=args;},
  },
});
describe('Exportación / movimientos de personal',()=>{
  const entries=[
    payment('m1',{payment_kind:'advance',payroll_id:null,amount:15000,notes:'Anticipo de noviembre'}),
    payment('m2',{payment_kind:'payroll',amount:4500.25,reversed_at:'2026-11-19',reversal_reason:'Duplicado'}),
  ];
  test('descarga datos mediante el exportador XLSX compartido y no renombra CSV',()=>{
    excel.exportStaffMovementsExcel(entries,()=> 'Empleado de prueba','movimientos.xlsx');
    assert.equal(captured.filename,'movimientos.xlsx');
    assert.equal(captured.sheetName,'Movimientos personal');
    assert.equal(captured.columns.find(col=>col.key==='importe').kind,'currency');
  });
  test('importes numéricos, tipos de movimiento y estado de reversión se conservan',()=>{
    excel.exportStaffMovementsExcel(entries,()=> 'Gabriel','movimientos.xlsx');
    assert.deepEqual(captured.rows.map(row=>row.importe),[15000,4500.25]);
    assert.deepEqual(captured.rows.map(row=>row.tipo),['Anticipo','Pago de liquidación']);
    assert.deepEqual(captured.rows.map(row=>row.estado),['Registrado','Revertido']);
    assert.equal(captured.rows[1].reversion,'Duplicado');
  });
  test('no incorpora movimientos ajenos al filtro aplicado',()=>{
    excel.exportStaffMovementsExcel([entries[0]],()=> 'Gabriel','filtrados.xlsx');
    assert.equal(captured.rows.length,1);
    assert.equal(captured.rows[0].id,'m1');
  });
  test('mantiene observaciones e IDs históricos',()=>{
    excel.exportStaffMovementsExcel(entries,()=> 'Gabriel','movimientos.xlsx');
    assert.equal(captured.rows[0].observaciones,'Anticipo de noviembre');
    assert.equal(captured.rows[1].liquidacion,'p1');
  });
});

const reportMocks={
  './report-promotions.utils':{summarizePromotionSales:()=>({})},
  './product-margin.utils':{analyzeProductMargins:()=>({}),buildProductMarginExportRows:()=>[]},
  './reportes.utils':{
    formatCurrency:n=>String(n),formatReportDate:s=>s,formatReportDateTime:s=>s,
    getReportSummary:()=>({}),groupReport:()=>[],REPORT_GROUP_LABELS:{},
  },
};

describe('Exportación / integridad de archivo Excel',()=>{
  test('crea ZIP XLSX con workbook y una hoja XML real',async()=>{
    const {exportSimpleTableToExcel}=loadSource('src/features/reportes/utils/xlsx-export.utils.ts',reportMocks);
    let blob;
    const oldDocument=global.document,oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
    let download;
    global.document={
      body:{appendChild:()=>{}},
      createElement:()=>({click(){download=this.download;},remove(){}}),
    };
    URL.createObjectURL=value=>{blob=value;return 'blob:test';};
    URL.revokeObjectURL=()=>{};
    try {
      exportSimpleTableToExcel({
        filename:'movimientos.xlsx',sheetName:'Movimientos personal',
        columns:[{key:'nombre',header:'Empleado',width:24},{key:'importe',header:'Importe',width:15,kind:'currency'}],
        rows:[{nombre:'Gabriel',importe:12345.67}],
      });
      const bytes=Buffer.from(await blob.arrayBuffer());
      assert.equal(bytes.toString('ascii',0,2),'PK');
      assert.ok(bytes.includes(Buffer.from('xl/workbook.xml')));
      assert.ok(bytes.includes(Buffer.from('xl/worksheets/sheet1.xml')));
      assert.ok(bytes.includes(Buffer.from('Gabriel')));
      assert.ok(bytes.includes(Buffer.from('12345.67')));
      assert.equal(download,'movimientos.xlsx');
    } finally {
      global.document=oldDocument;
      URL.createObjectURL=oldCreate;
      URL.revokeObjectURL=oldRevoke;
    }
  });
});
