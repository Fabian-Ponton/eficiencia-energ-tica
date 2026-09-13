<script setup lang="ts">
import {
  IconChartBar,
  IconCircleCheck,
  IconCircleDashed,
  IconClipboardList,
  IconDownload,
  IconFileSpreadsheet,
  IconFileText,
  IconFileZip,
  IconHistory,
  IconLoader2,
  IconPhoto,
  IconTable,
} from '@tabler/icons-vue';
import { useLocalStorage } from '@vueuse/core';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, shallowRef, type Component } from 'vue';
import { RouterLink } from 'vue-router';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { backupFileName, exportProjectZip } from '@/db/backup';
import { logReport, markBackup } from '@/db/projects';
import { getDb } from '@/db/schema';
import type { ReportKind } from '@/domain/types';
import { chartsBundle, csvBundle } from '@/reports/bundle';
import { toCsv, type CsvFormat } from '@/reports/csv';
import { loadReportData } from '@/reports/data';
import { auditFigures, type ReportFigure } from '@/reports/figures';
import { generateAuditReport, generatePgeeReport, reportFileName, type GeneratedFile } from '@/reports/generate';
import { buildAuditModel } from '@/reports/model';
import { exportTables, type ExportTable } from '@/reports/tables';
import { buildWorkbook } from '@/reports/xlsx';
import { formatDateTime, toLocalDateTime } from '@/utils/dates';
import { formatNumber } from '@/utils/format';
import { deliverFile } from '@/utils/share';

const db = getDb();
const toast = useToast();
const { projectId, project } = useCurrentProject();
const { rows: measures } = useProjectRecords('measures');
/** Medidas incluidas en el plan: son las que desarrolla el PGEE. */
const planCount = computed(() => measures.value.filter((m) => m.selected).length);

// Vista previa: qué tablas y gráficas tiene hoy el proyecto (se recalcula al generar cada archivo)
const preview = shallowRef<{ tables: ExportTable[]; figures: ReportFigure[] } | null>(null);
async function freshContent() {
  const data = await loadReportData(db, projectId.value);
  const model = buildAuditModel(data);
  return { project: data.project, model, tables: exportTables(model), figures: auditFigures(model) };
}
onMounted(async () => {
  const { tables, figures } = await freshContent();
  preview.value = { tables, figures };
});
const livePhotoCount = useLiveQuery(
  () =>
    db.photos
      .where('projectId')
      .equals(projectId.value)
      .filter((p) => !p.deletedAt)
      .count(),
  [projectId],
  0,
);
/** Fotos vigentes del proyecto; 0 mientras se cuentan. */
const photoCount = computed(() => livePhotoCount.value ?? 0);

// Opciones que se recuerdan en este equipo
const includePhotos = useLocalStorage('pontia:informe-fotos', true);
const photoSize = useLocalStorage<'grande' | 'pequena'>('pontia:informe-fotos-tamano', 'grande');
const csvFormat = useLocalStorage<CsvFormat>('pontia:formato-csv', 'es-CO');
const PHOTO_SIZES = [
  { value: 'grande', label: 'Grandes' },
  { value: 'pequena', label: 'Pequeñas' },
] as const;
const CSV_FORMATS = [
  { value: 'es-CO', label: 'Excel Colombia · ;' },
  { value: 'estandar', label: 'Estándar · ,' },
] as const;

type Action = ReportKind | 'respaldo';
const busy = ref<Action | null>(null);
const progress = ref<{ step: string; done: number; total: number } | null>(null);
const onProgress = (step: string, done: number, total: number) => {
  progress.value = { step, done, total };
};

/** Genera el archivo, lo comparte o descarga y lo anota en el historial. */
async function run(action: Action, task: () => Promise<GeneratedFile>) {
  if (busy.value) return;
  busy.value = action;
  progress.value = null;
  try {
    const { blob, fileName } = await task();
    const delivered = await deliverFile(blob, fileName);
    if (delivered === 'cancelado') return;
    if (action === 'respaldo') await markBackup(db, projectId.value);
    else await logReport(db, projectId.value, { kind: action, fileName });
    toast.add({ severity: 'success', summary: delivered === 'compartido' ? 'Archivo compartido' : 'Archivo descargado', detail: fileName, life: 4000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo generar el archivo', detail: error instanceof Error ? error.message : String(error), life: 6000 });
  } finally {
    busy.value = null;
    progress.value = null;
  }
}

const generateWord = () =>
  run('auditoria', () => generateAuditReport(db, projectId.value, { includePhotos: includePhotos.value && photoCount.value > 0, photoSize: photoSize.value, onProgress }));
const generatePgee = () => run('pgee', () => generatePgeeReport(db, projectId.value, { onProgress }));
const downloadCsvBundle = () =>
  run('csv', async () => {
    const { project: p, tables } = await freshContent();
    return { blob: await csvBundle(tables, csvFormat.value), fileName: reportFileName(p, 'Tablas-CSV', 'zip') };
  });
const downloadCsv = (id: string) =>
  run('csv', async () => {
    const { project: p, tables } = await freshContent();
    const t = tables.find((x) => x.id === id);
    if (!t) throw new Error('La tabla ya no tiene registros.');
    return { blob: new Blob([toCsv(t.rows as never[], t.columns, csvFormat.value)], { type: 'text/csv;charset=utf-8' }), fileName: reportFileName(p, t.id, 'csv') };
  });
const downloadExcel = () =>
  run('excel', async () => {
    const { project: p, tables } = await freshContent();
    return { blob: await buildWorkbook(tables, { title: `Datos de la auditoría · ${p.name}` }), fileName: reportFileName(p, 'Datos', 'xlsx') };
  });
const downloadCharts = () =>
  run('graficas', async () => {
    const { project: p, figures } = await freshContent();
    return { blob: await chartsBundle(figures, onProgress), fileName: reportFileName(p, 'Graficas', 'zip') };
  });
const downloadBackup = () =>
  run('respaldo', async () => {
    const p = project.value;
    if (!p) throw new Error('El proyecto no está disponible.');
    return { blob: await exportProjectZip(db, p.id), fileName: backupFileName(p) };
  });

/** Contenido del informe Word, con lo que ya tiene datos marcado. */
const sections = computed(() => {
  const ids = new Set(preview.value?.figures.map((f) => f.id) ?? []);
  const tables = new Set(preview.value?.tables.map((t) => t.id) ?? []);
  return [
    { title: 'Resumen ejecutivo con indicadores y hallazgos', ok: true },
    { title: 'Alcance y descripción de la instalación', ok: tables.has('espacios') },
    { title: 'Metodología (ISO 50002 · ISO 50006 · IPMVP)', ok: true },
    { title: 'Comportamiento del consumo mensual, anual y diario', ok: ids.has('consumo-mensual') || ids.has('curva-de-carga') },
    { title: 'Balance energético y usos significativos', ok: ids.has('pareto-usos') },
    { title: 'Indicadores de desempeño y línea base', ok: ids.has('linea-base') },
    { title: 'Dimensionamiento: climatización, iluminación y capacidad', ok: ids.has('climatizacion') || ids.has('unifilar') },
    { title: 'Mediciones puntuales', ok: tables.has('mediciones') },
    { title: 'Diagnóstico con evidencia fotográfica', ok: tables.has('hallazgos') },
    { title: 'Oportunidades de ahorro y matriz de priorización', ok: tables.has('medidas') },
    { title: 'Conclusiones y recomendaciones', ok: true },
    { title: `Anexo fotográfico · ${formatNumber(photoCount.value)} ${photoCount.value === 1 ? 'foto' : 'fotos'}`, ok: photoCount.value > 0 && includePhotos.value },
  ];
});

const KIND: Record<ReportKind, { label: string; icon: Component }> = {
  auditoria: { label: 'Informe de auditoría', icon: IconFileText },
  pgee: { label: 'Plan de gestión (PGEE)', icon: IconClipboardList },
  csv: { label: 'Tablas en CSV', icon: IconTable },
  excel: { label: 'Libro de Excel', icon: IconFileSpreadsheet },
  graficas: { label: 'Gráficas en PNG', icon: IconChartBar },
};
const history = computed(() => project.value?.reports ?? []);
const when = (at: number) => formatDateTime(toLocalDateTime(new Date(at)));
const stats = computed(() => [
  { label: 'Archivos generados', value: formatNumber(history.value.length) },
  { label: 'Último', value: history.value[0] ? when(history.value[0].at).split(' · ')[0] : '—', unit: history.value[0] ? KIND[history.value[0].kind].label.toLowerCase() : undefined },
  { label: 'Tablas', value: preview.value ? formatNumber(preview.value.tables.length) : '…' },
  { label: 'Gráficas', value: preview.value ? formatNumber(preview.value.figures.length) : '…' },
]);
</script>

<template>
  <div class="vista">
    <PageHeader step="informes" :stats="stats" />

    <section class="card seccion principal">
      <div class="cabecera-seccion">
        <h2><IconFileText :size="20" />Informe de auditoría energética</h2>
        <span class="eyebrow">Word · estructura ISO 50002</span>
      </div>
      <p class="texto">
        Portada, índice, resumen ejecutivo con indicadores, gráficas y tablas numeradas, verificación de cada espacio, capacidad eléctrica, diagnóstico con fotos, oportunidades de ahorro,
        conclusiones y anexo fotográfico. Se abre y se edita en Word.
      </p>
      <ol class="indice-informe">
        <li v-for="s in sections" :key="s.title" :class="{ pendiente: !s.ok }">
          <component :is="s.ok ? IconCircleCheck : IconCircleDashed" :size="16" />
          <span>{{ s.title }}</span>
        </li>
      </ol>
      <div class="opciones">
        <label class="fila-interruptor">
          <span>Incluir el anexo fotográfico<small>{{ photoCount ? `${formatNumber(photoCount)} fotos del proyecto` : 'El proyecto aún no tiene fotos' }}</small></span>
          <ToggleSwitch v-model="includePhotos" :disabled="!photoCount" />
        </label>
        <div v-if="includePhotos && photoCount" class="campo">
          <span class="etiqueta">Tamaño de las fotos</span>
          <ChoiceChips v-model="photoSize" :options="PHOTO_SIZES" label="Tamaño de las fotos" />
        </div>
      </div>
      <div v-if="busy === 'auditoria' && progress" class="avance" role="progressbar" :aria-valuenow="progress.done" aria-valuemin="0" :aria-valuemax="progress.total">
        <span class="pista"><span class="relleno" :style="{ width: `${Math.round(((progress.done + 1) / progress.total) * 100)}%` }" /></span>
        <span class="mono paso">{{ progress.step }} · {{ progress.done + 1 }} de {{ progress.total }}</span>
      </div>
      <Button :label="busy === 'auditoria' ? 'Generando el informe…' : 'Generar informe Word'" :disabled="busy !== null" class="generar" @click="generateWord">
        <template #icon><component :is="busy === 'auditoria' ? IconLoader2 : IconDownload" :size="18" :class="{ girar: busy === 'auditoria' }" /></template>
      </Button>
    </section>

    <div class="rejilla">
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2><IconTable :size="18" />Tablas en CSV</h2>
          <span class="eyebrow">una por tabla · se abren en Excel</span>
        </div>
        <div class="campo">
          <span class="etiqueta">Formato</span>
          <ChoiceChips v-model="csvFormat" :options="CSV_FORMATS" label="Formato del CSV" fill />
        </div>
        <ul v-if="preview" class="filas tablas">
          <li v-for="t in preview.tables" :key="t.id">
            <button type="button" class="fila-boton" :disabled="busy !== null" @click="downloadCsv(t.id)">
              <span class="fila-principal">
                <span>{{ t.title }}</span>
                <span class="mono cuenta">{{ formatNumber(t.rows.length) }} filas <IconDownload :size="15" /></span>
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="nota"><IconLoader2 :size="15" class="girar" />Revisando las tablas del proyecto…</p>
        <Button label="Descargar todas (.zip)" severity="secondary" outlined :disabled="busy !== null || !preview?.tables.length" @click="downloadCsvBundle">
          <template #icon><component :is="busy === 'csv' ? IconLoader2 : IconFileZip" :size="18" :class="{ girar: busy === 'csv' }" /></template>
        </Button>
      </section>

      <div class="columna">
        <section class="card seccion">
          <div class="cabecera-seccion">
            <h2><IconClipboardList :size="18" />Plan de gestión (PGEE)</h2>
            <span class="eyebrow">Word · {{ planCount === 1 ? '1 medida en el plan' : `${formatNumber(planCount)} medidas en el plan` }}</span>
          </div>
          <p class="texto">
            Política, objetivos y metas, planes de acción con la matriz de priorización y seguimiento con M&amp;V, según la ISO 50001. Se completa en el
            <RouterLink :to="{ name: 'pgee', params: { projectId } }">paso PGEE</RouterLink>.
          </p>
          <div v-if="busy === 'pgee' && progress" class="avance" role="progressbar" :aria-valuenow="progress.done" aria-valuemin="0" :aria-valuemax="progress.total">
            <span class="pista"><span class="relleno" :style="{ width: `${Math.round(((progress.done + 1) / progress.total) * 100)}%` }" /></span>
            <span class="mono paso">{{ progress.step }}</span>
          </div>
          <Button :label="busy === 'pgee' ? 'Generando el PGEE…' : 'Generar PGEE (Word)'" severity="secondary" outlined :disabled="busy !== null" @click="generatePgee">
            <template #icon><component :is="busy === 'pgee' ? IconLoader2 : IconDownload" :size="18" :class="{ girar: busy === 'pgee' }" /></template>
          </Button>
        </section>

        <section class="card seccion">
          <div class="cabecera-seccion">
            <h2><IconFileSpreadsheet :size="18" />Libro de Excel</h2>
            <span class="eyebrow">una hoja por tabla, con filtros</span>
          </div>
          <p class="texto">Inventario, facturas, espacios, sistema eléctrico, mediciones, lecturas, dimensionamiento, hallazgos y medidas de ahorro, listos para seguir trabajando.</p>
          <Button label="Descargar Excel (.xlsx)" severity="secondary" outlined :disabled="busy !== null || !preview?.tables.length" @click="downloadExcel">
            <template #icon><component :is="busy === 'excel' ? IconLoader2 : IconDownload" :size="18" :class="{ girar: busy === 'excel' }" /></template>
          </Button>
        </section>

        <section class="card seccion">
          <div class="cabecera-seccion">
            <h2><IconChartBar :size="18" />Gráficas en PNG</h2>
            <span class="eyebrow">{{ preview ? `${formatNumber(preview.figures.length)} gráficas del informe` : 'gráficas del informe' }}</span>
          </div>
          <p class="texto">Las mismas gráficas del informe, en alta resolución y fondo blanco, para presentaciones.</p>
          <div v-if="busy === 'graficas' && progress" class="avance">
            <span class="pista"><span class="relleno" :style="{ width: `${Math.round(((progress.done + 1) / progress.total) * 100)}%` }" /></span>
            <span class="mono paso">{{ progress.done + 1 }} de {{ progress.total }}</span>
          </div>
          <Button label="Descargar gráficas (.zip)" severity="secondary" outlined :disabled="busy !== null || !preview?.figures.length" @click="downloadCharts">
            <template #icon><component :is="busy === 'graficas' ? IconLoader2 : IconPhoto" :size="18" :class="{ girar: busy === 'graficas' }" /></template>
          </Button>
        </section>

        <section class="card seccion">
          <div class="cabecera-seccion">
            <h2><IconFileZip :size="18" />Respaldo del proyecto</h2>
            <span class="eyebrow">datos y fotos en un .zip</span>
          </div>
          <p class="texto">Sirve para guardar una copia o para pasar el proyecto del celular al PC.</p>
          <Button label="Descargar respaldo" severity="secondary" outlined :disabled="busy !== null" @click="downloadBackup">
            <template #icon><component :is="busy === 'respaldo' ? IconLoader2 : IconDownload" :size="18" :class="{ girar: busy === 'respaldo' }" /></template>
          </Button>
        </section>
      </div>
    </div>

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2><IconHistory :size="18" />Historial</h2>
        <span class="eyebrow">archivos generados en este proyecto</span>
      </div>
      <ul v-if="history.length" class="filas historial">
        <li v-for="r in history" :key="r.id" class="fila-boton estatica">
          <span class="fila-principal">
            <span class="tipo"><component :is="KIND[r.kind].icon" :size="16" />{{ KIND[r.kind].label }}</span>
            <span class="mono fecha">{{ when(r.at) }}</span>
          </span>
          <span class="fila-secundaria mono">{{ r.fileName }}</span>
        </li>
      </ul>
      <p v-else class="nota">Aún no se ha generado ningún archivo. El primer informe completa esta etapa de la auditoría.</p>
    </section>
  </div>
</template>

<style scoped>
.principal {
  gap: 14px;
}
.texto {
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
}
.texto a {
  font-weight: 600;
}
.indice-informe {
  display: grid;
  gap: 6px 18px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  list-style: none;
  counter-reset: seccion;
}
.indice-informe li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.indice-informe li svg {
  flex-shrink: 0;
  color: var(--good-text);
}
.indice-informe li.pendiente {
  color: var(--muted);
}
.indice-informe li.pendiente svg {
  color: var(--field-border);
}
.opciones {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.avance {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pista {
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--divider);
}
.relleno {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 300ms var(--ease);
}
.paso {
  color: var(--muted);
  font-size: 11.5px;
}
.generar {
  align-self: flex-start;
}
.rejilla {
  display: grid;
  gap: 14px;
}
.columna {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tablas {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.tablas .fila-boton {
  padding: 10px 12px;
}
.tablas .fila-boton:disabled {
  cursor: progress;
  opacity: 0.6;
}
.cuenta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
}
.nota {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.estatica {
  cursor: default;
}
.historial .tipo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
/* En el celular la fecha baja a su propia línea en vez de partirse */
.historial .fila-principal {
  flex-wrap: wrap;
  row-gap: 2px;
}
.historial .fecha {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}
.historial .fila-secundaria {
  overflow: hidden;
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (min-width: 720px) {
  .indice-informe {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1024px) {
  .rejilla {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
</style>
