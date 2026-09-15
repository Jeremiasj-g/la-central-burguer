'use client';

import { useEffect, useState } from 'react';
import { BadgePercent, Beef, CircleDot, CookingPot, CupSoda, Pizza, Sandwich, Utensils } from 'lucide-react';
import { FreeMode, Mousewheel } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Category } from '@/features/categorias/types/categoria.types';
import { cn } from '@/shared/utils/cn';

const icons = {
  BadgePercent,
  Beef,
  Pizza,
  Sandwich,
  CircleDot,
  CookingPot,
  CupSoda,
  Utensils,
};

const categoryAssets = {
  burger: '/swiper-categories/burguer.svg',
  sandwich: '/swiper-categories/sandwich.svg',
  beef: '/swiper-categories/beef.svg',
  cup: '/swiper-categories/cup.svg',
  utensils: '/swiper-categories/utensils.svg',
  pizza: '/swiper-categories/pizza.svg',
} as const;

interface CategoryTabsProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (id: string) => void;
}

function normalizeCategoryName(value: string) {
  return value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getCategoryAsset(categoryName: string) {
  const name = normalizeCategoryName(categoryName);

  if (
    name.includes('lomito')
    || name.includes('figazza de lomo')
    || name.includes('sandwich')
    || name.includes('sanguche')
  ) {
    return categoryAssets.sandwich;
  }

  if (name.includes('milanesa') || name.includes('mila')) {
    return categoryAssets.beef;
  }

  if (
    name.includes('bebida')
    || name.includes('gaseosa')
    || name.includes('refresco')
  ) {
    return categoryAssets.cup;
  }

  if (
    name.includes('burger')
    || name.includes('burguer')
    || name.includes('hamburguesa')
  ) {
    return categoryAssets.burger;
  }

  if (name.includes('pizza') || name.includes('pizzeta')) {
    return categoryAssets.pizza;
  }

  return categoryAssets.utensils;
}

function tabClasses(active: boolean) {
  return cn(
    'group flex h-[92px] w-full min-w-0 flex-col overflow-hidden rounded-sm border px-2 py-2 text-center uppercase transition sm:h-[108px] sm:px-3 sm:py-2.5',
    active
      ? 'border-central-orange bg-central-orange text-black shadow-orange'
      : 'border-white/10 bg-[#20201f] text-central-cream/70 hover:border-central-orange/60 hover:text-central-orange',
  );
}

function CategoryIcon({
  src,
  fallback: FallbackIcon,
  active,
}: {
  src: string;
  fallback: (typeof icons)[keyof typeof icons];
  active: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <span className="flex h-[70%] w-full min-h-0 items-center justify-center overflow-hidden" aria-hidden="true">
      {failed ? (
        <FallbackIcon className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={1.8} />
      ) : (
        <img
          src={src}
          alt=""
          className={cn(
            'h-full max-h-[44px] w-full max-w-[58px] object-contain sm:max-h-[52px] sm:max-w-[66px]',
            active ? 'brightness-0' : 'brightness-0 invert opacity-75',
          )}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function CategoryLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-[30%] w-full min-w-0 items-center justify-center overflow-hidden">
      <span className="line-clamp-2 w-full min-w-0 text-[9px] font-semibold leading-[1.05] tracking-[.035em] [overflow-wrap:anywhere] hyphens-auto sm:text-[10px] sm:leading-[1.08] sm:tracking-[.045em]">
        {children}
      </span>
    </span>
  );
}

export function CategoryTabs({ categories, selectedCategoryId, onSelect }: CategoryTabsProps) {
  return (
    <div className="category-tabs-swiper relative rounded-sm py-2 backdrop-blur-xl">
      <Swiper
        modules={[FreeMode, Mousewheel]}
        freeMode
        mousewheel={{ forceToAxis: true, sensitivity: 0.75 }}
        grabCursor
        slidesPerView="auto"
        spaceBetween={8}
        className="!overflow-hidden"
      >
        <SwiperSlide className="!w-[96px] sm:!w-[132px]">
          <button type="button" onClick={() => onSelect('all')} className={tabClasses(selectedCategoryId === 'all')}>
            <CategoryIcon src={categoryAssets.utensils} fallback={Utensils} active={selectedCategoryId === 'all'} />
            <CategoryLabel>Todo</CategoryLabel>
          </button>
        </SwiperSlide>

        {categories.map((category) => {
          const FallbackIcon = icons[(category.iconName ?? 'Utensils') as keyof typeof icons] ?? Utensils;
          const active = selectedCategoryId === category.id;
          return (
            <SwiperSlide key={category.id} className="!w-[96px] sm:!w-[132px]">
              <button type="button" onClick={() => onSelect(category.id)} className={tabClasses(active)} title={category.name}>
                <CategoryIcon src={getCategoryAsset(category.name)} fallback={FallbackIcon} active={active} />
                <CategoryLabel>{category.name}</CategoryLabel>
              </button>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
