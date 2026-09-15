import { ref } from 'vue';

/**
 * Cada pantalla de PONTIA se descarga en su propio archivo. Si el archivo no llega —copia incompleta
 * en el equipo, sin conexión o una versión recién publicada—, el navegador lanza uno de estos mensajes
 * y la pantalla no abriría. Cada navegador lo dice a su manera.
 */
const MENSAJES =
  /dynamically imported module|Importing a module script failed|error loading dynamically|Unable to preload CSS|Failed to fetch|NetworkError|ChunkLoadError/i;

export const isMissingChunkError = (error: unknown): boolean => MENSAJES.test(error instanceof Error ? error.message : String(error));

/** Se enciende cuando una pantalla no llegó ni siquiera tras recargar; la app lo avisa al usuario. */
export const missingChunk = ref(false);

const REINTENTO = 'pontia:recargar-pantalla';
const seIntento = () => {
  try {
    return sessionStorage.getItem(REINTENTO) !== null;
  } catch {
    return false;
  }
};

/** Al abrir bien una pantalla se borra la marca del intento anterior. */
export function forgetMissingChunk(): void {
  try {
    sessionStorage.removeItem(REINTENTO);
  } catch {
    // Sin almacenamiento de sesión no hay nada que limpiar
  }
}

/**
 * Recarga la app una sola vez para traer los archivos que falten y seguir donde iba el usuario.
 * Si ya se recargó y el archivo sigue sin llegar, enciende el aviso en lugar de recargar en bucle.
 */
export function recoverMissingChunk(path?: string): void {
  if (seIntento()) {
    missingChunk.value = true;
    return;
  }
  try {
    sessionStorage.setItem(REINTENTO, path ?? window.location.hash);
  } catch {
    // Sin almacenamiento de sesión se recarga igual: la marca evita el bucle solo cuando existe
  }
  if (path) window.location.hash = path;
  window.location.reload();
}
