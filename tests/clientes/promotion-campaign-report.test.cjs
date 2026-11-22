/* eslint-disable @typescript-eslint/no-require-imports -- Node tests use CommonJS. */
'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadSource } = require('../personal/helpers/load-source.cjs');
const { findCampaignsWithoutSales, summarizePromotionSales } = loadSource('src/features/reportes/utils/report-promotions.utils.ts');

const burger = { id:'burger', title:'25% Off en hamburguesas', starts_on:'2026-10-30', ends_on:'2026-11-01', enabled:true, discount_percent:25 };
const potatoes = { id:'papas', title:'Papas gratinadas', starts_on:'2026-11-06', ends_on:'2026-11-15', enabled:false, discount_percent:40 };
const outside = { id:'old', title:'Promo anterior', starts_on:'2026-09-01', ends_on:'2026-09-05', enabled:false, discount_percent:10 };
const filters = { from:'2026-11-01', to:'2026-11-22', allTime:false };
const empty = { orders:[], items:[], settledDeliveryCommissions:[] };
const sold = {
  orders:[{ id:'order-1', status:'aceptado', subtotal:9000 }],
  items:[{ orderId:'order-1', discountCampaignId:'burger', discountCampaignTitle:burger.title, isPromotion:true, quantity:2, unitPrice:4500, total:9000, originalUnitPrice:6000, discountPercent:25, productId:'p1',productName:'Burger',categoryName:'Hamburguesas' }],
  settledDeliveryCommissions:[],
};

describe('Reportes / campañas y ofertas históricas',()=>{
 test('una campaña vigente en el período sin pedidos aparece como cero ventas, aun deshabilitada',()=>{
   const result = findCampaignsWithoutSales([burger,potatoes,outside],sold,filters);
   assert.deepEqual(result.map(c=>c.title),['Papas gratinadas']);
 });
 test('filtro de fechas impide presentar campañas de otros períodos como faltantes',()=>{
   const result=findCampaignsWithoutSales([burger,potatoes,outside],empty,{from:'2026-10-01',to:'2026-10-31',allTime:false});
   assert.deepEqual(result.map(c=>c.id),['burger']);
 });
 test('una campaña sin ventas puede aparecer al elegir todo el historial',()=>{
   const result=findCampaignsWithoutSales([burger,potatoes,outside],sold,{...filters,allTime:true});
   assert.deepEqual(result.map(c=>c.id),['papas','old']);
 });
 test('ventas canceladas no cuentan como una campaña vendida',()=>{
   const canceled={...sold,orders:[{...sold.orders[0],status:'cancelado'}]};
   assert.deepEqual(findCampaignsWithoutSales([burger,potatoes],canceled,filters).map(c=>c.id),['papas','burger']);
 });
 test('el resumen de ventas mantiene sus importes reales y no incorpora campañas sin pedidos',()=>{
   assert.equal(summarizePromotionSales(sold,'campaign').revenue,9000);
   assert.equal(summarizePromotionSales(sold,'campaign').units,2);
   assert.equal(summarizePromotionSales(empty,'campaign').revenue,0);
 });
 test('el UI expone las campañas sin venta usando el mismo período aplicado',()=>{
   const report=fs.readFileSync('src/features/reportes/components/PromotionReport.tsx','utf8');
   const tables=fs.readFileSync('src/features/reportes/components/ReportTables.tsx','utf8');
   const page=fs.readFileSync('src/features/reportes/pages/ReportesAdminPage.tsx','utf8');
   assert.match(report,/findCampaignsWithoutSales\(campaigns, dataset, filters\)/);
   assert.match(report,/Campañas sin ventas con estos filtros/);
   assert.match(report,/0 ventas vinculadas/);
   assert.match(tables,/<PromotionReport dataset=\{dataset\} filters=\{filters\}/);
   assert.match(page,/filters=\{appliedFilters\}/);
 });
});
