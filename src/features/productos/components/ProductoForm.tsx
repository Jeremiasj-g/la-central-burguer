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

  const fieldLabelClass = 'admin-modal-label';
  const selectedChipClass = 'inline-flex items-center gap-1.5 rounded-full border border-central-orange/35 bg-white/[.11] px-2.5 py-1 text-[11px] font-black leading-none text-white shadow-sm';
  const suggestionChipClass = 'rounded-sm border border-white/10 bg-[#1d1d1d] px-2.5 py-1 text-[11px] font-bold text-white/84 transition hover:border-central-orange/75 hover:text-white';

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.9fr)]">
        <div className="space-y-3.5">
          <div className="admin-modal-field">
            <label className={fieldLabelClass}>Nombre <span className="text-red-300">*</span></label>
            <Input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} required autoFocus />
          </div>

          <div className="admin-modal-field">
            <label className={fieldLabelClass}>Ingredientes</label>
            <div className="space-y-3">
              <div className="flex min-h-8 flex-wrap items-center gap-1.5">
                {selectedIngredients.length ? selectedIngredients.map((ingredient) => (
                  <button
                    key={ingredient.id}
                    type="button"
                    title={`Quitar ${ingredient.name}`}
                    onClick={() => toggleIngredient(ingredient.id)}
                    className={selectedChipClass}
                  >
                    {ingredient.name}
                    <X size={12} className="text-white/70" />
                  </button>
                )) : (
                  <span className="text-xs font-semibold text-white/40">Seleccioná ingredientes desde las sugerencias.</span>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-white/48">Sugerencias</p>
                <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-1 custom-scrollbar">
                  {suggestedIngredients.map((ingredient) => (
                    <button
                      key={ingredient.id}
                      type="button"
                      title={`Agregar ${ingredient.name}`}
                      onClick={() => toggleIngredient(ingredient.id)}
                      className={suggestionChipClass}
                    >
                      {ingredient.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="admin-modal-field">
            <label className={fieldLabelClass}>Descripción <span className="font-semibold text-white/50">(opcional)</span></label>
            <Textarea
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
              placeholder="Agregá un detalle extra. La descripción también se arma con los ingredientes seleccionados."
              rows={4}
            />
          </div>

          <div className="admin-modal-field">
            <label className={fieldLabelClass}>Precio <span className="text-red-300">*</span></label>
            <Input type="number" min={0} value={values.currentPrice || ''} onChange={(event) => setValues({ ...values, currentPrice: Number(event.target.value) })} placeholder="$" required />
          </div>

          <div className="admin-modal-field">
            <label className={fieldLabelClass}>Categoría <span className="text-red-300">*</span></label>
            <Select
              aria-label="Categoría del producto"
              value={values.categoryId}
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
              onValueChange={(categoryId) => setValues({ ...values, categoryId })}
              placeholder="Seleccionar categoría"
              required
            />
          </div>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="mb-2 block text-sm font-extrabold text-white/86">Imagen</label>
            <label className="grid cursor-pointer place-items-center rounded-sm border border-dashed border-white/12 bg-[#1b1b1b] px-5 py-7 text-center transition hover:border-central-orange/70 hover:bg-central-orange/5">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => handleImageFile(event.target.files?.[0])} />
              <Upload className="text-white/55" size={30} />
              <span className="mt-3 text-sm font-black text-central-orange">Haz clic para subir</span>
              <span className="mt-1 text-xs font-bold uppercase tracking-[.12em] text-white/45">PNG, JPG o GIF (máx. 450 KB)</span>
            </label>
            {imageError ? <p className="mt-2 rounded-sm border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200">{imageError}</p> : null}
          </div>

          <div className="overflow-hidden rounded-sm border border-white/10 bg-black/30">
            <ProductImageMedia
              imageUrl={values.imageUrl}
              productName={values.name || 'Vista previa del producto'}
              categoryName={selectedCategory?.name}
              className="h-44 w-full"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {([
              ['active', 'Activo'],
              ['available', 'Disponible'],
              ['featured', 'Destacado'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 rounded-sm border border-white/10 bg-white/[.04] p-3 text-sm font-bold text-white/85">
                <input
                  type="checkbox"
                  checked={values[key]}
                  onChange={(event) => setValues({ ...values, [key]: event.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
        <Button type="button" variant="dark" className="rounded-sm bg-white/10 hover:bg-white/15" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="rounded-sm" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
}
