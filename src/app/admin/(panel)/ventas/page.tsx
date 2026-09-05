import { permanentRedirect } from 'next/navigation';
import { ROUTES } from '@/shared/constants/routes';

export default function Page() {
  permanentRedirect(ROUTES.adminReportes);
}
