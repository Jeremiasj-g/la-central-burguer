'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SaleFilters, SaleLedgerEntry } from '../types/venta.types';
import { getSales } from '../services/ventas.service';
import { subscribeToOrders } from '@/features/pedidos/services/pedidos.service';
export function useSales(filters: SaleFilters) { const [sales,setSales]=useState<SaleLedgerEntry[]>([]); const [isLoading,setIsLoading]=useState(true); const [error,setError]=useState<string|null>(null); const key=useMemo(()=>JSON.stringify(filters),[filters]); const load=useCallback(async()=>{ try{setIsLoading(true);setError(null);setSales(await getSales(JSON.parse(key) as SaleFilters));}catch(err){setError(err instanceof Error?err.message:'Error al cargar ventas');}finally{setIsLoading(false);}},[key]); useEffect(()=>{load();return subscribeToOrders(load);},[load]); return {sales,isLoading,error,refresh:load}; }
