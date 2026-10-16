'use client';

import Link from 'next/link';
import Skeleton from 'react-loading-skeleton';
import { MapPin } from 'lucide-react';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';

const socialButtonBase = 'lcb-polished-social grid h-11 w-11 place-items-center overflow-visible rounded-[12px] border transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

function normalizeExternalUrl(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`;
}

export function PublicFooter() {
  const { config, isLoading } = useBusinessConfig();
  const businessName = config?.businessName?.trim() || 'La Central Burger';
  const whatsapp = (config?.whatsappNumber || '543794752707').replace(/\D/g, '');
  const address = config?.address?.trim() || 'Madariaga 246';
  const facebookUrl = normalizeExternalUrl(config?.facebookUrl, '#');
  const instagramUrl = normalizeExternalUrl(config?.instagramUrl, '#');
  const whatsappUrl = normalizeExternalUrl(config?.whatsappUrl, `https://wa.me/${whatsapp}`);

  return (
    <footer className="lcb-polished-footer relative overflow-hidden border-t px-4 py-14 sm:px-7 sm:py-16 lg:px-10">
      
      {!isLoading ? (
        
      ) : null}

      <div className="mx-auto max-w-[1480px] text-center">
        <div className="brand-stamp mx-auto mb-6 h-24 w-24 overflow-hidden">
          <BusinessLogo logoUrl={config?.logoUrl} businessName={businessName} mode="stamp" loading={isLoading} />
        </div>

        {isLoading ? (
          <div className="skeleton-dark mx-auto max-w-sm"><Skeleton height={48} borderRadius={2} /></div>
        ) : (
          <h2 className="lcb-polished-footer-title text-[36px] font-semibold tracking-[-.055em] sm:text-[50px]">{businessName}</h2>
        )}
        <div className="lcb-polished-accent-line mx-auto mt-5" />

        {isLoading ? (
          <div className="skeleton-dark mt-7 flex justify-center gap-4">
            <Skeleton width={48} height={48} borderRadius={2} />
            <Skeleton width={48} height={48} borderRadius={2} />
            <Skeleton width={48} height={48} borderRadius={2} />
          </div>
        ) : (
          <div className="mt-7 flex justify-center gap-4">
            <Link
              className={`${socialButtonBase} hover:drop-shadow-[0_0_14px_rgba(24,119,242,.75)] focus-visible:ring-[#1877F2]`}
              href={facebookUrl}
              target={facebookUrl === '#' ? undefined : '_blank'}
              rel={facebookUrl === '#' ? undefined : 'noreferrer'}
              aria-label="Facebook"
              title="Facebook"
            >
              <span
                aria-hidden="true"
                className="h-full w-full"
                style={{
                  backgroundColor: '#1877F2',
                  WebkitMaskImage: 'url("/social/facebook.svg")',
                  maskImage: 'url("/social/facebook.svg")',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                }}
              />
            </Link>
  
            <Link
              className={`${socialButtonBase} hover:drop-shadow-[0_0_14px_rgba(225,48,108,.75)] focus-visible:ring-[#E1306C]`}
              href={instagramUrl}
              target={instagramUrl === '#' ? undefined : '_blank'}
              rel={instagramUrl === '#' ? undefined : 'noreferrer'}
              aria-label="Instagram"
              title="Instagram"
            >
              <span
                aria-hidden="true"
                className="h-full w-full"
                style={{
                  backgroundColor: '#E1306C',
                  WebkitMaskImage: 'url("/social/instagram.svg")',
                  maskImage: 'url("/social/instagram.svg")',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                }}
              />
            </Link>
  
            <Link
              className={`${socialButtonBase} hover:drop-shadow-[0_0_14px_rgba(37,211,102,.75)] focus-visible:ring-[#25D366]`}
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              title="WhatsApp"
            >
              <span
                aria-hidden="true"
                className="h-full w-full"
                style={{
                  backgroundColor: '#25D366',
                  WebkitMaskImage: 'url("/social/whatsapp.svg")',
                  maskImage: 'url("/social/whatsapp.svg")',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                }}
              />
            </Link>
          </div>
        )}

        {isLoading ? (
          <div className="skeleton-dark mx-auto mt-8 max-w-xs">
            <Skeleton height={16} />
            <Skeleton className="mt-2" width="82%" height={14} />
          </div>
        ) : (
          <>
            <p className="lcb-polished-footer-address mt-7 flex items-center justify-center gap-2 text-[13px] font-medium">
              <MapPin size={16} /> {address} · Corrientes, Argentina
            </p>
            <p className="lcb-polished-footer-meta mt-2 text-[12px]">Copyright © 2026 {businessName}. Todos los derechos reservados.</p>
          </>
        )}
        <p className="lcb-polished-footer-meta mt-2 text-[12px]">Desarrollado por <span className="font-semibold text-central-orange">@Devcor</span></p>
      </div>
    </footer>
  );
}
