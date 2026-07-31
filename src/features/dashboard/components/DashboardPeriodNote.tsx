interface DashboardPeriodNoteProps {
  children: string;
}

export function DashboardPeriodNote({ children }: DashboardPeriodNoteProps) {
  return (
    <p className="mt-4 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-500">
      {children}
    </p>
  );
}
