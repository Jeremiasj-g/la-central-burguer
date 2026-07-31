'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShoppingBag } from 'lucide-react';
import { loginAdmin } from '../services/auth.service';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';

export function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try { setLoading(true); setError(null); await loginAdmin(email, password); router.replace(ROUTES.adminDashboard); } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión'); } finally { setLoading(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-central-carbon px-4 text-white"><section className="w-full max-w-md rounded-sm border border-white/10 bg-white/5 p-8 shadow-dark backdrop-blur"><div className="grid h-16 w-16 place-items-center rounded-sm bg-central-orange text-white shadow-orange"><ShoppingBag size={30} /></div><p className="mt-6 text-xs font-black uppercase tracking-[.25em] text-central-orange">Panel administrativo</p><h1 className="mt-2 text-4xl font-black">Ingresar</h1><p className="mt-3 text-sm text-white/55">Ingresá con el usuario administrador configurado en Supabase Auth.</p><form className="mt-8 space-y-4" onSubmit={submit}><div><label className="mb-2 block text-sm font-bold text-white/75">Email</label><Input value={email} onChange={(event) => setEmail(event.target.value)} className="border-white/10 bg-central-ink text-white" /></div><div><label className="mb-2 block text-sm font-bold text-white/75">Contraseña</label><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="border-white/10 bg-central-ink text-white" /></div>{error ? <p className="rounded-sm bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}<Button className="w-full" type="submit" disabled={loading}><Lock size={18} /> {loading ? 'Ingresando...' : 'Entrar al panel'}</Button></form></section></main>;
}
