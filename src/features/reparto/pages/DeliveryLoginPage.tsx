'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/shared/components/ui/Button';
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
    <main className="min-h-screen bg-central-carbon px-4 py-8 text-white sm:grid sm:place-items-center">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-central-orange text-white shadow-orange"><Bike size={30} /></span>
          <p className="mt-5 text-xs font-black uppercase tracking-[.28em] text-central-orange">La Central Burger</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Panel de repartidor</h1>
          <p className="mt-2 text-sm leading-6 text-white/55">Tus pedidos asignados, navegación, cobros y ganancias en un solo lugar.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[.05] p-5 shadow-2xl backdrop-blur sm:p-6">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/55"><Mail size={14} /> Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-base text-white outline-none transition focus:border-central-orange focus:ring-2 focus:ring-central-orange/20" />
          </label>
          <label className="mt-4 block">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/55"><LockKeyhole size={14} /> Contraseña</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-base text-white outline-none transition focus:border-central-orange focus:ring-2 focus:ring-central-orange/20" />
          </label>
          <Button type="submit" className="mt-6 h-12 w-full rounded-xl" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar a mis entregas'}</Button>
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-white/[.04] p-3 text-xs leading-5 text-white/50"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-central-orange" /> El acceso está limitado a cuentas de repartidor habilitadas por administración.</div>
        </form>
      </div>
    </main>
  );
}
