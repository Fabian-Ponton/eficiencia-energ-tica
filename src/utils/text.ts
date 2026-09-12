/** «AC-A601-01» → «AC-A601-02»; si el código no termina en número, agrega «-2». */
export function incrementCode(code: string | undefined): string | undefined {
  if (!code) return code;
  const match = /^(.*?)(\d+)$/.exec(code);
  if (!match) return `${code}-2`;
  return match[1] + String(Number(match[2]) + 1).padStart(match[2].length, '0');
}

/** Compara textos sin tildes ni mayúsculas, para los buscadores. */
export const normalizeText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/** «Hospital San José · Sede 2» → «hospital-san-jose-sede-2», para nombres de archivo. */
export const fileSlug = (text: string, max = 48): string =>
  normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, max)
    .replace(/-+$/, '') || 'proyecto';
