'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShoppingBag } from 'lucide-react';
import { loginAdmin } from '../services/auth.service';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { PasswordInput } from '@/shared/components/ui/PasswordInput';

export function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await loginAdmin(email, password);
      router.replace(ROUTES.adminDashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-scope relative grid min-h-screen place-items-center overflow-hidden bg-[#F2F2F7] px-4 py-10 text-[#1C1C1E]">
      <div className="pointer-events-none absolute -left-24 top-[-120px] h-[360px] w-[360px] rounded-full bg-[#FF9500]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-[-90px] h-[380px] w-[380px] rounded-full bg-[#007AFF]/8 blur-3xl" />

      <section className="relative w-full max-w-[430px] rounded-[30px] border border-black/[0.05] bg-white/92 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.10)] backdrop-blur-2xl sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-[#FFF3E0] text-[#FF9500]">
            <ShoppingBag size={27} strokeWidth={2} />
          </div>
          <span className="rounded-full bg-[#F2F2F7] px-3 py-1.5 text-[11px] font-medium text-[#8E8E93]">Admin</span>
        </div>

        <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">Panel administrativo</p>
        <h1 className="mt-1.5 text-[38px] font-semibold leading-none tracking-[-0.045em] text-[#1C1C1E]">Ingresar</h1>
        <p className="mt-3 max-w-sm text-[14px] leading-5 text-[#8E8E93]">
          Ingresá con el usuario administrador configurado en Supabase Auth.
        </p>

        <form className="mt-8 space-y-4" onSubmit={submit}>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-[#636366]">Email</label>
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 rounded-[14px] border-[#E5E5EA] bg-[#F7F7FA] px-4 text-[#1C1C1E] shadow-none focus:border-[#FF9500] focus:ring-[#FF9500]/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-[#636366]">Contraseña</label>
            <PasswordInput
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-[14px] border-[#E5E5EA] bg-[#F7F7FA] px-4 text-[#1C1C1E] shadow-none focus:border-[#FF9500] focus:ring-[#FF9500]/20"
            />
          </div>

          {error ? (
            <p className="rounded-[14px] border border-[#FF3B30]/10 bg-[#FFF0EF] p-3.5 text-[13px] leading-5 text-[#C9342B]">{error}</p>
          ) : null}

          <Button
            className="mt-1 h-12 w-full rounded-[14px] bg-[#FF9500] text-[14px] font-semibold shadow-none hover:bg-[#E88300] focus:ring-[#FF9500]"
            type="submit"
            disabled={loading}
          >
            <Lock size={17} /> {loading ? 'Ingresando...' : 'Entrar al panel'}
          </Button>
        </form>
      </section>
    </main>
  );
}
