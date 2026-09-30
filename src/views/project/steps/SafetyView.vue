<script setup lang="ts">
import { IconAlertOctagon, IconBolt, IconCircleCheck, IconInfoCircle, IconPlus, IconShieldBolt, IconSparkles } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, ref } from 'vue';
import RiskChip from '@/components/RiskChip.vue';
import RiskMatrix from '@/components/RiskMatrix.vue';
import EmptyState from '@/components/EmptyState.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useFabAction } from '@/composables/useFab';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { useQuickAdd } from '@/composables/useQuickAdd';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { updateProject } from '@/db/projects';
import { saveRecord } from '@/db/records';
import { getDb } from '@/db/schema';
import { isElectric } from '@/domain/carriers';
import {
  HIGH_RISK_ACTION,
  RISK_LEVELS,
  SAFETY_STATUS_LABEL,
  levelOf,
  matrixCounts,
  needsAttention,
  pendingSafetySuggestions,
  riskFactorInfo,
  safetyCodes,
  safetyFindingFromSuggestion,
  safetySuggestions,
  summarizeSafety,
  urgencyOf,
  worstConsequence,
  type SafetySuggestion,
} from '@/domain/safety';
import { capacityAnalysis, resolveSizing } from '@/domain/sizing';
import type { SafetyFinding } from '@/domain/types';
import type { Tone } from '@/ui/icons';
import { formatDate } from '@/utils/dates';
import { formatNumber } from '@/utils/format';
import SafetyForm from './SafetyForm.vue';

const db = getDb();
const { projectId, project } = useCurrentProject();
const desktop = useMediaQuery('(min-width: 1024px)');

const byUrgency = (a: SafetyFinding, b: SafetyFinding) => urgencyOf(b) - urgencyOf(a) || a.createdAt - b.createdAt;
const { rows: findings, ready } = useProjectRecords('safetyFindings', byUrgency);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es', { numeric: true });
const { rows: areas } = useProjectRecords('areas', byName);
const { rows: equipment } = useProjectRecords('equipment', undefined, isElectric);
const { rows: nodes } = useProjectRecords('electrical');
const { rows: measurements } = useProjectRecords('measurements');
const { rows: bills } = useProjectRecords('bills', undefined, isElectric);
const { rows: series } = useProjectRecords('intervalSeries');

const codes = computed(() => safetyCodes(findings.value));
const summary = computed(() => summarizeSafety(findings.value));
const cells = computed(() => matrixCounts(findings.value));

// Sugerencias: lo que los datos del proyecto señalan como factor de riesgo eléctrico; el auditor decide cuáles adopta
const capacity = computed(() =>
  capacityAnalysis({ nodes: nodes.value, equipment: equipment.value, measurements: measurements.value, bills: bills.value, series: series.value, areas: areas.value, params: resolveSizing(project.value?.sizing) }),
);
const suggestions = computed(() =>
  pendingSafetySuggestions(safetySuggestions({ checks: capacity.value.checks, imbalance: capacity.value.imbalance, equipment: equipment.value, areas: areas.value }), findings.value),
);

const stats = computed(() => [
  { label: 'Hallazgos', value: formatNumber(summary.value.total), unit: `${summary.value.open} abiertos` },
  { label: 'Piden atención', value: formatNumber(summary.value.attention), unit: summary.value.attention ? 'alto riesgo o nivel alto' : 'ninguno' },
  { label: 'Por valorar', value: formatNumber(summary.value.unevaluated), unit: 'sin nivel' },
  { label: 'Cerrados', value: formatNumber(summary.value.closed) },
]);

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'atencion', label: 'Piden atención' },
  { value: 'abiertos', label: 'Abiertos' },
  { value: 'cerrados', label: 'Cerrados' },
] as const;
const filter = ref<(typeof FILTERS)[number]['value']>('todos');
const visibleFindings = computed(() =>
  findings.value.filter((f) => (filter.value === 'todos' ? true : filter.value === 'atencion' ? needsAttention(f) : filter.value === 'abiertos' ? f.status !== 'cerrado' : f.status === 'cerrado')),
);

const STATUS_TONE: Record<SafetyFinding['status'], Tone> = { abierto: 'neutral', 'en-control': 'info', cerrado: 'good' };
const placeName = (f: SafetyFinding): string | undefined => {
  if (!f.entityId) return undefined;
  if (f.entityType === 'area') return areas.value.find((a) => a.id === f.entityId)?.name;
  if (f.entityType === 'equipo') return equipment.value.find((e) => e.id === f.entityId)?.name;
  if (f.entityType === 'electrico') return nodes.value.find((n) => n.id === f.entityId)?.name;
  return undefined;
};

const { visible, draft, isNew, errors, saving, openNew, openEdit, save, saveAndDuplicate, remove } = useRecordEditor('safetyFindings', {
  empty: () => ({
    id: crypto.randomUUID(),
    projectId: projectId.value,
    foundAt: new Date().toISOString().slice(0, 10),
    riskFactor: 'contacto-directo',
    real: false,
    highRisk: false,
    imminent: false,
    description: '',
    status: 'abierto',
    auto: false,
  }),
  validate: (d) => ({ description: d.description.trim() ? undefined : 'Describe lo que se encontró.' }),
  prepare: (d) => ({ ...d, consequence: worstConsequence(d.consequences) ?? d.consequence, confirmed: Boolean(levelOf({ consequence: worstConsequence(d.consequences) ?? d.consequence, frequency: d.frequency })) }),
  describe: (d) => riskFactorInfo(d.riskFactor).label,
  photoEntity: 'seguridad',
  duplicate: (d) => ({ ...d, status: 'abierto', ruleId: undefined, auto: false }),
});

async function adopt(s: SafetySuggestion) {
  const record = await saveRecord(db, 'safetyFindings', safetyFindingFromSuggestion(s, projectId.value, new Date().toISOString().slice(0, 10)));
  openEdit(record);
}

async function setReviewed(value: boolean) {
  await updateProject(db, projectId.value, { safetyReviewed: value || undefined });
}

useFabAction({ label: 'Agregar hallazgo', icon: IconPlus, run: () => openNew() });
useQuickAdd(() => openNew());
</script>

<template>
  <div class="vista">
    <PageHeader step="seguridad" :stats="findings.length ? stats : undefined">
      <template v-if="desktop" #actions>
        <Button label="Agregar hallazgo" @click="openNew()">
          <template #icon><IconPlus :size="18" stroke="2.2" /></template>
        </Button>
      </template>
    </PageHeader>

    <section v-if="summary.attention" class="alerta-critica" role="alert">
      <IconAlertOctagon :size="22" />
      <div>
        <strong>{{ summary.attention }} {{ summary.attention === 1 ? 'hallazgo pide' : 'hallazgos piden' }} atención inmediata</strong>
        <p>
          {{ summary.imminent }} de peligro inminente, {{ summary.highRisk }} de alto riesgo y {{ summary.highLevel }} de nivel alto o muy alto en la matriz. Se ven aquí y en el informe sin importar el ahorro.
        </p>
        <details>
          <summary>Qué dice el RETIE (1.5.1.4.3)</summary>
          <p>{{ HIGH_RISK_ACTION }}</p>
        </details>
      </div>
    </section>

    <p class="aviso-linea">
      <IconInfoCircle :size="16" />
      <span>
        Los riesgos eléctricos se valoran aparte de los hallazgos energéticos y no suman ahorros. El nivel sale de la matriz del RETIE (Res. 40284 de 2026, art. 1.5.1.4.1). Esta pantalla no reemplaza el
        dictamen de inspección del RETIE ni el sistema de gestión de seguridad y salud en el trabajo de la entidad.
      </span>
    </p>

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2><IconShieldBolt :size="18" />Matriz de riesgos</h2>
        <span class="eyebrow">RETIE 1.5.1.4.1 · hallazgos abiertos</span>
      </div>
      <RiskMatrix :cells="cells" :codes="codes" />
      <ul class="leyenda">
        <li v-for="(info, id) in RISK_LEVELS" :key="id">
          <RiskChip :level="id" />
          <span>{{ info.decision.split('.')[0] }}.</span>
        </li>
      </ul>
    </section>

    <section v-if="suggestions.length" class="card seccion sugerencias">
      <div class="cabecera-seccion">
        <h2><IconSparkles :size="18" />Sugerencias de los datos</h2>
        <span class="eyebrow">{{ suggestions.length }} por revisar · PONTIA las sugiere, tú decides</span>
      </div>
      <ul class="lista-sugerencias">
        <li v-for="s in suggestions" :key="s.ruleId" class="sugerencia">
          <span class="factor"><IconBolt :size="16" />{{ riskFactorInfo(s.riskFactor).label }}</span>
          <span class="texto">
            <strong>{{ s.title }}</strong>
            <span>{{ s.description }}</span>
            <small>{{ s.basis }}</small>
          </span>
          <Button label="Valorar" size="small" severity="secondary" outlined @click="adopt(s)" />
        </li>
      </ul>
    </section>

    <template v-if="findings.length">
      <ChoiceChips v-model="filter" :options="FILTERS" label="Filtrar los hallazgos" />
      <div class="rejilla">
        <button v-for="f in visibleFindings" :key="f.id" type="button" class="card hallazgo" :class="{ atencion: needsAttention(f), cerrado: f.status === 'cerrado' }" @click="openEdit(f)">
          <span class="fila">
            <span class="codigo mono">{{ codes.get(f.id) }}</span>
            <strong class="titulo">{{ riskFactorInfo(f.riskFactor).label }}</strong>
            <RiskChip :level="levelOf(f)" />
          </span>
          <span class="donde">{{ [placeName(f), f.real ? 'Riesgo real' : 'Riesgo potencial'].filter(Boolean).join(' · ') }}</span>
          <span class="descripcion">{{ f.description }}</span>
          <span class="marcas">
            <StatusChip v-if="f.imminent" tone="critical" :icon="IconAlertOctagon" label="Peligro inminente" />
            <StatusChip v-if="f.highRisk" tone="critical" :icon="IconAlertOctagon" label="Alto riesgo" />
            <StatusChip :tone="STATUS_TONE[f.status]" :label="SAFETY_STATUS_LABEL[f.status]" />
            <span v-if="f.dueDate" class="plazo">Compromiso: {{ formatDate(f.dueDate) }}</span>
            <span v-if="f.responsible" class="plazo">{{ f.responsible }}</span>
          </span>
        </button>
      </div>
      <div v-if="!visibleFindings.length" class="card">
        <EmptyState :icon="IconCircleCheck" title="Sin resultados" text="Ningún hallazgo cumple ese filtro." />
      </div>
    </template>

    <div v-else-if="ready" class="card">
      <EmptyState
        :icon="IconShieldBolt"
        title="Aún no hay hallazgos de seguridad"
        text="Registra lo que encontraste en el recorrido —tableros sin tapa, conexiones flojas, puestas a tierra ausentes, equipos defectuosos— o valora las sugerencias que salen de los datos."
      >
        <Button label="Agregar el primer hallazgo" @click="openNew()" />
      </EmptyState>
      <label class="fila-interruptor revisado">
        <span>Revisé la seguridad eléctrica y no encontré hallazgos<small>Marca el paso como hecho sin registrar ninguno. El informe lo dirá.</small></span>
        <ToggleSwitch :model-value="Boolean(project?.safetyReviewed)" @update:model-value="setReviewed" />
      </label>
    </div>

    <FormSheet
      v-model:visible="visible"
      :title="isNew ? 'Nuevo hallazgo de seguridad' : riskFactorInfo(draft.riskFactor).label"
      eyebrow="Seguridad eléctrica · RETIE 1.5.1"
      :saving="saving"
      :can-delete="!isNew"
      can-duplicate
      @submit="save"
      @delete="remove()"
      @duplicate="saveAndDuplicate"
    >
      <SafetyForm :key="draft.id" v-model:draft="draft" :errors="errors" :project-id="projectId" :areas="areas" :equipment="equipment" :nodes="nodes" />
    </FormSheet>
  </div>
</template>

<style scoped>
.alerta-critica {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-card);
  background: var(--critical-wash);
  color: var(--critical-text);
}
.alerta-critica svg {
  flex-shrink: 0;
  margin-top: 1px;
}
.alerta-critica strong {
  font-size: 15px;
}
.alerta-critica p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.45;
}
.alerta-critica details {
  margin-top: 8px;
  font-size: 13px;
}
.alerta-critica summary {
  cursor: pointer;
  font-weight: 600;
}
.leyenda {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.leyenda li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.4;
}
.leyenda li :deep(.estado) {
  flex-shrink: 0;
  min-width: 112px;
  justify-content: flex-start;
}
.sugerencias {
  border-left: 3px solid var(--accent);
}
.lista-sugerencias {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sugerencia {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  padding: 10px 0;
}
.sugerencia + .sugerencia {
  border-top: 1px solid var(--divider);
}
.sugerencia .factor {
  display: inline-flex;
  grid-column: 1 / -1;
  align-items: center;
  gap: 5px;
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 600;
}
.sugerencia .texto {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 13px;
}
.sugerencia .texto strong {
  font-size: 14px;
}
.sugerencia .texto span,
.sugerencia .texto small {
  color: var(--ink-2);
}
.sugerencia .texto small {
  color: var(--muted);
}
.rejilla {
  display: grid;
  gap: 10px;
}
.hallazgo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-left: 3px solid var(--border);
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 150ms var(--ease),
    box-shadow 150ms var(--ease);
}
.hallazgo:hover {
  box-shadow: 0 4px 16px rgba(16, 35, 75, 0.08);
}
.hallazgo.atencion {
  border-left-color: var(--critical-text);
}
.hallazgo.cerrado {
  opacity: 0.7;
}
.fila {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.codigo {
  color: var(--accent-strong);
  font-size: 12px;
}
.titulo {
  flex: 1;
  min-width: 0;
  font-size: 15px;
}
.donde {
  color: var(--muted);
  font-size: 12.5px;
}
.descripcion {
  display: -webkit-box;
  overflow: hidden;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.marcas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}
.plazo {
  color: var(--ink-2);
  font-size: 12px;
}
.revisado {
  margin: 8px 12px 12px;
}
@media (min-width: 1024px) {
  .rejilla {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
