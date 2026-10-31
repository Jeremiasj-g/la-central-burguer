import { HomePage } from '@/features/home/pages/HomePage';
import { getPublicGalleryServer } from '@/features/galeria/services/gallery.server';
import type { GalleryState } from '@/features/galeria/services/gallery.service';

// La galería puede cambiar desde Configuración sin volver a desplegar la web.
export const dynamic = 'force-dynamic';

export default async function Page() {
  let initialGallery: GalleryState | null = null;
  try {
    initialGallery = await getPublicGalleryServer();
  } catch (error) {
    // Un problema momentáneo con Supabase no debe impedir abrir el menú.
    console.error('No se pudo cargar la galería inicial:', error);
  }
  return <HomePage initialGallery={initialGallery} />;
}
