/**
 * Prepara fotos de cámara para Supabase Storage. La compresión ocurre solo
 * cuando es necesaria y no modifica el archivo original del dispositivo.
 */
const MAX_SOURCE_BYTES = 18 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const OPTIMIZE_FROM_BYTES = 850_000;

function fileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('No se pudo leer la fotografía.'));
    reader.onerror = () => reject(new Error('No se pudo leer la fotografía.'));
    reader.readAsDataURL(file);
  });
}

function estimateBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.ceil(base64.length * 0.75);
}

async function decodeImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('No pudimos abrir esta foto. Probá con JPG, PNG o WEBP.'));
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('La imagen seleccionada no tiene dimensiones válidas.');
    }
    return image;
  } finally {
    // El elemento Image conserva la foto decodificada.
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareProductImage(file: File): Promise<string> {
  const supported = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
  if (!supported.includes(file.type)) {
    throw new Error('Seleccioná una fotografía JPG, PNG o WEBP (también admitimos GIF y HEIC compatibles).');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('La fotografía supera los 18 MB. Elegí una de menor tamaño.');
  }
  if (file.type === 'image/gif') {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error('El GIF supera los 3 MB. Elegí uno más liviano.');
    }
    return fileAsDataUrl(file);
  }

  // Fotos pequeñas se suben sin perder calidad.
  if (file.size <= OPTIMIZE_FROM_BYTES && !['image/heic', 'image/heif'].includes(file.type)) {
    return fileAsDataUrl(file);
  }

  const image = await decodeImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo procesar esta fotografía.');

  const passes = [
    { maxEdge: 1800, quality: 0.83 },
    { maxEdge: 1500, quality: 0.74 },
    { maxEdge: 1280, quality: 0.64 },
    { maxEdge: 1050, quality: 0.55 },
    { maxEdge: 850, quality: 0.5 },
  ];

  for (const pass of passes) {
    const ratio = Math.min(1, pass.maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    let dataUrl = canvas.toDataURL('image/webp', pass.quality);
    if (!dataUrl.startsWith('data:image/webp')) {
      // Alternativa para navegadores sin soporte de exportación WEBP.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      dataUrl = canvas.toDataURL('image/jpeg', pass.quality);
    }
    if (estimateBytes(dataUrl) <= MAX_UPLOAD_BYTES) return dataUrl;
  }

  throw new Error('No se pudo reducir la foto a menos de 3 MB. Probá con otra imagen.');
}
