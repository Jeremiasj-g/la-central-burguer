'use client';

import { ArrowRight, Database, FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { Modal } from '@/shared/components/ui/Modal';
import { cn } from '@/shared/utils/cn';

export type ReportExportMode = 'analytical' | 'raw';

interface ReportExportDialogProps {
  open: boolean;
  hasFilteredData: boolean;
  exportingMode: ReportExportMode | null;
  onClose: () => void;
  onExport: (mode: ReportExportMode) => void;
}

function ExportOption({
  mode,
  icon: Icon,
  title,
  badge,
  description,
  disabled,
  isLoading,
  featured = false,
  onSelect,
}: {
  mode: ReportExportMode;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  badge: string;
  description: string;
  disabled: boolean;
  isLoading: boolean;
  featured?: boolean;
  onSelect: (mode: ReportExportMode) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(mode)}
      className={cn(
        'group flex w-full cursor-pointer items-start gap-4 rounded-sm border p-4 text-left outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-central-orange/30 disabled:cursor-not-allowed disabled:opacity-45',
        featured
          ? 'border-central-orange/35 bg-central-orange/[.055] hover:border-central-orange/70 hover:bg-central-orange/[.085]'
          : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50',
      )}
    >
      <span className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-sm',
        featured ? 'bg-central-orange text-white shadow-orange' : 'bg-neutral-100 text-neutral-600',
      )}>
        {isLoading ? <LoaderCircle size={20} className="animate-spin" /> : <Icon size={20} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-extrabold text-central-carbon">{title}</span>
          <span className={cn(
            'rounded-sm px-2 py-0.5 text-[10px] font-black uppercase tracking-[.12em]',
            featured ? 'bg-central-orange/12 text-central-ember' : 'bg-neutral-100 text-neutral-500',
          )}>
            {badge}
          </span>
        </span>
        <span className="mt-1.5 block text-xs leading-5 text-neutral-500">{description}</span>
      </span>
      <ArrowRight size={17} className="mt-3 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-central-orange" />
    </button>
  );
}

export function ReportExportDialog({
  open,
  hasFilteredData,
  exportingMode,
  onClose,
  onExport,
}: ReportExportDialogProps) {
  const isExporting = exportingMode !== null;

  return (
    <Modal open={open} onClose={onClose} title="Exportar a Excel" size="md">
      <div className="space-y-3">
        <p className="pb-1 text-sm leading-6 text-neutral-600">
          Elegí el archivo según el uso que le vas a dar.
        </p>
        <ExportOption
          mode="analytical"
          icon={FileSpreadsheet}
          title="Reporte analítico"
          badge="Filtros actuales"
          description="Incluye resumen, pedidos, productos y consolidaciones listos para presentar."
          disabled={isExporting || !hasFilteredData}
          isLoading={exportingMode === 'analytical'}
          onSelect={onExport}
        />
        <ExportOption
          mode="raw"
          icon={Database}
          title="Base cruda completa"
          badge="Histórico completo"
          description="Una fila por producto vendido, con datos de pedido, cliente, entrega, pago y producto. Ideal para filtros y tablas dinámicas."
          disabled={isExporting}
          isLoading={exportingMode === 'raw'}
          featured
          onSelect={onExport}
        />
        <p className="rounded-sm border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[11px] leading-5 text-neutral-500">
          La base cruda excluye información interna que no aporta al análisis comercial, como perfiles, auditoría y configuración del sistema.
        </p>
      </div>
    </Modal>
  );
}
