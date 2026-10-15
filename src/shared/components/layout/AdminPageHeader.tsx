import { cn } from '@/shared/utils/cn';

interface AdminPageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        'admin-page-header mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="admin-page-eyebrow text-[11px] font-semibold uppercase tracking-[.16em] text-[#0071e3]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="admin-page-title mt-1.5 text-[32px] font-semibold leading-[1.04] tracking-[-.045em] text-[#1d1d1f] sm:text-[40px]">
          {title}
        </h1>
        {description ? (
          <p className="admin-page-description mt-2.5 max-w-3xl text-[14px] leading-6 text-[#6e6e73] sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="admin-page-actions flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
