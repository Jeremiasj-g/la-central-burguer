'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { ROUTES } from '@/shared/constants/routes';

function requiresOnboarding(user: User | null) {
  if (!user) return false;
  const invitedAt = (user as User & { invited_at?: string | null }).invited_at;
  const completedAt = user.user_metadata?.onboarding_completed_at;
  return user.user_metadata?.onboarding_required === true || Boolean(invitedAt && !completedAt);
}

export function AccountOnboardingGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === ROUTES.activateAccount) return;
    const supabase = getSupabaseBrowserClient();
    let mounted = true;

    const routeUser = (user: User | null) => {
      if (!mounted || !requiresOnboarding(user)) return;
      router.replace(ROUTES.activateAccount);
    };

    void supabase.auth.getUser().then(({ data }) => routeUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => routeUser(session?.user ?? null));

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null;
}
