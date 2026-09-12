import { reactive, readonly } from 'vue';

interface UndoOffer {
  id: number;
  message: string;
  action: () => Promise<void> | void;
}

const state = reactive<{ offer: UndoOffer | null }>({ offer: null });
let timer: ReturnType<typeof setTimeout> | undefined;
let sequence = 0;

/** Aviso «Se eliminó … · Deshacer» que se ve unos segundos en la parte inferior. */
export const undoState = readonly(state);

export function offerUndo(message: string, action: () => Promise<void> | void, ms = 8000): void {
  clearTimeout(timer);
  state.offer = { id: ++sequence, message, action };
  timer = setTimeout(dismissUndo, ms);
}

export function dismissUndo(): void {
  clearTimeout(timer);
  state.offer = null;
}

export async function runUndo(): Promise<void> {
  const offer = state.offer;
  dismissUndo();
  await offer?.action();
}
