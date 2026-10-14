import Skeleton from 'react-loading-skeleton';
import { ShoppingBag } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface BusinessLogoProps {
  logoUrl?: string | null;
  businessName?: string;
  mode?: 'stamp' | 'navbar' | 'admin';
  className?: string;
  loading?: boolean;
}

function splitBusinessName(name?: string) {
  const safeName = name?.trim() || 'La Central Burger';
  const words = safeName.split(/\s+/);
  if (words.length <= 1) return { first: safeName, second: '' };
  return {
    first: words.slice(0, -1).join(' '),
    second: words.at(-1) ?? '',
  };
}

export function BusinessLogo({
  logoUrl,
  businessName,
  mode = 'stamp',
  className,
  loading = false,
}: BusinessLogoProps) {
  const name = splitBusinessName(businessName);

  if (loading) {
    if (mode === 'navbar') {
      return (
        <>
          <span className="skeleton-dark grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-sm sm:h-12 sm:w-12">
            <Skeleton width="100%" height="100%" borderRadius={2} />
          </span>
          <span className="skeleton-dark min-w-0">
            <span className="block"><Skeleton width={138} height={15} /></span>
            <span className="mt-1 block"><Skeleton width={82} height={9} /></span>
          </span>
        </>
      );
    }

    if (mode === 'admin') {
      return (
        <span className="skeleton-dark block h-full w-full overflow-hidden rounded-sm">
          <Skeleton width="100%" height="100%" borderRadius={2} />
        </span>
      );
    }

    return (
      <span className="skeleton-dark block h-full w-full overflow-hidden rounded-full">
        <Skeleton width="100%" height="100%" borderRadius="50%" />
      </span>
    );
  }

  if (logoUrl?.trim() && mode === 'navbar') {
    return (
      <>
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-sm border border-central-cream/35 bg-central-cream/95 p-1 shadow-soft sm:h-12 sm:w-12">
          <img
            src={logoUrl}
            alt={`Logo de ${businessName?.trim() || 'La Central Burger'}`}
            className="h-full w-full object-contain"
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-lg uppercase leading-none tracking-wide text-central-cream sm:text-xl">{name.first}</span>
          <span className="block truncate text-xs font-black uppercase tracking-[.32em] text-central-orange">{name.second}</span>
        </span>
      </>
    );
  }

  if (logoUrl?.trim()) {
    return (
      <img
        src={logoUrl}
        alt={`Logo de ${businessName?.trim() || 'La Central Burger'}`}
        className={cn(
          'block object-contain',
          mode === 'stamp' && 'h-full w-full rounded-full p-1.5',
          mode === 'admin' && 'h-full w-full rounded-sm object-contain p-1',
          className,
        )}
      />
    );
  }

  if (mode === 'navbar') {
    return (
      <>
        <span className="grid h-11 w-11 place-items-center rounded-sm border-2 border-central-cream bg-central-cream text-central-carbon shadow-soft sm:h-12 sm:w-12">
          <ShoppingBag size={24} />
        </span>
        <span>
          <span className="block font-display text-lg uppercase leading-none tracking-wide text-central-cream sm:text-xl">{name.first}</span>
          <span className="block text-xs font-black uppercase tracking-[.32em] text-central-orange">{name.second}</span>
        </span>
      </>
    );
  }

  if (mode === 'admin') {
    return <ShoppingBag size={22} />;
  }

  return (
    <div className="text-center">
      <ShoppingBag className="mx-auto mb-1" size={42} />
      <p className="text-[11px] font-black uppercase leading-none tracking-[.26em] sm:text-xs">{name.first}</p>
      <p className="mt-1 text-[18px] font-black uppercase tracking-[.16em] sm:text-2xl">{name.second}</p>
    </div>
  );
}
