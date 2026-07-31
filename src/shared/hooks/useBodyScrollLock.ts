'use client';

import { useEffect } from 'react';
import { acquireBodyScrollLock } from '@/shared/utils/body-scroll-lock.utils';

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return acquireBodyScrollLock();
  }, [active]);
}
