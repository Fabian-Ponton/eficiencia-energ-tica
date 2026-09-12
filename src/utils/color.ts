const channel = (value: number): number => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Blanco o tinta según cuál contraste mejor con el color de fondo (etiquetas dentro de barras). */
export function readableTextOn(backgroundHex: string, ink = '#0f1b33'): string {
  const bg = relativeLuminance(backgroundHex);
  return contrast(bg, 1) >= contrast(bg, relativeLuminance(ink)) ? '#ffffff' : ink;
}
