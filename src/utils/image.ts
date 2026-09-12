export interface CompressedImage {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

/** Tamaño que conserva la proporción sin pasar de `maxSide` en el lado mayor (nunca agranda). */
export function fittedSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

interface Decoded {
  image: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

/** Decodifica la foto respetando la orientación EXIF, para que las fotos del celular no queden giradas. */
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Algunos Safari no decodifican con createImageBitmap: se intenta con <img>
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('No se pudo leer la imagen. Usa una foto en JPG o PNG.');
  }
  return { image: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

type Painter = CanvasDrawImage & CanvasFillStrokeStyles & CanvasRect & CanvasImageSmoothing;

function paint(ctx: Painter | null, source: CanvasImageSource, width: number, height: number) {
  if (!ctx) throw new Error('Este navegador no permite procesar imágenes.');
  // Las transparencias de un PNG quedarían negras en el JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
}

async function toJpeg(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    paint(canvas.getContext('2d'), source, width, height);
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), source, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la foto.'))), 'image/jpeg', quality),
  );
}

/**
 * Reduce la foto de la cámara (varios MB) a un JPEG de 1600 px como máximo y una miniatura de 320 px.
 * Al volver a codificar también se descartan los metadatos EXIF (incluida la ubicación).
 */
export async function compressImage(file: Blob, { maxSide = 1600, quality = 0.8, thumbSide = 320 } = {}): Promise<CompressedImage> {
  const decoded = await decode(file);
  try {
    const main = fittedSize(decoded.width, decoded.height, maxSide);
    const small = fittedSize(decoded.width, decoded.height, thumbSide);
    // Una a la vez para no duplicar la memoria en celulares modestos
    const blob = await toJpeg(decoded.image, main.width, main.height, quality);
    const thumb = await toJpeg(decoded.image, small.width, small.height, 0.72);
    return { blob, thumb, width: main.width, height: main.height };
  } finally {
    decoded.release();
  }
}
