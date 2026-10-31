import { NextResponse } from 'next/server';
import { getPublicGalleryServer } from '@/features/galeria/services/gallery.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const gallery = await getPublicGalleryServer();
    return NextResponse.json(gallery, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('No se pudo consultar la galería pública:', error);
    return NextResponse.json({ error: 'Galería temporalmente no disponible.' }, {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  }
}
