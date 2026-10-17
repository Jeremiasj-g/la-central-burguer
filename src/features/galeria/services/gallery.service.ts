import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { createSharedRealtimeSubscription } from '@/lib/supabase/realtime-subscription';

const BUCKET = 'gallery-images';
export const MAX_GALLERY_IMAGES = 12;
export type GalleryImage = { id: string; image_url: string; image_path: string; alt_text: string; display_order: number; created_at: string };
export type GalleryState = { enabled: boolean; images: GalleryImage[] };

export async function getGalleryState(): Promise<GalleryState> {
  const db = getSupabaseBrowserClient();
  const { data: settings, error: settingsError } = await db.from('gallery_settings').select('enabled').eq('id', 1).single();
  if (settingsError) throw settingsError;
  if (!settings?.enabled) return { enabled: false, images: [] };
  const { data, error } = await db.from('gallery_images').select('*').order('display_order').order('created_at');
  if (error) throw error;
  return { enabled: true, images: data ?? [] };
}

export async function getAdminGallery(): Promise<GalleryState> {
  const db = getSupabaseBrowserClient();
  const [settings, images] = await Promise.all([
    db.from('gallery_settings').select('enabled').eq('id', 1).single(),
    db.from('gallery_images').select('*').order('display_order').order('created_at'),
  ]);
  if (settings.error) throw settings.error;
  if (images.error) throw images.error;
  return { enabled: settings.data?.enabled ?? false, images: images.data ?? [] };
}

export async function setGalleryEnabled(enabled: boolean): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from('gallery_settings')
    .update({ enabled, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) throw error;
}

export async function uploadGalleryImages(files: File[], currentCount: number): Promise<void> {
  if (currentCount + files.length > MAX_GALLERY_IMAGES) throw new Error('La galería admite hasta 12 fotografías.');
  const db = getSupabaseBrowserClient();
  for (const [i, file] of files.entries()) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Solo se permiten imágenes JPG, PNG o WEBP.');
    if (file.size > 4 * 1024 * 1024) throw new Error('Cada imagen debe pesar menos de 4 MB.');
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `gallery/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (uploadError) throw uploadError;
    const image_url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { error } = await db.from('gallery_images').insert({ image_url, image_path: path, display_order: currentCount + i, alt_text: '' });
    if (error) {
      await db.storage.from(BUCKET).remove([path]);
      throw error;
    }
  }
}

export async function deleteGalleryImage(image: GalleryImage): Promise<void> {
  const db = getSupabaseBrowserClient();
  const { error } = await db.from('gallery_images').delete().eq('id', image.id);
  if (error) throw error;
  // El registro se elimina primero para evitar una fotografía rota en la galería.
  const { error: storageError } = await db.storage.from(BUCKET).remove([image.image_path]);
  if (storageError) console.warn('No se pudo limpiar la imagen de Storage:', storageError.message);
}

export async function saveGalleryAlt(id: string, alt_text: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from('gallery_images')
    .update({ alt_text: alt_text.trim().slice(0, 160) }).eq('id', id);
  if (error) throw error;
}

export async function reorderGalleryImages(images: GalleryImage[]): Promise<void> {
  const db = getSupabaseBrowserClient();
  for (const [index, image] of images.entries()) {
    const { error } = await db.from('gallery_images').update({ display_order: index }).eq('id', image.id);
    if (error) throw error;
  }
}

const subscribe = createSharedRealtimeSubscription('gallery-public', (channel, notify) =>
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_settings' }, notify)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_images' }, notify));

export function subscribeGallery(onChange: () => void): () => void {
  return subscribe(onChange);
}
