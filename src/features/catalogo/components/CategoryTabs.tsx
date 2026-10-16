'use client';

import { BadgePercent, Beef, Coffee, Grid2X2, Pizza, Sandwich, UtensilsCrossed } from 'lucide-react';
import { useRef } from 'react';
import type { Category } from '@/features/categorias/types/categoria.types';

interface CategoryTabsProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (id: string) => void;
}

function getCategoryIcon(name: string) {
  const normalized = name.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized.includes('pizza')) return Pizza;
  if (normalized.includes('lomito') || normalized.includes('sandwich') || normalized.includes('figazza')) return Sandwich;
  if (normalized.includes('milanesa') || normalized.includes('mila')) return Beef;
  if (normalized.includes('bebida') || normalized.includes('gaseosa')) return Coffee;
  if (normalized.includes('promo')) return BadgePercent;
  if (normalized.includes('burguer') || normalized.includes('burger') || normalized.includes('hamburguesa')) return Sandwich;
  return UtensilsCrossed;
}

export function CategoryTabs({ categories, selectedCategoryId, onSelect }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="lcb-category-navigation relative min-w-0">
      <div ref={scrollRef} className="lcb-category-scroll" role="group" aria-label="Filtrar por categoría">
        <button type="button" aria-pressed={selectedCategoryId === 'all'} onClick={() => onSelect('all')}
          className={`lcb-category-pill ${selectedCategoryId === 'all' ? 'is-selected' : ''}`}>
          <Grid2X2 size={17} strokeWidth={1.8} /> Todo el menú
        </button>
        {categories.map(category => {
          const Icon = getCategoryIcon(category.name);
          return (
            <button key={category.id} type="button" aria-pressed={selectedCategoryId === category.id}
              className={`lcb-category-pill ${selectedCategoryId === category.id ? 'is-selected' : ''}`}
              onClick={() => onSelect(category.id)} title={category.name}>
              <Icon size={17} strokeWidth={1.7} /><span>{category.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
