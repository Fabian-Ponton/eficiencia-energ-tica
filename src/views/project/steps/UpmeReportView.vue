<script setup lang="ts">
import { IconAlertTriangle, IconCalendarEvent, IconCircleCheck, IconCircleDashed, IconCloudCheck, IconDownload, IconFileText, IconFileZip, IconInfoCircle, IconLoader2, IconTable } from '@tabler/icons-vue';
import { useDebounceFn } from '@vueuse/core';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { RouterLink } from 'vue-router';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { logReport } from '@/db/projects';
import { saveRecord } from '@/db/records';
import { getDb } from '@/db/schema';
import { nextAudit, upmeFileName, upmeReadiness } from '@/domain/upmeReport';
import { generateAuditReport } from '@/reports/generate';
import { loadReportData } from '@/reports/data';
import { buildAuditModel, type AuditModel } from '@/reports/model';
import { reportRoute } from '@/reports/route';
import { buildUpmeAnnexes, buildUpmePackage } from '@/reports/upme/package';
import { formatDate } from '@/utils/dates';
import { deliverFile } from '@/utils/share';

/**
 * Reporte a la UPME (art. 237 de la Ley 2294 de 2023): qué falta para reportar, el caso en el SUU con su concepto y el paquete de archivos con los
 * nombres que pide la UPME. PONTIA no envía nada al SUU: el reporte lo hace la entidad con su usuario.
 */
const db = getDb();
const toast = useToast();
const { projectId, project } = useCurrentProject();
const settings = useLiveQuery(() => db.settings.get('app'), [], undefined);
const { rows: cycles } = useProjectRecords('upmeCycles', (a, b) => b.year - a.year);
const { rows: measures } = useProjectRecords('measures');
const { rows: tasks } = useProjectRecords('tasks');
const { rows: pgeeRows } = useProjectRecords('pgee', (a, b) => a.createdAt - b.createdAt);

// El modelo del informe da la línea base, el consumo de referencia y las hojas del paquete
const model = shallowRef<AuditModel | null>(null);
const failed = ref(false);
async function loadModel() {
  try {
    model.value = buildAuditModel(await loadReportData(db, projectId.value));
    failed.value = false;
  } catch {
    failed.value = true;
  }
}
onMounted(loadModel);

const routePlan = computed(() => (model.value ? reportRoute(model.value, { pgee: pgeeRows.value[0], measures: measures.value, tasks: tasks.value }) : null));

// Ciclo de reporte: un caso por sede y por ciclo
const year = ref(new Date().getFullYear());
const cycle = computed(() => cycles.value.find((c) => c.year === year.value));
const form = reactive({ caseNumber: '', filedAt: '', conceptAt: '', conceptResult: '', conceptNote: '' });
let syncing = false;
watch(
  [cycle, year],
  () => {
    syncing = true;
    form.caseNumber = cycle.value?.caseNumber ?? '';
    form.filedAt = cycle.value?.filedAt ?? '';
    form.conceptAt = cycle.value?.concept?.at ?? '';
    form.conceptResult = cycle.value?.concept?.result ?? '';
    form.conceptNote = cycle.value?.concept?.note ?? '';
    setTimeout(() => (syncing = false), 0);
  },
  { immediate: true },
);
// Al abrir el paso se muestra el ciclo más reciente que ya está registrado
watch(
  () => cycles.value[0]?.year,
  (latest) => {
    if (latest !== undefined && !cycles.value.some((c) => c.year === year.value)) year.value = latest;
  },
  { immediate: true },
);

const status = ref<'guardado' | 'guardando' | 'error'>('guardado');
const persist = useDebounceFn(async () => {
  try {
    const hasData = Object.values(form).some((v) => v.trim());
    if ((!hasData && !cycle.value) || !Number.isFinite(year.value)) return;
    await saveRecord(db, 'upmeCycles', {
      id: cycle.value?.id ?? crypto.randomUUID(),
      projectId: projectId.value,
      createdAt: cycle.value?.createdAt,
      year: year.value,
      caseNumber: form.caseNumber.trim() || undefined,
      filedAt: form.filedAt || undefined,
      concept: form.conceptAt || form.conceptResult.trim() || form.conceptNote.trim() ? { at: form.conceptAt || undefined, result: form.conceptResult.trim() || undefined, note: form.conceptNote.trim() || undefined } : undefined,
    });
    status.value = 'guardado';
  } catch {
    status.value = 'error';
  }
}, 700);
watch(form, () => {
  if (syncing) return;
  status.value = 'guardando';
  void persist();
});

const yearOptions = computed(() => [...new Set([...cycles.value.map((c) => c.year), year.value])].sort((a, b) => b - a).map((y) => ({ value: y, label: String(y) })));

const EMPTY_READINESS: ReturnType<typeof upmeReadiness> = { items: [], ready: false, missing: [], done: 0, total: 0 };
const readiness = computed(() =>
  project.value
    ? upmeReadiness({
        project: project.value,
        auditor: settings.value?.auditor,
        pgee: pgeeRows.value[0],
        firstYear: routePlan.value?.firstYear ?? null,
        upme: model.value?.upme ?? null,
        measures: measures.value,
        cycle: { caseNumber: form.caseNumber },
      })
    : EMPTY_READINESS,
);
const audit = computed(() => nextAudit(project.value?.audit?.date, new Date()));
const stepLink = (step: string) => (step === 'auditor' ? { name: 'auditor' } : { name: step, params: { projectId: projectId.value } });

const stats = computed(() => [
  { label: 'Listo para reportar', value: `${readiness.value.done} de ${readiness.value.total}`, unit: readiness.value.ready ? 'completo' : 'requisitos' },
  { label: 'Ciclo', value: String(year.value) },
  { label: 'Caso en el SUU', value: form.caseNumber.trim() || '—' },
  { label: 'Próxima auditoría', value: audit.value ? formatDate(audit.value.due) : '—' },
]);

// Archivos del reporte
type Busy = 'paquete' | 'informe' | 'anexos' | null;
const busy = ref<Busy>(null);
const cycleInfo = computed(() => ({ year: year.value, caseNumber: form.caseNumber.trim() || undefined }));
async function deliver(kind: Exclude<Busy, null>) {
  if (busy.value || !model.value || !routePlan.value) return;
  busy.value = kind;
  try {
    const options = { cycle: cycleInfo.value, route: routePlan.value };
    const file =
      kind === 'paquete'
        ? await buildUpmePackage(model.value, options)
        : kind === 'anexos'
          ? await buildUpmeAnnexes(model.value, options)
          : { ...(await generateAuditReport(db, projectId.value)), fileName: upmeFileName('informe', cycleInfo.value) };
    const delivered = await deliverFile(file.blob, file.fileName);
    if (delivered === 'cancelado') return;
    await logReport(db, projectId.value, { kind: kind === 'informe' ? 'auditoria' : 'excel', fileName: file.fileName });
    toast.add({ severity: 'success', summary: delivered === 'compartido' ? 'Archivo compartido' : 'Archivo descargado', detail: file.fileName, life: 4500 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo generar el archivo', detail: error instanceof Error ? error.message : String(error), life: 6500 });
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="vista">
    <PageHeader step="reporte-upme" :stats="stats">
      <template #actions>
        <span class="guardado" :class="{ alerta: status === 'error' }" role="status">
          <IconLoader2 v-if="status === 'guardando'" :size="16" class="girar" />
          <IconAlertTriangle v-else-if="status === 'error'" :size="16" />
          <IconCloudCheck v-else :size="16" />
          {{ { guardado: 'Guardado', guardando: 'Guardando…', error: 'No se pudo guardar' }[status] }}
        </span>
      </template>
    </PageHeader>

    <p class="aviso-linea">
      <IconInfoCircle :size="16" />
      <span>
        PONTIA <strong>no envía nada al SUU</strong>: el reporte lo hace la entidad con su usuario, en el Módulo de Medidas del artículo 237, con un caso por sede. Aquí queda todo listo para diligenciarlo. Las plantillas
        oficiales solo están en el SUU: las hojas del paquete son equivalentes y sus columnas exactas se ajustan cuando las tengas.
      </span>
    </p>

    <section class="card seccion">
      <div class="cabecera-seccion apilada">
        <h2>¿Listo para reportar?</h2>
        <span class="eyebrow">sale de los datos del proyecto · nada bloquea el trabajo</span>
        <StatusChip v-if="readiness.ready" tone="good" label="Lo obligatorio está completo" :icon="IconCircleCheck" />
        <StatusChip v-else tone="warning" :label="readiness.missing.length === 1 ? 'Falta 1 requisito obligatorio' : `Faltan ${readiness.missing.length} requisitos obligatorios`" :icon="IconAlertTriangle" />
      </div>
      <p v-if="failed" class="aviso-linea alerta"><IconAlertTriangle :size="16" /><span>No se pudieron leer los datos del proyecto para revisar el reporte.</span></p>
      <ul class="requisitos">
        <li v-for="item in readiness.items" :key="item.id" :class="{ completo: item.ok }">
          <component :is="item.ok ? IconCircleCheck : IconCircleDashed" :size="20" />
          <span class="texto">
            <strong>{{ item.label }}<small v-if="item.level === 'recomendado'"> · recomendado</small></strong>
            <span v-if="item.detail && !item.ok" class="detalle">{{ item.detail }}</span>
          </span>
          <RouterLink v-if="!item.ok && item.step !== 'reporte-upme'" :to="stepLink(item.step)" class="completar">Completar</RouterLink>
        </li>
      </ul>
    </section>

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2><IconCalendarEvent :size="18" />Caso en el SUU</h2>
        <span class="eyebrow">ciclo, número de caso y concepto de la UPME</span>
      </div>
      <div class="campo">
        <span class="etiqueta">Ciclo de reporte</span>
        <ChoiceChips :model-value="year" :options="yearOptions" label="Ciclo de reporte" @update:model-value="(v) => (year = v)" />
        <div class="otro-ciclo">
          <span class="ayuda">Otro año:</span>
          <NumberInput v-model="year" required :decimals="0" :grouping="false" :min="2024" :max="2100" aria-label="Año del ciclo" />
        </div>
      </div>
      <div class="form-grid">
        <label class="campo">
          <span class="etiqueta">Número de caso</span>
          <InputText v-model="form.caseNumber" class="mono" placeholder="El que asigna el SUU" />
          <small class="ayuda">Va en el nombre de los archivos: sin número queda «XXX».</small>
        </label>
        <label class="campo">
          <span class="etiqueta">Fecha de radicación</span>
          <input v-model="form.filedAt" type="date" class="p-inputtext p-component" />
        </label>
        <label class="campo">
          <span class="etiqueta">Fecha del concepto técnico de la UPME</span>
          <input v-model="form.conceptAt" type="date" class="p-inputtext p-component" />
        </label>
        <label class="campo">
          <span class="etiqueta">Resultado del concepto</span>
          <InputText v-model="form.conceptResult" placeholder="Ej.: con observaciones, aprobado" />
        </label>
        <label class="campo completo">
          <span class="etiqueta">Observaciones de la UPME</span>
          <Textarea v-model="form.conceptNote" auto-resize rows="2" placeholder="Lo que pidió corregir o completar" />
        </label>
      </div>
      <div v-if="audit" class="proxima" :class="{ vencida: audit.overdue, pronto: audit.soon }">
        <IconCalendarEvent :size="18" />
        <span>
          <template v-if="audit.overdue">La auditoría de cada cuatro años venció el {{ formatDate(audit.due) }}: hace {{ Math.abs(audit.days) }} días.</template>
          <template v-else>La próxima auditoría vence el {{ formatDate(audit.due) }} (en {{ audit.days }} días), cuatro años después de la anterior (Ley 1715, art. 30).</template>
        </span>
      </div>
      <p v-else class="ayuda">Anota la fecha de la auditoría en Datos generales para calcular cuándo toca la siguiente.</p>
    </section>

    <section class="card seccion documento">
      <div class="cabecera-seccion">
        <h2><IconFileText :size="18" />Archivos del reporte</h2>
        <span class="eyebrow">con los nombres de la UPME · ART237_{{ year }}_{{ form.caseNumber.trim() || 'XXX' }}</span>
      </div>
      <p class="texto">Descarga los archivos y súbelos al caso en el SUU con el usuario de la entidad.</p>
      <div class="archivos">
        <Button label="Informe de auditoría (Word)" :disabled="!model || busy !== null" @click="deliver('informe')">
          <template #icon><component :is="busy === 'informe' ? IconLoader2 : IconFileText" :size="18" :class="{ girar: busy === 'informe' }" /></template>
        </Button>
        <Button label="Paquete de datos (Excel)" severity="secondary" outlined :disabled="!model || busy !== null" @click="deliver('paquete')">
          <template #icon><component :is="busy === 'paquete' ? IconLoader2 : IconTable" :size="18" :class="{ girar: busy === 'paquete' }" /></template>
        </Button>
        <Button label="Anexos (zip)" severity="secondary" outlined :disabled="!model || busy !== null" @click="deliver('anexos')">
          <template #icon><component :is="busy === 'anexos' ? IconLoader2 : IconFileZip" :size="18" :class="{ girar: busy === 'anexos' }" /></template>
        </Button>
      </div>
      <ul class="nombres">
        <li><IconDownload :size="14" /><span class="mono">ART237_{{ year }}_{{ form.caseNumber.trim() || 'XXX' }}_Informe de Auditoría.docx</span></li>
        <li><IconDownload :size="14" /><span class="mono">ART237_{{ year }}_{{ form.caseNumber.trim() || 'XXX' }}_Anexos Auditorías.zip</span></li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.guardado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--accent-wash);
  color: var(--accent-ink);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.guardado.alerta {
  background: var(--warning-wash);
  color: var(--warning-text);
}
.requisitos {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.requisitos li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--warning-text);
}
.requisitos li.completo {
  color: var(--good-text);
}
.requisitos li > svg {
  flex-shrink: 0;
  margin-top: 1px;
}
.texto {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  color: var(--ink);
  font-size: 13.5px;
}
p.texto {
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
}
.texto small {
  color: var(--muted);
  font-weight: 400;
}
.detalle {
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.4;
}
.completar {
  flex-shrink: 0;
  align-self: center;
  padding: 6px 10px;
  border-radius: 8px;
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.completar:hover {
  background: var(--accent-wash);
}
.otro-ciclo {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 220px;
}
.proxima {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--ink-2);
  font-size: 13.5px;
}
.proxima.pronto {
  background: var(--warning-wash);
  color: var(--warning-text);
}
.proxima.vencida {
  background: var(--critical-wash);
  color: var(--critical-text);
}
.documento {
  border-left: 3px solid var(--accent);
}
.archivos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.nombres {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--muted);
  font-size: 12px;
}
.nombres li {
  display: flex;
  align-items: center;
  gap: 6px;
}
@media (max-width: 639px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
