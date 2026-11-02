'use client';

import { BadgePercent, Beef, CookingPot, CupSoda, Pizza, Sandwich, Utensils } from 'lucide-react';
import type { Category } from '@/features/categorias/types/categoria.types';

interface CategoryTabsProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (id: string) => void;
}

function CategorySymbol({ name }: { name: string }) {
  const normalized = name.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/promo|oferta|descuento/.test(normalized)) return <BadgePercent size={18} strokeWidth={1.7}/>;
  if (/pizza/.test(normalized)) return <Pizza size={18} strokeWidth={1.7}/>;
  if (/hamburgues|burger|burguer/.test(normalized)) return <Beef size={18} strokeWidth={1.7}/>;
  if (/lomito|figazza|sandwich|sanguche/.test(normalized)) return <Sandwich size={18} strokeWidth={1.7}/>;
  if (/bebida|gaseosa|cerveza|jugo/.test(normalized)) return <CupSoda size={18} strokeWidth={1.7}/>;
  return <CookingPot size={18} strokeWidth={1.7}/>;
}

export function CategoryTabs({ categories, selectedCategoryId, onSelect }: CategoryTabsProps) {
  return (
    <div className="chet-category-list -mx-1 flex gap-2 overflow-x-auto px-1 py-2" role="group" aria-label="Filtrar productos por categoría">
      <button type="button" onClick={() => onSelect('all')} aria-pressed={selectedCategoryId === 'all'}
        className={'chet-category-chip inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-transform duration-200 hover:scale-[1.035] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff933d] motion-reduce:transition-none ' + (selectedCategoryId === 'all' ? 'border-[#ff933d] bg-[#ff933d] text-[#1a120d]' : 'border-white/10 bg-[#222124] text-white/70')}>
        <Utensils size={17} strokeWidth={1.7}/> Todo
      </button>
      {categories.map(category => (
        <button type="button" key={category.id} onClick={() => onSelect(category.id)} aria-pressed={selectedCategoryId === category.id}
          className={'chet-category-chip inline-flex h-11 max-w-[240px] shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-transform duration-200 hover:scale-[1.035] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff933d] motion-reduce:transition-none ' + (selectedCategoryId === category.id ? 'border-[#ff933d] bg-[#ff933d] text-[#1a120d]' : 'border-white/10 bg-[#222124] text-white/70')}>
          <CategorySymbol name={category.name} /><span className="truncate">{category.name}</span>
        </button>
      ))}
    </div>
  );
}
