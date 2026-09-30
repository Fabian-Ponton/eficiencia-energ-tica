<script setup lang="ts">
import { IconAlertTriangle, IconBolt, IconCalendarEvent, IconCash, IconChecklist, IconInfoCircle, IconNotes, IconPlus, IconProgress, IconTrash, IconUserCog } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, onMounted, watch } from 'vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { FUNDING_SOURCES, kpiFor, PHASE_OF_PRIORITY, TASK_PHASES, taskDays, verificationFor } from '@/domain/implementation';
import {
  documentKindInfo,
  DOCUMENT_KINDS,
  emptyRetie,
  INTERVENTIONS,
  missingDocuments,
  RETIE_REGIMES,
  RETIE_STATUS_LABEL,
  retieGate,
  retieProblems,
  retieRegime,
  retieReminders,
  START_PROOFS,
  suggestedWorks,
} from '@/domain/retie';
import type { Measure, RetieDocument, RetieDocumentKind, RetieVerification, Task, TaskExecutor } from '@/domain/types';
import { TASK_STATUS } from '@/ui/icons';
import { formatCop } from '@/utils/format';

/** Formulario de una tarea del plan: qué se hace, cuándo, quién, con qué dinero, cómo va y, si toca la instalación eléctrica, el RETIE. */
const draft = defineModel<Draft<Task>>('draft', { required: true });
const props = defineProps<{ errors: FieldErrors; projectId: string; measures: readonly Measure[]; tasks: readonly Task[] }>();

const PHASES = TASK_PHASES.map((p) => ({ value: p.id, label: p.label }));
const STATUSES = (['pendiente', 'en-ejecucion', 'implementada'] as const).map((s) => ({ value: s, label: TASK_STATUS[s].label, icon: TASK_STATUS[s].icon }));
const SOURCES = [...FUNDING_SOURCES];
const QUICK_PROGRESS = [0, 25, 50, 75, 100];
const measureOptions = computed(() => props.measures.map((m) => ({ value: m.id, label: `${m.code} · ${m.title}${m.selected ? '' : ' (fuera del plan)'}` })));
const measure = computed(() => props.measures.find((m) => m.id === draft.value.measureId));
const days = computed(() => taskDays(draft.value));

/** Parte de la inversión de la medida que aún no tiene tarea: evita contar dos veces el mismo dinero. */
const budgetHint = computed(() => {
  const m = measure.value;
  if (!m) return null;
  const assigned = props.tasks.filter((t) => t.measureId === m.id && t.id !== draft.value.id).reduce((total, t) => total + (t.budgetCop ?? 0), 0);
  const remaining = m.investmentCop - assigned;
  if (remaining <= 0 || remaining === draft.value.budgetCop) return null;
  return { value: remaining, label: assigned > 0 ? `Resto de la inversión de ${m.code}` : `Inversión de ${m.code}` };
});

/** Al elegir la medida se completan el nombre, el plazo, el indicador y la verificación que falten. */
function chooseMeasure(id: string | null | undefined) {
  draft.value.measureId = id ?? undefined;
  const m = props.measures.find((x) => x.id === id);
  if (!m) return;
  if (!draft.value.name.trim()) {
    draft.value.name = m.title;
    draft.value.phase = PHASE_OF_PRIORITY[m.priority ?? 'baja'];
  }
  draft.value.kpi ||= kpiFor(m);
  draft.value.verification ||= verificationFor(m);
}

// El estado y el avance van de la mano: implementada es el 100 %; pendiente, sin avance
watch(
  () => draft.value.status,
  (status) => {
    if (status === 'implementada') draft.value.progress = 100;
    else if (status === 'pendiente') draft.value.progress = 0;
  },
);
watch(
  () => draft.value.progress,
  (progress) => {
    if (progress >= 100 && draft.value.status !== 'implementada') draft.value.status = 'implementada';
    else if (progress > 0 && progress < 100 && draft.value.status !== 'en-ejecucion') draft.value.status = 'en-ejecucion';
  },
);

// ——— Quién ejecuta ———
const EXECUTOR_KINDS = [
  { value: 'persona', label: 'Persona' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'dependencia', label: 'Dependencia' },
] as const;
const REGISTRY_BODIES = [
  { value: 'CONTE', label: 'CONTE' },
  { value: 'COPNIA', label: 'COPNIA' },
  { value: 'otra', label: 'Otro' },
] as const;
/** El ejecutor se crea al escribir en cualquiera de sus campos: una tarea sin ejecutor no lleva el objeto vacío. */
function executor(): TaskExecutor {
  draft.value.executor ??= { kind: 'empresa', name: '' };
  return draft.value.executor;
}
const executorKind = computed({ get: () => draft.value.executor?.kind, set: (kind) => (executor().kind = kind ?? 'empresa') });
// Para quitar al ejecutor basta vaciar su nombre y su registro: al guardar no se conserva vacío
const executorName = computed({ get: () => draft.value.executor?.name ?? '', set: (name) => (executor().name = name) });
const executorRole = computed({ get: () => draft.value.executor?.role ?? '', set: (role) => (executor().role = role) });
const registryBody = computed({
  get: () => draft.value.executor?.registry?.body,
  set: (body) => {
    const e = executor();
    e.registry = body ? { ...e.registry, body } : undefined;
  },
});
const registryCategory = computed({
  get: () => draft.value.executor?.registry?.category ?? '',
  set: (category) => {
    const e = executor();
    if (e.registry) e.registry.category = category;
  },
});
const registryNumber = computed({
  get: () => draft.value.executor?.registry?.number ?? '',
  set: (number) => {
    const e = executor();
    if (e.registry) e.registry.number = number;
  },
});

// ——— Cumplimiento del RETIE ———
const APPLIES = [
  { value: 'si', label: 'Aplica' },
  { value: 'no', label: 'No aplica' },
  { value: 'por-definir', label: 'Por definir' },
] as const;
const RESULTS = [
  { value: 'cumple', label: 'Cumple' },
  { value: 'no-cumple', label: 'No cumple' },
] as const;
const STARTS = START_PROOFS.map((p) => ({ value: p.id, label: p.label }));
const INTERVENTION_OPTIONS = INTERVENTIONS.map((i) => ({ value: i.id, label: i.label }));
const KIND_OPTIONS = DOCUMENT_KINDS.map((d) => ({ value: d.id, label: d.label }));

const onWorks = computed(() => Boolean(draft.value.works));
function setWorks(on: boolean) {
  // Al apagar la obra no se borra la verificación: queda guardada por si se vuelve a marcar
  if (!on) {
    draft.value.works = undefined;
    return;
  }
  draft.value.works = { ...(suggestedWorks({ kind: measure.value?.kind ?? 'baja-inversion', savingsType: measure.value?.savingsType }).works ?? { interventionType: 'remodelacion' }) };
  draft.value.retie ??= emptyRetie();
}
onMounted(() => {
  if (draft.value.works && !draft.value.retie) draft.value.retie = emptyRetie();
});

const retie = computed<RetieVerification | undefined>(() => draft.value.retie);
const regime = computed(() => retieRegime(draft.value.works?.startDate));
const reminders = computed(() => retieReminders({ works: draft.value.works, measure: measure.value }));
const missing = computed(() => (retie.value?.applies === 'si' ? missingDocuments(retie.value.documents) : []));
const problems = computed(() => (retie.value ? retieProblems(retie.value) : []));
const gate = computed(() => retieGate({ works: draft.value.works, retie: draft.value.retie }));
/** Se avisa antes de guardar por qué esta tarea no puede quedar como implementada. */
const blocked = computed(() => draft.value.status === 'implementada' && !gate.value.ok);
const waived = computed(() => draft.value.status === 'implementada' && gate.value.waived);
const STATUS_OPTIONS = computed(() => (['pendiente', 'en-revision', 'cumple', 'no-cumple'] as const).map((s) => ({ value: s, label: RETIE_STATUS_LABEL[s] })));

// Si el RETIE no aplica, la verificación queda en «No aplica»; si vuelve a aplicar, pendiente
watch(
  () => draft.value.retie?.applies,
  (applies) => {
    const v = draft.value.retie;
    if (!v) return;
    if (applies === 'no') v.status = 'no-aplica';
    else if (v.status === 'no-aplica') v.status = 'pendiente';
  },
);

function addDocument(kind: RetieDocumentKind = 'declaracion-construccion') {
  const v = (draft.value.retie ??= emptyRetie());
  const row: RetieDocument = { kind };
  v.documents.push(row);
}
function removeDocument(index: number) {
  draft.value.retie?.documents.splice(index, 1);
}
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconChecklist :size="16" />Tarea</h3>
    <label class="campo">
      <span class="etiqueta">Nombre</span>
      <InputText v-model="draft.name" placeholder="Ej.: Instalación de luminarias LED en las aulas" :invalid="Boolean(errors.name)" />
      <small v-if="errors.name" class="error">{{ errors.name }}</small>
    </label>
    <label class="campo">
      <span class="etiqueta">Medida del plan</span>
      <Select
        :model-value="draft.measureId"
        :options="measureOptions"
        option-label="label"
        option-value="value"
        placeholder="Sin medida (tarea general)"
        show-clear
        @update:model-value="chooseMeasure"
      />
    </label>
    <div class="campo">
      <span class="etiqueta">Plazo</span>
      <ChoiceChips v-model="draft.phase" :options="PHASES" label="Plazo de la tarea" fill />
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconCalendarEvent :size="16" />Programación</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Inicio</span>
        <input v-model="draft.start" type="date" class="p-inputtext p-component" />
      </label>
      <label class="campo">
        <span class="etiqueta">Fin</span>
        <input v-model="draft.end" type="date" class="p-inputtext p-component" :class="{ 'p-invalid': errors.end }" />
        <small v-if="errors.end" class="error">{{ errors.end }}</small>
        <small v-else-if="days" class="ayuda">{{ days }} {{ days === 1 ? 'día' : 'días' }}</small>
      </label>
      <label class="campo completo">
        <span class="etiqueta">Responsable en la entidad</span>
        <InputText v-model="draft.responsible" placeholder="Persona o dependencia que responde por la tarea" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconUserCog :size="16" />Quién ejecuta</h3>
    <p class="ayuda-seccion">Quien hace el trabajo: un contratista, una persona o una dependencia de la entidad. En una obra eléctrica, el diseño y la construcción los firma una persona competente con su matrícula profesional (RETIE, art. 4.3.8).</p>
    <div class="campo">
      <span class="etiqueta">Tipo</span>
      <ChoiceChips v-model="executorKind" :options="EXECUTOR_KINDS" label="Tipo de ejecutor" />
    </div>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Nombre o razón social</span>
        <InputText v-model="executorName" placeholder="Quién ejecuta" />
      </label>
      <label class="campo">
        <span class="etiqueta">Rol en la obra</span>
        <InputText v-model="executorRole" placeholder="Ej.: constructor, diseñador, interventor" />
      </label>
    </div>
    <div class="campo">
      <span class="etiqueta">Registro profesional</span>
      <ChoiceChips v-model="registryBody" :options="REGISTRY_BODIES" label="Entidad que expide la matrícula" clearable />
    </div>
    <div v-if="draft.executor?.registry" class="form-grid">
      <label class="campo">
        <span class="etiqueta">Categoría</span>
        <InputText v-model="registryCategory" placeholder="Ej.: TE-1, ingeniero electricista" />
      </label>
      <label class="campo">
        <span class="etiqueta">Número de matrícula</span>
        <InputText v-model="registryNumber" placeholder="Solo si el contratista lo entrega" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconCash :size="16" />Presupuesto</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Presupuesto</span>
        <NumberInput v-model="draft.budgetCop" :decimals="0" suffix="COP" />
        <button v-if="budgetHint" type="button" class="valor-rapido sugerido" @click="draft.budgetCop = budgetHint.value">
          {{ budgetHint.label }}: {{ formatCop(budgetHint.value) }}
        </button>
      </label>
      <label class="campo">
        <span class="etiqueta">Financiación</span>
        <Select v-model="draft.fundingSource" :options="SOURCES" editable placeholder="Elegir o escribir" show-clear />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconProgress :size="16" />Avance</h3>
    <div class="campo">
      <span class="etiqueta">Estado</span>
      <ChoiceChips v-model="draft.status" :options="STATUSES" label="Estado de la tarea" fill />
    </div>
    <label class="campo">
      <span class="etiqueta">Avance</span>
      <NumberInput v-model="draft.progress" required :decimals="0" :min="0" :max="100" suffix="%" :invalid="Boolean(errors.progress)" />
      <small v-if="errors.progress" class="error">{{ errors.progress }}</small>
    </label>
    <div class="valores-rapidos">
      <button v-for="v in QUICK_PROGRESS" :key="v" type="button" class="valor-rapido" @click="draft.progress = v">{{ v }} %</button>
    </div>
    <p v-if="blocked" class="aviso-linea alerta" role="alert">
      <IconAlertTriangle :size="16" />
      <span>No se puede guardar como implementada: {{ gate.reason }}</span>
    </p>
    <p v-else-if="waived" class="aviso-linea alerta">
      <IconInfoCircle :size="16" />
      <span>Se guarda como implementada sin la verificación del RETIE en «Cumple»: la justificación queda en el informe.</span>
    </p>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconBolt :size="16" />Cumplimiento del RETIE</h3>
    <label class="fila-interruptor">
      <span>Interviene la instalación eléctrica<small>Obra de instalación, ampliación, remodelación o reposición. Las compras, los estudios y las campañas no.</small></span>
      <ToggleSwitch :model-value="onWorks" @update:model-value="setWorks" />
    </label>

    <template v-if="draft.works && retie">
      <div class="campo">
        <span class="etiqueta">Tipo de intervención</span>
        <ChoiceChips v-model="draft.works.interventionType" :options="INTERVENTION_OPTIONS" label="Tipo de intervención" />
      </div>
      <div class="form-grid">
        <label class="campo">
          <span class="etiqueta">Inicio de la obra</span>
          <input v-model="draft.works.startDate" type="date" class="p-inputtext p-component" />
        </label>
        <div class="campo">
          <span class="etiqueta">Cómo se prueba la fecha</span>
          <ChoiceChips v-model="draft.works.startProof" :options="STARTS" label="Documento que prueba la fecha de inicio" clearable />
        </div>
      </div>
      <p class="aviso-linea" :class="{ alerta: regime === 'por-confirmar' }">
        <IconInfoCircle :size="16" />
        <span><strong>{{ RETIE_REGIMES[regime].label }}.</strong> {{ RETIE_REGIMES[regime].text }}</span>
      </p>

      <details class="recordatorios">
        <summary>Qué dice el RETIE (recordatorio)</summary>
        <ul>
          <li v-for="r in reminders" :key="r.ref + r.text">
            {{ r.text }} <span class="ref">({{ r.ref }})</span>
          </li>
        </ul>
        <p class="ayuda">PONTIA registra y recuerda. No decide qué documento aplica a la instalación ni reemplaza el dictamen de inspección de un organismo acreditado por el ONAC.</p>
      </details>

      <div class="campo">
        <span class="etiqueta">¿Aplica el RETIE a esta intervención?</span>
        <ChoiceChips v-model="retie.applies" :options="APPLIES" label="Aplicación del RETIE" fill />
      </div>

      <template v-if="retie.applies === 'si'">
        <div class="campo">
          <span class="etiqueta">Documentos de la demostración de la conformidad</span>
          <div v-for="(d, index) in retie.documents" :key="index" class="documento">
            <div class="form-grid">
              <label class="campo">
                <span class="etiqueta">Documento</span>
                <Select v-model="d.kind" :options="KIND_OPTIONS" option-label="label" option-value="value" />
              </label>
              <label class="campo">
                <span class="etiqueta">Número o referencia</span>
                <InputText v-model="d.reference" placeholder="Consecutivo del documento" />
              </label>
              <label class="campo">
                <span class="etiqueta">Quién lo emitió</span>
                <InputText v-model="d.issuer" placeholder="Persona, empresa u organismo" />
              </label>
              <label class="campo">
                <span class="etiqueta">Fecha</span>
                <input v-model="d.date" type="date" class="p-inputtext p-component" />
              </label>
            </div>
            <div class="fila-documento">
              <ChoiceChips v-model="d.result" :options="RESULTS" :label="`Resultado de ${documentKindInfo(d.kind).label}`" clearable />
              <button type="button" class="boton-icono" :aria-label="`Quitar ${documentKindInfo(d.kind).label}`" @click="removeDocument(index)"><IconTrash :size="18" /></button>
            </div>
            <small v-if="documentKindInfo(d.kind).hint" class="ayuda">{{ documentKindInfo(d.kind).hint }} <span class="ref">({{ documentKindInfo(d.kind).ref }})</span></small>
          </div>
          <div class="valores-rapidos">
            <button v-for="kind in missing" :key="kind" type="button" class="valor-rapido" @click="addDocument(kind)"><IconPlus :size="12" /> {{ documentKindInfo(kind).label }}</button>
            <button type="button" class="valor-rapido" @click="addDocument('otro')"><IconPlus :size="12" /> Otro documento</button>
          </div>
          <small v-if="missing.length" class="ayuda">Suelen acompañar la certificación plena y aún no están registrados: {{ missing.map((k) => documentKindInfo(k).label.toLowerCase()).join(', ') }}.</small>
        </div>

        <label class="fila-interruptor">
          <span>
            Análisis de riesgos de origen eléctrico hecho
            <small>Lo pide el RETIE con el diseño. Los riesgos del proyecto se valoran en el paso «Seguridad eléctrica».</small>
          </span>
          <ToggleSwitch v-model="retie.riskAnalysisDone" />
        </label>
        <label class="campo">
          <span class="etiqueta">Pruebas y puesta en servicio</span>
          <Textarea v-model="retie.commissioningNotes" auto-resize rows="2" placeholder="Pruebas y mediciones hechas, fecha de energización, observaciones del inspector" />
        </label>
        <div class="campo">
          <span class="etiqueta">Estado de la verificación</span>
          <ChoiceChips v-model="retie.status" :options="STATUS_OPTIONS" label="Estado de la verificación del RETIE" fill />
        </div>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Quién verificó</span>
            <InputText v-model="retie.verifiedBy" placeholder="Persona competente u organismo de inspección" />
          </label>
          <label class="campo">
            <span class="etiqueta">Fecha de la verificación</span>
            <input v-model="retie.verifiedAt" type="date" class="p-inputtext p-component" />
          </label>
        </div>
        <p v-if="problems.length" class="aviso-linea alerta">
          <IconAlertTriangle :size="16" />
          <span>Para dejar el RETIE en «Cumple» falta: {{ problems.join(', ') }}.</span>
        </p>
      </template>

      <label v-if="retie.applies !== 'por-definir'" class="campo">
        <span class="etiqueta">{{ retie.applies === 'no' ? '¿Por qué no aplica el RETIE?' : 'Justificación' }}</span>
        <Textarea
          v-model="retie.justification"
          auto-resize
          rows="2"
          :invalid="Boolean(errors.retie)"
          :placeholder="retie.applies === 'no' ? 'Ej.: solo se cambian lámparas dentro de las luminarias existentes, sin tocar circuitos ni tableros' : 'Solo si la tarea se implementa sin la verificación en «Cumple»: por qué y con qué respaldo'"
        />
      </label>
      <small v-if="errors.retie" class="error">{{ errors.retie }}</small>
    </template>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Seguimiento</h3>
    <label class="campo">
      <span class="etiqueta">Indicador</span>
      <InputText v-model="draft.kpi" placeholder="Ej.: kWh/mes del bloque frente a la línea base" />
    </label>
    <label class="campo">
      <span class="etiqueta">Verificación del ahorro</span>
      <InputText v-model="draft.verification" placeholder="Ej.: IPMVP opción B, medición antes y después" />
      <small class="ayuda">Es la verificación del ahorro (IPMVP); la del RETIE es la de arriba.</small>
    </label>
    <Textarea v-model="draft.notes" auto-resize rows="2" placeholder="Observaciones: contratista, riesgos, compromisos…" />
  </section>

  <EntityPhotos :project-id="projectId" entity-type="tarea" :entity-id="draft.id" default-kind="instalacion" title="Evidencia de la tarea" />
</template>

<style scoped>
.sugerido {
  align-self: flex-start;
}
.recordatorios {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  font-size: 13px;
}
.recordatorios summary {
  cursor: pointer;
  font-weight: 600;
}
.recordatorios ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 10px 0 8px;
  padding-left: 18px;
  color: var(--ink-2);
  line-height: 1.45;
}
.ref {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}
.documento {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.fila-documento {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.valor-rapido {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: auto;
  min-height: 30px;
  padding: 4px 10px;
  font-family: inherit;
  text-align: left;
}
</style>
