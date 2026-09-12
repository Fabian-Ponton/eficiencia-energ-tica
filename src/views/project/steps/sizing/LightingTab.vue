<script setup lang="ts">
import { IconInfoCircle, IconRuler2 } from '@tabler/icons-vue';
import { computed, reactive } from 'vue';
import { RouterLink } from 'vue-router';
import { bulletChart } from '@/charts/builders';
import { chartPalette } from '@/charts/palette';
import EChart from '@/components/charts/EChart.vue';
import PngButton from '@/components/charts/PngButton.vue';
import LightingPlan from '@/components/diagrams/LightingPlan.vue';
import EmptyState from '@/components/EmptyState.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useTheme } from '@/composables/useTheme';
import type { LightingStatus } from '@/domain/calc/sizing/lighting';
import { spaceTypeOf } from '@/domain/catalogs';
import { luminaireGrid, type AreaLighting, type SizingParameters } from '@/domain/sizing';
import type { Equipment } from '@/domain/types';
import { LIGHTING_STATUS } from '@/ui/icons';
import { formatNumber, formatPercent } from '@/utils/format';
import { fileSlug } from '@/utils/text';

/** Iluminación de cada espacio: iluminancia, método de los lúmenes, densidad de potencia y VEEI. */
const props = defineProps<{ rows: AreaLighting[]; areaCount: number; equipment: readonly Equipment[]; params: SizingParameters; ready: boolean }>();
const { projectId, project } = useCurrentProject();
const { isDark } = useTheme();

function buildChart(dark: boolean) {
  const p = chartPalette(dark);
  const colors: Record<LightingStatus, string> = { adecuada: p.good, insuficiente: p.serious, excesiva: p.warning };
  return bulletChart({
    dark,
    unit: 'lx',
    valueName: 'Iluminancia actual',
    targetName: 'Requerida',
    items: props.rows.map((r) => ({
      label: r.area.name,
      value: Math.round(r.lux ?? 0),
      target: r.requiredLux,
      color: r.status ? colors[r.status] : p.estimate,
      note: r.lux === null ? 'sin dato' : `${formatNumber(r.lux)} lx`,
    })),
  });
}
const chartOption = computed(() => buildChart(isDark.value));
const chartHeight = computed(() => Math.max(170, props.rows.length * 42 + 44));
const pngName = computed(() => `${fileSlug(project.value?.name ?? 'proyecto')}_iluminacion`);

const counts = computed(() =>
  (['adecuada', 'insuficiente', 'excesiva'] as const)
    .map((status) => ({ status, count: props.rows.filter((r) => r.status === status).length }))
    .filter((c) => c.count),
);

/** Tubos fluorescentes: símbolo lineal en el plano; lo demás, panel. */
const TUBES = new Set(['T8', 'T5', 'T12']);
const shapeOf = (r: AreaLighting) =>
  props.equipment.some((e) => e.areaId === r.area.id && e.category === 'iluminacion' && TUBES.has(e.lampType ?? '')) ? 'lineal' : 'panel';

type Layout = 'actual' | 'propuesta';
const layouts = reactive<Record<string, Layout>>({});
const layoutOf = (r: AreaLighting): Layout => layouts[r.area.id] ?? (r.installed.count ? 'actual' : 'propuesta');
const hasPlan = (r: AreaLighting) => Boolean(r.area.lengthM && r.area.widthM);
const canCompare = (r: AreaLighting) => r.installed.count > 0 && r.required.count !== r.installed.count;
const layoutOptions = (r: AreaLighting) => [
  { value: 'actual' as const, label: `Actual · ${r.installed.count}` },
  { value: 'propuesta' as const, label: `Lúmenes · ${r.required.count}` },
];
function points(r: AreaLighting) {
  const count = layoutOf(r) === 'actual' ? r.installed.count : r.required.count;
  return luminaireGrid(count, r.area.lengthM ?? 0, r.area.widthM ?? 0).points;
}

function advice(r: AreaLighting): string {
  const missing = r.required.count - r.installed.count;
  if (r.status === 'insuficiente') {
    return missing > 0
      ? `Faltan ${missing} ${missing === 1 ? 'luminaria' : 'luminarias'} de este tipo para llegar a ${formatNumber(r.requiredLux)} lx, o luminarias de más flujo luminoso.`
      : `Con las luminarias instaladas el cálculo alcanza, pero la medición no: revisa lámparas fundidas, suciedad o balastos.`;
  }
  if (r.status === 'excesiva') return 'La iluminancia supera la referencia: se puede reducir la cantidad de luminarias o su potencia.';
  if (r.status === 'adecuada') return 'La iluminancia está dentro del rango de referencia del espacio.';
  return r.installed.count ? 'Registra los lúmenes de las luminarias o mide la iluminancia para calificar el espacio.' : 'Asigna las luminarias a este espacio en el inventario.';
}
</script>

<template>
  <div class="pestana">
    <template v-if="rows.length">
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Iluminancia frente a la requerida</h2>
          <span class="eyebrow">lux · la marca oscura es la referencia del espacio</span>
          <PngButton :option="() => buildChart(false)" :name="pngName" :height="chartHeight + 90" />
        </div>
        <EChart :option="chartOption" label="Iluminancia medida o calculada de cada espacio frente a la requerida" :height="`${chartHeight}px`" />
        <div class="estados">
          <StatusChip v-for="c in counts" :key="c.status" :tone="LIGHTING_STATUS[c.status].tone" :icon="LIGHTING_STATUS[c.status].icon" :label="`${c.count} · ${LIGHTING_STATUS[c.status].label.toLowerCase()}`" />
        </div>
        <p class="nota">
          <IconInfoCircle :size="15" />
          <span>
            Método de los lúmenes N = E·A ÷ (Φ·CU·FM) con un coeficiente de utilización orientativo según el índice del local y un factor de mantenimiento de
            {{ formatNumber(params.maintenanceFactor, 2) }}. Las referencias de iluminancia y VEEI se validan con el RETILAP.
          </span>
        </p>
      </section>

      <div class="rejilla">
        <article v-for="r in rows" :key="r.area.id" class="card seccion espacio" :class="r.status ?? 'sin-dato'">
          <div class="cabecera-seccion">
            <h3>{{ r.area.name }}</h3>
            <span class="eyebrow">{{ spaceTypeOf(r.area.spaceType)?.label ?? 'Espacio' }} · {{ formatNumber(r.requiredLux) }} lx requeridos</span>
            <StatusChip v-if="r.status" v-bind="LIGHTING_STATUS[r.status]" />
          </div>
          <div class="cuerpo">
            <div v-if="hasPlan(r)" class="plano">
              <LightingPlan
                :length-m="r.area.lengthM ?? 0"
                :width-m="r.area.widthM ?? 0"
                :points="points(r)"
                :shape="shapeOf(r)"
                :variant="layoutOf(r)"
                :window-orientation="r.area.windowOrientation"
                :window-area-m2="r.area.windowAreaM2"
              />
              <ChoiceChips
                v-if="canCompare(r)"
                :model-value="layoutOf(r)"
                :options="layoutOptions(r)"
                label="Distribución de luminarias"
                fill
                @update:model-value="(value) => (layouts[r.area.id] = value)"
              />
            </div>
            <dl class="cifras">
              <div>
                <dt>Iluminancia {{ r.basis === 'medido' ? 'medida' : 'calculada' }}</dt>
                <dd class="num">{{ r.lux === null ? '—' : `${formatNumber(r.lux)} lx` }}</dd>
              </div>
              <div v-if="r.basis === 'medido' && r.calculatedLux !== null">
                <dt>Calculada con lo instalado</dt>
                <dd class="num">{{ formatNumber(r.calculatedLux) }} lx</dd>
              </div>
              <div>
                <dt>Luminarias</dt>
                <dd class="num">{{ formatNumber(r.installed.count) }} <small>de {{ formatNumber(r.required.count) }} requeridas</small></dd>
              </div>
              <div>
                <dt>Densidad de potencia</dt>
                <dd class="num">{{ r.lpd === null ? '—' : `${formatNumber(r.lpd, 1)} W/m²` }}</dd>
              </div>
              <div>
                <dt>VEEI <small>W/m² por 100 lx</small></dt>
                <dd class="num veei" :class="{ excede: r.veeiOk === false }">
                  {{ r.veei === null ? '—' : formatNumber(r.veei, 2) }}
                  <small>límite {{ formatNumber(r.veeiLimit, 1) }}</small>
                </dd>
              </div>
            </dl>
          </div>
          <p class="consejo">
            {{ advice(r) }}
            <template v-if="r.veeiOk === false"> El VEEI supera el límite: la instalación usa más potencia de la necesaria por cada 100 lux (candidata a LED).</template>
          </p>
          <p class="mono calculo">
            K {{ formatNumber(r.roomIndex, 2) }}{{ r.roomIndexAssumed ? ' (supuesto)' : '' }} · CU {{ formatNumber(r.utilization, 2) }} · FM {{ formatNumber(params.maintenanceFactor, 2) }} ·
            {{ formatNumber(r.lumensBasis) }} lm por luminaria{{ r.lumensAssumed ? ' (LED de referencia)' : '' }} · {{ formatPercent(r.lux && r.requiredLux ? r.lux / r.requiredLux : 0, 0) }} de la referencia
          </p>
        </article>
      </div>
      <p v-if="areaCount > rows.length" class="aviso-linea">
        <IconInfoCircle :size="16" />
        <span>{{ areaCount - rows.length }} {{ areaCount - rows.length === 1 ? 'espacio' : 'espacios' }} sin área no se evalúan.</span>
      </p>
    </template>

    <div v-else-if="ready" class="card">
      <EmptyState :icon="IconRuler2" title="Sin espacios con dimensiones" text="El método de los lúmenes necesita el área y la altura de cada espacio, y las luminarias asignadas a él.">
        <RouterLink :to="{ name: 'areas', params: { projectId } }">Registrar espacios</RouterLink>
      </EmptyState>
    </div>
  </div>
</template>

<style scoped>
.pestana {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.rejilla {
  display: grid;
  gap: 14px;
}
.estados {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.nota {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
}
.nota svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.espacio {
  border-left: 3px solid var(--good-text);
}
.espacio.insuficiente {
  border-left-color: var(--serious-text);
}
.espacio.excesiva {
  border-left-color: var(--warning-text);
}
.espacio.sin-dato {
  border-left-color: var(--field-border);
}
.cuerpo {
  display: grid;
  gap: 12px;
}
.plano {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cifras {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
  align-content: start;
  margin: 0;
}
.cifras > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
dt {
  color: var(--muted);
  font-size: 12px;
}
dt small {
  font-size: 10.5px;
}
dd {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
dd small {
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 500;
}
.veei.excede {
  color: var(--serious-text);
}
.consejo {
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
}
.calculo {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
}
@media (min-width: 640px) {
  .cuerpo {
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    align-items: start;
  }
  .cifras {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (min-width: 1024px) {
  .rejilla {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
</style>
