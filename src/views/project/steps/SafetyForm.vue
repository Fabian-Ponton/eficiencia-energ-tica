<script setup lang="ts">
import { IconAlertOctagon, IconBolt, IconGauge, IconMapPin, IconShieldCheck, IconTools } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, watch } from 'vue';
import RiskChip from '@/components/RiskChip.vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import {
  CONSEQUENCE_CLASSES,
  CONTROL_HIERARCHY,
  FREQUENCIES,
  HIGH_RISK_ACTION,
  HIGH_RISK_CRITERIA,
  RISK_FACTORS,
  RISK_LEVELS,
  levelOf,
  riskFactorInfo,
  worstConsequence,
  type RiskClass,
} from '@/domain/safety';
import type { Area, ElectricalNode, Equipment, EntityType, RiskLevelNumber, SafetyFinding } from '@/domain/types';

/** Formulario de un hallazgo de seguridad eléctrica: el factor de riesgo del RETIE, su valoración con la matriz y el control. */
const draft = defineModel<Draft<SafetyFinding>>('draft', { required: true });
const props = defineProps<{ errors: FieldErrors; projectId: string; areas: readonly Area[]; equipment: readonly Equipment[]; nodes: readonly ElectricalNode[] }>();

const factor = computed(() => riskFactorInfo(draft.value.riskFactor));
const FACTOR_OPTIONS = RISK_FACTORS.map((f) => ({ value: f.id, label: f.label }));
const REAL_OPTIONS = [
  { value: 'potencial', label: 'Potencial' },
  { value: 'real', label: 'Real' },
] as const;
const real = computed({ get: () => (draft.value.real ? 'real' : 'potencial'), set: (value) => (draft.value.real = value === 'real') });

// Ubicación: un espacio, un equipo o un elemento del sistema eléctrico
const locationGroups = computed(() => [
  { label: 'Sistema eléctrico', items: props.nodes.map((n) => ({ value: `electrico:${n.id}`, label: n.name })) },
  { label: 'Espacios', items: props.areas.map((a) => ({ value: `area:${a.id}`, label: a.name })) },
  { label: 'Equipos', items: props.equipment.map((e) => ({ value: `equipo:${e.id}`, label: `${e.name}${e.code ? ` · ${e.code}` : ''}` })) },
]);
const location = computed({
  get: () => (draft.value.entityType && draft.value.entityId ? `${draft.value.entityType}:${draft.value.entityId}` : undefined),
  set: (value?: string) => {
    if (!value) {
      draft.value.entityType = undefined;
      draft.value.entityId = undefined;
      return;
    }
    const [type, ...rest] = value.split(':');
    draft.value.entityType = type as EntityType;
    draft.value.entityId = rest.join(':');
  },
});

// Valoración: la consecuencia de cada clase y la frecuencia; el nivel sale de cruzar la más grave con la frecuencia
const LEVELS = ([1, 2, 3, 4, 5] as const).map((n) => ({ value: n, label: String(n) }));
const FREQUENCY_OPTIONS = FREQUENCIES.map((f) => ({ value: f.id, label: f.id.toUpperCase() }));
const consequences = (klass: RiskClass) => ({
  get: () => draft.value.consequences?.[klass],
  set: (value?: RiskLevelNumber) => {
    draft.value.consequences = { ...draft.value.consequences, [klass]: value };
  },
});
const chosen = computed(() => Object.fromEntries(CONSEQUENCE_CLASSES.map((c) => [c.id, draft.value.consequences?.[c.id]])) as Record<RiskClass, RiskLevelNumber | undefined>);
const worst = computed(() => worstConsequence(draft.value.consequences) ?? draft.value.consequence);
watch(worst, (value) => (draft.value.consequence = value), { immediate: true });
const level = computed(() => levelOf({ consequence: worst.value, frequency: draft.value.frequency }));
const frequencyLabel = computed(() => FREQUENCIES.find((f) => f.id === draft.value.frequency)?.label);
const levelInfo = computed(() => (level.value ? RISK_LEVELS[level.value] : null));

const STATES = [
  { value: 'abierto', label: 'Abierto' },
  { value: 'en-control', label: 'En control' },
  { value: 'cerrado', label: 'Cerrado' },
] as const;
const CONTROLS = CONTROL_HIERARCHY.map((c) => ({ value: c.id, label: c.label }));
const flagged = computed(() => draft.value.highRisk || draft.value.imminent);
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconBolt :size="16" />Factor de riesgo</h3>
    <label class="campo">
      <span class="etiqueta">Factor de riesgo eléctrico (RETIE 1.5.1.3)</span>
      <Select v-model="draft.riskFactor" :options="FACTOR_OPTIONS" option-label="label" option-value="value" filter />
    </label>
    <div class="ayuda-riesgo">
      <p><strong>Posibles causas.</strong> {{ factor.causes }}</p>
      <p><strong>Medidas de protección.</strong> {{ factor.protections }}</p>
    </div>
    <div class="campo">
      <span class="etiqueta">El riesgo es</span>
      <ChoiceChips v-model="real" :options="REAL_OPTIONS" label="Riesgo potencial o real" fill />
      <small class="ayuda">Real: ya se presenta en la instalación. Potencial: puede presentarse si no se controla.</small>
    </div>
    <label class="campo">
      <span class="etiqueta">Qué se encontró</span>
      <Textarea v-model="draft.description" auto-resize rows="3" placeholder="Ej.: el tablero del laboratorio no tiene tapa ni etiqueta y hay cables sin canaleta" :invalid="Boolean(errors.description)" />
      <small v-if="errors.description" class="error">{{ errors.description }}</small>
    </label>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconMapPin :size="16" />Ubicación</h3>
    <label class="campo">
      <span class="etiqueta">Dónde está</span>
      <Select
        v-model="location"
        :options="locationGroups"
        option-label="label"
        option-value="value"
        option-group-label="label"
        option-group-children="items"
        placeholder="Espacio, equipo o tablero"
        filter
        show-clear
      />
    </label>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Fecha del hallazgo</span>
        <input v-model="draft.foundAt" type="date" class="p-inputtext p-component" />
      </label>
      <label class="campo">
        <span class="etiqueta">Norma de referencia</span>
        <InputText v-model="draft.normRef" placeholder="Ej.: RETIE 1.5.1; NTC 2050" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconGauge :size="16" />Valoración con la matriz del RETIE (1.5.1.4.1)</h3>
    <p v-if="draft.auto && !draft.confirmed" class="aviso-linea alerta">Lo sugirió PONTIA con los datos del proyecto: valora la consecuencia y la frecuencia con tu criterio antes de darlo por evaluado.</p>
    <p class="ayuda-seccion">Elige la consecuencia de cada clase de pérdida que aplique (1 a 5). Se toma la más grave y se cruza con la frecuencia.</p>
    <div v-for="klass in CONSEQUENCE_CLASSES" :key="klass.id" class="campo">
      <span class="etiqueta">{{ klass.label }}</span>
      <ChoiceChips :model-value="chosen[klass.id]" :options="LEVELS" :label="`Consecuencia ${klass.label.toLowerCase()}`" clearable fill @update:model-value="(v) => consequences(klass.id).set(v as RiskLevelNumber | undefined)" />
      <small class="ayuda">{{ chosen[klass.id] ? `${chosen[klass.id]} · ${klass.levels[chosen[klass.id] as RiskLevelNumber]}` : 'Sin valorar' }}</small>
    </div>
    <div class="campo">
      <span class="etiqueta">Frecuencia</span>
      <ChoiceChips v-model="draft.frequency" :options="FREQUENCY_OPTIONS" label="Frecuencia" clearable fill />
      <small class="ayuda">{{ frequencyLabel ?? 'A es la más frecuente (varias veces al mes en la empresa); E, la menos (no ha ocurrido en el sector).' }}</small>
    </div>
    <div class="resultado">
      <RiskChip :level="level" />
      <template v-if="levelInfo">
        <p><strong>Decisión.</strong> {{ levelInfo.decision }} {{ levelInfo.permit }}</p>
        <p><strong>Para ejecutar los trabajos.</strong> {{ levelInfo.execution }}</p>
      </template>
      <p v-else class="ayuda">Elige la consecuencia y la frecuencia para ver el nivel de riesgo y qué exige el RETIE para trabajar.</p>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconAlertOctagon :size="16" />Alto riesgo y peligro inminente</h3>
    <label class="fila-interruptor">
      <span>Alto riesgo<small>Lo determina una persona competente en electrotecnia con los criterios del RETIE (1.5.1.4.2).</small></span>
      <ToggleSwitch v-model="draft.highRisk" />
    </label>
    <label class="fila-interruptor">
      <span>Peligro inminente<small>Hay indicios racionales de que el accidente puede ocurrir antes de estudiar el problema a fondo.</small></span>
      <ToggleSwitch v-model="draft.imminent" />
    </label>
    <template v-if="flagged">
      <p class="aviso-linea alerta">{{ HIGH_RISK_ACTION }}</p>
      <ul class="criterios">
        <li v-for="c in HIGH_RISK_CRITERIA" :key="c.id"><b>{{ c.id }}.</b> {{ c.text }}</li>
      </ul>
      <label class="campo">
        <span class="etiqueta">Antecedente comparable (criterio d)</span>
        <InputText v-model="draft.precedent" placeholder="Un hecho ocurrido en condiciones similares, con su fuente" />
      </label>
      <label class="campo">
        <span class="etiqueta">Persona competente que evaluó</span>
        <InputText v-model="draft.evaluator" placeholder="Nombre y cargo" />
      </label>
    </template>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconTools :size="16" />Control y seguimiento</h3>
    <div class="campo">
      <span class="etiqueta">Tipo de control</span>
      <ChoiceChips v-model="draft.control" :options="CONTROLS" label="Tipo de control" clearable />
    </div>
    <label class="campo">
      <span class="etiqueta">Acción inmediata</span>
      <Textarea v-model="draft.immediateAction" auto-resize rows="2" placeholder="Lo que se hace ya para reducir el riesgo mientras se corrige" />
    </label>
    <label class="campo">
      <span class="etiqueta">Acción recomendada</span>
      <Textarea v-model="draft.recommendedAction" auto-resize rows="2" placeholder="La corrección definitiva" />
    </label>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Responsable</span>
        <InputText v-model="draft.responsible" placeholder="Quién lo corrige" />
      </label>
      <label class="campo">
        <span class="etiqueta">Fecha compromiso</span>
        <input v-model="draft.dueDate" type="date" class="p-inputtext p-component" />
      </label>
    </div>
    <div class="campo">
      <span class="etiqueta">Estado</span>
      <ChoiceChips v-model="draft.status" :options="STATES" label="Estado del hallazgo" fill />
    </div>
    <label class="campo">
      <span class="etiqueta"><IconShieldCheck :size="12" /> Referencia en el SG-SST de la entidad</span>
      <InputText v-model="draft.sstRef" placeholder="Opcional: cómo aparece este peligro en la matriz de peligros de la entidad" />
    </label>
  </section>

  <EntityPhotos :project-id="projectId" entity-type="seguridad" :entity-id="draft.id" default-kind="estado-fisico" title="Evidencia fotográfica" hint="Solo fotografía lo que la entidad autoriza: tableros, etiquetas, puestas a tierra, conexiones." />
</template>

<style scoped>
.ayuda-riesgo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.45;
}
.ayuda-riesgo p {
  margin: 0;
}
.resultado {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.resultado p {
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.45;
}
.resultado :deep(.estado) {
  align-self: flex-start;
}
.criterios {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.4;
}
.criterios b {
  color: var(--ink);
}
</style>
