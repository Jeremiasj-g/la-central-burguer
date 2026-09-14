import { cn } from '@/shared/utils/cn';

interface AdminPageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function AdminPageHeader({ eyebrow, title, description, actions, className }: AdminPageHeaderProps) {
  return (
    <div className={cn('mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">{eyebrow}</p>
        ) : null}
        <h1 className={cn('text-[34px] font-semibold leading-[1.08] tracking-[-0.045em] text-[#1C1C1E] sm:text-[40px]', eyebrow && 'mt-1.5')}>
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 max-w-3xl text-[14px] leading-5 text-[#8E8E93] sm:text-[15px]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
