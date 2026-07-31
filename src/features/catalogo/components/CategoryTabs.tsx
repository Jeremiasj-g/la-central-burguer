'use client';

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

interface CategoryTabsProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (id: string) => void;
}

function tabClasses(active: boolean) {
  return cn(
    'group flex h-[70px] w-full min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-sm border px-1.5 py-1.5 text-center text-[8px] font-black uppercase tracking-[.04em] transition sm:h-[86px] sm:gap-2 sm:px-2.5 sm:py-3 sm:text-[10px] sm:tracking-wide',
    active
      ? 'border-central-orange bg-central-orange text-black shadow-orange'
      : 'border-white/10 bg-white/[.035] text-central-cream/70 hover:border-central-orange/60 hover:text-central-orange',
  );
}

function CategoryIcon({ icon: Icon }: { icon: (typeof icons)[keyof typeof icons] }) {
  return (
    <span className="grid h-[18px] w-[18px] shrink-0 place-items-center sm:h-[22px] sm:w-[22px]" aria-hidden="true">
      <Icon className="h-4 w-4 sm:h-[19px] sm:w-[19px]" strokeWidth={2} />
    </span>
  );
}

function CategoryLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="line-clamp-2 w-full min-w-0 [overflow-wrap:anywhere] hyphens-auto leading-[1.12] sm:leading-[1.15]">
      {children}
    </span>
  );
}

export function CategoryTabs({ categories, selectedCategoryId, onSelect }: CategoryTabsProps) {
  return (
    <div className="category-tabs-swiper relative rounded-sm border border-central-orange/25 bg-black/35 p-2 sm:p-3 shadow-dark backdrop-blur">
      <Swiper
        modules={[FreeMode, Mousewheel]}
        freeMode
        mousewheel={{ forceToAxis: true, sensitivity: 0.75 }}
        grabCursor
        slidesPerView="auto"
        spaceBetween={8}
        className="!overflow-hidden"
      >
        <SwiperSlide className="!w-[92px] sm:!w-[132px]">
          <button type="button" onClick={() => onSelect('all')} className={tabClasses(selectedCategoryId === 'all')}>
            <CategoryIcon icon={Utensils} />
            <CategoryLabel>Todo</CategoryLabel>
          </button>
        </SwiperSlide>
        {categories.map((category) => {
          const Icon = icons[(category.iconName ?? 'Utensils') as keyof typeof icons] ?? Utensils;
          const active = selectedCategoryId === category.id;
          return (
            <SwiperSlide key={category.id} className="!w-[92px] sm:!w-[132px]">
              <button type="button" onClick={() => onSelect(category.id)} className={tabClasses(active)} title={category.name}>
                <CategoryIcon icon={Icon} />
                <CategoryLabel>{category.name}</CategoryLabel>
              </button>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
