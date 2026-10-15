'use client';

import { CheckCircle2, ImagePlus, Package, Plus, Search, Star, Upload, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import type { Product } from '../types/producto.types';
import type { Category } from '@/features/categorias/types/categoria.types';
import type { Ingredient } from '@/features/ingredientes/types/ingrediente.types';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { Textarea } from '@/shared/components/ui/Textarea';
import { ProductImageMedia } from './ProductImageMedia';
import { formatCurrency } from '@/shared/utils/format.utils';

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
  const fieldClass = '!h-11 !w-full !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !px-3 !text-[13px] !font-normal !text-neutral-900 !shadow-none placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white focus:!ring-central-orange/10';
  const selectedChipClass = 'group inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-central-orange/25 bg-central-orange/[.09] px-2.5 py-1 text-[11px] font-medium leading-none text-central-ember transition-[border-color,background-color,transform] duration-200 hover:border-central-orange/45 hover:bg-central-orange/15 active:scale-[.98]';
  const suggestionChipClass = 'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium leading-none text-neutral-600 transition-[border-color,background-color,color,transform] duration-200 hover:border-central-orange/40 hover:bg-central-orange/[.06] hover:text-central-ember active:scale-[.98]';
  const composedDescription = buildProductDescription();

  return (
    <form onSubmit={handleSubmit} className="product-create-workspace min-w-0">
      <div className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-[16px] border border-neutral-200/70 bg-[#f8f8f9] px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-[-.015em] text-neutral-900">
            {product ? 'Actualizá la información de tu producto' : 'Configurá tu nuevo producto'}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-neutral-500">
            Completá los datos, elegí los ingredientes y revisá cómo quedará publicado.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[10px] font-medium text-neutral-500">
          <span className="text-red-500">*</span> Campos obligatorios
        </span>
      </div>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,.88fr)] lg:gap-5">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="product-essential-heading" className="min-w-0 rounded-[18px] border border-neutral-200/80 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-central-orange/10 text-[12px] font-semibold tabular-nums text-central-ember">01</span>
              <div className="min-w-0">
                <h3 id="product-essential-heading" className="text-[14px] font-semibold tracking-[-.02em] text-neutral-950">Información principal</h3>
                <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">Identificá el producto, asignale su categoría y precio.</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label htmlFor="product-name" className={labelClass}>Nombre del producto <span className="text-red-500">*</span></label>
                <Input id="product-name" className={fieldClass} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} placeholder="Ej. Hamburguesa clásica" required />
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <span className={labelClass}>Categoría <span className="text-red-500">*</span></span>
                  <Select
                    aria-label="Categoría del producto"
                    variant="light"
                    value={values.categoryId}
                    options={categories.map((category) => ({ value: category.id, label: category.name }))}
                    onValueChange={(categoryId) => setValues({ ...values, categoryId })}
                    placeholder="Seleccionar categoría"
                    className="!h-11 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !text-[12px] !font-normal !shadow-none"
                    contentClassName="!rounded-[13px]"
                    required
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="product-price" className={labelClass}>Precio de venta <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium text-neutral-400">$</span>
                    <Input id="product-price" className={`${fieldClass} !pl-8`} type="number" min={0} step="any" inputMode="decimal" value={values.currentPrice || ''} onChange={(event) => setValues({ ...values, currentPrice: Number(event.target.value) })} placeholder="0,00" required />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="product-ingredients-heading" className="min-w-0 rounded-[18px] border border-neutral-200/80 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-central-orange/10 text-[12px] font-semibold tabular-nums text-central-ember">02</span>
              <div className="min-w-0 flex-1">
                <h3 id="product-ingredients-heading" className="text-[14px] font-semibold tracking-[-.02em] text-neutral-950">Composición del producto</h3>
                <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">Elegí sus ingredientes. Podés agregarlos o quitarlos en cualquier momento.</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#f7f7f9] px-2.5 py-1 text-[10px] font-medium tabular-nums text-neutral-500">
                {selectedIngredients.length} elegidos
              </span>
            </div>

            <div className="min-w-0 rounded-[13px] border border-neutral-200/75 bg-[#fafafa] p-3 sm:p-3.5">
              <p className="mb-2 text-[11px] font-medium text-neutral-600">Ingredientes seleccionados</p>
              <div className="flex min-h-9 flex-wrap items-center gap-1.5" aria-label="Ingredientes seleccionados">
                {selectedIngredients.length > 0 ? selectedIngredients.map((ingredient) => (
                  <button key={ingredient.id} type="button" title={`Quitar ${ingredient.name}`} aria-label={`Quitar ${ingredient.name}`} className={selectedChipClass} onClick={() => toggleIngredient(ingredient.id)}>
                    {ingredient.name}
                    <X size={13} strokeWidth={1.8} className="opacity-65 transition-opacity duration-200 group-hover:opacity-100" />
                  </button>
                )) : (
                  <p className="py-1 text-[11px] leading-4 text-neutral-400">Todavía no agregaste ingredientes.</p>
                )}
              </div>
            </div>

            <div className="mt-4 min-w-0">
              <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                <label htmlFor="ingredient-product-search" className="text-[11px] font-medium text-neutral-600">Agregar ingredientes</label>
                <span className="text-[10px] tabular-nums text-neutral-400">{filteredIngredients.length} disponibles</span>
              </div>
              <div className="relative">
                <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="ingredient-product-search"
                  type="search"
                  className={`${fieldClass} !h-10 !pl-9`}
                  value={ingredientSearch}
                  onChange={(event) => setIngredientSearch(event.target.value)}
                  placeholder="Buscar ingrediente por nombre"
                  autoComplete="off"
                />
              </div>
              <div className="custom-scrollbar mt-2.5 max-h-40 min-h-14 overflow-y-auto rounded-[13px] border border-neutral-200/75 bg-[#fafafa] p-3">
                {filteredIngredients.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {filteredIngredients.map((ingredient) => (
                      <button key={ingredient.id} type="button" title={`Agregar ${ingredient.name}`} aria-label={`Agregar ${ingredient.name}`} className={suggestionChipClass} onClick={() => toggleIngredient(ingredient.id)}>
                        <Plus size={12} strokeWidth={2} className="text-central-orange" />
                        {ingredient.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="py-2 text-center text-[11px] leading-5 text-neutral-400">
                    {ingredientSearch.trim() ? 'No encontramos ingredientes con ese nombre.' : 'Ya seleccionaste todos los ingredientes disponibles.'}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby="product-description-heading" className="min-w-0 rounded-[18px] border border-neutral-200/80 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-central-orange/10 text-[12px] font-semibold tabular-nums text-central-ember">03</span>
              <div className="min-w-0">
                <h3 id="product-description-heading" className="text-[14px] font-semibold tracking-[-.02em] text-neutral-950">Descripción para el cliente</h3>
                <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">Los ingredientes se integran automáticamente cuando guardás.</p>
              </div>
            </div>
            <label htmlFor="product-description" className={labelClass}>Detalle adicional <span className="text-neutral-400">(opcional)</span></label>
            <Textarea
              id="product-description"
              className="!min-h-24 !w-full !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !px-3 !py-2.5 !text-[13px] !font-normal !text-neutral-900 placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white focus:!ring-central-orange/10"
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
              placeholder="Ej. Con nuestra salsa especial y pan artesanal."
              rows={3}
            />
            <div className="mt-3 rounded-[12px] border border-central-orange/10 bg-central-orange/[.045] px-3 py-3" aria-live="polite">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-central-ember">
                <CheckCircle2 size={13} strokeWidth={1.8} /> Vista previa de la descripción
              </div>
              <p className="mt-1.5 break-words text-[12px] leading-5 text-neutral-600">
                {composedDescription || 'Acá verás el texto final cuando agregues ingredientes o una descripción.'}
              </p>
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-5 lg:sticky lg:top-0 lg:self-start">
          <section aria-labelledby="product-image-heading" className="min-w-0 overflow-hidden rounded-[18px] border border-neutral-200/80 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-central-orange/10 text-[12px] font-semibold tabular-nums text-central-ember">04</span>
              <div>
                <h3 id="product-image-heading" className="text-[14px] font-semibold tracking-[-.02em] text-neutral-950">Presentación e imagen</h3>
                <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">Comprobá visualmente cómo se presenta el producto.</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[14px] border border-neutral-200/80 bg-[#191b20]">
              <ProductImageMedia
                imageUrl={values.imageUrl}
                productName={values.name || 'Vista previa del producto'}
                categoryName={selectedCategory?.name}
                className="h-40 w-full sm:h-44 lg:h-[155px]"
              />
              <div className="px-3.5 py-3.5 text-white">
                <p className="truncate text-[10px] font-medium text-white/45">{selectedCategory?.name || 'Sin categoría'}</p>
                <div className="mt-1 flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 break-words text-[14px] font-semibold leading-5 tracking-[-.025em]">{values.name.trim() || 'Nombre del producto'}</p>
                  <span className="shrink-0 whitespace-nowrap text-[14px] font-semibold tabular-nums text-[#f6b762]">{formatCurrency(values.currentPrice)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {values.featured ? <span className="inline-flex items-center gap-1 rounded-full bg-central-orange/15 px-2 py-0.5 text-[10px] font-medium text-[#f6b762]"><Star size={10} className="fill-current" /> Destacado</span> : null}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${values.active && values.available ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-white/60'}`}>
                    {values.active && values.available ? 'Activo y disponible' : 'No disponible para pedir'}
                  </span>
                </div>
              </div>
            </div>

            <label
              className="mt-3 flex cursor-pointer items-center gap-3 rounded-[12px] border border-dashed border-neutral-300 bg-[#f8f8f9] px-3 py-3 transition-[border-color,background-color] duration-200 hover:border-central-orange/45 hover:bg-central-orange/[.04] focus-within:border-central-orange/45 focus-within:ring-2 focus-within:ring-central-orange/10"
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
              onDrop={(event) => { event.preventDefault(); handleImageFile(event.dataTransfer.files?.[0]); }}
            >
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Seleccionar imagen del producto" onChange={(event) => handleImageFile(event.target.files?.[0])} />
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-white text-neutral-500 shadow-[0_1px_3px_rgba(17,16,15,.06)]"><ImagePlus size={19} strokeWidth={1.8} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-neutral-800">Cambiar imagen</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-neutral-500">Elegí un archivo o arrastralo acá.</span>
                <span className="block text-[10px] text-neutral-400">PNG, JPG, WEBP o GIF · máx. 450 KB</span>
              </span>
              <Upload size={15} strokeWidth={1.8} className="shrink-0 text-neutral-400" />
            </label>
            {imageError ? <p role="alert" className="mt-2 rounded-[11px] border border-red-200/80 bg-red-50 px-3 py-2 text-[11px] leading-5 text-red-600">{imageError}</p> : null}
          </section>

          <section aria-labelledby="product-publish-heading" className="min-w-0 rounded-[18px] border border-neutral-200/80 bg-white p-4 sm:p-5">
            <div className="mb-3 flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-central-orange/10 text-[12px] font-semibold tabular-nums text-central-ember">05</span>
              <div>
                <h3 id="product-publish-heading" className="text-[14px] font-semibold tracking-[-.02em] text-neutral-950">Disponibilidad y visibilidad</h3>
                <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">Definí el estado inicial de tu producto.</p>
              </div>
            </div>
            <div className="divide-y divide-neutral-100">
              {([
                ['active', 'Producto activo', 'Habilitado en el catálogo'],
                ['available', 'Disponible para pedir', 'Se puede solicitar desde el menú'],
                ['featured', 'Destacado', 'Se muestra como recomendado'],
              ] as const).map(([key, label, description]) => (
                <label key={key} className="flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-[10px] px-1 py-3 transition-colors duration-200 hover:bg-[#fafafa]">
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium text-neutral-800">{label}</span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-neutral-500">{description}</span>
                  </span>
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
      </div>

      <div className="sticky bottom-[-14px] z-20 -mx-3.5 -mb-3.5 mt-6 flex flex-col-reverse gap-2 border-t border-neutral-200/80 bg-white/95 px-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:bottom-[-16px] sm:-mx-5 sm:-mb-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pb-[calc(16px+env(safe-area-inset-bottom))]">
        <p className="hidden text-[11px] leading-4 text-neutral-400 sm:block">Revisá los datos antes de continuar.</p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="secondary" className="!h-10 !rounded-[11px] !border-neutral-200 !bg-[#f7f7f9] !px-4 !text-[12px] !font-medium !text-neutral-600 !shadow-none transition-colors duration-200 hover:!bg-neutral-100" onClick={onCancel} disabled={isSaving}>Cancelar</Button>
          <Button type="submit" className="!h-10 !rounded-[11px] !bg-[#191b20] !px-4 !text-[12px] !font-medium !shadow-none transition-colors duration-200 hover:!bg-neutral-700" disabled={isSaving}>
            {isSaving ? 'Guardando...' : product ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      </div>
    </form>
  );
}
