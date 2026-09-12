<script setup lang="ts">
import { IconChevronDown, IconInfoCircle, IconRuler2 } from '@tabler/icons-vue';
import { computed, reactive } from 'vue';
import { RouterLink } from 'vue-router';
import { bulletChart } from '@/charts/builders';
import { chartPalette } from '@/charts/palette';
import EChart from '@/components/charts/EChart.vue';
import PngButton from '@/components/charts/PngButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useTheme } from '@/composables/useTheme';
import { spaceTypeOf } from '@/domain/catalogs';
import { spaceReference, type AreaCooling, type CoolingStatus, type SizingParameters } from '@/domain/sizing';
import { COOLING_STATUS } from '@/ui/icons';
import { formatNumber, formatPercent } from '@/utils/format';
import { fileSlug } from '@/utils/text';

/** Carga térmica de cada espacio frente a la capacidad de sus aires acondicionados. */
const props = defineProps<{ rows: AreaCooling[]; areaCount: number; params: SizingParameters; ready: boolean }>();
const { projectId, project } = useCurrentProject();
const { isDark } = useTheme();

function buildChart(dark: boolean) {
  const p = chartPalette(dark);
  const colors: Record<CoolingStatus, string> = { adecuado: p.good, subdimensionado: p.serious, sobredimensionado: p.warning, 'sin-aire': p.estimate };
  return bulletChart({
    dark,
    unit: 'BTU/h',
    valueName: 'Capacidad instalada',
    targetName: 'Carga requerida',
    items: props.rows.map((r) => ({
      label: r.area.name,
      value: Math.round(r.installedBtuH),
      target: Math.round(r.requiredBtuH),
      color: colors[r.status],
      note: r.status === 'sin-aire' ? 'sin aire' : undefined,
    })),
  });
}
const chartOption = computed(() => buildChart(isDark.value));
const chartHeight = computed(() => Math.max(170, props.rows.length * 42 + 44));
const pngName = computed(() => `${fileSlug(project.value?.name ?? 'proyecto')}_climatizacion`);

const counts = computed(() => {
  const count = (status: CoolingStatus) => props.rows.filter((r) => r.status === status).length;
  return (['adecuado', 'subdimensionado', 'sobredimensionado', 'sin-aire'] as const).map((status) => ({ status, count: count(status) })).filter((c) => c.count);
});

/** Componentes de la carga, con colores fijos de la paleta categórica. */
const PARTS = [
  { key: 'envelope', label: 'Envolvente', color: 0 },
  { key: 'people', label: 'Personas', color: 4 },
  { key: 'solar', label: 'Ventanas', color: 1 },
  { key: 'lighting', label: 'Iluminación', color: 3 },
  { key: 'equipment', label: 'Equipos', color: 2 },
  { key: 'safety', label: 'Seguridad', color: 6 },
] as const;
function parts(r: AreaCooling) {
  const p = chartPalette(isDark.value);
  return PARTS.map((part) => ({ ...part, value: r.load.components[part.key], fill: p.series[part.color] }))
    .filter((part) => part.value > 0)
    .map((part) => ({ ...part, share: part.value / r.requiredBtuH }));
}

const units = (r: AreaCooling) => `${r.suggestion.count} × ${formatNumber(r.suggestion.sizeBtuH)} BTU/h`;
function advice(r: AreaCooling): string {
  switch (r.status) {
    case 'sin-aire':
      return `La carga se cubriría con ${units(r)}. Si el espacio ya tiene aire, asígnalo a este espacio en el inventario.`;
    case 'subdimensionado':
      return `Faltan ${formatNumber(-r.marginBtuH)} BTU/h: en las horas pico el espacio no llega a la temperatura de diseño. Capacidad recomendada: ${units(r)}.`;
    case 'sobredimensionado':
      return `Sobran ${formatNumber(r.marginBtuH)} BTU/h: el equipo arranca y para seguido, deshumidifica mal y gasta más. Al reponerlo bastaría con ${units(r)}.`;
    default:
      return 'La capacidad instalada cubre la carga térmica estimada del espacio.';
  }
}

const open = reactive(new Set<string>());
function toggle(id: string) {
  if (open.has(id)) open.delete(id);
  else open.add(id);
}
function calcItems(r: AreaCooling) {
  const c = r.load.components;
  return [
    { label: `Envolvente · ${formatNumber(r.areaM2, 1)} m²`, value: formatNumber(c.envelope), unit: 'BTU/h' },
    { label: `Personas · ${formatNumber(r.area.occupants ?? 0)}`, value: formatNumber(c.people), unit: 'BTU/h' },
    { label: `Ventanas · ${formatNumber(r.area.windowAreaM2 ?? 0, 1)} m²`, value: formatNumber(c.solar), unit: 'BTU/h' },
    { label: 'Iluminación', value: formatNumber(c.lighting), unit: 'BTU/h' },
    { label: 'Equipos', value: formatNumber(c.equipment), unit: 'BTU/h' },
    { label: `Seguridad · ${formatPercent(props.params.safetyFactor, 0)}`, value: formatNumber(c.safety), unit: 'BTU/h' },
    { label: 'Carga requerida', value: formatNumber(r.requiredBtuH), unit: 'BTU/h', strong: true },
  ];
}
function calcNote(r: AreaCooling): string {
  const envelope = spaceReference(props.params, r.area.spaceType).envelopeBtuHPerM2;
  const roof = r.area.roofExposed ? ` + ${formatNumber(props.params.roofExtraBtuHPerM2)} por techo expuesto` : '';
  const solar = r.area.windowOrientation ? `ventanas al ${r.area.windowOrientation}` : 'ventanas sin orientación (promedio)';
  return `${formatNumber(envelope)} BTU/h·m² de envolvente${roof} · ${formatNumber(props.params.btuHPerPerson)} BTU/h por persona · ${solar} · 1 W = 3,412 BTU/h · 12.000 BTU/h = 1 TR`;
}
</script>

<template>
  <div class="pestana">
    <template v-if="rows.length">
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Capacidad frente a la carga térmica</h2>
          <span class="eyebrow">BTU/h · la marca oscura es lo requerido</span>
          <PngButton :option="() => buildChart(false)" :name="pngName" :height="chartHeight + 90" />
        </div>
        <EChart :option="chartOption" label="Capacidad de aire acondicionado instalada frente a la carga térmica requerida en cada espacio" :height="`${chartHeight}px`" />
        <div class="estados">
          <StatusChip v-for="c in counts" :key="c.status" :tone="COOLING_STATUS[c.status].tone" :icon="COOLING_STATUS[c.status].icon" :label="`${c.count} · ${COOLING_STATUS[c.status].label.toLowerCase()}`" />
        </div>
        <p class="nota">
          <IconInfoCircle :size="15" />
          <span>
            Método simplificado: envolvente, personas, ventanas, iluminación y equipos del espacio, más un {{ formatPercent(params.safetyFactor, 0) }} de seguridad. Sirve para
            verificar los equipos; no reemplaza un cálculo de cargas detallado.
          </span>
        </p>
      </section>

      <div class="rejilla">
        <article v-for="r in rows" :key="r.area.id" class="card seccion espacio" :class="r.status">
          <div class="cabecera-seccion">
            <h3>{{ r.area.name }}</h3>
            <span class="eyebrow">{{ spaceTypeOf(r.area.spaceType)?.label ?? 'Espacio' }} · {{ formatNumber(r.areaM2, 1) }} m² · {{ formatNumber(r.area.occupants ?? 0) }} personas</span>
            <StatusChip v-bind="COOLING_STATUS[r.status]" />
          </div>
          <div class="cifras">
            <div>
              <span class="eyebrow">Requerida</span>
              <strong class="num">{{ formatNumber(r.requiredBtuH) }}</strong>
              <span class="unidad">BTU/h · {{ formatNumber(r.requiredBtuH / 12000, 1) }} TR</span>
            </div>
            <div>
              <span class="eyebrow">Instalada</span>
              <strong class="num">{{ r.installedBtuH ? formatNumber(r.installedBtuH) : '—' }}</strong>
              <span class="unidad">{{ r.units ? `BTU/h · ${r.units} ${r.units === 1 ? 'unidad' : 'unidades'}` : 'sin aire asignado' }}</span>
            </div>
            <div>
              <span class="eyebrow">Cobertura</span>
              <strong class="num">{{ r.ratio === null ? '—' : formatPercent(r.ratio, 0) }}</strong>
              <span class="unidad">instalada ÷ requerida</span>
            </div>
          </div>
          <div class="desglose" role="img" :aria-label="`Composición de la carga: ${parts(r).map((p) => `${p.label} ${formatPercent(p.share, 0)}`).join(', ')}`">
            <span v-for="part in parts(r)" :key="part.key" class="segmento" :style="{ flexGrow: part.share, background: part.fill }" />
          </div>
          <ul class="leyenda">
            <li v-for="part in parts(r)" :key="part.key">
              <span class="muestra" :style="{ background: part.fill }" />
              <span>{{ part.label }}</span>
              <span class="mono num">{{ formatPercent(part.share, 0) }}</span>
            </li>
          </ul>
          <p class="consejo">{{ advice(r) }}</p>
          <button type="button" class="ver-calculo" :aria-expanded="open.has(r.area.id)" @click="toggle(r.area.id)">
            {{ open.has(r.area.id) ? 'Ocultar el cálculo' : 'Ver el cálculo' }}
            <IconChevronDown :size="16" :class="{ girada: open.has(r.area.id) }" />
          </button>
          <CalcPanel v-if="open.has(r.area.id)" title="Carga térmica simplificada" :items="calcItems(r)" :note="calcNote(r)" />
        </article>
      </div>
      <p v-if="areaCount > rows.length" class="aviso-linea">
        <IconInfoCircle :size="16" />
        <span>{{ areaCount - rows.length }} {{ areaCount - rows.length === 1 ? 'espacio' : 'espacios' }} sin área o de un tipo sin climatización no se evalúan.</span>
      </p>
    </template>

    <div v-else-if="ready" class="card">
      <EmptyState :icon="IconRuler2" title="Sin espacios con dimensiones" text="La carga térmica sale del área, las personas, las ventanas y los equipos de cada espacio.">
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
.espacio.subdimensionado {
  border-left-color: var(--serious-text);
}
.espacio.sobredimensionado {
  border-left-color: var(--warning-text);
}
.espacio.sin-aire {
  border-left-color: var(--field-border);
}
.cifras {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--divider);
}
.cifras > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 8px 10px;
  background: var(--surface);
}
.cifras .eyebrow {
  font-size: 9.5px;
}
.cifras strong {
  font-size: 17px;
  font-weight: 600;
}
.unidad {
  color: var(--muted);
  font-size: 11.5px;
}
.desglose {
  display: flex;
  gap: 2px;
  height: 12px;
  overflow: hidden;
  border-radius: 4px;
}
.segmento {
  flex: 1 1 0;
  min-width: 3px;
  transition: flex-grow 500ms var(--ease);
}
.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: -4px 0 0;
  padding: 0;
  color: var(--ink-2);
  font-size: 12px;
  list-style: none;
}
.leyenda li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.leyenda .num {
  color: var(--muted);
}
.muestra {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
.consejo {
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
}
.ver-calculo {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 4px;
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
.app-dark .ver-calculo {
  color: var(--accent);
}
.ver-calculo svg {
  transition: transform 200ms var(--ease);
}
.ver-calculo .girada {
  transform: rotate(180deg);
}
@media (min-width: 1024px) {
  .rejilla {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
</style>
