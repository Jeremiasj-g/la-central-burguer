import { PublicFooter } from './PublicFooter';
import { PublicHeader } from './PublicHeader';
import { PublicMaintenanceBoundary } from './PublicMaintenanceBoundary';

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <PublicMaintenanceBoundary>
      {process.env.NEXT_PUBLIC_APP_ENV === 'development' ? (
        <div role="status" className="relative z-50 bg-[#9a5616] px-4 py-2 text-center text-[12px] font-medium text-white">
          <strong className="font-semibold">ENTORNO DE PRUEBAS</strong> · Los pedidos no se envían al local ni abren WhatsApp.
        </div>
      ) : null}
      <PublicHeader />
      {children}
      <PublicFooter />
    </PublicMaintenanceBoundary>
  );
}
