'use client';

import { ArrowUpRight, Database, FileSpreadsheet, Info, LoaderCircle } from 'lucide-react';
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
      aria-label={`${title}. ${badge}. ${description}`}
      className={cn(
        'group flex w-full min-w-0 cursor-pointer items-start gap-3.5 rounded-[15px] border px-3.5 py-4 text-left outline-none transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[#188650]/25 active:scale-[.995] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 sm:px-4',
        featured
          ? 'border-[#c9e4d6] bg-[#f6fbf8] hover:border-[#96c7ab] hover:bg-[#f1f8f4] hover:shadow-[0_5px_16px_rgba(17,76,44,.065)]'
          : 'border-neutral-200/90 bg-white hover:border-neutral-300 hover:bg-[#fafafb] hover:shadow-[0_5px_16px_rgba(15,23,42,.035)]',
      )}
    >
      <span className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-[11px] transition-colors duration-200 sm:h-11 sm:w-11',
        featured ? 'bg-[#e0f1e7] text-[#188650] group-hover:bg-[#d5ebdf]' : 'bg-[#f2f3f5] text-neutral-600 group-hover:bg-[#e9ebee]',
      )}>
        {isLoading ? <LoaderCircle size={19} className="animate-spin" /> : <Icon size={19} />}
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="text-[13px] font-semibold leading-5 tracking-[-.015em] text-neutral-900 sm:text-[14px]">{title}</span>
          <span className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.055em]',
            featured ? 'bg-[#e2f1e8] text-[#397c55]' : 'bg-[#f2f3f5] text-neutral-500',
          )}>
            {badge}
          </span>
        </span>
        <span className="mt-1.5 block text-[11px] leading-[1.7] text-neutral-500 sm:text-[12px]">{description}</span>
      </span>
      <ArrowUpRight size={16} className={cn(
        'mt-3 shrink-0 text-neutral-300 transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
        featured ? 'group-hover:text-[#188650]' : 'group-hover:text-neutral-600',
      )} />
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
    <Modal
      open={open}
      onClose={onClose}
      title="Exportar a Excel"
      size="md"
      theme="light"
      className="!bg-[#111318]/55 !backdrop-blur-[5px]"
      panelClassName="!rounded-[21px] !border-neutral-200/75 !bg-white !shadow-[0_22px_70px_rgba(12,17,26,.18)]"
      headerClassName="!items-center !border-neutral-100 !px-5 !py-[17px] sm:!px-6 sm:!py-5"
      titleClassName="!text-[19px] !font-semibold !leading-snug !tracking-[-.035em] !text-neutral-950 sm:!text-[21px]"
      closeButtonClassName="!rounded-[10px] !p-1.5 !text-neutral-400 hover:!bg-neutral-100 hover:!text-neutral-800"
      bodyClassName="!px-4 !pb-5 !pt-4 sm:!px-6 sm:!pb-6 sm:!pt-5"
    >
      <div className="min-w-0 space-y-3">
        <div className="mb-4 flex items-start gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#e7f4ec] text-[#188650]">
            <FileSpreadsheet size={17} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-neutral-800">Elegí el tipo de archivo</p>
            <p className="mt-0.5 text-[11px] leading-5 text-neutral-500">Seleccioná el formato según cómo vayas a trabajar los datos.</p>
          </div>
        </div>
        <ExportOption
          mode="analytical"
          icon={FileSpreadsheet}
          title="Reporte analítico"
          badge="Filtros actuales"
          description="Resumen de ventas, pedidos, productos y consolidaciones. Listo para presentar y analizar."
          disabled={isExporting || !hasFilteredData}
          isLoading={exportingMode === 'analytical'}
          onSelect={onExport}
        />
        <ExportOption
          mode="raw"
          icon={Database}
          title="Base cruda completa"
          badge="Histórico completo"
          description="Una fila por producto vendido, con pedido, cliente, entrega y pago. Ideal para tablas dinámicas."
          disabled={isExporting}
          isLoading={exportingMode === 'raw'}
          featured
          onSelect={onExport}
        />
        <div className="flex items-start gap-2.5 pt-2 text-[10.5px] leading-[1.65] text-neutral-500">
          <Info size={15} className="mt-0.5 shrink-0 text-neutral-400" />
          <p>La base cruda excluye perfiles, auditoría y configuraciones internas que no aportan al análisis comercial.</p>
        </div>
      </div>
    </Modal>
  );
}
