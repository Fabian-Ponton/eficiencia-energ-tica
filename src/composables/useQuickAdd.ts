import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/**
 * Abre el formulario al llegar desde el menú rápido «+» (la ruta trae `?nuevo`),
 * también si la pantalla ya estaba abierta.
 */
export function useQuickAdd(open: () => void): void {
  const route = useRoute();
  const router = useRouter();
  watch(
    () => route.query.nuevo,
    (value) => {
      if (value === undefined) return;
      open();
      void router.replace({ query: { ...route.query, nuevo: undefined } });
    },
    { immediate: true },
  );
}
