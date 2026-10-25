import { ref } from 'vue';
import { getDb } from '@/db/schema';
import { getSettings, saveCopyrightHolder } from '@/db/settings';

/**
 * Titular de los derechos, leído una vez al arrancar y compartido por toda la aplicación.
 * Vive aquí para que el pie de marca no consulte la base de datos en cada pantalla.
 */
const holder = ref<string | undefined>(undefined);
let cargando: Promise<void> | null = null;

async function cargar(): Promise<void> {
  try {
    holder.value = (await getSettings(getDb())).copyrightHolder;
  } catch {
    // Sin base de datos se usa el titular por omisión
  }
}

export function useOwnership() {
  cargando ??= cargar();
  return {
    holder,
    /** Guarda el titular y lo refleja al instante en los pies y en los documentos nuevos. */
    async setHolder(value: string) {
      await saveCopyrightHolder(getDb(), value);
      holder.value = value.trim() || undefined;
    },
  };
}
