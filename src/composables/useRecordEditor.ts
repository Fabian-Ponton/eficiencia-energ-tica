import { useToast } from 'primevue/usetoast';
import { computed, ref, toRaw, watch, type Ref } from 'vue';
import { discardPhotos, restoreRecords, saveRecord, softDeleteRecords, type Draft, type RecordTable, type RecordTables } from '@/db/records';
import { getDb } from '@/db/schema';
import type { EntityType } from '@/domain/types';
import { offerUndo } from './useUndo';

export type FieldErrors = Partial<Record<string, string>>;

export interface RecordEditorOptions<T> {
  /** Borrador vacío con un identificador nuevo. */
  empty: () => Draft<T>;
  /** Errores por campo; vacío si el borrador se puede guardar. */
  validate?: (draft: Draft<T>) => FieldErrors;
  /** Nombre corto del registro para los avisos, p. ej. «Aula 601». */
  describe: (draft: Draft<T>) => string;
  /** Vínculo de sus fotos: se descartan si se cierra sin guardar un registro nuevo. */
  photoEntity?: EntityType;
  /** Últimos ajustes antes de guardar. */
  prepare?: (draft: Draft<T>) => Draft<T>;
  /** Cómo queda la copia de «Guardar y duplicar». */
  duplicate?: (draft: Draft<T>) => Draft<T>;
}

const idOf = (record: object): string => (record as { id: string }).id;

/** Estado de la hoja para crear, editar, duplicar y eliminar registros de una tabla. */
// NoInfer: la tabla define el tipo y las opciones se revisan contra él (así 'bueno' queda como Condition y no como texto)
export function useRecordEditor<K extends RecordTable>(table: K, options: NoInfer<RecordEditorOptions<RecordTables[K]>>) {
  type D = Draft<RecordTables[K]>;
  const db = getDb();
  const toast = useToast();
  const visible = ref(false);
  const draft = ref(options.empty()) as Ref<D>;
  const isNew = ref(true);
  const submitted = ref(false);
  const saving = ref(false);
  let saved = false;

  const errors = computed<FieldErrors>(() => (submitted.value && options.validate ? options.validate(draft.value) : {}));

  /** Copia editable: el formulario nunca modifica el registro que muestra la lista. */
  function editable(record: RecordTables[K] | D): D {
    const copy = structuredClone(toRaw(record)) as Partial<RecordTables[K]>;
    delete copy.updatedAt;
    delete copy.deletedAt;
    return copy as unknown as D;
  }

  function open(next: D, asNew: boolean) {
    draft.value = next;
    isNew.value = asNew;
    submitted.value = false;
    saved = false;
    visible.value = true;
  }

  const openNew = (prefill: Partial<D> = {}) => open({ ...options.empty(), ...prefill }, true);
  const openEdit = (record: RecordTables[K]) => open(editable(record), false);

  /** Copia un registro con un identificador nuevo y sin fotos. */
  function openDuplicate(record: RecordTables[K] | D) {
    const copy = editable(record) as Partial<D>;
    delete copy.createdAt;
    const next = { ...copy, id: crypto.randomUUID() } as D;
    open(options.duplicate ? options.duplicate(next) : next, true);
  }

  async function save(): Promise<D | null> {
    submitted.value = true;
    const problem = Object.values(options.validate?.(draft.value) ?? {}).find(Boolean);
    if (problem) {
      toast.add({ severity: 'warn', summary: 'Revisa el formulario', detail: problem, life: 3500 });
      return null;
    }
    saving.value = true;
    try {
      const record = options.prepare ? options.prepare(draft.value) : draft.value;
      await saveRecord(db, table, record);
      saved = true;
      visible.value = false;
      toast.add({ severity: 'success', summary: isNew.value ? 'Registro agregado' : 'Cambios guardados', detail: options.describe(record), life: 2500 });
      return record;
    } catch (error) {
      toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: error instanceof Error ? error.message : String(error), life: 6000 });
      return null;
    } finally {
      saving.value = false;
    }
  }

  /** Guarda y abre enseguida una copia: útil cuando el mismo equipo se repite en otro espacio. */
  async function saveAndDuplicate(): Promise<void> {
    const record = await save();
    if (record) openDuplicate(record);
  }

  /** Elimina (con opción de deshacer) el registro abierto o los indicados. */
  async function remove(ids: string[] = [idOf(draft.value)]): Promise<void> {
    const label = options.describe(draft.value);
    await softDeleteRecords(db, table, ids);
    saved = true;
    visible.value = false;
    const extra = ids.length - 1;
    const message = extra > 0 ? `Se eliminó «${label}» con ${extra} ${extra === 1 ? 'elemento' : 'elementos'} que dependen de él` : `Se eliminó «${label}»`;
    offerUndo(message, () => restoreRecords(db, table, ids));
  }

  // Si se cierra sin guardar un registro nuevo, sus fotos no quedan huérfanas
  watch(visible, (isOpen) => {
    if (isOpen || saved || !isNew.value || !options.photoEntity) return;
    void discardPhotos(db, options.photoEntity, idOf(draft.value));
  });

  return { visible, draft, isNew, submitted, errors, saving, openNew, openEdit, openDuplicate, save, saveAndDuplicate, remove };
}
