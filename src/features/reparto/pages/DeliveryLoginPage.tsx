'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bike, LockKeyhole, Mail } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/shared/components/ui/Button';
import { PasswordInput } from '@/shared/components/ui/PasswordInput';
import { ROUTES } from '@/shared/constants/routes';
import { loginDeliveryDriver } from '../services/delivery-driver.service';

export function DeliveryLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await loginDeliveryDriver(email.trim(), password);
      router.replace(ROUTES.deliveryPanel);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#111111] px-4 py-12 text-[#f6f4f0] sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,178,26,.12),transparent_55%),linear-gradient(180deg,#161616_0%,#111111_75%)]" />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-9 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-3 text-[13px] font-semibold tracking-[-.02em] text-white transition-colors duration-200 hover:text-[#ffb21a]">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] border border-[#ffb21a]/30 bg-[#ffb21a]/10 text-[#ffb21a]">
              <Bike size={20} strokeWidth={1.8} />
            </span>
            La Central Burger
          </Link>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/55">Repartidores</span>
        </div>

        <h1 className="text-[30px] font-semibold leading-tight tracking-[-.045em] text-white sm:text-[34px]">Iniciar sesión</h1>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="delivery-login-email" className="mb-2 flex items-center gap-2 text-[12px] font-medium text-white/70">
              <Mail size={14} strokeWidth={1.8} /> Correo electrónico
            </label>
            <input id="delivery-login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="correo@ejemplo.com" className="h-12 w-full rounded-[12px] border border-white/10 bg-white/[.055] px-4 text-[13px] font-normal text-white outline-none placeholder:text-white/35 transition-all duration-200 focus:border-[#ffb21a]/60 focus:ring-2 focus:ring-[#ffb21a]/15" />
          </div>
          <div>
            <label htmlFor="delivery-login-password" className="mb-2 flex items-center gap-2 text-[12px] font-medium text-white/70">
              <LockKeyhole size={14} strokeWidth={1.8} /> Contraseña
            </label>
            <PasswordInput id="delivery-login-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Ingresá tu contraseña" className="!h-12 !rounded-[12px] !border-white/10 !bg-white/[.055] !px-4 !pr-12 !text-[13px] !font-normal !text-white focus:!border-[#ffb21a]/60 focus:!ring-2 focus:!ring-[#ffb21a]/15" />
          </div>
          <Button type="submit" className="!mt-7 !h-12 w-full !rounded-[12px] !bg-[#ffb21a] !text-[13px] !font-semibold !text-[#17130e] !shadow-none transition-colors duration-200 hover:!bg-[#ffc44c]" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar a mis entregas'} {!loading && <ArrowRight size={16} strokeWidth={1.8} />}
          </Button>
        </form>
        <div className="mt-8 border-t border-white/10 pt-5 text-center">
          <Link href="/" className="text-[12px] font-medium text-white/50 transition-colors duration-200 hover:text-[#ffb21a]">Volver al inicio</Link>
        </div>
      </div>
    </main>
  );
}
