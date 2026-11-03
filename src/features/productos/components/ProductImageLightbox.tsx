'use client';

import { GalleryLightbox } from '@/features/galeria/components/GalleryLightbox';
import { ProductImageMedia } from './ProductImageMedia';
import { isProductImagePlaceholder } from '../utils/productImage.utils';

interface ProductImageLightboxProps {
  open: boolean;
  imageUrl: string;
  productName: string;
  categoryName?: string;
  onClose: () => void;
}

/** Comparte el visor de galería: zoom táctil, arrastre y controles de zoom. */
export function ProductImageLightbox({ open, imageUrl, productName, categoryName, onClose }: ProductImageLightboxProps) {
  if (!open) return null;

  const hasImage = !isProductImagePlaceholder(imageUrl);

  return (
    <GalleryLightbox
      images={[{ image_url: hasImage ? imageUrl : '', alt_text: productName }]}
      selectedIndex={0}
      title={productName}
      onSelect={() => {}}
      onClose={onClose}
      fallbackImage={hasImage ? undefined : (
        <ProductImageMedia
          imageUrl={imageUrl}
          productName={productName}
          categoryName={categoryName}
          fit="contain"
          className="h-full w-full"
          imageClassName="pointer-events-none select-none"
        />
      )}
    />
  );
}
