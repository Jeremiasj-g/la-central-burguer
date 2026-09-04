'use client';

import { useCallback, useEffect, useState } from 'react';
import { getReportData } from '../services/reportes.service';
import type { ReportDataset, ReportFilters } from '../types/reporte.types';

const EMPTY_DATASET: ReportDataset = { orders: [], items: [] };

export function useReportes(filters: ReportFilters) {
  const [data, setData] = useState<ReportDataset>(EMPTY_DATASET);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    getReportData(filters)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setData(EMPTY_DATASET);
        setError(caught instanceof Error ? caught.message : 'No se pudo generar el reporte.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, revision]);

  return { data, isLoading, error, refresh };
}
