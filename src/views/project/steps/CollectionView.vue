<script setup lang="ts">
import { IconAlertTriangle, IconArrowRight, IconCircleCheck, IconCircleDashed, IconClockPlay, IconDownload, IconFileSpreadsheet, IconPlus, IconProgressCheck, IconUpload } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { computed, ref, shallowRef } from 'vue';
import { RouterLink } from 'vue-router';
import FormatsImportDialog from '@/components/FormatsImportDialog.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useFabAction } from '@/composables/useFab';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { useQuickAdd } from '@/composables/useQuickAdd';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { formatBytes } from '@/composables/useStorageInfo';
import { applyFormatsImport, planFormatsImport, type ImportPlan } from '@/db/formatsImport';
import { isActive } from '@/db/records';
import { getDb } from '@/db/schema';
import { isElectric } from '@/domain/carriers';
import { buildCollection, STATUS_LABEL, summarizeCollection, type CollectionRow } from '@/domain/collection';
import type { CollectionStatus } from '@/domain/types';
import { loadReportData } from '@/reports/data';
import { buildFormatsWorkbook, formatsFileName, type FormatId } from '@/reports/formats';
import type { Tone } from '@/ui/icons';
import { formatDate } from '@/utils/dates';
import { deliverFile } from '@/utils/share';
import CollectionForm from './CollectionForm.vue';

const db = getDb();
const { projectId, project } = useCurrentProject();
const desktop = useMediaQuery('(min-width: 1024px)');

const { rows: areas } = useProjectRecords('areas');
const { rows: equipment } = useProjectRecords('equipment');
const { rows: occupancy } = useProjectRecords('occupancy');
const { rows: maintenance } = useProjectRecords('maintenance');
const { rows: stored, ready } = useProjectRecords('collection');
const { rows: electricBills } = useProjectRecords('bills', undefined, isElectric);
const { rows: measurements } = useProjectRecords('measurements');
const { rows: readings } = useProjectRecords('meterReadings');
const { rows: series } = useProjectRecords('intervalSeries');
const { rows: findings } = useProjectRecords('findings');
const photos = useLiveQuery(() => db.photos.where('projectId').equals(projectId.value).filter(isActive).count(), [projectId], 0);

const rows = computed(() =>
  project.value
    ? buildCollection({
        project: project.value,
        areas: areas.value,
        equipment: equipment.value,
        occupancy: occupancy.value,
        maintenance: maintenance.value,
        electricBills: electricBills.value.length,
        measurementRecords: measurements.value.length + readings.value.length + series.value.length,
        photos: photos.value ?? 0,
        findings: findings.value.length,
        stored: stored.value,
      })
    : [],
);
const summary = computed(() => summarizeCollection(rows.value));

const STATUS_STYLE: Record<CollectionStatus, { tone: Tone; icon: typeof IconCircleCheck }> = {
  pendiente: { tone: 'neutral', icon: IconCircleDashed },
  'en-curso': { tone: 'info', icon: IconClockPlay },
  obtenido: { tone: 'good', icon: IconCircleCheck },
  'no-disponible': { tone: 'warning', icon: IconAlertTriangle },
};

const stats = computed(() => [
  { label: 'Obtenidos', value: `${summary.value.resolved} de ${summary.value.total}` },
  { label: 'Pendientes', value: String(summary.value.pending.length) },
  { label: 'No disponibles', value: String(summary.value.unavailable) },
]);

const editing = computed(() => rows.value.find((r) => r.key === draft.value.key));
const { visible, draft, isNew, errors, saving, openNew, openEdit, save, remove } = useRecordEditor('collection', {
  empty: () => ({ id: crypto.randomUUID(), projectId: projectId.value, key: `otro-${crypto.randomUUID().slice(0, 8)}`, label: '', status: 'pendiente' }),
  validate: (d) => ({ label: d.label.trim() ? undefined : 'Escribe el nombre del renglón.' }),
  describe: (d) => d.label || 'Renglón',
});

/** Abre el renglón: el que ya tiene anotaciones se edita; el que no, se crea con su nombre y su clave. */
function edit(row: CollectionRow) {
  if (row.stored) openEdit(row.stored);
  else openNew({ key: row.key, label: row.label });
}

const addOwn = () => openNew();
useFabAction({ label: 'Agregar renglón', icon: IconPlus, run: addOwn });
useQuickAdd(addOwn);

// Formatos de Excel: se descargan en blanco o con lo registrado, y el libro diligenciado se puede volver a cargar
const toast = useToast();
const downloading = ref<'blanco' | 'lleno' | null>(null);
async function download(filled: boolean) {
  const p = project.value;
  if (!p || downloading.value) return;
  downloading.value = filled ? 'lleno' : 'blanco';
  try {
    const blob = await buildFormatsWorkbook(await loadReportData(db, p.id), { filled });
    const name = formatsFileName(p.code, p.name, filled);
    const result = await deliverFile(blob, name);
    if (result !== 'cancelado') toast.add({ severity: 'success', summary: result === 'compartido' ? 'Formatos compartidos' : 'Formatos descargados', detail: `${name} · ${formatBytes(blob.size)}`, life: 5000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudieron generar los formatos', detail: error instanceof Error ? error.message : String(error), life: 7000 });
  } finally {
    downloading.value = null;
  }
}

const fileInput = ref<HTMLInputElement>();
const chosenFile = shallowRef<File | null>(null);
const plan = shallowRef<ImportPlan | null>(null);
const showImport = ref(false);
const planning = ref(false);
const applying = ref(false);

async function makePlan(term?: string) {
  const file = chosenFile.value;
  const p = project.value;
  if (!file || !p) return;
  planning.value = true;
  try {
    plan.value = await planFormatsImport(file, await loadReportData(db, p.id), { term: term || undefined });
    showImport.value = true;
  } catch {
    toast.add({ severity: 'error', summary: 'No se pudo leer el archivo', detail: 'Revisa que sea un libro de Excel (.xlsx), no un .xls ni un PDF.', life: 7000 });
  } finally {
    planning.value = false;
  }
}

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  chosenFile.value = input.files?.[0] ?? null;
  input.value = '';
  await makePlan();
}

async function applyImport(sheets: FormatId[]) {
  const p = project.value;
  if (!plan.value || !p) return;
  applying.value = true;
  try {
    const { created, updated } = await applyFormatsImport(db, p.id, plan.value, new Set(sheets));
    showImport.value = false;
    toast.add({ severity: 'success', summary: 'Formatos cargados', detail: `Se crearon ${created} registros y se actualizaron ${updated}.`, life: 6000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudieron cargar los formatos', detail: error instanceof Error ? error.message : String(error), life: 8000 });
  } finally {
    applying.value = false;
  }
}

const segmentClass = (status: CollectionStatus) => ({ obtenido: 'ok', 'en-curso': 'curso', pendiente: 'pend', 'no-disponible': 'nd' })[status];
const dateOrDash = (value?: string) => (value ? formatDate(value) : '—');
</script>

<template>
  <div class="vista">
    <PageHeader step="control" :stats="stats">
      <template v-if="desktop" #actions>
        <Button label="Agregar renglón" severity="secondary" outlined @click="addOwn">
          <template #icon><IconPlus :size="18" stroke="2.2" /></template>
        </Button>
      </template>
    </PageHeader>

    <section class="card avance">
      <div class="segmentos" role="img" :aria-label="`${summary.resolved} de ${summary.total} renglones resueltos`">
        <i v-for="row in rows.filter((r) => !r.custom)" :key="row.key" :class="segmentClass(row.status)" :title="`${row.label}: ${STATUS_LABEL[row.status]}`" />
      </div>
      <p class="texto">
        <IconProgressCheck :size="16" />
        <template v-if="!summary.pending.length">Toda la información está obtenida o declarada no disponible: el levantamiento queda completo.</template>
        <template v-else>
          Faltan {{ summary.pending.length }} {{ summary.pending.length === 1 ? 'renglón' : 'renglones' }}: {{ summary.pending.map((r) => r.label.toLowerCase()).join(', ') }}.
        </template>
      </p>
    </section>

    <section class="card excel">
      <header>
        <span class="icono-excel"><IconFileSpreadsheet :size="22" /></span>
        <div>
          <h2>Formatos de Excel</h2>
          <p>Los 13 formatos de recolección, con listas desplegables y las unidades a la vista. Llénalos con los técnicos en campo y vuelve a cargarlos aquí.</p>
        </div>
      </header>
      <div class="botones">
        <Button label="Descargar en blanco" severity="secondary" outlined :loading="downloading === 'blanco'" :disabled="Boolean(downloading)" @click="download(false)">
          <template #icon><IconDownload :size="18" /></template>
        </Button>
        <Button label="Descargar con lo registrado" severity="secondary" outlined :loading="downloading === 'lleno'" :disabled="Boolean(downloading)" @click="download(true)">
          <template #icon><IconDownload :size="18" /></template>
        </Button>
        <Button label="Cargar formatos diligenciados" :loading="planning" @click="fileInput?.click()">
          <template #icon><IconUpload :size="18" /></template>
        </Button>
      </div>
      <input ref="fileInput" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="sr-only" tabindex="-1" aria-hidden="true" @change="onFileChosen" />
    </section>

    <FormatsImportDialog v-model:visible="showImport" :plan="plan" :file-name="chosenFile?.name ?? ''" :busy="applying" @apply="applyImport" @change-term="makePlan" />

    <div v-if="ready" class="lista">
      <article v-for="row in rows" :key="row.key" class="card renglon" :class="{ resuelto: row.status === 'obtenido' }">
        <header>
          <span class="icono" :class="STATUS_STYLE[row.status].tone"><component :is="STATUS_STYLE[row.status].icon" :size="20" /></span>
          <div class="titulo">
            <h2>{{ row.label }}</h2>
            <span class="detalle">{{ row.detail }}</span>
          </div>
          <StatusChip :tone="STATUS_STYLE[row.status].tone" :icon="STATUS_STYLE[row.status].icon" :label="STATUS_LABEL[row.status]" />
        </header>
        <p class="ayuda">{{ row.hint }}</p>
        <dl v-if="row.stored && (row.stored.responsible || row.stored.targetDate || row.stored.obtainedDate || row.stored.evidence)" class="datos">
          <div v-if="row.stored.responsible">
            <dt>Responsable</dt>
            <dd>{{ row.stored.responsible }}</dd>
          </div>
          <div v-if="row.stored.targetDate">
            <dt>Objetivo</dt>
            <dd>{{ dateOrDash(row.stored.targetDate) }}</dd>
          </div>
          <div v-if="row.stored.obtainedDate">
            <dt>Obtenida</dt>
            <dd>{{ dateOrDash(row.stored.obtainedDate) }}</dd>
          </div>
          <div v-if="row.stored.evidence">
            <dt>Evidencia</dt>
            <dd>{{ row.stored.evidence }}</dd>
          </div>
        </dl>
        <footer>
          <RouterLink v-if="row.step" class="ir" :to="{ name: row.step, params: { projectId }, query: row.tab ? { tab: row.tab } : {} }">
            Abrir la pantalla<IconArrowRight :size="14" />
          </RouterLink>
          <button type="button" class="editar" @click="edit(row)">{{ row.stored ? 'Editar anotaciones' : 'Anotar responsable y fechas' }}</button>
        </footer>
      </article>
    </div>

    <FormSheet
      v-model:visible="visible"
      :title="isNew && draft.label === '' ? 'Nuevo renglón' : draft.label || 'Renglón'"
      eyebrow="Control de recolección"
      :saving="saving"
      :can-delete="!isNew"
      submit-label="Guardar"
      @submit="save"
      @delete="remove()"
    >
      <CollectionForm :key="draft.id" v-model:draft="draft" :errors="errors" :custom="draft.key.startsWith('otro-')" :automatic="editing ? `${STATUS_LABEL[editing.auto].toLowerCase()}: ${editing.detail}` : 'sin datos'" />
    </FormSheet>
  </div>
</template>

<style scoped>
.avance {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
}
.segmentos {
  display: flex;
  gap: 4px;
}
.segmentos i {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: var(--divider);
}
.segmentos i.ok {
  background: var(--accent);
}
.segmentos i.curso {
  background: var(--info-strong, #6da7ec);
}
.segmentos i.nd {
  background: repeating-linear-gradient(45deg, var(--warning-text), var(--warning-text) 3px, transparent 3px, transparent 6px);
}
.texto {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.4;
}
.texto svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--accent-strong);
}
.excel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
}
.excel header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.excel h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.excel p {
  margin: 2px 0 0;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.4;
}
.icono-excel {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--accent-wash);
  color: var(--accent-strong);
}
.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 639px) {
  .botones > .p-button {
    flex: 1 1 100%;
  }
}
.lista {
  display: grid;
  gap: 10px;
}
.renglon {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
}
.renglon header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.icono {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--ink-2);
}
.icono.good {
  background: var(--accent-wash);
  color: var(--accent-strong);
}
.icono.info {
  background: var(--info-wash);
  color: var(--navy);
}
.icono.warning {
  background: var(--warning-wash);
  color: var(--warning-text);
}
.titulo {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.titulo h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}
.detalle {
  color: var(--muted);
  font-size: 12px;
}
.ayuda {
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.4;
}
.datos {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin: 0;
  font-size: 12px;
}
.datos dt {
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.datos dd {
  margin: 0;
}
.renglon footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 2px;
}
.ir,
.editar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--accent-strong);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.ir:hover,
.editar:hover {
  background: var(--accent-wash);
}
.editar {
  color: var(--ink-2);
}
@media (min-width: 900px) {
  .lista {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1400px) {
  .lista {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
