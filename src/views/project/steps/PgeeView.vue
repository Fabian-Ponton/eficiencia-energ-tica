<script setup lang="ts">
import { IconAlertTriangle, IconClipboardList, IconCloudCheck, IconDownload, IconLoader2, IconPlus, IconTarget, IconTrash, IconUsers } from '@tabler/icons-vue';
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
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { logReport } from '@/db/projects';
import { saveRecord } from '@/db/records';
import { getDb } from '@/db/schema';
import type { EndUseShare } from '@/domain/calc/balance';
import { sum } from '@/domain/calc/stats';
import { endUseOf } from '@/domain/catalogs';
import { measureEconomics } from '@/domain/measures';
import type { EndUseCategory, Pgee } from '@/domain/types';
import { loadReportData } from '@/reports/data';
import { generatePgeeReport } from '@/reports/generate';
import { buildAuditModel } from '@/reports/model';
import { PRIORITY_STATUS } from '@/ui/icons';
import { formatCop, formatMillionsCop, formatNumber, formatPercent } from '@/utils/format';
import { deliverFile } from '@/utils/share';

const db = getDb();
const toast = useToast();
const { projectId, project } = useCurrentProject();
const { rows: records, ready } = useProjectRecords('pgee', (a, b) => a.createdAt - b.createdAt);
const { rows: measures } = useProjectRecords('measures');

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
  team: TeamRow[];
  objectives: ObjectiveRow[];
  monitoring: string;
  communication: string;
  training: string;
  reviewFrequency: string;
}

const newKey = () => crypto.randomUUID();
const fromRecord = (p?: Pgee): Form => ({
  policy: p?.policy ?? '',
  scope: p?.scope ?? '',
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
const review = shallowRef<{ significant: EndUseShare[]; referenceKwh: number | null }>({ significant: [], referenceKwh: null });
onMounted(async () => {
  try {
    const model = buildAuditModel(await loadReportData(db, projectId.value));
    review.value = { significant: model.significant, referenceKwh: model.referenceKwh };
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
const objectiveCount = computed(() => form.objectives.filter((o) => o.description.trim()).length);
const stats = computed(() => [
  { label: 'Medidas del plan', value: formatNumber(plan.value.length), unit: `de ${formatNumber(measures.value.length)}` },
  { label: 'Ahorro del plan', value: formatNumber(totals.value.kwh), unit: totals.value.share === null ? 'kWh/año' : `kWh/año · ${formatPercent(totals.value.share, 1)}` },
  { label: 'Inversión', value: formatMillionsCop(totals.value.investment), unit: 'COP' },
  { label: 'Objetivos', value: formatNumber(objectiveCount.value) },
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
        <span class="eyebrow">Word · estructura ISO 50001</span>
      </div>
      <p class="texto">
        Política, alcance, equipo, revisión energética, objetivos y metas, planes de acción con la matriz de priorización, recursos, comunicación y seguimiento con M&amp;V (IPMVP).
        Lo que dejes en blanco va como texto propuesto, marcado para que la dirección lo apruebe.
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
          <h2>1. Política energética</h2>
          <span class="eyebrow">compromiso de la dirección</span>
        </div>
        <div class="campo">
          <Textarea v-model="form.policy" auto-resize rows="4" aria-label="Política energética" placeholder="Ej.: La universidad se compromete a mejorar de forma continua su desempeño energético…" />
        </div>
      </section>
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>2. Alcance y límites</h2>
          <span class="eyebrow">instalaciones y energéticos que cubre</span>
        </div>
        <div class="campo">
          <Textarea v-model="form.scope" auto-resize rows="4" aria-label="Alcance y límites" placeholder="Ej.: Bloque 6 con sus aulas, laboratorios y oficinas; energía eléctrica." />
        </div>
      </section>
    </div>

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2><IconUsers :size="18" />3. Equipo de gestión de la energía</h2>
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
        <h2>4. Revisión energética</h2>
        <span class="eyebrow">usos significativos del análisis</span>
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

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2><IconTarget :size="18" />5. Objetivos y metas</h2>
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

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2>6 y 7. Planes de acción y recursos</h2>
        <span class="eyebrow">medidas incluidas en el plan</span>
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
            <StatusChip v-if="m.priority" v-bind="PRIORITY_STATUS[m.priority]" />
          </span>
        </li>
      </ul>
      <p v-else class="nota">Aún no hay medidas en el plan. Créalas o márcalas en Oportunidades.</p>
      <p v-if="plan.length" class="total">
        Total: <strong>{{ formatNumber(totals.kwh) }} kWh/año</strong> · {{ formatCop(totals.cop) }}/año · inversión {{ formatCop(totals.investment) }} · retorno {{ payback(totals.payback) }}
      </p>
    </section>

    <div class="rejilla">
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>8. Comunicación y formación</h2>
          <span class="eyebrow">a quién, qué y cada cuánto</span>
        </div>
        <label class="campo">
          <span class="etiqueta">Comunicación</span>
          <Textarea v-model="form.communication" auto-resize rows="3" placeholder="Ej.: Informe trimestral a la dirección y boletín a los usuarios con el consumo frente a la meta." />
        </label>
        <label class="campo">
          <span class="etiqueta">Formación</span>
          <Textarea v-model="form.training" auto-resize rows="3" placeholder="Ej.: Taller de uso eficiente para mantenimiento y docentes." />
        </label>
      </section>
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>9. Seguimiento, medición y verificación</h2>
          <span class="eyebrow">IPMVP · revisión del plan</span>
        </div>
        <label class="campo">
          <span class="etiqueta">Seguimiento y verificación de los ahorros</span>
          <Textarea v-model="form.monitoring" auto-resize rows="3" placeholder="Ej.: Comparación mensual del consumo con la línea base; opción B del IPMVP para la iluminación." />
        </label>
        <div class="campo">
          <span class="etiqueta">Revisión del plan con la dirección</span>
          <ChoiceChips v-model="form.reviewFrequency" :options="FREQUENCIES" label="Frecuencia de revisión del plan" />
        </div>
      </section>
    </div>
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
@media (min-width: 720px) {
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
