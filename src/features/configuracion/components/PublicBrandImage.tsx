'use client';

import { useState } from 'react';

interface PublicBrandImageProps {
  logoUrl?: string | null;
  businessName: string;
  className?: string;
  width: number;
  height: number;
  loading?: 'eager' | 'lazy';
}

/** Utiliza el logo editable del negocio y conserva al chef como imagen predeterminada. */
export function PublicBrandImage({
  logoUrl,
  businessName,
  className = '',
  width,
  height,
  loading = 'lazy',
}: PublicBrandImageProps) {
  const [invalidUrl, setInvalidUrl] = useState<string | null>(null);
  const source = logoUrl?.trim() || '/branding/chef-cutout.webp';
  const src = invalidUrl === source ? '/branding/chef-cutout.webp' : source;

  return (
    <img
      src={src}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      alt={`Logo de ${businessName}`}
      className={className}
      onError={() => setInvalidUrl(source)}
    />
  );
}
