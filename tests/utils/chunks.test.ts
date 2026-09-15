import { describe, expect, it } from 'vitest';
import { isMissingChunkError } from '@/utils/chunks';

describe('pantalla que no se pudo descargar', () => {
  it('reconoce el fallo en cada navegador', () => {
    // Mensajes reales: Chrome y Edge, Safari, Firefox, y los de red
    expect(isMissingChunkError(new Error('Failed to fetch dynamically imported module: https://ejemplo.co/assets/ProjectLayout-a1b2.js'))).toBe(true);
    expect(isMissingChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isMissingChunkError(new Error('error loading dynamically imported module'))).toBe(true);
    // Vite usa este mensaje cuando lo que falta es el archivo de estilos de la pantalla
    expect(isMissingChunkError(new Error('Unable to preload CSS for /assets/ProjectLayout-c3d4.css'))).toBe(true);
    expect(isMissingChunkError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(isMissingChunkError('ChunkLoadError: Loading chunk 12 failed')).toBe(true);
  });

  it('no confunde un error normal de la app con una descarga fallida', () => {
    expect(isMissingChunkError(new Error('No encontramos este proyecto'))).toBe(false);
    expect(isMissingChunkError(new Error('La cantidad debe ser un número entero desde 1.'))).toBe(false);
    expect(isMissingChunkError(undefined)).toBe(false);
  });
});
