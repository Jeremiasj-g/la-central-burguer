'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowDownUp, ArrowUp } from 'lucide-react';
import { TablePagination } from '@/shared/components/ui/TablePagination';

export interface StaffColumn<T> {
  id: string;
  title: ReactNode;
  value?: (row: T) => string | number | null;
  render: (row: T) => ReactNode;
  numeric?: boolean;
}

export function StaffTable<T>({
  rows, columns, getId, initialSort, emptyMessage = 'No hay registros para mostrar.', minWidthClassName = 'min-w-[740px]',
}: {
  rows: T[];
  columns: StaffColumn<T>[];
  getId: (row: T) => string;
  initialSort?: string;
  emptyMessage?: string;
  minWidthClassName?: string;
}) {
  const [sortBy, setSortBy] = useState(initialSort ?? columns.find((column) => column.value)?.id ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const sorted = useMemo(() => {
    const sortColumn = columns.find((column) => column.id === sortBy);
    if (!sortColumn?.value) return rows;
    return [...rows].sort((a, b) => {
      const left = sortColumn.value?.(a) ?? null;
      const right = sortColumn.value?.(b) ?? null;
      if (left === null) return right === null ? getId(a).localeCompare(getId(b)) : 1;
      if (right === null) return -1;
      const comparison = typeof left === 'number' && typeof right === 'number'
        ? left - right : String(left).localeCompare(String(right), 'es', { sensitivity: 'base', numeric: true });
      return (sortDir === 'asc' ? comparison : -comparison) || getId(a).localeCompare(getId(b));
    });
  }, [rows, columns, sortBy, sortDir, getId]);

  const safePage = Math.min(page, Math.max(1, Math.ceil(sorted.length / pageSize)));
  const visible = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className="min-w-0 overflow-hidden rounded-[15px] border border-neutral-200/80 bg-white">
      <div className="w-full overflow-x-auto">
        <table className={"w-full border-collapse text-left text-[12px] text-neutral-700 " + minWidthClassName}>
          <thead className="bg-[#f8f8f9] text-[11px] font-medium text-neutral-500">
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col"
                  aria-sort={column.value ? sortBy === column.id ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none' : undefined}
                  className={'border-b border-neutral-200/75 px-4 py-3 font-medium ' + (column.numeric ? 'text-right' : 'text-left')}>
                  {column.value ? (
                    <button type="button" onClick={() => {
                      if (sortBy === column.id) setSortDir((current) => current === 'asc' ? 'desc' : 'asc');
                      else { setSortBy(column.id); setSortDir('asc'); }
                      setPage(1);
                    }} className="inline-flex items-center gap-1.5 rounded text-inherit transition-colors duration-200 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-central-orange">
                      {column.title}
                      {sortBy === column.id ? sortDir === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/> : <ArrowDownUp size={13} className="text-neutral-400"/>}
                    </button>
                  ) : column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={getId(row)} className="transition-colors duration-200 hover:bg-neutral-50">
                {columns.map((column) => (
                  <td key={column.id} className={'border-b border-neutral-100 px-4 py-3 align-middle ' + (column.numeric ? 'text-right tabular-nums' : '')}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-[13px] text-neutral-500">{emptyMessage}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={safePage} pageSize={pageSize} totalItems={sorted.length} onPageChange={setPage}/>
    </section>
  );
}
