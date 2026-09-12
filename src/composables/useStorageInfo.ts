import { ref } from 'vue';

/** Espacio que ocupa PONTIA en el equipo y si el navegador se comprometió a no borrarlo. */
export function useStorageInfo() {
  const usage = ref<number | null>(null);
  const quota = ref<number | null>(null);
  const persisted = ref<boolean | null>(null);

  async function refresh(): Promise<void> {
    if (!navigator.storage?.estimate) return;
    const estimate = await navigator.storage.estimate();
    usage.value = estimate.usage ?? null;
    quota.value = estimate.quota ?? null;
    persisted.value = navigator.storage.persisted ? await navigator.storage.persisted() : null;
  }

  /** Pide almacenamiento persistente; en iPhone ayuda a que el navegador no borre los datos. */
  async function requestPersistence(): Promise<void> {
    if (navigator.storage?.persist) persisted.value = await navigator.storage.persist();
  }

  void refresh();
  return { usage, quota, persisted, refresh, requestPersistence };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
}
