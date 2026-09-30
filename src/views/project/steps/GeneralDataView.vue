<script setup lang="ts">
import {
  IconAlertTriangle,
  IconBolt,
  IconBuilding,
  IconBuildingCommunity,
  IconCalendarTime,
  IconCircleCheck,
  IconCloudCheck,
  IconId,
  IconInfoCircle,
  IconLoader2,
  IconReportMoney,
  IconSun,
  IconTargetArrow,
  IconUsers,
} from '@tabler/icons-vue';
import { useDebounceFn } from '@vueuse/core';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { updateProject } from '@/db/projects';
import { getDb } from '@/db/schema';
import { daysPerMonth, ENTITY_KINDS, ENTITY_ORDERS, GRID_OPERATORS, SECTORS, VOLTAGE_LEVELS } from '@/domain/catalogs';
import { characterization, groupStatus, nextAuditDate, type CharacterizationSource } from '@/domain/compliance';
import { tenureInfo, TENURES, tenureScope } from '@/domain/tenure';
import type { EntityKind, EntityOrder, Tenure } from '@/domain/types';
import { formatDate } from '@/utils/dates';
import { round } from '@/utils/format';

const db = getDb();
const { project } = useCurrentProject();

interface GeneralForm {
  name: string;
  code?: string;
  sector?: string;
  client?: string;
  nit?: string;
  city?: string;
  address?: string;
  auditor?: string;
  startDate?: string;
  endDate?: string;
  areaM2?: number;
  users?: number;
  operatingHours?: string;
  daysPerWeek: number;
  vacationDaysPerYear?: number;
  gridOperator?: string;
  accountNumber?: string;
  voltageLevel?: string;
  tariff?: number;
  discountPct?: number;
  escalationPct?: number;
  horizonYears?: number;
  emissionFactor?: number;
  peakSunHours?: number;
  entityKind?: EntityKind;
  entityOrder?: EntityOrder;
  siteName?: string;
  siteCode?: string;
  contactName?: string;
  contactRole?: string;
  tenure?: Tenure;
  builtYear?: number;
  floors?: number;
  activity?: string;
  surroundings?: string;
  students?: number;
  staff?: number;
  floating?: number;
  auditDate?: string;
  surveyDate?: string;
  boundary?: string;
  objectives?: string;
  limitations?: string;
  fnce: 'potencial' | 'excluida';
  fnceNote?: string;
}

const DAYS = [
  { value: 5, label: '5 días' },
  { value: 6, label: '6 días' },
  { value: 7, label: '7 días' },
] as const;

const form = reactive<GeneralForm>({ name: '', daysPerWeek: 5, fnce: 'potencial' });
const status = ref<'guardado' | 'pendiente' | 'guardando' | 'error'>('guardado');
let ready = false;

const percent = (fraction: number) => round(fraction * 100, 4);
const clean = (text?: string) => text?.trim() || undefined;

// Se carga una sola vez: después, el formulario manda y se guarda solo
watch(
  project,
  (p) => {
    if (!p || ready) return;
    Object.assign(form, {
      name: p.name,
      code: p.code,
      sector: p.sector,
      client: p.client,
      nit: p.nit,
      city: p.city,
      address: p.address,
      auditor: p.auditor,
      startDate: p.startDate,
      endDate: p.endDate,
      areaM2: p.areaM2,
      users: p.users,
      operatingHours: p.operatingHours,
      daysPerWeek: p.calendar.daysPerWeek,
      vacationDaysPerYear: p.calendar.vacationDaysPerYear,
      gridOperator: p.gridOperator,
      accountNumber: p.accountNumber,
      voltageLevel: p.voltageLevel,
      tariff: p.economics.tariffCopPerKwh || undefined,
      discountPct: percent(p.economics.discountRate),
      escalationPct: percent(p.economics.tariffEscalation),
      horizonYears: p.economics.horizonYears,
      emissionFactor: p.economics.emissionFactorKgPerKwh || undefined,
      peakSunHours: p.peakSunHours,
      entityKind: p.entity?.kind,
      entityOrder: p.entity?.order,
      siteName: p.site?.name,
      siteCode: p.site?.upmeCode,
      contactName: p.institutionalContact?.name,
      contactRole: p.institutionalContact?.role,
      tenure: p.building?.tenure,
      builtYear: p.building?.builtYear,
      floors: p.building?.floors,
      activity: p.building?.activity,
      surroundings: p.building?.surroundings,
      students: p.population?.students,
      staff: p.population?.staff,
      floating: p.population?.floating,
      auditDate: p.audit?.date,
      surveyDate: p.surveyDate,
      boundary: p.scope?.boundary,
      objectives: p.scope?.objectives,
      limitations: p.scope?.limitations,
      fnce: p.scope?.fnce ?? 'potencial',
      fnceNote: p.scope?.fnceNote,
    });
    void nextTick(() => {
      ready = true;
    });
  },
  { immediate: true },
);

const nameError = computed(() => (form.name.trim() ? '' : 'Escribe el nombre del proyecto.'));
const statusText = computed(() => {
  if (nameError.value) return 'Falta el nombre';
  return { guardado: 'Guardado', pendiente: 'Guardando…', guardando: 'Guardando…', error: 'No se pudo guardar' }[status.value];
});

/** Agrupa solo lo que tiene valor: un bloque vacío no se guarda. */
const compact = <T extends object>(block: T): T | undefined => (Object.values(block).some((value) => value !== undefined) ? block : undefined);

/** Los bloques de la caracterización de la entidad, tal como se guardan en el proyecto. */
const details = computed(() => ({
  entity: form.entityKind ? { kind: form.entityKind, order: form.entityKind === 'publica' ? form.entityOrder : undefined } : undefined,
  site: compact({ name: clean(form.siteName), upmeCode: clean(form.siteCode) }),
  building: compact({ builtYear: form.builtYear, floors: form.floors, activity: clean(form.activity), surroundings: clean(form.surroundings), tenure: form.tenure }),
  population: compact({ students: form.students, staff: form.staff, floating: form.floating }),
  institutionalContact: compact({ name: clean(form.contactName), role: clean(form.contactRole) }),
  audit: compact({ date: form.auditDate || undefined }),
  // El alcance solo se guarda si el auditor escribió algo o excluyó las FNCER; sin nada, el informe usa el valor por omisión (potencial)
  scope:
    form.boundary?.trim() || form.objectives?.trim() || form.limitations?.trim() || form.fnceNote?.trim() || form.fnce === 'excluida'
      ? {
          boundary: clean(form.boundary),
          objectives: clean(form.objectives),
          limitations: clean(form.limitations),
          fnce: form.fnce,
          fnceNote: form.fnce === 'excluida' ? clean(form.fnceNote) : undefined,
        }
      : undefined,
}));

const persist = useDebounceFn(async () => {
  const p = project.value;
  if (!p || nameError.value) return;
  status.value = 'guardando';
  try {
    await updateProject(db, p.id, {
      name: form.name.trim(),
      code: clean(form.code),
      sector: form.sector || undefined,
      client: clean(form.client),
      nit: clean(form.nit),
      city: clean(form.city),
      address: clean(form.address),
      auditor: clean(form.auditor),
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      areaM2: form.areaM2,
      users: form.users,
      operatingHours: clean(form.operatingHours),
      calendar: { ...p.calendar, daysPerWeek: form.daysPerWeek, vacationDaysPerYear: form.vacationDaysPerYear ?? 0 },
      gridOperator: clean(form.gridOperator),
      accountNumber: clean(form.accountNumber),
      voltageLevel: form.voltageLevel || undefined,
      economics: {
        tariffCopPerKwh: form.tariff ?? 0,
        discountRate: (form.discountPct ?? 0) / 100,
        tariffEscalation: (form.escalationPct ?? 0) / 100,
        horizonYears: form.horizonYears ?? 10,
        emissionFactorKgPerKwh: form.emissionFactor ?? 0,
      },
      peakSunHours: form.peakSunHours,
      ...details.value,
      surveyDate: form.surveyDate || undefined,
    });
    status.value = 'guardado';
  } catch {
    status.value = 'error';
  }
}, 700);

watch(
  form,
  () => {
    if (!ready) return;
    status.value = 'pendiente';
    void persist();
  },
  { deep: true },
);

// «Usuarios» sigue la suma de estudiantes y personal mientras nadie lo cambie a mano
const fixedPopulation = computed(() => (form.students ?? 0) + (form.staff ?? 0));
watch(fixedPopulation, (now, before) => {
  if (!ready || now <= 0) return;
  if (form.users === undefined || form.users === before) form.users = now;
});

// La verificación del art. 4(a) mira el formulario, no lo guardado: el chip cambia al escribir
const source = computed<CharacterizationSource>(() => ({
  client: form.client,
  city: form.city,
  address: form.address,
  operatingHours: form.operatingHours,
  areaM2: form.areaM2,
  users: form.users,
  entity: details.value.entity,
  site: details.value.site,
  building: details.value.building,
  population: details.value.population,
  institutionalContact: details.value.institutionalContact,
}));
const art4 = computed(() => groupStatus(characterization(source.value)));
const art4Items = computed(() => characterization(source.value).items.filter((item) => item.level === 'obligatorio'));

const tenureHelp = computed(() => tenureInfo(form.tenure)?.help);
const tenureTone = computed(() => (tenureScope(form.tenure, form.entityKind) === 'todas' ? 'info' : 'alerta'));
const nextAudit = computed(() => nextAuditDate(form.auditDate));
const FNCE_CHOICES = [
  { value: 'potencial', label: 'Mostrar el potencial de referencia' },
  { value: 'excluida', label: 'Excluir del alcance' },
] as const;
const TENURE_OPTIONS = TENURES.map((t) => ({ value: t.id, label: t.label }));

const required = computed(() => [
  { label: 'Cliente', ok: Boolean(form.client?.trim()) },
  { label: 'Ciudad', ok: Boolean(form.city?.trim()) },
  { label: 'Área construida', ok: Boolean(form.areaM2) },
]);
const recommended = computed(() => [
  { label: 'Tarifa', ok: Boolean(form.tariff) },
  { label: 'Operador de red', ok: Boolean(form.gridOperator?.trim()) },
  { label: 'Factor de emisión', ok: Boolean(form.emissionFactor) },
  { label: 'Horas solares pico', ok: Boolean(form.peakSunHours) },
]);
const complete = computed(() => required.value.every((r) => r.ok));
</script>

<template>
  <div class="vista">
    <PageHeader step="datos">
      <template #actions>
        <span class="guardado" :class="{ alerta: nameError || status === 'error' }" role="status">
          <IconLoader2 v-if="!nameError && (status === 'guardando' || status === 'pendiente')" :size="16" class="girar" />
          <IconAlertTriangle v-else-if="nameError || status === 'error'" :size="16" />
          <IconCloudCheck v-else :size="16" />
          {{ statusText }}
        </span>
      </template>
    </PageHeader>

    <section class="card requisitos" :class="{ listo: complete }">
      <div class="grupo">
        <span class="eyebrow">{{ complete ? 'Paso completo' : 'Para completar el paso' }}</span>
        <div class="chips">
          <StatusChip v-for="r in required" :key="r.label" :tone="r.ok ? 'good' : 'neutral'" :icon="r.ok ? IconCircleCheck : undefined" :label="r.label" />
        </div>
      </div>
      <div class="grupo">
        <span class="eyebrow">Exigido para el informe · art. 4(a) de la Res. 40412 · {{ art4.done }} de {{ art4.total }}</span>
        <div class="chips">
          <StatusChip v-for="item in art4Items" :key="item.id" :tone="item.ok ? 'good' : 'neutral'" :icon="item.ok ? IconCircleCheck : undefined" :label="item.label" />
        </div>
      </div>
      <div class="grupo">
        <span class="eyebrow">Recomendado para los cálculos</span>
        <div class="chips">
          <StatusChip v-for="r in recommended" :key="r.label" :tone="r.ok ? 'good' : 'neutral'" :icon="r.ok ? IconCircleCheck : undefined" :label="r.label" />
        </div>
      </div>
    </section>

    <div class="secciones">
      <section class="card seccion">
        <header class="seccion-cabecera">
          <span class="seccion-icono"><IconId :size="20" /></span>
          <div>
            <h2>Identificación</h2>
            <p>Quién es el cliente y dónde está la instalación.</p>
          </div>
        </header>
        <div class="form-grid">
          <label class="campo completo">
            <span class="etiqueta">Nombre del proyecto</span>
            <InputText v-model="form.name" :invalid="Boolean(nameError)" />
            <small v-if="nameError" class="error">{{ nameError }}</small>
          </label>
          <label class="campo">
            <span class="etiqueta">Código</span>
            <InputText v-model="form.code" class="mono" placeholder="BL-06" />
          </label>
          <label class="campo">
            <span class="etiqueta">Sector</span>
            <Select v-model="form.sector" :options="SECTORS" placeholder="Elegir" show-clear />
          </label>
          <label class="campo completo">
            <span class="etiqueta">Cliente o institución</span>
            <InputText v-model="form.client" placeholder="Ej.: Universidad de La Guajira" />
          </label>
          <label class="campo">
            <span class="etiqueta">NIT</span>
            <InputText v-model="form.nit" class="mono" inputmode="numeric" placeholder="900.000.000-0" />
          </label>
          <label class="campo">
            <span class="etiqueta">Ciudad</span>
            <InputText v-model="form.city" placeholder="Ej.: Riohacha" />
          </label>
          <label class="campo completo">
            <span class="etiqueta">Dirección</span>
            <InputText v-model="form.address" />
          </label>
          <label class="campo completo">
            <span class="etiqueta">Auditor responsable</span>
            <InputText v-model="form.auditor" />
          </label>
          <label class="campo">
            <span class="etiqueta">Inicio de la auditoría</span>
            <input v-model="form.startDate" type="date" class="p-inputtext p-component" />
          </label>
          <label class="campo">
            <span class="etiqueta">Cierre previsto</span>
            <input v-model="form.endDate" type="date" class="p-inputtext p-component" />
          </label>
        </div>
      </section>

      <section class="card seccion">
        <header class="seccion-cabecera">
          <span class="seccion-icono"><IconBuildingCommunity :size="20" /></span>
          <div>
            <h2>Entidad y sede</h2>
            <p>Quién es el titular y de qué sede se trata. La UPME recibe un reporte por cada sede.</p>
          </div>
        </header>
        <div class="form-grid">
          <div class="campo completo">
            <span class="etiqueta">Tipo de entidad</span>
            <ChoiceChips v-model="form.entityKind" :options="ENTITY_KINDS" label="Tipo de entidad" fill clearable />
            <small class="ayuda">La Resolución 40412 de 2024 rige a las entidades públicas.</small>
          </div>
          <div v-if="form.entityKind === 'publica'" class="campo completo">
            <span class="etiqueta">Orden</span>
            <ChoiceChips v-model="form.entityOrder" :options="ENTITY_ORDERS" label="Orden de la entidad" fill clearable />
          </div>
          <label class="campo">
            <span class="etiqueta">Nombre de la sede</span>
            <InputText v-model="form.siteName" placeholder="Ej.: Sede Riohacha" />
          </label>
          <label class="campo">
            <span class="etiqueta">Código de la sede</span>
            <InputText v-model="form.siteCode" class="mono" placeholder="Lo define la entidad" />
          </label>
          <small class="ayuda-seccion completo">La UPME pide un código exclusivo por sede que elige la propia entidad. Déjalo en blanco hasta tenerlo.</small>
          <label class="campo">
            <span class="etiqueta">Responsable institucional</span>
            <InputText v-model="form.contactName" />
          </label>
          <label class="campo">
            <span class="etiqueta">Cargo</span>
            <InputText v-model="form.contactRole" />
          </label>
        </div>
      </section>

      <section class="card seccion">
        <header class="seccion-cabecera">
          <span class="seccion-icono"><IconBuilding :size="20" /></span>
          <div>
            <h2>Edificio</h2>
            <p>Lo que el art. 4(a) de la Res. 40412 pide para caracterizar la edificación.</p>
          </div>
        </header>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Área construida</span>
            <NumberInput v-model="form.areaM2" :decimals="1" suffix="m²" />
          </label>
          <label class="campo">
            <span class="etiqueta">Pisos</span>
            <NumberInput v-model="form.floors" :decimals="0" :max="200" suffix="pisos" />
          </label>
          <label class="campo">
            <span class="etiqueta">Año de construcción</span>
            <NumberInput v-model="form.builtYear" :decimals="0" :min="1800" :max="2100" :grouping="false" />
          </label>
          <div class="campo completo">
            <span class="etiqueta">Tenencia del edificio</span>
            <ChoiceChips v-model="form.tenure" :options="TENURE_OPTIONS" label="Tenencia del edificio" />
            <p v-if="tenureHelp" class="aviso-linea" :class="tenureTone">
              <IconInfoCircle :size="16" />{{ tenureHelp }}
            </p>
            <small v-else class="ayuda">Define qué medidas puede implementar la entidad en este edificio.</small>
          </div>
          <label class="campo completo">
            <span class="etiqueta">Proceso o actividad desempeñada</span>
            <InputText v-model="form.activity" placeholder="Ej.: docencia y prácticas de laboratorio" />
          </label>
          <label class="campo completo">
            <span class="etiqueta">Entorno</span>
            <Textarea v-model="form.surroundings" auto-resize rows="2" placeholder="Ej.: campus urbano junto a una vía principal; clima cálido y húmedo" />
          </label>
        </div>
      </section>

      <section class="card seccion">
        <header class="seccion-cabecera">
          <span class="seccion-icono"><IconUsers :size="20" /></span>
          <div>
            <h2>Población y operación</h2>
            <p>Quiénes usan el edificio y cuándo: definen los indicadores y la anualización.</p>
          </div>
        </header>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Estudiantes</span>
            <NumberInput v-model="form.students" :decimals="0" suffix="personas" />
          </label>
          <label class="campo">
            <span class="etiqueta">Personal docente y administrativo</span>
            <NumberInput v-model="form.staff" :decimals="0" suffix="personas" />
          </label>
          <label class="campo">
            <span class="etiqueta">Población flotante</span>
            <NumberInput v-model="form.floating" :decimals="0" suffix="personas" />
          </label>
          <label class="campo">
            <span class="etiqueta">Usuarios para los indicadores</span>
            <NumberInput v-model="form.users" :decimals="0" suffix="personas" />
          </label>
          <small class="ayuda-seccion completo">Los usuarios son la base de kWh/usuario·mes. Siguen la suma de estudiantes y personal mientras no los cambies a mano.</small>
          <label class="campo completo">
            <span class="etiqueta">Horario de operación</span>
            <InputText v-model="form.operatingHours" placeholder="Ej.: lunes a viernes, 06:00 – 22:00" />
          </label>
          <div class="campo completo">
            <span class="etiqueta">Días de operación por semana</span>
            <ChoiceChips v-model="form.daysPerWeek" :options="DAYS" label="Días de operación por semana" fill />
            <small class="ayuda">Equivale a {{ daysPerMonth(form.daysPerWeek) }} días de operación al mes, el valor por omisión de los equipos nuevos.</small>
          </div>
          <label class="campo">
            <span class="etiqueta">Vacaciones al año</span>
            <NumberInput v-model="form.vacationDaysPerYear" :decimals="0" :max="365" suffix="días" />
          </label>
        </div>
      </section>

      <section class="card seccion">
        <header class="seccion-cabecera">
          <span class="seccion-icono"><IconCalendarTime :size="20" /></span>
          <div>
            <h2>Ciclo de auditoría</h2>
            <p>La ley pide repetir la auditoría energética cada cuatro años.</p>
          </div>
        </header>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Levantamiento en campo</span>
            <input v-model="form.surveyDate" type="date" class="p-inputtext p-component" />
          </label>
          <label class="campo">
            <span class="etiqueta">Fecha de la auditoría</span>
            <input v-model="form.auditDate" type="date" class="p-inputtext p-component" />
          </label>
          <p v-if="nextAudit" class="aviso-linea completo">
            <IconInfoCircle :size="16" />La próxima auditoría se hace a más tardar el {{ formatDate(nextAudit) }} (Ley 1715 de 2014, art. 30, modificado por la Ley 2294 de 2023, art. 237).
          </p>
        </div>
      </section>

      <section class="card seccion">
        <header class="seccion-cabecera">
          <span class="seccion-icono"><IconTargetArrow :size="20" /></span>
          <div>
            <h2>Alcance y FNCER</h2>
            <p>Hasta dónde llega la auditoría y cómo se trata la generación con fuentes no convencionales.</p>
          </div>
        </header>
        <div class="form-grid">
          <label class="campo completo">
            <span class="etiqueta">Frontera de la auditoría</span>
            <Textarea v-model="form.boundary" auto-resize rows="3" placeholder="Ej.: el edificio de laboratorios, su acometida y los equipos de uso final; no incluye los edificios vecinos." />
          </label>
          <label class="campo completo">
            <span class="etiqueta">Objetivos</span>
            <Textarea v-model="form.objectives" auto-resize rows="2" placeholder="Ej.: caracterizar el uso de la energía y priorizar medidas para el PGEE." />
          </label>
          <label class="campo completo">
            <span class="etiqueta">Limitaciones</span>
            <Textarea v-model="form.limitations" auto-resize rows="2" placeholder="Ej.: un laboratorio estuvo en mantenimiento durante el levantamiento." />
          </label>
          <div class="campo completo">
            <span class="etiqueta">Fuentes no convencionales (FNCER)</span>
            <ChoiceChips v-model="form.fnce" :options="FNCE_CHOICES" label="Tratamiento de las FNCER" fill />
            <small class="ayuda">El diseño de generación fotovoltaica no forma parte del alcance: el informe solo muestra un potencial de referencia con la cubierta disponible y las horas de sol pico.</small>
          </div>
          <label v-if="form.fnce === 'excluida'" class="campo completo">
            <span class="etiqueta">Motivo de la exclusión</span>
            <Textarea v-model="form.fnceNote" auto-resize rows="2" placeholder="Ej.: la cubierta no está disponible o la entidad no lo contempla." />
          </label>
        </div>
      </section>

      <section class="card seccion">
        <header class="seccion-cabecera">
          <span class="seccion-icono"><IconBolt :size="20" /></span>
          <div>
            <h2>Suministro eléctrico</h2>
            <p>Datos de la factura del operador de red.</p>
          </div>
        </header>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Operador de red</span>
            <Select v-model="form.gridOperator" :options="GRID_OPERATORS" editable placeholder="Elegir o escribir" />
          </label>
          <label class="campo">
            <span class="etiqueta">Cuenta o NIU</span>
            <InputText v-model="form.accountNumber" class="mono" />
          </label>
          <label class="campo completo">
            <span class="etiqueta">Nivel de tensión</span>
            <Select v-model="form.voltageLevel" :options="[...VOLTAGE_LEVELS]" option-label="label" option-value="id" placeholder="Elegir" show-clear />
          </label>
        </div>
      </section>

      <section class="card seccion">
        <header class="seccion-cabecera">
          <span class="seccion-icono"><IconReportMoney :size="20" /></span>
          <div>
            <h2>Parámetros económicos</h2>
            <p>Se usan en el costo de la energía, el retorno de las medidas, el VPN y la TIR.</p>
          </div>
        </header>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Tarifa de energía</span>
            <NumberInput v-model="form.tariff" :decimals="2" suffix="COP/kWh" />
          </label>
          <label class="campo">
            <span class="etiqueta">Tasa de descuento</span>
            <NumberInput v-model="form.discountPct" :decimals="2" :max="100" suffix="%" />
          </label>
          <label class="campo">
            <span class="etiqueta">Incremento anual de la tarifa</span>
            <NumberInput v-model="form.escalationPct" :decimals="2" :max="100" suffix="%" />
          </label>
          <label class="campo">
            <span class="etiqueta">Horizonte de evaluación</span>
            <NumberInput v-model="form.horizonYears" :decimals="0" :min="1" :max="40" suffix="años" />
          </label>
          <label class="campo completo">
            <span class="etiqueta">Factor de emisión</span>
            <NumberInput v-model="form.emissionFactor" :decimals="4" suffix="kg CO₂e/kWh" />
            <small class="ayuda">Usa el factor del Sistema Interconectado Nacional vigente, publicado por la UPME. En blanco no se calculan emisiones evitadas.</small>
          </label>
        </div>
      </section>

      <section class="card seccion">
        <header class="seccion-cabecera">
          <span class="seccion-icono"><IconSun :size="20" /></span>
          <div>
            <h2>Recurso solar</h2>
            <p>Para dimensionar sistemas fotovoltaicos.</p>
          </div>
        </header>
        <div class="form-grid">
          <label class="campo completo">
            <span class="etiqueta">Horas solares pico</span>
            <NumberInput v-model="form.peakSunHours" :decimals="2" :max="12" suffix="h/día" />
            <small class="ayuda">Irradiación diaria promedio del sitio (kWh/m²·día). Valida el dato con el Atlas de Radiación Solar del IDEAM.</small>
          </label>
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
.requisitos {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 28px;
  padding: 14px 16px;
}
.requisitos.listo {
  border-color: var(--accent);
}
.grupo {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.secciones {
  display: grid;
  gap: 14px;
}
.seccion {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
.seccion-cabecera {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.seccion-icono {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--info-wash);
  color: var(--navy);
}
.app-dark .seccion-icono {
  color: var(--ink);
}
.seccion-cabecera h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.seccion-cabecera p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 13px;
}
/* En PC las secciones se acomodan en dos columnas que se leen de arriba abajo, sin dejar huecos entre tarjetas de distinta altura */
@media (min-width: 1024px) {
  .secciones {
    display: block;
    column-count: 2;
    column-gap: 14px;
  }
  .secciones > .seccion {
    break-inside: avoid;
    margin-bottom: 14px;
  }
}
</style>
