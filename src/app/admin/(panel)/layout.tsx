import { AdminShell } from '@/shared/components/layout/AdminShell';
import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/features/auth/services/auth.server';
import { ROUTES } from '@/shared/constants/routes';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect(ROUTES.adminLogin);

  return <AdminShell>{children}</AdminShell>;
}
