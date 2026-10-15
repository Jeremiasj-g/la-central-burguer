'use client';

import { Upload, X } from 'lucide-react';
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
  const fieldClass = '!h-10 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !px-3 !text-[13px] !font-normal !text-neutral-900 !shadow-none placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white focus:!ring-central-orange/10';
  const selectedChipClass = 'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-central-orange/20 bg-central-orange/[.09] px-2.5 py-1.5 text-[11px] font-medium leading-none text-central-ember transition-[background-color,border-color,color,transform] duration-200 hover:border-central-orange/45 hover:bg-central-orange/15 active:scale-[.97]';
  const suggestionChipClass = 'cursor-pointer rounded-full border border-neutral-200/80 bg-[#f7f7f9] px-2.5 py-1.5 text-[11px] font-normal text-neutral-600 transition-[background-color,border-color,color,transform] duration-200 hover:border-central-orange/35 hover:bg-central-orange/[.06] hover:text-central-ember active:scale-[.97]';

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(270px,.9fr)] lg:gap-6">
        <div className="min-w-0 space-y-4">
          <div>
            <label htmlFor="product-name" className={labelClass}>Nombre del producto <span className="text-red-500">*</span></label>
            <Input id="product-name" className={fieldClass} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} placeholder="Ej. Hamburguesa clásica" required autoFocus />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-neutral-500">Ingredientes asociados</span>
              <span className="rounded-full bg-[#f7f7f9] px-2.5 py-1 text-[10px] font-medium tabular-nums text-neutral-500">{selectedIngredients.length} seleccionados</span>
            </div>
            <div className="rounded-[13px] border border-neutral-200/80 bg-[#fafafa] p-3">
              <div className="flex min-h-8 flex-wrap items-center gap-1.5">
                {selectedIngredients.length ? selectedIngredients.map((ingredient) => (
                  <button
                    key={ingredient.id}
                    type="button"
                    title={`Quitar ${ingredient.name}`}
                    aria-label={`Quitar ${ingredient.name}`}
                    onClick={() => toggleIngredient(ingredient.id)}
                    className={selectedChipClass}
                  >
                    {ingredient.name}
                    <X size={12} strokeWidth={1.8} />
                  </button>
                )) : (
                  <span className="py-1 text-[11px] text-neutral-400">Seleccioná ingredientes de las opciones disponibles.</span>
                )}
              </div>
              <div className="mt-3 border-t border-neutral-200/70 pt-3">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[.08em] text-neutral-400">Agregar ingredientes</p>
                <div className="custom-scrollbar flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                  {suggestedIngredients.length ? suggestedIngredients.map((ingredient) => (
                    <button
                      key={ingredient.id}
                      type="button"
                      title={`Agregar ${ingredient.name}`}
                      aria-label={`Agregar ${ingredient.name}`}
                      onClick={() => toggleIngredient(ingredient.id)}
                      className={suggestionChipClass}
                    >
                      {ingredient.name}
                    </button>
                  )) : (
                    <p className="py-1 text-[11px] text-neutral-400">No hay más ingredientes disponibles.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="product-description" className={labelClass}>Descripción <span className="font-normal text-neutral-400">(opcional)</span></label>
            <Textarea
              id="product-description"
              className="!min-h-24 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !px-3 !py-2.5 !text-[13px] !font-normal !text-neutral-900 placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white focus:!ring-central-orange/10"
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
              placeholder="Agregá un detalle extra. La descripción también se arma con los ingredientes seleccionados."
              rows={4}
            />
            <p className="mt-1.5 text-[11px] leading-4 text-neutral-400">Los ingredientes seleccionados se incorporan a la descripción al guardar.</p>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="product-price" className={labelClass}>Precio de venta <span className="text-red-500">*</span></label>
              <Input id="product-price" className={fieldClass} type="number" min={0} value={values.currentPrice || ''} onChange={(event) => setValues({ ...values, currentPrice: Number(event.target.value) })} placeholder="$" required />
            </div>
            <div className="min-w-0">
              <span className={labelClass}>Categoría <span className="text-red-500">*</span></span>
              <Select
                aria-label="Categoría del producto"
                variant="light"
                value={values.categoryId}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                onValueChange={(categoryId) => setValues({ ...values, categoryId })}
                placeholder="Seleccionar categoría"
                className="!h-10 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !text-[12px] !font-normal !shadow-none"
                contentClassName="!rounded-[13px]"
                required
              />
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <span className={labelClass}>Imagen del producto</span>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-[14px] border border-dashed border-neutral-300 bg-[#f8f8f9] px-4 py-5 text-center outline-none transition-[border-color,background-color] duration-200 hover:border-central-orange/45 hover:bg-central-orange/[.035] focus-within:border-central-orange/45 focus-within:ring-2 focus-within:ring-central-orange/10">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(event) => handleImageFile(event.target.files?.[0])} aria-label="Subir imagen del producto" />
              <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-white text-neutral-500 shadow-[0_1px_3px_rgba(17,16,15,.06)]">
                <Upload size={19} strokeWidth={1.8} />
              </span>
              <span className="mt-2 text-[12px] font-medium text-neutral-800">Seleccionar imagen</span>
              <span className="mt-1 text-[11px] text-neutral-400">PNG, JPG, WEBP o GIF · Máx. 450 KB</span>
            </label>
            {imageError ? <p role="alert" className="mt-2 rounded-[11px] border border-red-200/80 bg-red-50 px-3 py-2 text-[11px] leading-5 text-red-600">{imageError}</p> : null}
          </div>

          <div>
            <p className={labelClass}>Vista previa</p>
            <div className="overflow-hidden rounded-[14px] border border-neutral-200/80 bg-[#191b20]">
              <ProductImageMedia
                imageUrl={values.imageUrl}
                productName={values.name || 'Vista previa del producto'}
                categoryName={selectedCategory?.name}
                className="h-44 w-full sm:h-48 lg:h-40"
              />
            </div>
          </div>

          <div>
            <p className={labelClass}>Visibilidad del producto</p>
            <div className="space-y-2 rounded-[13px] border border-neutral-200/80 bg-[#fafafa] p-2.5">
              {([
                ['active', 'Producto activo', 'Habilitado en el catálogo'],
                ['available', 'Disponible', 'Se puede solicitar en el menú'],
                ['featured', 'Destacado', 'Se muestra como recomendado'],
              ] as const).map(([key, label, description]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 transition-colors duration-200 hover:bg-white">
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium text-neutral-800">{label}</span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-neutral-500">{description}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 cursor-pointer accent-central-orange"
                    checked={values[key]}
                    onChange={(event) => setValues({ ...values, [key]: event.target.checked })}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 justify-end gap-2 border-t border-neutral-100 pt-4">
        <Button type="button" variant="secondary" className="!rounded-[11px] !border-neutral-200 !bg-[#f7f7f9] !px-4 !text-[12px] !font-medium !text-neutral-600 !shadow-none hover:!bg-neutral-100" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="!rounded-[11px] !bg-[#191b20] !px-4 !text-[12px] !font-medium !shadow-none hover:!bg-neutral-700" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar producto'}</Button>
      </div>
    </form>
  );
}
