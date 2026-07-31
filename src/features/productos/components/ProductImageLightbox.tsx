'use client';

import { Modal } from '@/shared/components/ui/Modal';
import { ProductImageMedia } from './ProductImageMedia';

interface ProductImageLightboxProps {
  open: boolean;
  imageUrl: string;
  productName: string;
  categoryName?: string;
  onClose: () => void;
}

export function ProductImageLightbox({ open, imageUrl, productName, categoryName, onClose }: ProductImageLightboxProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={productName}
      theme="dark"
      size="xl"
      panelClassName="border-central-orange/30 bg-[#11100f] text-central-cream"
    >
      <div className="flex min-h-[240px] w-full items-center justify-center overflow-hidden rounded-sm border border-central-orange/20 bg-black p-1.5 sm:min-h-[360px] sm:p-2">
        <ProductImageMedia
          imageUrl={imageUrl}
          productName={productName}
          categoryName={categoryName}
          fit="contain"
          className="min-h-[240px] max-h-[calc(100dvh-10rem)] w-full sm:min-h-[360px]"
          imageClassName="max-h-[calc(100dvh-10rem)]"
        />
      </div>
      <p className="mt-2 text-center text-[11px] font-medium text-central-cream/45 sm:text-xs">
        Tocá fuera de la imagen o usá la cruz para cerrar.
      </p>
    </Modal>
  );
}
