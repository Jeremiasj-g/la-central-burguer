'use client';

import { useEffect } from 'react';

export function PublicTypographyPortalSync() {
  useEffect(() => {
    const publicScope = document.querySelector<HTMLElement>('.public-site');
    if (!publicScope) return;

    const previousFontFamily = document.body.style.getPropertyValue('--lcb-public-font-family');
    const fontFamily = window.getComputedStyle(publicScope).fontFamily;

    document.body.style.setProperty('--lcb-public-font-family', fontFamily);
    document.body.classList.add('lcb-public-typography');

    return () => {
      document.body.classList.remove('lcb-public-typography');
      if (previousFontFamily) {
        document.body.style.setProperty('--lcb-public-font-family', previousFontFamily);
      } else {
        document.body.style.removeProperty('--lcb-public-font-family');
      }
    };
  }, []);

  return null;
}
