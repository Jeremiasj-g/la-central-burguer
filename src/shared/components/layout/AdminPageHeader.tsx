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
    <div className={cn('mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div>
        {eyebrow ? <p className="text-xs font-black uppercase tracking-[.25em] text-central-orange">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-black tracking-tight text-central-carbon sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-neutral-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
