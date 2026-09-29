'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = totalItems === 0 ? 0 : Math.min(safePage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-neutral-100 bg-neutral-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs font-medium text-neutral-500">
        {totalItems === 0 ? '0 registros' : `Mostrando ${from}–${to} de ${totalItems}`}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex h-8 items-center gap-1 rounded-sm border border-neutral-200 bg-white px-2.5 text-xs font-bold text-neutral-600 transition hover:border-central-orange hover:text-central-orange disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft size={14} /> Anterior
        </button>

        <span className="min-w-20 text-center text-xs font-bold text-neutral-600">
          {safePage} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="inline-flex h-8 items-center gap-1 rounded-sm border border-neutral-200 bg-white px-2.5 text-xs font-bold text-neutral-600 transition hover:border-central-orange hover:text-central-orange disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página siguiente"
        >
          Siguiente <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
