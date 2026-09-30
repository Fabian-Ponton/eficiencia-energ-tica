<script setup lang="ts">
import {
  IconAlertTriangle,
  IconBuildingBank,
  IconCheck,
  IconClipboardList,
  IconCloudCheck,
  IconDownload,
  IconLoader2,
  IconPlus,
  IconScale,
  IconTarget,
  IconTrash,
  IconUserCheck,
  IconUsers,
} from '@tabler/icons-vue';
import { useDebounceFn } from '@vueuse/core';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { RouterLink } from 'vue-router';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import AnnualRoutePanel from './AnnualRoutePanel.vue';
import FollowUpPanel from './FollowUpPanel.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { logReport } from '@/db/projects';
import { saveRecord } from '@/db/records';
import { getDb } from '@/db/schema';
import type { EndUseShare } from '@/domain/calc/balance';
import { sum } from '@/domain/calc/stats';
import { endUseOf } from '@/domain/catalogs';
import { chosenFinancing, FINANCING_GROUPS, FINANCING_MODELS, type FinancingGroup } from '@/domain/financing';
import { measureEconomics } from '@/domain/measures';
import { LEGAL_GOAL_PCT, MEASURE_CLASSES, measureClassOf, planRoute, type MeasureClass } from '@/domain/route';
import type { Bill, EndUseCategory, Pgee, RouteYear } from '@/domain/types';
import type { UpmeBaseline } from '@/domain/upmeBaseline';
import { loadReportData } from '@/reports/data';
import { generatePgeeReport } from '@/reports/generate';
import { buildAuditModel } from '@/reports/model';
import { PRIORITY_STATUS, type Tone } from '@/ui/icons';
import { formatCop, formatMillionsCop, formatNumber, formatPercent } from '@/utils/format';
import { deliverFile } from '@/utils/share';

const db = getDb();
const toast = useToast();
const { projectId, project } = useCurrentProject();
const { rows: records, ready } = useProjectRecords('pgee', (a, b) => a.createdAt - b.createdAt);
const { rows: measures } = useProjectRecords('measures');
const { rows: tasks } = useProjectRecords('tasks');

interface TeamRow {
  key: string;
  role: string;
  name: string;
  responsibilities: string;
}
interface ObjectiveRow {
  key: string;
  description: string;
  targetPercent?: number;
  deadline: string;
}
interface Form {
  policy: string;
  scope: string;
  manager: { name: string; role: string; appointmentDoc: string; appointmentDate: string };
  /** Lo que el auditor cambió de la meta legal; vacío, se usan el año y el consumo que calcula PONTIA. */
  legal: { baseYear?: number; previousYearKwh?: number; pct?: number };
  team: TeamRow[];
  objectives: ObjectiveRow[];
  /** Ruta anual confirmada por el auditor; sin ella se ve la propuesta. */
  route?: RouteYear[];
  financing: { models: string[]; note: string };
  monitoring: string;
  communication: string;
  training: string;
  reviewFrequency: string;
}

const newKey = () => crypto.randomUUID();
const fromRecord = (p?: Pgee): Form => ({
  policy: p?.policy ?? '',
  scope: p?.scope ?? '',
  manager: {
    name: p?.energyManager?.name ?? '',
    role: p?.energyManager?.role ?? '',
    appointmentDoc: p?.energyManager?.appointmentDoc ?? '',
    appointmentDate: p?.energyManager?.appointmentDate ?? '',
  },
  legal: { baseYear: p?.legalGoal?.baseYear, previousYearKwh: p?.legalGoal?.previousYearKwh, pct: p?.legalGoal && p.legalGoal.pct !== LEGAL_GOAL_PCT ? p.legalGoal.pct : undefined },
  route: p?.annualRoute?.map((r) => ({ ...r, measureCodes: [...r.measureCodes] })),
  financing: { models: [...(p?.financing?.models ?? [])], note: p?.financing?.note ?? '' },
  team: (p?.team ?? []).map((t) => ({ key: newKey(), role: t.role, name: t.name, responsibilities: t.responsibilities ?? '' })),
  objectives: (p?.objectives ?? []).map((o) => ({ key: newKey(), description: o.description, targetPercent: o.targetPercent, deadline: o.deadline ?? '' })),
  monitoring: p?.monitoring ?? '',
  communication: p?.communication ?? '',
  training: p?.training ?? '',
  reviewFrequency: p?.reviewFrequency ?? 'Semestral',
});

const form = reactive<Form>(fromRecord());
const recordId = ref<string>(newKey());
const createdAt = ref<number | undefined>(undefined);
const status = ref<'guardado' | 'guardando' | 'error'>('guardado');
let loaded = false;

// Un PGEE por proyecto: se carga una vez y después el formulario manda y se guarda solo
watch(
  [ready, () => records.value[0]],
  ([isReady, record]) => {
    if (!isReady || loaded) return;
    Object.assign(form, fromRecord(record));
    if (record) {
      recordId.value = record.id;
      createdAt.value = record.createdAt;
    }
    void nextTick(() => {
      loaded = true;
    });
  },
  { immediate: true },
);

const persist = useDebounceFn(async () => {
  try {
    // saveRecord quita los textos en blanco
    const saved = await saveRecord(db, 'pgee', {
      id: recordId.value,
      projectId: projectId.value,
      createdAt: createdAt.value,
      policy: form.policy,
      scope: form.scope,
      energyManager: form.manager.name.trim()
        ? {
            name: form.manager.name.trim(),
            role: form.manager.role.trim() || undefined,
            appointmentDoc: form.manager.appointmentDoc.trim() || undefined,
            appointmentDate: form.manager.appointmentDate || undefined,
          }
        : undefined,
      legalGoal:
        form.legal.baseYear !== undefined || form.legal.previousYearKwh !== undefined || form.legal.pct !== undefined
          ? { baseYear: form.legal.baseYear ?? routePlan.value.legal.baseYear, previousYearKwh: form.legal.previousYearKwh, pct: form.legal.pct ?? LEGAL_GOAL_PCT }
          : undefined,
      annualRoute: form.route?.length ? form.route.map((r) => ({ ...r, measureCodes: [...r.measureCodes] })) : undefined,
      financing: form.financing.models.length || form.financing.note.trim() ? { models: [...form.financing.models], note: form.financing.note.trim() || undefined } : undefined,
      team: form.team
        .filter((t) => t.role.trim() || t.name.trim())
        .map((t) => ({ role: t.role.trim(), name: t.name.trim(), responsibilities: t.responsibilities.trim() || undefined })),
      objectives: form.objectives
        .filter((o) => o.description.trim())
        .map((o) => ({ description: o.description.trim(), targetPercent: o.targetPercent ?? undefined, deadline: o.deadline || undefined })),
      monitoring: form.monitoring,
      communication: form.communication,
      training: form.training,
      reviewFrequency: form.reviewFrequency,
    });
    createdAt.value = saved.createdAt;
    status.value = 'guardado';
  } catch {
    status.value = 'error';
  }
}, 700);
watch(
  form,
  () => {
    if (!loaded) return;
    status.value = 'guardando';
    void persist();
  },
  { deep: true },
);

const addMember = () => form.team.push({ key: newKey(), role: '', name: '', responsibilities: '' });
const addObjective = () => form.objectives.push({ key: newKey(), description: '', targetPercent: undefined, deadline: '' });
const FREQUENCIES = [
  { value: 'Trimestral', label: 'Trimestral' },
  { value: 'Semestral', label: 'Semestral' },
  { value: 'Anual', label: 'Anual' },
] as const;

// Revisión energética: usos significativos y consumo de referencia, los mismos que usa el documento
const review = shallowRef<{ significant: EndUseShare[]; referenceKwh: number | null; lastPeriod?: string; bills: Bill[]; upme: UpmeBaseline | null }>({ significant: [], referenceKwh: null, bills: [], upme: null });
onMounted(async () => {
  try {
    const model = buildAuditModel(await loadReportData(db, projectId.value));
    review.value = { significant: model.significant, referenceKwh: model.referenceKwh, lastPeriod: model.data.bills.at(-1)?.period, bills: model.data.bills, upme: model.upme };
  } catch {
    // Sin datos del análisis la pantalla sigue funcionando; el documento explica lo que falta
  }
});

// Planes de acción: las medidas incluidas en el plan, en el orden del documento
const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 } as const;
const plan = computed(() => {
  const economics = project.value?.economics;
  return measures.value
    .filter((m) => m.selected)
    .sort((a, b) => PRIORITY_ORDER[a.priority ?? 'baja'] - PRIORITY_ORDER[b.priority ?? 'baja'] || a.code.localeCompare(b.code, 'es', { numeric: true }))
    .map((m) => ({ m, e: economics ? measureEconomics(m, economics) : null }));
});
const totals = computed(() => {
  const list = plan.value.map(({ m }) => m);
  const kwh = sum(list.map((m) => m.savingsKwhYear));
  const cop = sum(list.map((m) => m.savingsCopYear));
  const investment = sum(list.map((m) => m.investmentCop));
  const net = cop - sum(list.map((m) => m.annualCostCop));
  const reference = review.value.referenceKwh;
  return { kwh, cop, investment, payback: net > 0 ? investment / net : Infinity, share: reference ? kwh / reference : null };
});
// Meta legal y ruta anual: el mismo cálculo que usan el inicio del proyecto y el documento
const routePlan = computed(() =>
  planRoute({
    stored: { annualRoute: form.route, legalGoal: form.legal },
    auditDate: project.value?.audit?.date,
    lastPeriod: review.value.lastPeriod,
    today: new Date(),
    measures: measures.value,
    tasks: tasks.value,
    referenceKwh: review.value.referenceKwh,
  }),
);
const firstRow = computed(() => routePlan.value.rows.find((r) => r.legalMinimum));
const legalBar = computed(() => (firstRow.value?.targetKwh ? Math.min(100, (firstRow.value.plannedKwh / firstRow.value.targetKwh) * 100) : 0));
const percentText = (value: number | null | undefined) => (value === null || value === undefined ? '—' : formatPercent(value / 100, 1));

const managerStatus = computed<{ tone: Tone; label: string }>(() => {
  const m = form.manager;
  if (!m.name.trim()) return { tone: 'critical', label: 'Sin designar' };
  return m.appointmentDoc.trim() && m.appointmentDate ? { tone: 'good', label: 'Designado' } : { tone: 'warning', label: 'Falta el acto de designación' };
});

const CLASS_TONE: Record<MeasureClass, Tone> = { A: 'good', B: 'info', C: 'warning' };
const classOf = (paybackYears?: number) => measureClassOf(paybackYears ?? Number.POSITIVE_INFINITY);

const groupedModels = (Object.keys(FINANCING_GROUPS) as FinancingGroup[]).map((group) => ({ group, label: FINANCING_GROUPS[group], models: FINANCING_MODELS.filter((m) => m.group === group) }));
const toggleModel = (id: string) => {
  const at = form.financing.models.indexOf(id);
  if (at >= 0) form.financing.models.splice(at, 1);
  else form.financing.models.push(id);
};
const chosenCount = computed(() => chosenFinancing(form.financing.models).length);

const stats = computed(() => [
  { label: 'Medidas del plan', value: formatNumber(plan.value.length), unit: `de ${formatNumber(measures.value.length)}` },
  { label: 'Ahorro del plan', value: formatNumber(totals.value.kwh), unit: totals.value.share === null ? 'kWh/año' : `kWh/año · ${formatPercent(totals.value.share, 1)}` },
  { label: 'Inversión', value: formatMillionsCop(totals.value.investment), unit: 'COP' },
  { label: `Primer año · ${routePlan.value.legal.firstYear}`, value: percentText(firstRow.value?.plannedPct), unit: `mínimo ${formatNumber(routePlan.value.legal.pct, 0)} %` },
]);

// PGEE en Word
const generating = ref(false);
const progress = ref<{ step: string; done: number; total: number } | null>(null);
async function generate() {
  if (generating.value) return;
  generating.value = true;
  try {
    // Lo último que se escribió también entra en el documento
    if (status.value === 'guardando') await persist();
    const { blob, fileName } = await generatePgeeReport(db, projectId.value, {
      onProgress: (step, done, total) => {
        progress.value = { step, done, total };
      },
    });
    const delivered = await deliverFile(blob, fileName);
    if (delivered === 'cancelado') return;
    await logReport(db, projectId.value, { kind: 'pgee', fileName });
    toast.add({ severity: 'success', summary: delivered === 'compartido' ? 'PGEE compartido' : 'PGEE descargado', detail: fileName, life: 4000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo generar el PGEE', detail: error instanceof Error ? error.message : String(error), life: 6000 });
  } finally {
    generating.value = false;
    progress.value = null;
  }
}

const payback = (years?: number) => (years !== undefined && Number.isFinite(years) ? `${formatNumber(years, 1)} años` : '—');
const useOf = (category: string) => endUseOf(category as EndUseCategory);
/** Meta en kWh/año sobre el consumo de referencia, para saber cuánto significa el porcentaje. */
const equivalentKwh = (percent?: number) => (percent && review.value.referenceKwh ? `≈ ${formatNumber((percent / 100) * review.value.referenceKwh)} kWh/año` : '');
</script>

<template>
  <div class="vista">
    <PageHeader step="pgee" :stats="stats">
      <template #actions>
        <span class="guardado" :class="{ alerta: status === 'error' }" role="status">
          <IconLoader2 v-if="status === 'guardando'" :size="16" class="girar" />
          <IconAlertTriangle v-else-if="status === 'error'" :size="16" />
          <IconCloudCheck v-else :size="16" />
          {{ { guardado: 'Guardado', guardando: 'Guardando…', error: 'No se pudo guardar' }[status] }}
        </span>
      </template>
    </PageHeader>

    <section class="card seccion documento">
      <div class="cabecera-seccion">
        <h2><IconClipboardList :size="20" />Plan de gestión eficiente de la energía</h2>
        <span class="eyebrow">Word · siete etapas de la guía de la UPME</span>
      </div>
      <p class="texto">
        Decisión y marco legal, diagnóstico energético, formulación con la meta legal y la ruta anual, selección de proyectos, modelo financiero y contractual, implementación y seguimiento con M&amp;V
        (IPMVP). Lo que dejes en blanco va como texto propuesto, marcado para que la dirección lo apruebe.
      </p>
      <div v-if="generating && progress" class="avance" role="progressbar" :aria-valuenow="progress.done" aria-valuemin="0" :aria-valuemax="progress.total">
        <span class="pista"><span class="relleno" :style="{ width: `${Math.round(((progress.done + 1) / progress.total) * 100)}%` }" /></span>
        <span class="mono paso">{{ progress.step }}</span>
      </div>
      <Button :label="generating ? 'Generando el PGEE…' : 'Generar PGEE (Word)'" :disabled="generating" class="generar" @click="generate">
        <template #icon><component :is="generating ? IconLoader2 : IconDownload" :size="18" :class="{ girar: generating }" /></template>
      </Button>
    </section>

    <div class="rejilla">
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>1.2 Política energética</h2>
          <span class="eyebrow">etapa 1 · compromiso de la dirección</span>
        </div>
        <div class="campo">
          <Textarea v-model="form.policy" auto-resize rows="4" aria-label="Política energética" placeholder="Ej.: La universidad se compromete a mejorar de forma continua su desempeño energético…" />
        </div>
      </section>
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>1.3 Alcance y límites</h2>
          <span class="eyebrow">instalaciones y energéticos que cubre</span>
        </div>
        <div class="campo">
          <Textarea v-model="form.scope" auto-resize rows="4" aria-label="Alcance y límites" placeholder="Ej.: Bloque de laboratorios de la Sede Riohacha, con sus laboratorios y oficinas; electricidad y gas natural." />
        </div>
      </section>
    </div>

    <section class="card seccion">
      <div class="cabecera-seccion apilada">
        <h2><IconUserCheck :size="18" />1.4 Gestor energético</h2>
        <span class="eyebrow">responsable del seguimiento y la evaluación · Res. 40412, art. 4, par. 3</span>
        <StatusChip :tone="managerStatus.tone" :label="managerStatus.label" />
      </div>
      <p class="nota">
        Es la persona que lidera la estructuración y la implementación del PGEE. La resolución exige definir un responsable; la guía de la UPME dice que su nombramiento es lo que materializa el compromiso de
        la entidad. Deja constancia del acto con que se designó.
      </p>
      <div class="form-grid">
        <label class="campo">
          <span class="etiqueta">Nombre o cargo del gestor</span>
          <InputText v-model="form.manager.name" placeholder="Nombre y cargo, o la dependencia que lo asume" />
        </label>
        <label class="campo">
          <span class="etiqueta">Rol en el plan</span>
          <InputText v-model="form.manager.role" placeholder="Gestor energético" />
        </label>
        <label class="campo">
          <span class="etiqueta">Acto de designación</span>
          <InputText v-model="form.manager.appointmentDoc" placeholder="Ej.: Resolución rectoral 0123 de 2026" />
        </label>
        <label class="campo">
          <span class="etiqueta">Fecha del acto</span>
          <input v-model="form.manager.appointmentDate" type="date" class="p-inputtext p-component" />
        </label>
      </div>
    </section>

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2><IconUsers :size="18" />1.5 Equipo de gestión de la energía</h2>
        <span class="eyebrow">roles y responsabilidades</span>
        <Button label="Agregar" size="small" severity="secondary" outlined @click="addMember">
          <template #icon><IconPlus :size="16" /></template>
        </Button>
      </div>
      <p v-if="!form.team.length" class="nota">Sin integrantes todavía: el PGEE propone los roles de dirección, líder de gestión y mantenimiento.</p>
      <div v-for="(t, index) in form.team" :key="t.key" class="fila-editable equipo">
        <label class="campo">
          <span class="etiqueta">Rol</span>
          <InputText v-model="t.role" placeholder="Líder de gestión de la energía" />
        </label>
        <label class="campo">
          <span class="etiqueta">Nombre o dependencia</span>
          <InputText v-model="t.name" placeholder="Nombre y cargo" />
        </label>
        <label class="campo">
          <span class="etiqueta">Responsabilidades</span>
          <InputText v-model="t.responsibilities" placeholder="Qué hace en el plan" />
        </label>
        <button type="button" class="boton-icono" :aria-label="`Quitar a ${t.name || t.role || 'este integrante'}`" @click="form.team.splice(index, 1)"><IconTrash :size="18" /></button>
      </div>
    </section>

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2>2. Diagnóstico energético: revisión</h2>
        <span class="eyebrow">etapa 2 · usos significativos del análisis</span>
      </div>
      <template v-if="review.significant.length">
        <div class="barra-usos" role="img" :aria-label="`Los usos significativos suman el ${formatPercent(review.significant[review.significant.length - 1].cumulativeShare, 0)} del consumo`">
          <span v-for="s in review.significant" :key="s.category" :style="{ width: `${s.share * 100}%`, background: useOf(s.category).color }" />
        </div>
        <ul class="usos">
          <li v-for="s in review.significant" :key="s.category">
            <span class="muestra" :style="{ background: useOf(s.category).color }" />
            <span>{{ useOf(s.category).label }}</span>
            <span class="mono num">{{ formatPercent(s.share, 0) }}</span>
          </li>
        </ul>
      </template>
      <p v-else class="nota">Registra el inventario para identificar los usos significativos.</p>
      <p class="nota">La línea base y los indicadores del paso de balance van completos en el documento.</p>
    </section>

    <section class="card seccion meta-legal">
      <div class="cabecera-seccion apilada">
        <h2><IconScale :size="18" />3.1 Meta legal del primer año</h2>
        <span class="eyebrow">etapa 3 · Ley 1715, art. 30 (modificado por la Ley 2294, art. 237)</span>
        <StatusChip v-if="firstRow?.status === 'cumple'" tone="good" label="El plan la alcanza" :icon="IconCheck" />
        <StatusChip v-else-if="firstRow?.status === 'no-cumple'" tone="critical" label="El plan no la alcanza" :icon="IconAlertTriangle" />
        <StatusChip v-else tone="neutral" label="Sin datos para compararla" />
      </div>
      <p v-if="routePlan.legal.targetKwh !== null" class="cifra-legal">
        <strong>{{ formatNumber(routePlan.legal.pct, 0) }} %</strong> del consumo de {{ routePlan.legal.baseYear }} ({{ formatNumber(routePlan.legal.referenceKwh ?? 0) }} kWh) =
        <strong>{{ formatNumber(routePlan.legal.targetKwh) }} kWh/año</strong> de ahorro en {{ routePlan.legal.firstYear }}.
      </p>
      <p v-else class="nota">Falta el consumo del año anterior: registra 12 facturas o escríbelo abajo.</p>
      <div v-if="firstRow?.targetKwh" class="medidor" role="img" :aria-label="`El plan prevé ${percentText(firstRow.plannedPct)} en ${firstRow.year}; la meta es ${percentText(firstRow.targetPct)}`">
        <span class="pista"><span class="relleno" :class="{ falta: firstRow.status === 'no-cumple' }" :style="{ width: `${legalBar}%` }" /></span>
        <span class="mono leyenda-medidor">
          el plan prevé {{ formatNumber(firstRow.plannedKwh) }} kWh/año ({{ percentText(firstRow.plannedPct) }})
          <template v-if="firstRow.gapKwh > 0">· faltan {{ formatNumber(firstRow.gapKwh) }} kWh/año</template>
        </span>
      </div>
      <div class="form-grid tres">
        <label class="campo">
          <span class="etiqueta">Año de referencia</span>
          <NumberInput v-model="form.legal.baseYear" :decimals="0" :grouping="false" :min="2000" :max="2100" :placeholder="String(routePlan.legal.baseYear)" />
          <small class="ayuda">«El año anterior» a la primera ola de ahorro: por omisión, el de la auditoría.</small>
        </label>
        <label class="campo">
          <span class="etiqueta">Consumo del año anterior</span>
          <NumberInput v-model="form.legal.previousYearKwh" :decimals="0" suffix="kWh" :placeholder="review.referenceKwh !== null ? formatNumber(review.referenceKwh) : 'Sin facturas'" />
          <small class="ayuda">Vacío: se usan los últimos 12 meses facturados.</small>
        </label>
        <label class="campo">
          <span class="etiqueta">Meta</span>
          <NumberInput v-model="form.legal.pct" :decimals="1" :min="LEGAL_GOAL_PCT" :max="100" suffix="%" :placeholder="String(LEGAL_GOAL_PCT)" />
          <small class="ayuda">No puede ser menor que el 15 % de la ley.</small>
        </label>
      </div>
      <p class="aviso-linea">
        <span>
          La ley pide, en el año siguiente a la auditoría, estrategias que permitan un ahorro de «mínimo 15 % respecto del consumo del año anterior» y, desde el segundo año, «metas sostenibles definidas por la
          auditoría y a ser alcanzadas a más tardar en el año 2026». No dice cuál es «el año anterior» ni PONTIA interpreta ese plazo: se muestra tal cual. Consúltalo con la UPME si tu caso lo requiere.
        </span>
      </p>
    </section>

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2><IconTarget :size="18" />3.2 Objetivos y metas</h2>
        <span class="eyebrow">{{ totals.share !== null && plan.length ? `las medidas del plan ahorran el ${formatPercent(totals.share, 1)} del consumo` : 'metas frente a la línea base' }}</span>
        <Button label="Agregar" size="small" severity="secondary" outlined @click="addObjective">
          <template #icon><IconPlus :size="16" /></template>
        </Button>
      </div>
      <p v-if="!form.objectives.length" class="nota">Sin objetivos todavía: el PGEE propone como meta el ahorro de las medidas del plan.</p>
      <div v-for="(o, index) in form.objectives" :key="o.key" class="fila-editable objetivo">
        <label class="campo">
          <span class="etiqueta">Objetivo</span>
          <InputText v-model="o.description" placeholder="Ej.: Reducir el consumo del bloque" />
        </label>
        <label class="campo">
          <span class="etiqueta">Meta<span v-if="equivalentKwh(o.targetPercent)" class="equivalente">{{ equivalentKwh(o.targetPercent) }}</span></span>
          <NumberInput v-model="o.targetPercent" :decimals="1" :max="100" suffix="%" />
        </label>
        <label class="campo">
          <span class="etiqueta">Plazo</span>
          <input v-model="o.deadline" type="date" class="p-inputtext p-component" />
        </label>
        <button type="button" class="boton-icono" :aria-label="`Quitar el objetivo ${o.description || index + 1}`" @click="form.objectives.splice(index, 1)"><IconTrash :size="18" /></button>
      </div>
    </section>

    <AnnualRoutePanel v-model="form.route" :plan="routePlan" :measures="measures" />

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2>4. Selección de proyectos: planes de acción</h2>
        <span class="eyebrow">etapa 4 · medidas incluidas en el plan</span>
        <RouterLink :to="{ name: 'oportunidades', params: { projectId } }" class="enlace">Editar medidas</RouterLink>
      </div>
      <ul v-if="plan.length" class="filas plan">
        <li v-for="{ m, e } in plan" :key="m.id" class="fila-boton estatica">
          <span class="fila-principal">
            <strong><span class="mono codigo">{{ m.code }}</span> {{ m.title }}</strong>
          </span>
          <span class="fila-secundaria">
            <span>{{ formatNumber(m.savingsKwhYear) }} kWh/año · {{ formatCop(m.savingsCopYear) }}/año</span>
            <strong class="retorno">{{ payback(e?.paybackYears) }}</strong>
          </span>
          <span class="fila-secundaria">
            <span>Inversión {{ formatCop(m.investmentCop) }}</span>
            <span class="marcas">
              <StatusChip :tone="CLASS_TONE[classOf(e?.paybackYears)]" :label="MEASURE_CLASSES[classOf(e?.paybackYears)].label" />
              <StatusChip v-if="m.priority" v-bind="PRIORITY_STATUS[m.priority]" />
            </span>
          </span>
        </li>
      </ul>
      <p v-else class="nota">Aún no hay medidas en el plan. Créalas o márcalas en Oportunidades.</p>
      <p v-if="plan.length" class="total">
        Total: <strong>{{ formatNumber(totals.kwh) }} kWh/año</strong> · {{ formatCop(totals.cop) }}/año · inversión {{ formatCop(totals.investment) }} · retorno {{ payback(totals.payback) }}
      </p>
      <p class="nota">
        Tipo de medida según la guía de la UPME: A, retorno menor de 1 año ({{ MEASURE_CLASSES.A.examples }}); B, de 1 a 3 años ({{ MEASURE_CLASSES.B.examples }}); C, más de 3 años ({{ MEASURE_CLASSES.C.examples }}).
      </p>
    </section>

    <section class="card seccion">
      <div class="cabecera-seccion apilada">
        <h2><IconBuildingBank :size="18" />5. Modelo financiero y contractual</h2>
        <span class="eyebrow">etapa 5 · guía de la UPME, módulo 3</span>
        <StatusChip v-if="chosenCount" tone="good" :label="`${chosenCount} ${chosenCount === 1 ? 'camino elegido' : 'caminos elegidos'}`" />
        <StatusChip v-else tone="neutral" label="Sin elegir" />
      </div>
      <p class="nota">
        Marca los caminos que la entidad considera para pagar las medidas. El PGEE no decide el instrumento jurídico: la entidad lo define con su oficina jurídica y de presupuesto, y las medidas pueden usar
        modelos distintos.
      </p>
      <div v-for="g in groupedModels" :key="g.group" class="grupo-modelos">
        <h3>{{ g.label }}</h3>
        <div class="modelos">
          <button v-for="model in g.models" :key="model.id" type="button" class="modelo" :class="{ activo: form.financing.models.includes(model.id) }" :aria-pressed="form.financing.models.includes(model.id)" @click="toggleModel(model.id)">
            <span class="marca"><IconCheck v-if="form.financing.models.includes(model.id)" :size="14" stroke="3" /></span>
            <span class="modelo-texto">
              <strong>{{ model.label }}</strong>
              <small>{{ model.description }}</small>
            </span>
          </button>
        </div>
      </div>
      <label class="campo">
        <span class="etiqueta">Decisión de la entidad</span>
        <Textarea v-model="form.financing.note" auto-resize rows="3" placeholder="Ej.: Las medidas de buenas prácticas se pagan con gastos de funcionamiento; el cambio de iluminación, con un proyecto de inversión del banco de proyectos." />
      </label>
    </section>

    <div class="rejilla">
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>6. Implementación: comunicación y formación</h2>
          <span class="eyebrow">etapa 6 · a quién, qué y cada cuánto</span>
        </div>
        <label class="campo">
          <span class="etiqueta">Comunicación</span>
          <Textarea v-model="form.communication" auto-resize rows="3" placeholder="Ej.: Informe trimestral a la dirección y boletín a los usuarios con el consumo frente a la meta." />
        </label>
        <label class="campo">
          <span class="etiqueta">Formación</span>
          <Textarea v-model="form.training" auto-resize rows="3" placeholder="Ej.: Taller de uso eficiente para mantenimiento y docentes." />
        </label>
        <p class="nota">El cronograma, el presupuesto y el avance de las tareas están en el paso Implementación.</p>
      </section>
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>7. Seguimiento, reporte y verificación</h2>
          <span class="eyebrow">etapa 7 · IPMVP · revisión del plan</span>
        </div>
        <label class="campo">
          <span class="etiqueta">Seguimiento y verificación de los ahorros</span>
          <Textarea v-model="form.monitoring" auto-resize rows="3" placeholder="Ej.: Comparación mensual del consumo con la línea base; opción B del IPMVP para la iluminación." />
        </label>
        <div class="campo">
          <span class="etiqueta">Revisión del plan con la dirección</span>
          <ChoiceChips v-model="form.reviewFrequency" :options="FREQUENCIES" label="Frecuencia de revisión del plan" />
        </div>
        <p class="nota">El gestor energético anota cada mes las observaciones del plan y la dirección lo revisa cada año; el informe anual de resultados se presenta a la UPME.</p>
      </section>
    </div>

    <FollowUpPanel :bills="review.bills" :plan="routePlan" :baseline="review.upme" />
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
.documento {
  gap: 14px;
  border-left: 3px solid var(--accent);
}
.texto {
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
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
.nota {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.fila-editable {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 10px;
  align-items: end;
  padding-top: 12px;
  border-top: 1px solid var(--divider);
}
.fila-editable > .campo {
  grid-column: 1;
}
.fila-editable > .boton-icono {
  grid-row: 1;
  grid-column: 2;
}
.equivalente {
  margin-left: 6px;
  color: var(--muted);
  font-weight: 400;
}
.barra-usos {
  display: flex;
  height: 14px;
  overflow: hidden;
  border-radius: 7px;
  background: var(--divider);
}
.barra-usos span {
  height: 100%;
}
.barra-usos span + span {
  border-left: 2px solid var(--surface);
}
.usos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.usos li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.usos .num {
  color: var(--muted);
}
.muestra {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.enlace {
  font-size: 13px;
  font-weight: 600;
}
.plan {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.estatica {
  cursor: default;
}
.plan .fila-principal strong {
  font-weight: 600;
}
.retorno {
  color: var(--ink);
  font-weight: 600;
  white-space: nowrap;
}
.codigo {
  color: var(--accent-strong);
  font-size: 12px;
}
.app-dark .codigo {
  color: var(--accent);
}
.total {
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
}
.meta-legal {
  border-left: 3px solid var(--serious);
}
.cifra-legal {
  margin: 0;
  color: var(--ink-2);
  font-size: 15px;
}
.cifra-legal strong {
  color: var(--ink);
}
.medidor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.medidor .pista {
  height: 10px;
  border-radius: 5px;
}
.medidor .relleno {
  border-radius: 5px;
}
.medidor .relleno.falta {
  background: var(--critical-text);
}
.leyenda-medidor {
  color: var(--muted);
  font-size: 12px;
}
.marcas {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}
.grupo-modelos {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.grupo-modelos h3 {
  margin: 0;
  color: var(--ink-2);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.modelos {
  display: grid;
  gap: 8px;
}
.modelo {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--field-border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition:
    background-color 120ms var(--ease),
    border-color 120ms var(--ease);
}
.modelo:hover {
  border-color: var(--axis);
}
.modelo.activo {
  border-color: var(--accent-strong);
  background: var(--accent-wash);
}
.modelo .marca {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border: 1.5px solid var(--field-border);
  border-radius: 5px;
  color: #fff;
}
.modelo.activo .marca {
  border-color: var(--accent-strong);
  background: var(--accent-strong);
}
.modelo-texto {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.modelo-texto strong {
  font-size: 13.5px;
}
.modelo-texto small {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}
@media (min-width: 720px) {
  .modelos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .fila-editable.equipo {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr) auto;
  }
  .fila-editable.objetivo {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  }
  .fila-editable > .campo {
    grid-column: auto;
  }
  .fila-editable > .boton-icono {
    grid-row: auto;
    grid-column: auto;
  }
}
@media (min-width: 1024px) {
  .rejilla {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
</style>
