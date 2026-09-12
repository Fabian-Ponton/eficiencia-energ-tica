import { liveQuery } from 'dexie';
import { onScopeDispose, shallowRef, watch, type Ref, type WatchSource } from 'vue';

/** Consulta a la base local que se actualiza sola cuando cambian los datos consultados. */
export function useLiveQuery<T>(query: () => T | Promise<T>, deps: WatchSource[] = [], initial?: T): Readonly<Ref<T | undefined>> {
  const value = shallowRef<T | undefined>(initial);
  let subscription: { unsubscribe(): void } | undefined;
  watch(
    deps,
    () => {
      subscription?.unsubscribe();
      subscription = liveQuery(query).subscribe({
        next: (result) => {
          value.value = result;
        },
        error: (error: unknown) => console.error('Error al leer la base local', error),
      });
    },
    { immediate: true },
  );
  onScopeDispose(() => subscription?.unsubscribe());
  return value;
}
