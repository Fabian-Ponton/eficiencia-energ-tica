<script setup lang="ts">
import { IconAlertTriangle, IconBolt, IconBulb, IconCloudCheck, IconLayoutGrid, IconLoader2, IconRestore, IconSnowflake } from '@tabler/icons-vue';
import { useDebounceFn } from '@vueuse/core';
import Button from 'primevue/button';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { updateProject } from '@/db/projects';
import { getDb } from '@/db/schema';
import { SPACE_TYPES } from '@/domain/catalogs';
import { defaultSpaceReference, resolveSizing, SIZING_DEFAULTS, type GlobalSizingKey } from '@/domain/sizing';
import type { Area, Orientation, SizingOverrides } from '@/domain/types';
import { round } from '@/utils/format';

/** Referencias editables del dimensionamiento. Se guardan solas y solo lo que difiere de los valores por defecto. */
const props = defineProps<{ areas: readonly Area[] }>();
const db = getDb();
const { project } = useCurrentProject();

const ORIENTATIONS: readonly { id: Orientation; label: string }[] = [
  { id: 'N', label: 'Norte' },
  { id: 'S', label: 'Sur' },
  { id: 'E', label: 'Oriente' },
  { id: 'O', label: 'Occidente' },
];

interface SpaceRow {
  lux?: number;
  envelope?: number;
  veei?: number;
}
/** Valores tal como se muestran: las fracciones en porcentaje. */
interface Form {
  spaces: Record<string, SpaceRow>;
  solar: Record<Orientation, number | undefined>;
  btuHPerPerson?: number;
  roofExtraBtuHPerM2?: number;
  safetyFactor?: number;
  coolingUnder?: number;
  coolingOver?: number;
  lightingTolerance?: number;
  lightingExcess?: number;
  maintenanceFactor?: number;
  loadingHigh?: number;
  loadingCritical?: number;
  breakerCriterion?: number;
  demandFactor?: number;
  defaultPowerFactor?: number;
}
type GlobalField = Exclude<keyof Form, 'spaces' | 'solar'>;
/** Campos que se muestran en porcentaje y se guardan como fracción. */
const PERCENT = new Set<GlobalField>(['safetyFactor', 'coolingUnder', 'coolingOver', 'lightingTolerance', 'loadingHigh', 'loadingCritical', 'breakerCriterion', 'demandFactor']);
const GLOBAL_FIELDS: readonly GlobalField[] = [
  'btuHPerPerson',
  'roofExtraBtuHPerM2',
  'safetyFactor',
  'coolingUnder',
  'coolingOver',
  'lightingTolerance',
  'lightingExcess',
  'maintenanceFactor',
  'loadingHigh',
  'loadingCritical',
  'breakerCriterion',
  'demandFactor',
  'defaultPowerFactor',
];

function formFrom(overrides?: SizingOverrides): Form {
  const p = resolveSizing(overrides);
  const form: Form = {
    spaces: Object.fromEntries(SPACE_TYPES.map((t) => [t.id, { lux: p.spaces[t.id].lux, envelope: p.spaces[t.id].envelopeBtuHPerM2, veei: p.spaces[t.id].veeiLimit }])),
    solar: { ...p.solarBtuHPerM2 },
  };
  for (const field of GLOBAL_FIELDS) form[field] = PERCENT.has(field) ? round(p[field] * 100, 2) : p[field];
  return form;
}

const valid = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const differs = (value: number | undefined, fallback: number): value is number => valid(value) && Math.abs(value - fallback) > 1e-9;

function toOverrides(form: Form): SizingOverrides | undefined {
  const out: SizingOverrides = {};
  for (const field of GLOBAL_FIELDS) {
    const shown = form[field];
    const value = valid(shown) ? (PERCENT.has(field) ? round(shown / 100, 6) : shown) : undefined;
    if (differs(value, SIZING_DEFAULTS[field as GlobalSizingKey])) out[field] = value;
  }
  const solar: Partial<Record<Orientation, number>> = {};
  for (const o of ORIENTATIONS) {
    const value = form.solar[o.id];
    if (differs(value, SIZING_DEFAULTS.solarBtuHPerM2[o.id])) solar[o.id] = value;
  }
  if (Object.keys(solar).length) out.solarBtuHPerM2 = solar;
  const spaces: NonNullable<SizingOverrides['spaces']> = {};
  for (const type of SPACE_TYPES) {
    const d = defaultSpaceReference(type.id);
    const row = form.spaces[type.id];
    const diff: { lux?: number; envelopeBtuHPerM2?: number; veeiLimit?: number } = {};
    if (differs(row.lux, d.lux)) diff.lux = row.lux;
    if (differs(row.envelope, d.envelopeBtuHPerM2)) diff.envelopeBtuHPerM2 = row.envelope;
    if (differs(row.veei, d.veeiLimit)) diff.veeiLimit = row.veei;
    if (Object.keys(diff).length) spaces[type.id] = diff;
  }
  if (Object.keys(spaces).length) out.spaces = spaces;
  return Object.keys(out).length ? out : undefined;
}

const form = reactive<Form>(formFrom());
const status = ref<'guardado' | 'guardando' | 'error'>('guardado');
let ready = false;

// Se carga una sola vez: después, el formulario manda y se guarda solo
watch(
  project,
  (p) => {
    if (!p || ready) return;
    Object.assign(form, formFrom(p.sizing));
    void nextTick(() => {
      ready = true;
    });
  },
  { immediate: true },
);

const persist = useDebounceFn(async () => {
  const p = project.value;
  if (!p) return;
  try {
    await updateProject(db, p.id, { sizing: toOverrides(form) });
    status.value = 'guardado';
  } catch {
    status.value = 'error';
  }
}, 600);
watch(
  form,
  () => {
    if (!ready) return;
    status.value = 'guardando';
    void persist();
  },
  { deep: true },
);

const changed = computed(() => toOverrides(form) !== undefined);
function reset() {
  Object.assign(form, formFrom());
}

// Primero los tipos de espacio del proyecto; los demás, a pedido
const used = computed(() => new Set(props.areas.map((a) => a.spaceType ?? 'otro')));
const showAll = ref(false);
const spaceRows = computed(() => SPACE_TYPES.filter((t) => showAll.value || !used.value.size || used.value.has(t.id)));
const statusText = computed(() => ({ guardado: changed.value ? 'Cambios guardados' : 'Valores por defecto', guardando: 'Guardando…', error: 'No se pudo guardar' })[status.value]);
</script>

<template>
  <div class="pestana parametros">
    <div class="encabezado">
      <p class="aviso-linea">
        <IconAlertTriangle :size="16" />
        <span>Valores orientativos: valídalos con el RETILAP, el RETIE y tu criterio. Los cambios solo aplican a este proyecto y el dimensionamiento se recalcula al instante.</span>
      </p>
      <div class="acciones">
        <span class="guardado" :class="{ alerta: status === 'error' }" role="status">
          <IconLoader2 v-if="status === 'guardando'" :size="16" class="girar" />
          <IconCloudCheck v-else :size="16" />
          {{ statusText }}
        </span>
        <Button label="Restablecer" severity="secondary" outlined size="small" :disabled="!changed" @click="reset">
          <template #icon><IconRestore :size="16" /></template>
        </Button>
      </div>
    </div>

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2><IconLayoutGrid :size="18" />Por tipo de espacio</h2>
        <span class="eyebrow">iluminancia requerida · carga de envolvente · límite VEEI</span>
      </div>
      <div class="espacios">
        <div class="fila titulos" aria-hidden="true">
          <span>Tipo de espacio</span>
          <span>Iluminancia <small>lx</small></span>
          <span>Envolvente <small>BTU/h·m²</small></span>
          <span>VEEI límite <small>W/m²·100 lx</small></span>
        </div>
        <div v-for="t in spaceRows" :key="t.id" class="fila">
          <span class="tipo">{{ t.label }}<small v-if="used.has(t.id)" class="en-uso">en el proyecto</small></span>
          <label class="campo">
            <span class="ayuda movil">Lux</span>
            <NumberInput v-model="form.spaces[t.id].lux" :decimals="0" :max="5000" :aria-label="`Iluminancia requerida de ${t.label} en lux`" />
          </label>
          <label class="campo">
            <span class="ayuda movil">BTU/h·m²</span>
            <NumberInput v-model="form.spaces[t.id].envelope" :decimals="0" :max="2000" :aria-label="`Carga de envolvente de ${t.label} en BTU/h por m²`" />
          </label>
          <label class="campo">
            <span class="ayuda movil">VEEI</span>
            <NumberInput v-model="form.spaces[t.id].veei" :decimals="1" :max="50" :aria-label="`Límite VEEI de ${t.label}`" />
          </label>
        </div>
      </div>
      <button v-if="used.size" type="button" class="ver-todos" @click="showAll = !showAll">
        {{ showAll ? 'Ver solo los tipos del proyecto' : `Ver los ${SPACE_TYPES.length} tipos de espacio` }}
      </button>
    </section>

    <div class="rejilla">
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2><IconSnowflake :size="18" />Climatización</h2>
          <span class="eyebrow">carga térmica simplificada</span>
        </div>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Calor por persona</span>
            <NumberInput v-model="form.btuHPerPerson" :decimals="0" :max="2000" suffix="BTU/h" />
          </label>
          <label class="campo">
            <span class="etiqueta">Techo expuesto al sol</span>
            <NumberInput v-model="form.roofExtraBtuHPerM2" :decimals="0" :max="1000" suffix="BTU/h·m²" />
          </label>
          <label class="campo">
            <span class="etiqueta">Factor de seguridad</span>
            <NumberInput v-model="form.safetyFactor" :decimals="0" :max="50" suffix="%" />
          </label>
          <div class="campo completo">
            <span class="etiqueta">Ganancia solar por m² de ventana (BTU/h)</span>
            <div class="orientaciones">
              <label v-for="o in ORIENTATIONS" :key="o.id" class="campo">
                <span class="ayuda">{{ o.label }}</span>
                <NumberInput v-model="form.solar[o.id]" :decimals="0" :max="3000" :aria-label="`Ganancia solar de ventanas al ${o.label.toLowerCase()}`" />
              </label>
            </div>
          </div>
          <label class="campo">
            <span class="etiqueta">Insuficiente por debajo de</span>
            <NumberInput v-model="form.coolingUnder" :decimals="0" :max="100" suffix="%" />
            <span class="ayuda">Capacidad instalada ÷ requerida</span>
          </label>
          <label class="campo">
            <span class="etiqueta">Sobredimensionado desde</span>
            <NumberInput v-model="form.coolingOver" :decimals="0" :max="300" suffix="%" />
          </label>
        </div>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2><IconBulb :size="18" />Iluminación</h2>
          <span class="eyebrow">método de los lúmenes</span>
        </div>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Factor de mantenimiento</span>
            <NumberInput v-model="form.maintenanceFactor" :decimals="2" :max="1" />
          </label>
          <label class="campo">
            <span class="etiqueta">Tolerancia bajo la referencia</span>
            <NumberInput v-model="form.lightingTolerance" :decimals="0" :max="50" suffix="%" />
          </label>
          <label class="campo">
            <span class="etiqueta">Excesiva desde (veces la referencia)</span>
            <NumberInput v-model="form.lightingExcess" :decimals="1" :min="1" :max="5" suffix="×" />
          </label>
        </div>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2><IconBolt :size="18" />Sistema eléctrico</h2>
          <span class="eyebrow">carga frente a la capacidad</span>
        </div>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Carga alta desde</span>
            <NumberInput v-model="form.loadingHigh" :decimals="0" :max="100" suffix="%" />
          </label>
          <label class="campo">
            <span class="etiqueta">Carga crítica sobre</span>
            <NumberInput v-model="form.loadingCritical" :decimals="0" :max="150" suffix="%" />
          </label>
          <label class="campo">
            <span class="etiqueta">Criterio de protecciones</span>
            <NumberInput v-model="form.breakerCriterion" :decimals="0" :max="100" suffix="%" />
            <span class="ayuda">Carga continua máxima de un tablero o circuito</span>
          </label>
          <label class="campo">
            <span class="etiqueta">Factor de demanda</span>
            <NumberInput v-model="form.demandFactor" :decimals="0" :max="100" suffix="%" />
            <span class="ayuda">Cuando no hay medición, sobre la carga instalada</span>
          </label>
          <label class="campo">
            <span class="etiqueta">Factor de potencia supuesto</span>
            <NumberInput v-model="form.defaultPowerFactor" :decimals="2" :min="0.5" :max="1" />
          </label>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pestana {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.encabezado {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.acciones {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.guardado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--good-text);
  font-size: 13px;
  font-weight: 600;
}
.guardado.alerta {
  color: var(--critical-text);
}
.espacios {
  display: flex;
  flex-direction: column;
}
.fila {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 10px;
  padding: 10px 0;
  border-top: 1px solid var(--divider);
}
.fila .tipo {
  display: flex;
  grid-column: 1 / -1;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
.en-uso {
  color: var(--accent-strong);
  font-size: 11px;
  font-weight: 500;
}
.app-dark .en-uso {
  color: var(--accent);
}
.titulos {
  display: none;
}
.ver-todos {
  align-self: flex-start;
  height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent-strong);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.app-dark .ver-todos {
  color: var(--accent);
}
.orientaciones {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}
.rejilla {
  display: grid;
  gap: 14px;
}
@media (min-width: 720px) {
  .fila {
    grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(0, 1fr));
    align-items: center;
    padding: 6px 0;
  }
  .fila .tipo {
    grid-column: auto;
    flex-direction: column;
    gap: 0;
  }
  .titulos {
    display: grid;
    border-top: 0;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .titulos small {
    text-transform: none;
  }
  .movil {
    display: none;
  }
  .orientaciones {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (min-width: 1024px) {
  .rejilla {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
  }
  .rejilla .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .rejilla .orientaciones {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
