/**
 * Titularidad de PONTIA: el aviso de derechos que acompaña a la aplicación y a todo lo que sale de ella
 * (informes en Word, formatos en Excel, gráficas en PNG y respaldos .zip).
 *
 * El titular se puede cambiar en Ajustes → Titular de los derechos; mientras no se cambie se usa `DEFAULT_HOLDER`.
 * Las ideas no se protegen, pero sí su expresión: el código, los textos, el diseño y los formatos de esta aplicación.
 */

/** Titular por omisión. El auditor puede cambiarlo en Ajustes si la obra pertenece a otra persona o a una empresa. */
export const DEFAULT_HOLDER = 'Fabián Pontón';

/** Nombre de la obra. */
export const APP_NAME = 'PONTIA';

/** Año en que se publicó la primera versión; el aviso muestra «2026» o «2026–2028» cuando pasan los años. */
export const FIRST_YEAR = 2026;

const holderOf = (holder?: string) => holder?.trim() || DEFAULT_HOLDER;

/** «2026» o «2026–2028». */
export function copyrightYears(now = new Date()): string {
  const year = now.getFullYear();
  return year > FIRST_YEAR ? `${FIRST_YEAR}–${year}` : String(FIRST_YEAR);
}

/** «© 2026 Fabián Pontón · PONTIA» para el pie de pantalla, donde el espacio manda. */
export function copyrightShort(holder?: string, now = new Date()): string {
  return `© ${copyrightYears(now)} ${holderOf(holder)} · ${APP_NAME}`;
}

/** «© 2026 Fabián Pontón · PONTIA. Todos los derechos reservados.» */
export function copyrightLine(holder?: string, now = new Date()): string {
  return `${copyrightShort(holder, now)}. Todos los derechos reservados.`;
}

/** Pie de los documentos que genera la aplicación. */
export function documentNotice(holder?: string, now = new Date()): string {
  return `Elaborado con ${APP_NAME}, plataforma de auditoría y eficiencia energética. ${copyrightLine(holder, now)}`;
}

/** Aviso largo: va en la portada de los informes, en la guía de los formatos y dentro del respaldo. */
export function ownershipNotice(holder?: string, now = new Date()): string {
  return (
    `${copyrightLine(holder, now)} ${APP_NAME} y sus formatos, textos, informes y diseño son obra protegida por el derecho de autor ` +
    `(Ley 23 de 1982 y Decisión Andina 351 de 1993). Se entregan al cliente para el uso propio de esta auditoría. ` +
    `Queda prohibida su reproducción, modificación, distribución o uso comercial sin autorización escrita del titular.`
  );
}

/** Lo que se muestra en la pantalla de entrada, antes de dejar pasar a la aplicación. */
export const ACCESS_TERMS: readonly string[] = [
  'Esta herramienta y todo lo que produce son propiedad de su titular. El acceso es personal y autorizado.',
  'No está permitido copiar, reproducir, modificar ni distribuir la aplicación, sus formatos, sus textos ni sus informes sin autorización escrita.',
  'La información de las auditorías se guarda únicamente en este equipo. Quien entra se hace responsable de su uso y de su confidencialidad.',
];
