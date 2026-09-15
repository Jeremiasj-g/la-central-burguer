'use client';

import { useEffect } from 'react';

export function PublicTypographyPortalSync() {
  useEffect(() => {
    const publicScope = document.querySelector<HTMLElement>('.public-site');
    if (!publicScope) return;

    const previousFontFamily = document.body.style.getPropertyValue('--lcb-public-font-family');
    const previousDisplayFontFamily = document.body.style.getPropertyValue('--lcb-public-display-font-family');
    const computedStyles = window.getComputedStyle(publicScope);
    const fontFamily = computedStyles.fontFamily;
    const displayFontFamily = computedStyles.getPropertyValue('--font-public-display').trim();

    document.body.style.setProperty('--lcb-public-font-family', fontFamily);
    if (displayFontFamily) {
      document.body.style.setProperty('--lcb-public-display-font-family', displayFontFamily);
    }
    document.body.classList.add('lcb-public-typography');

    return () => {
      document.body.classList.remove('lcb-public-typography');

      if (previousFontFamily) {
        document.body.style.setProperty('--lcb-public-font-family', previousFontFamily);
      } else {
        document.body.style.removeProperty('--lcb-public-font-family');
      }

      if (previousDisplayFontFamily) {
        document.body.style.setProperty('--lcb-public-display-font-family', previousDisplayFontFamily);
      } else {
        document.body.style.removeProperty('--lcb-public-display-font-family');
      }
    };
  }, []);

  return null;
}
