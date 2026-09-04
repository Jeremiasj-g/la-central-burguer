import type {
  ReportDataset,
  ReportFilters,
  ReportGroupBy,
  ReportGroupRow,
} from '../types/reporte.types';
import {
  formatCurrency,
  formatReportDate,
  formatReportDateTime,
  getReportSummary,
  groupReport,
  REPORT_GROUP_LABELS,
} from './reportes.utils';

type CellKind = 'text' | 'number' | 'currency' | 'percent';
type CellValue = string | number | null | undefined;

interface ExportColumn {
  header: string;
  key: string;
  width: number;
  kind?: CellKind;
}

interface ExportSheet {
  name: string;
  title: string;
  subtitle: string;
  columns: ExportColumn[];
  rows: Record<string, CellValue>[];
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const encoder = new TextEncoder();
let crcTable: Uint32Array | null = null;

function xmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(data: Uint8Array) {
  const table = crcTable ?? (crcTable = buildCrcTable());
  let crc = 0xffffffff;
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function dosTimestamp(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { time, date: dosDate };
}

function createStoredZip(entries: ZipEntry[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const stamp = dosTimestamp();
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const localHeader = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(stamp.time), u16(stamp.date),
      u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), name,
    ]);
    localParts.push(localHeader, entry.data);

    const centralHeader = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(stamp.time), u16(stamp.date),
      u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(localOffset), name,
    ]);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + entry.data.length;
  }

  const locals = concat(localParts);
  const central = concat(centralParts);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(locals.length), u16(0),
  ]);

  return concat([locals, central, end]);
}

function columnName(index: number) {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function cellStyle(kind: CellKind | undefined) {
  if (kind === 'currency') return 3;
  if (kind === 'percent') return 4;
  if (kind === 'number') return 5;
  return 6;
}

function cellXml(reference: string, value: CellValue, style: number) {
  if (value === null || value === undefined || value === '') return `<c r="${reference}" s="${style}"/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`;
}

function sheetXml(sheet: ExportSheet) {
  const lastColumn = columnName(sheet.columns.length - 1);
  const lastRow = sheet.rows.length + 4;
  const columnWidths = sheet.columns
    .map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`)
    .join('');
  const headerCells = sheet.columns
    .map((column, index) => cellXml(`${columnName(index)}4`, column.header, 2))
    .join('');
  const dataRows = sheet.rows.map((row, rowIndex) => {
    const excelRow = rowIndex + 5;
    const cells = sheet.columns.map((column, columnIndex) =>
      cellXml(`${columnName(columnIndex)}${excelRow}`, row[column.key], cellStyle(column.kind)),
    ).join('');
    return `<row r="${excelRow}">${cells}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${Math.max(lastRow, 4)}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columnWidths}</cols>
  <sheetData>
    <row r="1" ht="28" customHeight="1">${cellXml('A1', sheet.title, 1)}</row>
    <row r="2" ht="20" customHeight="1">${cellXml('A2', sheet.subtitle, 6)}</row>
    <row r="3"/>
    <row r="4" ht="24" customHeight="1">${headerCells}</row>
    ${dataRows}
  </sheetData>
  <autoFilter ref="A4:${lastColumn}${Math.max(lastRow, 4)}"/>
  <mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells>
</worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="$ #,##0"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF11100F"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD88918"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFE5E1DB"/></left><right style="thin"><color rgb="FFE5E1DB"/></right><top style="thin"><color rgb="FFE5E1DB"/></top><bottom style="thin"><color rgb="FFE5E1DB"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function workbookXml(sheets: ExportSheet[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets>
</workbook>`;
}

function workbookRelsXml(sheetCount: number) {
  const sheetRels = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypesXml(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets}
</Types>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

function groupRows(rows: ReportGroupRow[]) {
  return rows.map((row) => ({
    grupo: row.label,
    pedidos: row.orders,
    cancelados: row.cancelledOrders,
    unidades: row.units,
    facturacion: row.revenue,
    ticket: row.averageTicket,
    participacion: row.share,
  }));
}

function groupColumns(firstHeader = 'Grupo'): ExportColumn[] {
  return [
    { header: firstHeader, key: 'grupo', width: 30 },
    { header: 'Pedidos', key: 'pedidos', width: 12, kind: 'number' },
    { header: 'Cancelados', key: 'cancelados', width: 12, kind: 'number' },
    { header: 'Unidades', key: 'unidades', width: 12, kind: 'number' },
    { header: 'Facturación', key: 'facturacion', width: 16, kind: 'currency' },
    { header: 'Ticket medio', key: 'ticket', width: 16, kind: 'currency' },
    { header: 'Participación', key: 'participacion', width: 14, kind: 'percent' },
  ];
}

function buildSheets(
  dataset: ReportDataset,
  filters: ReportFilters,
  groupBy: ReportGroupBy,
  businessName: string,
): ExportSheet[] {
  const summary = getReportSummary(dataset);
  const subtitle = `Período: ${formatReportDate(`${filters.from}T12:00:00`)} al ${formatReportDate(`${filters.to}T12:00:00`)} · Generado: ${formatReportDateTime(new Date().toISOString())}`;
  const validOrderIds = new Set(dataset.orders.filter((order) => order.status !== 'cancelado').map((order) => order.id));
  const orderMap = new Map(dataset.orders.map((order) => [order.id, order]));

  const summaryRows: Record<string, CellValue>[] = [
    { indicador: 'Facturación neta', valor: formatCurrency(summary.netRevenue) },
    { indicador: 'Pedidos válidos', valor: summary.validOrders },
    { indicador: 'Pedidos cancelados', valor: summary.cancelledOrders },
    { indicador: 'Ticket promedio', valor: formatCurrency(summary.averageTicket) },
    { indicador: 'Unidades vendidas', valor: summary.unitsSold },
    { indicador: 'Delivery cobrado', valor: formatCurrency(summary.deliveryRevenue) },
    { indicador: 'Tasa de cancelación', valor: `${(summary.cancellationRate * 100).toFixed(1)}%` },
  ];

  const orderRows = dataset.orders.map((order) => ({
    fecha: formatReportDateTime(order.createdAt),
    pedido: order.orderCode,
    cliente: order.customerName,
    telefono: order.customerPhone,
    entrega: order.deliveryMethod === 'delivery' ? 'Delivery' : 'Retiro local',
    pago: order.paymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo',
    estado: order.status,
    subtotal: order.subtotal,
    delivery: order.deliveryCost,
    total: order.total,
  }));

  const itemRows = dataset.items.map((item) => {
    const order = orderMap.get(item.orderId);
    return {
      fecha: order ? formatReportDateTime(order.createdAt) : '',
      pedido: order?.orderCode ?? '',
      estado: order?.status ?? '',
      cliente: order?.customerName ?? '',
      producto: item.productName,
      categoria: item.categoryName ?? 'Sin categoría',
      cantidad: item.quantity,
      unitario: item.unitPrice,
      total: item.total,
      promo: item.isPromotion ? 'Sí' : 'No',
      valida: validOrderIds.has(item.orderId) ? 'Sí' : 'No',
    };
  });

  return [
    {
      name: 'Resumen',
      title: `${businessName} · Reporte de ventas`,
      subtitle,
      columns: [
        { header: 'Indicador', key: 'indicador', width: 28 },
        { header: 'Valor', key: 'valor', width: 22 },
      ],
      rows: summaryRows,
    },
    {
      name: 'Pedidos',
      title: 'Detalle de pedidos',
      subtitle,
      columns: [
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Pedido', key: 'pedido', width: 20 },
        { header: 'Cliente', key: 'cliente', width: 26 },
        { header: 'Teléfono', key: 'telefono', width: 18 },
        { header: 'Entrega', key: 'entrega', width: 16 },
        { header: 'Pago', key: 'pago', width: 16 },
        { header: 'Estado', key: 'estado', width: 14 },
        { header: 'Subtotal', key: 'subtotal', width: 15, kind: 'currency' },
        { header: 'Delivery', key: 'delivery', width: 15, kind: 'currency' },
        { header: 'Total', key: 'total', width: 15, kind: 'currency' },
      ],
      rows: orderRows,
    },
    {
      name: 'Detalle productos',
      title: 'Detalle de productos vendidos',
      subtitle,
      columns: [
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Pedido', key: 'pedido', width: 20 },
        { header: 'Estado', key: 'estado', width: 14 },
        { header: 'Cliente', key: 'cliente', width: 26 },
        { header: 'Producto', key: 'producto', width: 32 },
        { header: 'Categoría', key: 'categoria', width: 24 },
        { header: 'Cantidad', key: 'cantidad', width: 12, kind: 'number' },
        { header: 'Precio unit.', key: 'unitario', width: 15, kind: 'currency' },
        { header: 'Total', key: 'total', width: 15, kind: 'currency' },
        { header: 'Promoción', key: 'promo', width: 12 },
        { header: 'Venta válida', key: 'valida', width: 12 },
      ],
      rows: itemRows,
    },
    {
      name: 'Consolidado',
      title: `Consolidado por ${REPORT_GROUP_LABELS[groupBy].toLocaleLowerCase('es-AR')}`,
      subtitle,
      columns: groupColumns(REPORT_GROUP_LABELS[groupBy]),
      rows: groupRows(groupReport(dataset, groupBy)),
    },
    {
      name: 'Productos',
      title: 'Consolidado por producto',
      subtitle,
      columns: groupColumns('Producto'),
      rows: groupRows(groupReport(dataset, 'product')),
    },
    {
      name: 'Categorías',
      title: 'Consolidado por categoría',
      subtitle,
      columns: groupColumns('Categoría'),
      rows: groupRows(groupReport(dataset, 'category')),
    },
    {
      name: 'Medios de pago',
      title: 'Consolidado por método de pago',
      subtitle,
      columns: groupColumns('Método de pago'),
      rows: groupRows(groupReport(dataset, 'payment')),
    },
    {
      name: 'Entregas',
      title: 'Consolidado por tipo de entrega',
      subtitle,
      columns: groupColumns('Tipo de entrega'),
      rows: groupRows(groupReport(dataset, 'delivery')),
    },
  ];
}

function slugifyFile(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function exportReportToExcel(params: {
  dataset: ReportDataset;
  filters: ReportFilters;
  groupBy: ReportGroupBy;
  businessName: string;
}) {
  const sheets = buildSheets(params.dataset, params.filters, params.groupBy, params.businessName);
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml(sheets.length)) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml(sheets)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml(sheets.length)) },
    { name: 'xl/styles.xml', data: encoder.encode(stylesXml()) },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encoder.encode(sheetXml(sheet)),
    })),
  ];

  const bytes = createStoredZip(entries);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugifyFile(params.businessName) || 'reporte'}-${params.filters.from}-a-${params.filters.to}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
