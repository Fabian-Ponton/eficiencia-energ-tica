import { inject, onBeforeUnmount, provide, shallowRef, watchEffect, type Component, type InjectionKey, type ShallowRef } from 'vue';

export interface FabAction {
  label: string;
  icon: Component;
  run: () => void;
}

const KEY: InjectionKey<ShallowRef<FabAction | null>> = Symbol('boton-flotante');

/** El diseño del proyecto guarda la acción que hace el botón flotante «+» en cada pantalla. */
export function provideFab(): ShallowRef<FabAction | null> {
  const action = shallowRef<FabAction | null>(null);
  provide(KEY, action);
  return action;
}

/**
 * Mientras la pantalla está abierta, el botón flotante hace esta acción (p. ej. «Agregar equipo»).
 * Con una función, la acción se recalcula al cambiar lo que usa (p. ej. la pestaña activa).
 */
export function useFabAction(action: FabAction | (() => FabAction | null)): void {
  const slot = inject(KEY, null);
  if (!slot) return;
  let current: FabAction | null = null;
  const stop = watchEffect(() => {
    current = typeof action === 'function' ? action() : action;
    slot.value = current;
  });
  onBeforeUnmount(() => {
    stop();
    if (slot.value === current) slot.value = null;
  });
}
