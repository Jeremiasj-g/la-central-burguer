'use client';
// Validación temporal de la modal minimalista de tres columnas.

import { ImagePlus, Plus, Search, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import type { Product } from '../types/producto.types';
import type { Category } from '@/features/categorias/types/categoria.types';
import type { Ingredient } from '@/features/ingredientes/types/ingrediente.types';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { Textarea } from '@/shared/components/ui/Textarea';
import { ProductImageMedia } from './ProductImageMedia';

interface ProductoFormProps {
  product?: Product | null;
  categories: Category[];
  ingredients: Ingredient[];
  isSaving?: boolean;
  onSubmit: (values: {
    name: string;
    description: string;
    imageUrl: string;
    categoryId: string;
    currentPrice: number;
    active: boolean;
    available: boolean;
    featured: boolean;
    isPromotion: boolean;
    ingredientIds: string[];
  }) => void;
  onCancel: () => void;
}

export function ProductoForm({ product, categories, ingredients, isSaving, onSubmit, onCancel }: ProductoFormProps) {
  const [imageError, setImageError] = useState<string | null>(null);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [values, setValues] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    imageUrl: product?.imageUrl ?? '/images/productos/burger-simple.svg',
    categoryId: product?.categoryId ?? categories[0]?.id ?? '',
    currentPrice: product?.currentPrice ?? 0,
    active: product?.active ?? true,
    available: product?.available ?? true,
    featured: product?.featured ?? false,
    ingredientIds: product?.ingredientIds ?? [],
  });

  const activeIngredients = useMemo(() => ingredients.filter((ingredient) => ingredient.active), [ingredients]);
  const ingredientById = useMemo<Record<string, Ingredient>>(
    () => Object.fromEntries(activeIngredients.map((ingredient) => [ingredient.id, ingredient])) as Record<string, Ingredient>,
    [activeIngredients],
  );
  const selectedIngredients = values.ingredientIds.map((id) => ingredientById[id]).filter((ingredient): ingredient is Ingredient => Boolean(ingredient));
  const suggestedIngredients = activeIngredients.filter((ingredient) => !values.ingredientIds.includes(ingredient.id));
  const selectedCategory = categories.find((category) => category.id === values.categoryId);
  const normalizedIngredientSearch = ingredientSearch.trim().toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filteredIngredients = suggestedIngredients.filter((ingredient) =>
    ingredient.name.toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normalizedIngredientSearch),
  );


  function toggleIngredient(ingredientId: string) {
    const exists = values.ingredientIds.includes(ingredientId);
    setValues({
      ...values,
      ingredientIds: exists
        ? values.ingredientIds.filter((id) => id !== ingredientId)
        : [...values.ingredientIds, ingredientId],
    });
  }

  function handleImageFile(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setImageError('Seleccioná una imagen PNG, JPG, WEBP o GIF.');
      return;
    }
    if (file.size > 450_000) {
      setImageError('La imagen es muy pesada para esta versión frontend. Usá una imagen menor a 450 KB.');
      return;
    }
    setImageError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setValues((current) => ({ ...current, imageUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  function buildProductDescription() {
    const ingredientNames = selectedIngredients.map((ingredient) => ingredient.name);
    const extraDescription = values.description.trim();

    if (!ingredientNames.length) return extraDescription;
    if (!extraDescription) return ingredientNames.join(', ');

    const normalizedExtra = extraDescription.toLowerCase();
    const missingIngredientNames = ingredientNames.filter((name) => !normalizedExtra.includes(name.toLowerCase()));

    return [missingIngredientNames.join(', '), extraDescription]
      .filter(Boolean)
      .join('. ');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      ...values,
      description: buildProductDescription(),
      isPromotion: selectedCategory?.slug === 'promos',
    });
  }

  const labelClass = 'mb-1.5 block text-[11px] font-medium text-neutral-500';
  const fieldClass = '!h-10 !w-full !rounded-[10px] !border-neutral-200/80 !bg-[#f8f8f9] !px-3 !text-[13px] !font-normal !text-neutral-900 !shadow-none placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white focus:!ring-central-orange/10';
  const selectedChipClass = 'group inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-[9px] bg-central-orange/[.09] px-2.5 py-1 text-[11px] font-medium text-central-ember transition-[background-color,transform] duration-200 hover:bg-central-orange/15 active:scale-[.98]';
  const suggestionChipClass = 'inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-[9px] bg-[#f5f5f6] px-2.5 py-1 text-[11px] font-normal text-neutral-600 transition-[background-color,color,transform] duration-200 hover:bg-central-orange/[.09] hover:text-central-ember active:scale-[.98]';

  return (
    <form onSubmit={handleSubmit} className="product-create-workspace min-w-0">
      <div className="grid min-w-0 items-start gap-y-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)_minmax(0,.94fr)] lg:gap-x-0">
        <section aria-labelledby="product-info-heading" className="min-w-0 lg:pr-5 xl:pr-7">
          <h3 id="product-info-heading" className="mb-4 text-[14px] font-semibold tracking-[-.02em] text-neutral-900">Información del producto</h3>
          <div className="space-y-3.5">
            <div>
              <label htmlFor="product-name" className={labelClass}>Nombre <span className="text-red-500">*</span></label>
              <Input id="product-name" className={fieldClass} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} placeholder="Ej. Hamburguesa clásica" required />
            </div>
            <div>
              <span className={labelClass}>Categoría <span className="text-red-500">*</span></span>
              <Select
                aria-label="Categoría del producto"
                variant="light"
                value={values.categoryId}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                onValueChange={(categoryId) => setValues({ ...values, categoryId })}
                placeholder="Seleccionar categoría"
                className="!h-10 !rounded-[10px] !border-neutral-200/80 !bg-[#f8f8f9] !text-[12px] !font-normal !shadow-none"
                contentClassName="!rounded-[12px]"
                required
              />
            </div>
            <div>
              <label htmlFor="product-price" className={labelClass}>Precio de venta <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-neutral-400">$</span>
                <Input id="product-price" className={fieldClass + ' !pl-7'} type="number" min={0} step="any" inputMode="decimal" value={values.currentPrice || ''} onChange={(event) => setValues({ ...values, currentPrice: Number(event.target.value) })} placeholder="0" required />
              </div>
            </div>
            <div>
              <label htmlFor="product-description" className={labelClass}>Descripción <span className="font-normal text-neutral-400">(opcional)</span></label>
              <Textarea
                id="product-description"
                className="!min-h-[102px] !w-full !rounded-[10px] !border-neutral-200/80 !bg-[#f8f8f9] !px-3 !py-2.5 !text-[13px] !font-normal !text-neutral-900 placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white focus:!ring-central-orange/10"
                value={values.description}
                onChange={(event) => setValues({ ...values, description: event.target.value })}
                placeholder="Agregá detalles del producto..."
                rows={3}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="product-ingredients-heading" className="min-w-0 border-t border-neutral-100 pt-5 lg:border-l lg:border-t-0 lg:px-5 lg:pt-0 xl:px-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 id="product-ingredients-heading" className="text-[14px] font-semibold tracking-[-.02em] text-neutral-900">Ingredientes</h3>
            <span className="text-[11px] tabular-nums text-neutral-400">{selectedIngredients.length} seleccionados</span>
          </div>

          <div className="min-w-0">
            <p className={labelClass}>Seleccionados</p>
            <div className="flex min-h-[37px] max-h-[118px] flex-wrap content-start gap-1.5 overflow-y-auto py-1 custom-scrollbar" aria-label="Ingredientes seleccionados">
              {selectedIngredients.length ? selectedIngredients.map((ingredient) => (
                <button key={ingredient.id} type="button" title={`Quitar ${ingredient.name}`} aria-label={`Quitar ${ingredient.name}`} className={selectedChipClass} onClick={() => toggleIngredient(ingredient.id)}>
                  {ingredient.name}
                  <X size={12} strokeWidth={1.8} className="opacity-65 transition-opacity duration-200 group-hover:opacity-100" />
                </button>
              )) : <p className="py-2 text-[11px] text-neutral-400">Sin ingredientes seleccionados</p>}
            </div>
          </div>

          <div className="mt-4 min-w-0">
            <label htmlFor="ingredient-product-search" className={labelClass}>Agregar ingrediente</label>
            <div className="relative">
              <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input
                id="ingredient-product-search"
                type="search"
                className={fieldClass + ' !pl-9'}
                value={ingredientSearch}
                onChange={(event) => setIngredientSearch(event.target.value)}
                placeholder="Buscar ingrediente"
                autoComplete="off"
              />
            </div>
            <div className="custom-scrollbar mt-2.5 max-h-[240px] min-h-[86px] overflow-y-auto">
              {filteredIngredients.length ? (
                <div className="flex flex-wrap content-start gap-1.5">
                  {filteredIngredients.map((ingredient) => (
                    <button key={ingredient.id} type="button" title={`Agregar ${ingredient.name}`} aria-label={`Agregar ${ingredient.name}`} className={suggestionChipClass} onClick={() => toggleIngredient(ingredient.id)}>
                      <Plus size={12} strokeWidth={1.9} className="text-central-orange" />
                      {ingredient.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-3 text-[11px] text-neutral-400">
                  {ingredientSearch.trim() ? 'Sin resultados.' : 'No quedan ingredientes por agregar.'}
                </p>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="product-visibility-heading" className="min-w-0 border-t border-neutral-100 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 xl:pl-7">
          <h3 id="product-visibility-heading" className="mb-4 text-[14px] font-semibold tracking-[-.02em] text-neutral-900">Imagen y publicación</h3>

          <div className="overflow-hidden rounded-[12px] bg-[#191b20]">
            <ProductImageMedia
              imageUrl={values.imageUrl}
              productName={values.name || 'Vista previa del producto'}
              categoryName={selectedCategory?.name}
              className="h-[158px] w-full sm:h-[180px] lg:h-[152px]"
            />
          </div>

          <label
            className="mt-2.5 flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-[10px] bg-[#f8f8f9] px-3 py-2 text-[12px] text-neutral-600 transition-colors duration-200 hover:bg-central-orange/[.08] focus-within:ring-2 focus-within:ring-central-orange/15"
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
            onDrop={(event) => { event.preventDefault(); handleImageFile(event.dataTransfer.files?.[0]); }}
          >
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Seleccionar imagen del producto" onChange={(event) => handleImageFile(event.target.files?.[0])} />
            <span className="flex min-w-0 items-center gap-2">
              <ImagePlus size={16} strokeWidth={1.8} className="shrink-0 text-neutral-500" />
              <span className="truncate">Cambiar imagen</span>
            </span>
            <span className="shrink-0 text-[10px] text-neutral-400">Máx. 450 KB</span>
          </label>
          {imageError ? <p role="alert" className="mt-2 text-[11px] leading-4 text-red-600">{imageError}</p> : null}

          <div className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
            {([
              ['active', 'Activo'],
              ['available', 'Disponible'],
              ['featured', 'Destacado'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-2">
                <span className="text-[12px] font-medium text-neutral-700">{label}</span>
                <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                  <input
                    type="checkbox"
                    className="product-create-switch peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    checked={values[key]}
                    onChange={(event) => setValues({ ...values, [key]: event.target.checked })}
                    aria-label={label}
                  />
                  <span aria-hidden="true" className="pointer-events-none h-6 w-11 rounded-full bg-neutral-200 transition-colors duration-200 peer-checked:bg-central-orange peer-focus-visible:ring-2 peer-focus-visible:ring-central-orange/35 peer-focus-visible:ring-offset-2" />
                  <span aria-hidden="true" className="pointer-events-none absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="sticky bottom-[-14px] z-20 -mx-3.5 -mb-3.5 mt-4 flex items-center justify-end gap-2 border-t border-neutral-100 bg-white/95 px-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:bottom-[-16px] sm:-mx-5 sm:-mb-4 sm:px-5 sm:pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button type="button" variant="secondary" className="!h-9 !rounded-[10px] !border-neutral-200 !bg-[#f7f7f9] !px-4 !text-[12px] !font-medium !text-neutral-600 !shadow-none hover:!bg-neutral-100" onClick={onCancel} disabled={isSaving}>Cancelar</Button>
        <Button type="submit" className="!h-9 !rounded-[10px] !bg-[#191b20] !px-4 !text-[12px] !font-medium !shadow-none hover:!bg-neutral-700" disabled={isSaving}>
          {isSaving ? 'Guardando...' : product ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </div>
    </form>
  );
}
