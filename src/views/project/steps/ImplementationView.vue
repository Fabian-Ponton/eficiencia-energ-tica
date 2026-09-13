<script setup lang="ts">
import { IconAlertTriangle, IconCalendarPlus, IconCalendarStats, IconCamera, IconCash, IconDownload, IconFileText, IconLoader2, IconPlus, IconTable } from '@tabler/icons-vue';
import { useLocalStorage, useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import EChart from '@/components/charts/EChart.vue';
import PngButton from '@/components/charts/PngButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useFabAction } from '@/composables/useFab';
import { usePhotoCounts, useProjectRecords } from '@/composables/useProjectRecords';
import { useQuickAdd } from '@/composables/useQuickAdd';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { useTheme } from '@/composables/useTheme';
import { logReport } from '@/db/projects';
import { saveRecord } from '@/db/records';
import { getDb } from '@/db/schema';
import { budgetByPhase, budgetBySource, isOverdue, planCashFlow, planTasks, scheduleSummary, TASK_PHASES } from '@/domain/implementation';
import type { Task, TaskStatus } from '@/domain/types';
import { toCsv, type CsvFormat } from '@/reports/csv';
import { generateImplementationReport, reportFileName } from '@/reports/generate';
import { cashFlowOption, ganttOption, phaseColors } from '@/reports/implementationFigures';
import { taskTable } from '@/reports/tables';
import { OVERDUE_STATUS, TASK_STATUS } from '@/ui/icons';
import { formatDate, periodLabel, periodLabelLong, toLocalDate } from '@/utils/dates';
import { formatCop, formatMillionsCop, formatNumber, formatPercent } from '@/utils/format';
import { deliverFile } from '@/utils/share';
import { fileSlug } from '@/utils/text';
import TaskForm from './TaskForm.vue';

const db = getDb();
const toast = useToast();
const { projectId, project } = useCurrentProject();
const { isDark } = useTheme();
const desktop = useMediaQuery('(min-width: 1024px)');
const { rows: tasks, ready } = useProjectRecords('tasks');
const { rows: measures } = useProjectRecords('measures', (a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
const photoCounts = usePhotoCounts('tarea');
const today = toLocalDate();

const DEFAULT_ECONOMICS = { tariffCopPerKwh: 0, discountRate: 0.12, tariffEscalation: 0, horizonYears: 10, emissionFactorKgPerKwh: 0 };
const economics = computed(() => project.value?.economics ?? DEFAULT_ECONOMICS);
const plan = computed(() => measures.value.filter((m) => m.selected));
const measureById = computed(() => new Map(measures.value.map((m) => [m.id, m])));
const summary = computed(() => scheduleSummary(tasks.value, today));
const flow = computed(() => planCashFlow(measures.value, tasks.value, economics.value));
/** Medidas del plan que todavía no tienen ninguna tarea. */
const unscheduled = computed(() => {
  const withTasks = new Set(tasks.value.map((t) => t.measureId));
  return plan.value.filter((m) => !withTasks.has(m.id));
});

const stats = computed(() => [
  { label: 'Tareas', value: formatNumber(summary.value.count), unit: `${summary.value.done} implementadas` },
  { label: 'Avance', value: formatPercent(summary.value.progress, 0), unit: summary.value.overdue ? `${summary.value.overdue} atrasadas` : undefined },
  { label: 'Presupuesto', value: formatMillionsCop(summary.value.budgetCop), unit: 'COP' },
  { label: 'Recuperación', value: flow.value.breakEven ? periodLabel(flow.value.breakEven) : '—' },
]);

// Arranque: PONTIA propone las tareas de las medidas del plan que aún no las tienen
const firstOfNextMonth = () => {
  const d = new Date();
  return toLocalDate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
};
const planStart = ref(firstOfNextMonth());
const proposedCount = computed(() => planTasks(unscheduled.value, projectId.value, planStart.value || today).length);
const creating = ref(false);
async function scheduleMeasures() {
  if (creating.value || !unscheduled.value.length) return;
  creating.value = true;
  try {
    const drafts = planTasks(unscheduled.value, projectId.value, planStart.value || today);
    for (const d of drafts) await saveRecord(db, 'tasks', d);
    toast.add({ severity: 'success', summary: `${drafts.length} tareas creadas`, detail: 'Ajusta las fechas, los responsables y el presupuesto de cada una.', life: 3500 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudieron crear las tareas', detail: error instanceof Error ? error.message : String(error), life: 6000 });
  } finally {
    creating.value = false;
  }
}

// Cronograma: al tocar una barra se abre su tarea
const gantt = computed(() => ganttOption(tasks.value, measures.value, today, isDark.value));
const pngName = computed(() => fileSlug(project.value?.name ?? 'proyecto'));
function editFromGantt(item: { value: unknown }) {
  const bar = Array.isArray(item.value) ? Number(item.value[4]) : Number.NaN;
  const row = gantt.value?.rows[bar];
  const task = row ? tasks.value[row.index] : undefined;
  if (task) openEdit(task);
}

// Flujo de caja
const flowOption = computed(() => (flow.value.periods.length ? cashFlowOption(flow.value, isDark.value) : null));
const totalInvestment = computed(() => flow.value.investment[flow.value.investment.length - 1] ?? 0);

// Presupuesto por plazo y por fuente
const phases = computed(() => {
  const colors = phaseColors(isDark.value);
  return budgetByPhase(tasks.value).map((p) => ({ ...p, color: colors[p.id] }));
});
const sources = computed(() => budgetBySource(tasks.value));

// Lista de tareas por plazo, con filtro por estado
type Filter = 'todas' | TaskStatus | 'atrasadas';
const filter = ref<Filter>('todas');
const FILTERS = computed(() => [
  { value: 'todas' as const, label: `Todas · ${tasks.value.length}` },
  ...(['pendiente', 'en-ejecucion', 'implementada'] as const).map((s) => ({ value: s, label: `${TASK_STATUS[s].label} · ${tasks.value.filter((t) => t.status === s).length}` })),
  ...(summary.value.overdue ? [{ value: 'atrasadas' as const, label: `Atrasadas · ${summary.value.overdue}` }] : []),
]);
const groups = computed(() => {
  const shown = tasks.value.filter((t) => filter.value === 'todas' || (filter.value === 'atrasadas' ? isOverdue(t, today) : t.status === filter.value));
  return TASK_PHASES.map((p) => {
    const list = shown.filter((t) => t.phase === p.id).sort((a, b) => (a.start ?? '9999').localeCompare(b.start ?? '9999') || a.name.localeCompare(b.name, 'es'));
    return { ...p, tasks: list, budget: list.reduce((total, t) => total + (t.budgetCop ?? 0), 0) };
  }).filter((g) => g.tasks.length);
});
const codeOf = (t: Task) => (t.measureId ? measureById.value.get(t.measureId)?.code : undefined);
const measureTitle = (t: Task) => (t.measureId ? measureById.value.get(t.measureId)?.title : undefined);
const statusOf = (t: Task) => (isOverdue(t, today) ? OVERDUE_STATUS : TASK_STATUS[t.status]);

const { visible, draft, isNew, errors, saving, openNew, openEdit, save, saveAndDuplicate, remove } = useRecordEditor('tasks', {
  empty: () => ({ id: crypto.randomUUID(), projectId: projectId.value, name: '', phase: 'corto', status: 'pendiente', progress: 0, start: today }),
  validate: (d) => ({
    name: d.name.trim() ? undefined : 'Escribe la tarea en pocas palabras.',
    end: d.start && d.end && d.end < d.start ? 'La fecha de fin es anterior a la de inicio.' : undefined,
    progress: Number.isFinite(d.progress) && d.progress >= 0 && d.progress <= 100 ? undefined : 'El avance va de 0 a 100 %.',
  }),
  describe: (d) => d.name || 'Tarea',
  photoEntity: 'tarea',
  // Implementada es el 100 %; con avance ya no está pendiente
  prepare: (d) => {
    const progress = d.status === 'implementada' ? 100 : Math.round(Math.min(100, Math.max(0, d.progress || 0)));
    const status: TaskStatus = progress >= 100 ? 'implementada' : d.status === 'pendiente' && progress > 0 ? 'en-ejecucion' : d.status;
    return { ...d, progress, status };
  },
  duplicate: (d) => ({ ...d, status: 'pendiente', progress: 0 }),
});
useFabAction({ label: 'Agregar tarea', icon: IconPlus, run: () => openNew() });
useQuickAdd(() => openNew());

// Plan de implementación en Word y tareas en CSV
const csvFormat = useLocalStorage<CsvFormat>('pontia:formato-csv', 'es-CO');
const busy = ref<'word' | 'csv' | null>(null);
const progress = ref<{ step: string; done: number; total: number } | null>(null);
async function deliver(kind: 'word' | 'csv', build: () => Promise<{ blob: Blob; fileName: string }>) {
  if (busy.value) return;
  busy.value = kind;
  try {
    const { blob, fileName } = await build();
    const delivered = await deliverFile(blob, fileName);
    if (delivered === 'cancelado') return;
    await logReport(db, projectId.value, { kind: kind === 'word' ? 'implementacion' : 'csv', fileName });
    toast.add({ severity: 'success', summary: delivered === 'compartido' ? 'Archivo compartido' : 'Archivo descargado', detail: fileName, life: 4000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo generar el archivo', detail: error instanceof Error ? error.message : String(error), life: 6000 });
  } finally {
    busy.value = null;
    progress.value = null;
  }
}
const generateWord = () =>
  deliver('word', () =>
    generateImplementationReport(db, projectId.value, {
      onProgress: (step, done, total) => {
        progress.value = { step, done, total };
      },
    }),
  );
const downloadCsv = () =>
  deliver('csv', async () => {
    const t = taskTable(tasks.value, measures.value);
    const p = project.value;
    return {
      blob: new Blob([toCsv(t.rows as never[], t.columns, csvFormat.value)], { type: 'text/csv;charset=utf-8' }),
      fileName: reportFileName({ name: p?.name ?? 'proyecto', code: p?.code }, 'Tareas', 'csv'),
    };
  });
</script>

<template>
  <div class="vista">
    <PageHeader step="implementacion" :stats="tasks.length ? stats : undefined">
      <template v-if="desktop" #actions>
        <Button label="Agregar tarea" @click="openNew()">
          <template #icon><IconPlus :size="18" stroke="2.2" /></template>
        </Button>
      </template>
    </PageHeader>

    <section v-if="ready && unscheduled.length" class="card seccion arranque">
      <div class="cabecera-seccion">
        <h2><IconCalendarPlus :size="18" />{{ tasks.length ? 'Medidas del plan sin programar' : 'Arma el cronograma desde el plan' }}</h2>
        <span class="eyebrow">{{ unscheduled.map((m) => m.code).join(' · ') }}</span>
      </div>
      <p class="texto">
        PONTIA propone para cada medida una tarea de preparación y otra de ejecución, en el plazo que le da su prioridad (alta: corto plazo; media: mediano; baja: largo) y con su
        inversión como presupuesto. Después ajustas las fechas, los responsables y el presupuesto.
      </p>
      <div class="fila-arranque">
        <label class="campo inicio">
          <span class="etiqueta">Inicio del plan</span>
          <input v-model="planStart" type="date" class="p-inputtext p-component" />
        </label>
        <Button :label="creating ? 'Creando…' : `Crear ${proposedCount} tareas`" :disabled="creating || !proposedCount" @click="scheduleMeasures">
          <template #icon><component :is="creating ? IconLoader2 : IconCalendarPlus" :size="18" :class="{ girar: creating }" /></template>
        </Button>
      </div>
    </section>

    <div v-if="ready && !tasks.length && !unscheduled.length" class="card">
      <EmptyState :icon="IconCalendarStats" title="Aún no hay tareas" text="Incluye medidas en el plan de gestión para armar el cronograma, o agrega tareas a mano.">
        <RouterLink :to="{ name: 'oportunidades', params: { projectId } }">Ir a Oportunidades</RouterLink>
      </EmptyState>
    </div>

    <template v-if="tasks.length">
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2><IconCalendarStats :size="18" />Cronograma</h2>
          <span class="eyebrow">toca una barra para editar la tarea{{ summary.overdue ? ` · ${summary.overdue} atrasadas` : '' }}</span>
          <PngButton v-if="gantt" :option="() => ganttOption(tasks, measures, today, false)?.option ?? null" :name="`${pngName}_cronograma`" :width="1000" :height="gantt.height" />
        </div>
        <div v-if="gantt" class="gantt-desplazable">
          <div class="gantt-lienzo">
            <EChart :option="gantt.option" label="Cronograma de las tareas del plan" :height="`${gantt.height}px`" @item-click="editFromGantt" />
          </div>
        </div>
        <p v-else class="nota">Agrega las fechas de inicio y fin de las tareas para ver el cronograma.</p>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2><IconCash :size="18" />Flujo de caja</h2>
          <span class="eyebrow">inversión frente al ahorro neto acumulado · M COP</span>
          <PngButton v-if="flowOption" :option="() => cashFlowOption(flow, false)" :name="`${pngName}_flujo-de-caja`" />
        </div>
        <template v-if="flowOption">
          <p class="destacado">
            <template v-if="flow.breakEven">
              La inversión de <strong>{{ formatCop(totalInvestment) }}</strong> se recupera en <strong>{{ periodLabelLong(flow.breakEven) }}</strong> con el ahorro de las medidas.
            </template>
            <template v-else>En el horizonte evaluado el ahorro no alcanza la inversión de {{ formatCop(totalInvestment) }}.</template>
          </p>
          <EChart :option="flowOption" label="Inversión y ahorro acumulados del plan" height="280px" />
          <p v-if="flow.unscheduled" class="nota"><IconAlertTriangle :size="15" />{{ flow.unscheduled }} medidas del plan aún no tienen tareas con fechas y no entran al flujo.</p>
        </template>
        <p v-else class="nota">El flujo de caja aparece cuando las tareas tienen fechas.</p>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2><IconTable :size="18" />Tareas</h2>
          <span class="eyebrow">por plazo · avance del plan {{ formatPercent(summary.progress, 0) }}</span>
        </div>
        <ChoiceChips v-model="filter" :options="FILTERS" label="Filtrar las tareas por estado" />
        <template v-if="groups.length">
          <div v-if="desktop" class="tabla-contenedor">
            <table class="tabla">
              <thead>
                <tr>
                  <th>Tarea</th>
                  <th>Responsable</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th class="der">Presupuesto <small>COP</small></th>
                  <th>Estado</th>
                  <th>Avance</th>
                </tr>
              </thead>
              <tbody v-for="g in groups" :key="g.id">
                <tr class="fila-grupo">
                  <td colspan="7">
                    {{ g.label }} <span class="grupo-dato">{{ g.range }} · {{ g.tasks.length }} {{ g.tasks.length === 1 ? 'tarea' : 'tareas' }} · {{ formatCop(g.budget) }}</span>
                  </td>
                </tr>
                <tr v-for="t in g.tasks" :key="t.id" class="fila-clic" @click="openEdit(t)">
                  <td>
                    <span class="tarea">
                      <span v-if="codeOf(t)" class="mono codigo">{{ codeOf(t) }}</span>{{ t.name }}
                      <span v-if="photoCounts.get(t.id)" class="fotos"><IconCamera :size="13" />{{ photoCounts.get(t.id) }}</span>
                    </span>
                    <span v-if="measureTitle(t)" class="sub">{{ measureTitle(t) }}</span>
                  </td>
                  <td>{{ t.responsible ?? '—' }}</td>
                  <td class="mono fecha">{{ formatDate(t.start) }}</td>
                  <td class="mono fecha">{{ formatDate(t.end) }}</td>
                  <td class="der">{{ t.budgetCop ? formatCop(t.budgetCop) : '—' }}</td>
                  <td><StatusChip v-bind="statusOf(t)" /></td>
                  <td>
                    <span class="avance">
                      <span class="pista"><span class="relleno" :style="{ width: `${t.progress}%` }" /></span>
                      <span class="mono pct">{{ t.progress }} %</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="grupos">
            <div v-for="g in groups" :key="g.id">
              <h3 class="grupo-titulo">
                <span>{{ g.label }}</span><span class="grupo-dato">{{ g.range }} · {{ formatCop(g.budget) }}</span>
              </h3>
              <ul class="filas lista">
                <li v-for="t in g.tasks" :key="t.id">
                  <button type="button" class="fila-boton" @click="openEdit(t)">
                    <span class="fila-principal">
                      <span class="tarea">
                        <span v-if="codeOf(t)" class="mono codigo">{{ codeOf(t) }}</span>{{ t.name }}
                        <span v-if="photoCounts.get(t.id)" class="fotos"><IconCamera :size="13" />{{ photoCounts.get(t.id) }}</span>
                      </span>
                    </span>
                    <span class="fila-secundaria">
                      <span>{{ formatDate(t.start) }} → {{ formatDate(t.end) }}</span>
                      <StatusChip v-bind="statusOf(t)" />
                    </span>
                    <span class="fila-secundaria">
                      <span class="avance">
                        <span class="pista"><span class="relleno" :style="{ width: `${t.progress}%` }" /></span>
                        <span class="mono pct">{{ t.progress }} %</span>
                      </span>
                      <span class="responsable">{{ t.responsible ?? '' }}</span>
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </template>
        <p v-else class="nota">Ninguna tarea en este estado.</p>
      </section>

      <div class="rejilla">
        <section class="card seccion">
          <div class="cabecera-seccion">
            <h2><IconCash :size="18" />Presupuesto</h2>
            <span class="eyebrow">por plazo y fuente de financiación</span>
          </div>
          <ul class="barras">
            <li v-for="p in phases" :key="p.id">
              <span class="barra-texto">
                <span>{{ p.label }} <small>{{ p.range }} · {{ p.count }} {{ p.count === 1 ? 'tarea' : 'tareas' }}</small></span>
                <strong>{{ formatCop(p.budget) }}</strong>
              </span>
              <span class="pista ancha"><span class="relleno" :style="{ width: `${p.share * 100}%`, background: p.color }" /></span>
            </li>
          </ul>
          <ul v-if="sources.length" class="fuentes">
            <li v-for="s in sources" :key="s.source">
              <span>{{ s.source }}</span><span class="mono">{{ formatCop(s.budget) }}</span>
            </li>
          </ul>
        </section>

        <section class="card seccion documento">
          <div class="cabecera-seccion">
            <h2><IconFileText :size="18" />Plan de implementación</h2>
            <span class="eyebrow">Word · cronograma, presupuesto y flujo de caja</span>
          </div>
          <p class="texto">Alcance, cronograma por plazo, presupuesto y financiación, flujo de caja, responsables con sus indicadores y el seguimiento con las tareas atrasadas y las próximas.</p>
          <div v-if="busy === 'word' && progress" class="avance-documento" role="progressbar" :aria-valuenow="progress.done" aria-valuemin="0" :aria-valuemax="progress.total">
            <span class="pista ancha"><span class="relleno" :style="{ width: `${Math.round(((progress.done + 1) / progress.total) * 100)}%` }" /></span>
            <span class="mono paso">{{ progress.step }}</span>
          </div>
          <div class="acciones">
            <Button :label="busy === 'word' ? 'Generando el plan…' : 'Generar plan (Word)'" :disabled="busy !== null" @click="generateWord">
              <template #icon><component :is="busy === 'word' ? IconLoader2 : IconDownload" :size="18" :class="{ girar: busy === 'word' }" /></template>
            </Button>
            <Button label="Tareas en CSV" severity="secondary" outlined :disabled="busy !== null" @click="downloadCsv">
              <template #icon><IconTable :size="18" /></template>
            </Button>
          </div>
        </section>
      </div>
    </template>

    <FormSheet
      v-model:visible="visible"
      :title="isNew ? 'Nueva tarea' : draft.name || 'Tarea'"
      eyebrow="Implementación"
      :saving="saving"
      :can-delete="!isNew"
      can-duplicate
      @submit="save"
      @delete="remove()"
      @duplicate="saveAndDuplicate"
    >
      <TaskForm :key="draft.id" v-model:draft="draft" :errors="errors" :project-id="projectId" :measures="measures" :tasks="tasks" />
    </FormSheet>
  </div>
</template>

<style scoped>
.arranque,
.documento {
  border-left: 3px solid var(--accent);
}
.texto {
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
}
.fila-arranque {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}
.inicio {
  width: 190px;
}
.nota {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.destacado {
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
}
/* En el celular el nombre de cada tarea va sobre su barra; si algo no cabe, el cronograma se desplaza de lado */
.gantt-desplazable {
  overflow-x: auto;
}
.gantt-lienzo {
  min-width: 300px;
}
.tarea {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  font-weight: 600;
}
.codigo {
  color: var(--accent-strong);
  font-size: 12px;
}
.app-dark .codigo {
  color: var(--accent);
}
.fotos {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
}
.sub {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
.fecha {
  font-size: 12px;
  white-space: nowrap;
}
.grupo-dato {
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
}
.avance {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 128px;
}
.pista {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--divider);
}
.pista.ancha {
  display: block;
  height: 8px;
}
.relleno {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 300ms var(--ease);
}
.pct {
  min-width: 38px;
  color: var(--muted);
  font-size: 11.5px;
  text-align: right;
}
.responsable {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grupos {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.grupo-titulo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
}
.lista {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.rejilla {
  display: grid;
  gap: 14px;
}
.barras {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.barras li {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.barra-texto {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}
.barra-texto small {
  color: var(--muted);
}
.fuentes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--divider);
  font-size: 13px;
  list-style: none;
}
.fuentes li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.avance-documento {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.paso {
  color: var(--muted);
  font-size: 11.5px;
}
.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (min-width: 1024px) {
  .rejilla {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
</style>
