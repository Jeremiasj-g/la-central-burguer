import { cn } from '@/shared/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  tone?: 'orange' | 'green' | 'red' | 'blue' | 'neutral' | 'dark';
  className?: string;
}

const tones = {
  orange: 'bg-central-orange/10 text-central-orange ring-central-orange/15',
  green: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/15',
  red: 'bg-red-500/10 text-red-700 ring-red-500/15',
  blue: 'bg-sky-500/10 text-sky-700 ring-sky-500/15',
  neutral: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  dark: 'bg-central-carbon text-white ring-white/10',
};

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1', tones[tone], className)}>{children}</span>;
}
