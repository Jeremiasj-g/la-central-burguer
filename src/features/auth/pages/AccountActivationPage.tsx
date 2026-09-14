'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, KeyRound, MailCheck, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/shared/components/ui/Button';
import { PasswordInput } from '@/shared/components/ui/PasswordInput';
import { ROUTES } from '@/shared/constants/routes';

type ActivationState = 'loading' | 'ready' | 'success' | 'error';

type AccessContext = {
  userId: string;
  fullName: string;
  email: string | null;
  active: boolean;
  roles: string[];
  permissions: string[];
};

function edgeMessage(data: unknown) {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error;
  return null;
}

function destinationForRoles(roles: string[]) {
  if (roles.includes('admin')) return ROUTES.adminDashboard;
  if (roles.includes('delivery')) return ROUTES.deliveryPanel;
  return ROUTES.home;
}

export function AccountActivationPage() {
  const router = useRouter();
  const [state, setState] = useState<ActivationState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [destination, setDestination] = useState(ROUTES.home as string);

  const displayName = useMemo(() => {
    const value = user?.user_metadata?.full_name;
    return typeof value === 'string' && value.trim() ? value.trim() : 'bienvenido/a';
  }, [user]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let mounted = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const resolveUser = async () => {
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const authError = params.get('error_description') || hash.get('error_description');
      if (authError) {
        if (mounted) {
          setErrorMessage(decodeURIComponent(authError));
          setState('error');
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session?.user && mounted) {
        setUser(data.session.user);
        setState('ready');
        return;
      }

      timeout = setTimeout(() => {
        if (mounted) {
          setErrorMessage('El enlace no es válido, venció o ya fue utilizado. Pedile al administrador una nueva invitación.');
          setState('error');
        }
      }, 1800);
    };

    void resolveUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted || !session?.user) return;
      if (timeout) clearTimeout(timeout);
      setUser(session.user);
      setState('ready');
    });

    return () => {
      mounted = false;
      if (timeout) clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function activate(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (password.length < 8) return toast.warning('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirmPassword) return toast.warning('Las contraseñas no coinciden.');

    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    try {
      const metadata = user.user_metadata ?? {};
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
        data: {
          ...metadata,
          onboarding_required: false,
          onboarding_completed_at: new Date().toISOString(),
        },
      });
      if (passwordError) throw passwordError;

      const { data: activationData, error: activationError } = await supabase.functions.invoke('activate-invited-user', { body: {} });
      if (activationError) throw activationError;
      const activationMessage = edgeMessage(activationData);
      if (activationMessage) throw new Error(activationMessage);

      const { data: context, error: contextError } = await supabase.rpc('get_current_access_context');
      if (contextError) throw contextError;
      const access = context as unknown as AccessContext | null;
      const next = destinationForRoles(access?.roles ?? []);
      setDestination(next);
      await supabase.auth.refreshSession();
      setState('success');
      toast.success('Cuenta activada correctamente.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo completar la activación.');
      toast.error(error instanceof Error ? error.message : 'No se pudo completar la activación.');
    } finally {
      setSaving(false);
    }
  }

  if (state === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-central-carbon px-4 text-white">
        <div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-central-orange"><MailCheck size={24} /></span><p className="mt-4 text-sm font-bold text-white/60">Validando tu invitación…</p></div>
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main className="grid min-h-screen place-items-center bg-central-carbon px-4 py-8 text-white">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[.05] p-6 text-center shadow-2xl">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 text-red-300"><ShieldCheck size={24} /></span>
          <h1 className="mt-5 text-2xl font-black">No pudimos validar la invitación</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">{errorMessage}</p>
          <Button className="mt-6 w-full rounded-xl" onClick={() => router.replace(ROUTES.home)}>Volver a La Central</Button>
        </section>
      </main>
    );
  }

  if (state === 'success') {
    return (
      <main className="grid min-h-screen place-items-center bg-central-carbon px-4 py-8 text-white">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[.05] p-6 text-center shadow-2xl">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300"><CheckCircle2 size={26} /></span>
          <p className="mt-5 text-xs font-black uppercase tracking-[.22em] text-central-orange">La Central Burger</p>
          <h1 className="mt-2 text-2xl font-black">Tu cuenta está lista</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">Email verificado y contraseña creada correctamente. Ya podés ingresar al portal asignado a tu rol.</p>
          <Button className="mt-6 w-full rounded-xl" onClick={() => router.replace(destination)}><UserRoundCheck size={17} /> Ir a mi panel</Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-central-carbon px-4 py-8 text-white sm:grid sm:place-items-center">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-central-orange shadow-orange"><KeyRound size={28} /></span>
          <p className="mt-5 text-xs font-black uppercase tracking-[.28em] text-central-orange">La Central Burger</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Activá tu cuenta</h1>
          <p className="mt-2 text-sm leading-6 text-white/55">Hola {displayName}. Tu email ya fue validado; sólo falta elegir tu contraseña de acceso.</p>
        </div>

        <form onSubmit={activate} className="rounded-2xl border border-white/10 bg-white/[.05] p-5 shadow-2xl backdrop-blur sm:p-6">
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-central-orange/15 bg-central-orange/[.07] p-4">
            <MailCheck size={19} className="mt-0.5 shrink-0 text-central-orange" />
            <div><p className="text-sm font-black">{user?.email}</p><p className="mt-1 text-xs leading-5 text-white/50">Esta contraseña la elegís vos. Administración nunca necesita conocerla.</p></div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/55">Nueva contraseña</span>
            <PasswordInput variant="dark" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
          </label>
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/55">Confirmar contraseña</span>
            <PasswordInput variant="dark" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required autoComplete="new-password" />
          </label>

          <div className="mt-5 rounded-xl bg-white/[.04] p-3 text-xs leading-5 text-white/45">Usá al menos 8 caracteres. El botón del ojo te permite revisar lo escrito antes de activar la cuenta.</div>
          <Button type="submit" className="mt-6 h-12 w-full rounded-xl" disabled={saving}>{saving ? 'Activando…' : 'Crear contraseña y activar cuenta'}</Button>
        </form>
      </div>
    </main>
  );
}
