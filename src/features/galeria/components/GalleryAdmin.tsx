'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Images, LoaderCircle, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import {
  MAX_GALLERY_IMAGES, deleteGalleryImage, getAdminGallery, reorderGalleryImages, saveGalleryAlt,
  setGalleryEnabled, uploadGalleryImages, type GalleryImage, type GalleryState,
} from '../services/gallery.service';

export function GalleryAdmin() {
  const [state, setState] = useState<GalleryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<GalleryImage | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try { setState(await getAdminGallery()); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cargar la galería.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function toggle(enabled: boolean) {
    if (!state || busy) return;
    if (enabled && state.images.length === 0) { toast.info('Subí al menos una imagen antes de publicar la galería.'); return; }
    setBusy(true);
    try { await setGalleryEnabled(enabled); setState({ ...state, enabled }); toast.success(enabled ? 'Galería visible en la web.' : 'Galería oculta en la web.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cambiar la visibilidad.'); }
    finally { setBusy(false); }
  }

  async function upload(files: FileList | null) {
    if (!files?.length || !state || busy) return;
    setBusy(true);
    try { await uploadGalleryImages(Array.from(files), state.images.length); await reload(); toast.success('Fotografías agregadas.'); }
    catch (error) { await reload(); toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las imágenes.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!state || busy) return;
    const next = [...state.images];
    const to = index + direction;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    setBusy(true);
    try { await reorderGalleryImages(next); setState({ ...state, images: next }); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo reordenar.'); await reload(); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!target || busy) return;
    setBusy(true);
    try { await deleteGalleryImage(target); setTarget(null); await reload(); toast.success('Fotografía eliminada.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo eliminar.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-4 min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.035)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-orange-50 text-central-orange"><Images size={19}/></div>
          <div><h2 className="text-[16px] font-semibold tracking-tight text-neutral-900">Galería de la página</h2>
            <p className="mt-1 max-w-xl text-[12px] leading-5 text-neutral-500">Fotos entre el inicio y el menú. Al desactivarla, el sitio vuelve a su diseño habitual sin ocupar espacio.</p></div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-neutral-200 bg-[#f8f8fa] px-3 py-2.5">
          <span className="text-[12px] font-medium text-neutral-700">{state?.enabled ? 'Visible' : 'Oculta'}</span>
          <input type="checkbox" role="switch" aria-label="Mostrar galería en la web" className="peer sr-only" checked={state?.enabled ?? false} disabled={busy || loading || !state} onChange={e => void toggle(e.target.checked)} />
          <span aria-hidden="true" className="relative h-6 w-11 rounded-full bg-neutral-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-central-orange peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-central-orange/30"/>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-5">
        <p className="text-[12px] text-neutral-500">{loading ? 'Cargando…' : `${state?.images.length ?? 0} de ${MAX_GALLERY_IMAGES} fotografías`}</p>
        <button type="button" disabled={busy || !state || state.images.length >= MAX_GALLERY_IMAGES} onClick={() => input.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-[11px] bg-central-orange px-3 text-[12px] font-semibold text-white transition-opacity disabled:opacity-40">
          {busy ? <LoaderCircle size={16} className="animate-spin"/> : <ImagePlus size={16}/>} Agregar fotos
        </button>
        <input ref={input} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e => void upload(e.target.files)} />
      </div>
      {!loading && state?.images.length === 0 ? (
        <div className="mt-4 rounded-[14px] border border-dashed border-neutral-200 bg-[#fafafa] px-5 py-9 text-center text-[13px] text-neutral-500">Todavía no hay fotos. Agregá imágenes y luego activá el switch.</div>
      ) : null}
      {state?.images.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state.images.map((image, index) => (
            <article key={image.id} className="min-w-0 overflow-hidden rounded-[15px] border border-neutral-200 bg-[#fafafa]">
              <img src={image.image_url} alt={image.alt_text || 'Vista previa de galería'} loading="lazy" className="h-36 w-full object-cover" />
              <div className="space-y-2.5 p-3">
                <label className="block text-[11px] font-medium text-neutral-500">Descripción de la foto
                  <input maxLength={160} defaultValue={image.alt_text} key={image.id + image.alt_text} disabled={busy} onBlur={async e => {
                    if (e.target.value.trim() === image.alt_text) return;
                    try { await saveGalleryAlt(image.id, e.target.value); await reload(); }
                    catch { toast.error('No se pudo guardar la descripción.'); }
                  }} placeholder="Ej.: Hamburguesa completa" className="mt-1.5 block h-9 w-full rounded-[10px] border border-neutral-200 bg-white px-3 text-[12px] text-neutral-800 outline-none focus:border-central-orange" />
                </label>
                <div className="flex justify-between gap-2">
                  <div className="flex gap-1.5">
                    <button type="button" title="Mover hacia el comienzo" aria-label="Mover foto a la izquierda" disabled={busy || index===0} onClick={() => void move(index,-1)} className="grid h-8 w-8 place-items-center rounded-[9px] border border-neutral-200 bg-white text-neutral-600 disabled:opacity-30"><ArrowUp size={15}/></button>
                    <button type="button" title="Mover hacia el final" aria-label="Mover foto a la derecha" disabled={busy || index===state.images.length-1} onClick={() => void move(index,1)} className="grid h-8 w-8 place-items-center rounded-[9px] border border-neutral-200 bg-white text-neutral-600 disabled:opacity-30"><ArrowDown size={15}/></button>
                  </div>
                  <button type="button" disabled={busy} onClick={() => setTarget(image)} className="inline-flex items-center gap-1.5 rounded-[9px] px-2 text-[11px] font-medium text-red-600 hover:bg-red-50"><Trash2 size={14}/> Eliminar</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      <p className="mt-4 text-[11px] text-neutral-400">Imágenes JPG, PNG o WEBP · Máximo 4 MB por archivo · Ordená con las flechas.</p>
      <ConfirmDialog open={Boolean(target)} title="Eliminar fotografía" description="La imagen desaparecerá de la galería pública. Esta acción no se puede deshacer." confirmLabel="Eliminar" tone="danger" theme="light" isLoading={busy} onConfirm={remove} onCancel={() => setTarget(null)}/>
    </section>
  );
}
