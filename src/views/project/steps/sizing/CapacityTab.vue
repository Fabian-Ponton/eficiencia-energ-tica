<script setup lang="ts">
import { IconBolt, IconInfoCircle } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { gaugeChart } from '@/charts/builders';
import { chartPalette } from '@/charts/palette';
import EChart from '@/components/charts/EChart.vue';
import SingleLineDiagram from '@/components/diagrams/SingleLineDiagram.vue';
import EmptyState from '@/components/EmptyState.vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useTheme } from '@/composables/useTheme';
import type { CapacityResult, DemandBasis, FacilityDemand, NodeCheck, SizingParameters } from '@/domain/sizing';
import type { ElectricalNode } from '@/domain/types';
import { IMBALANCE_STATUS, LOADING_STATUS } from '@/ui/icons';
import { formatDateTime, periodLabel } from '@/utils/dates';
import { formatNumber, formatPercent } from '@/utils/format';

/** Carga instalada y demanda frente a la capacidad del transformador, la acometida, los tableros y los circuitos. */
const props = defineProps<{ capacity: CapacityResult; nodes: readonly ElectricalNode[]; params: SizingParameters; ready: boolean }>();
const { projectId } = useCurrentProject();
const { isDark } = useTheme();
const desktop = useMediaQuery('(min-width: 1024px)');

const BASIS: Record<DemandBasis, string> = {
  analizador: 'Demanda máxima del analizador',
  factura: 'Demanda máxima facturada',
  medido: 'Medición puntual',
  instalado: 'Carga instalada × factor de demanda',
};
const BASIS_SHORT: Record<DemandBasis, string> = { analizador: 'Analizador', factura: 'Factura', medido: 'Medido', instalado: 'Estimado' };
const PF_BASIS: Record<FacilityDemand['pfBasis'], string> = { medido: 'medido', factura: 'de las facturas', supuesto: 'supuesto' };

const facility = computed(() => props.capacity.facility);
const transformer = computed(() => props.capacity.checks.find((c) => c.node.kind === 'transformador'));
/** De dónde sale la demanda máxima, en una línea. */
const source = computed(() => {
  const f = facility.value;
  if (!f) return '';
  if (f.basis === 'factura') return `Factura de ${periodLabel(f.source)}`;
  if (f.basis === 'instalado') return `Estimada con el ${f.source}`;
  return f.basis === 'analizador' ? f.source : `Medición en ${f.source}`;
});

function buildLoadingGauge(dark: boolean) {
  const t = transformer.value;
  if (!t) return null;
  const p = chartPalette(dark);
  return gaugeChart({
    dark,
    value: Math.round(t.ratio * 1000) / 10,
    max: 120,
    unit: '%',
    bands: [
      { to: props.params.loadingHigh * 100, color: p.good },
      { to: props.params.loadingCritical * 100, color: p.warning },
      { to: 100, color: p.serious },
      { to: 120, color: p.critical },
    ],
  });
}
function buildPfGauge(dark: boolean) {
  const f = facility.value;
  if (!f) return null;
  const p = chartPalette(dark);
  return gaugeChart({
    dark,
    value: Math.round(f.pf * 100) / 100,
    max: 1,
    unit: '',
    decimals: 2,
    bands: [
      { to: 0.85, color: p.critical },
      { to: 0.9, color: p.warning },
      { to: 1, color: p.good },
    ],
  });
}
const loadingOption = computed(() => buildLoadingGauge(isDark.value));
const pfOption = computed(() => buildPfGauge(isDark.value));

// Unifilar: al tocar un elemento se ve su verificación; al inicio, el más cargado
const showCircuits = ref(true);
const selectedId = ref<string>();
const selectedNode = computed(() => props.nodes.find((n) => n.id === selectedId.value));
const selected = computed<NodeCheck | undefined>(() => {
  const checks = props.capacity.checks;
  if (selectedId.value) return props.capacity.byNode.get(selectedId.value);
  return [...checks].sort((a, b) => b.ratio - a.ratio)[0];
});
function detailItems(c: NodeCheck) {
  return [
    { label: 'Capacidad', value: formatNumber(c.capacity, 1), unit: c.unit },
    { label: 'Carga', value: formatNumber(c.load, 1), unit: c.unit },
    { label: 'Uso de la capacidad', value: formatPercent(c.ratio, 0), strong: true },
    { label: 'Carga instalada', value: formatNumber(c.installedKw, 1), unit: 'kW' },
  ];
}
function detailNote(c: NodeCheck): string {
  const criterion =
    c.node.kind === 'transformador'
      ? `alta desde ${formatPercent(props.params.loadingHigh, 0)} y crítica sobre ${formatPercent(props.params.loadingCritical, 0)}`
      : `criterio de carga continua: ${formatPercent(props.params.breakerCriterion, 0)} de la capacidad`;
  return `${BASIS[c.basis]} · ${criterion}`;
}

const maxCurrent = (currents: readonly number[]) => Math.max(1, ...currents);
</script>

<template>
  <div class="pestana">
    <template v-if="nodes.length">
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Demanda y transformador</h2>
          <span class="eyebrow">{{ transformer ? `${transformer.node.name} · ${formatNumber(transformer.capacity, 1)} kVA` : 'Sin transformador con capacidad registrada' }}</span>
          <StatusChip v-if="transformer" v-bind="LOADING_STATUS[transformer.level]" />
        </div>
        <div v-if="loadingOption || pfOption" class="medidores">
          <figure v-if="loadingOption">
            <EChart :option="loadingOption" label="Carga del transformador respecto a su capacidad" height="180px" />
            <figcaption>Carga del transformador</figcaption>
          </figure>
          <figure v-if="pfOption && facility">
            <EChart :option="pfOption" label="Factor de potencia de la instalación" height="180px" />
            <figcaption>Factor de potencia · {{ PF_BASIS[facility.pfBasis] }}</figcaption>
          </figure>
        </div>
        <dl v-if="facility" class="demanda">
          <div>
            <dt>Demanda máxima</dt>
            <dd class="num">{{ formatNumber(facility.kw, 1) }} <small>kW</small></dd>
            <dd class="fuente">{{ source }}</dd>
          </div>
          <div>
            <dt>Potencia aparente</dt>
            <dd class="num">{{ formatNumber(facility.kva, 1) }} <small>kVA</small></dd>
            <dd class="fuente">con FP {{ formatNumber(facility.pf, 2) }}</dd>
          </div>
          <div>
            <dt>Carga instalada</dt>
            <dd class="num">{{ formatNumber(facility.installedKw, 1) }} <small>kW</small></dd>
            <dd class="fuente">{{ facility.installedKw ? `factor de demanda ${formatPercent(facility.kw / facility.installedKw, 0)}` : 'sin inventario' }}</dd>
          </div>
          <div v-if="transformer">
            <dt>Capacidad disponible</dt>
            <dd class="num">{{ formatNumber(Math.max(0, transformer.capacity - transformer.load), 1) }} <small>kVA</small></dd>
            <dd class="fuente">{{ formatPercent(Math.max(0, 1 - transformer.ratio), 0) }} libre</dd>
          </div>
        </dl>
        <p v-if="facility?.pf !== undefined && facility.pf < 0.9" class="aviso-linea alerta">
          <IconInfoCircle :size="16" />
          <span>Con un factor de potencia menor de 0,90 el operador cobra la energía reactiva: conviene evaluar un banco de condensadores.</span>
        </p>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2><IconBolt :size="18" />Diagrama unifilar</h2>
          <span class="eyebrow">toca un elemento para ver su verificación</span>
          <label class="interruptor">
            <span>Circuitos</span>
            <ToggleSwitch v-model="showCircuits" />
          </label>
        </div>
        <SingleLineDiagram :nodes="nodes" :checks="capacity.byNode" :show-circuits="showCircuits" @select="(node) => (selectedId = node.id)" />
        <ul class="niveles" aria-label="Convenciones de carga">
          <li><span class="muestra normal" />Normal · menos de {{ formatPercent(params.loadingHigh, 0) }}</li>
          <li><span class="muestra alta" />Alta · desde {{ formatPercent(params.loadingHigh, 0) }}</li>
          <li><span class="muestra critica" />Crítica · más de {{ formatPercent(params.loadingCritical, 0) }}</li>
        </ul>
        <template v-if="selected">
          <CalcPanel :title="selected.node.name" :items="detailItems(selected)" :note="detailNote(selected)" />
        </template>
        <p v-else-if="selectedNode" class="nota">«{{ selectedNode.name }}» no tiene una verificación de capacidad: registra su capacidad o una medición en el sistema eléctrico.</p>
      </section>

      <section v-if="capacity.checks.length" class="card seccion">
        <div class="cabecera-seccion">
          <h2>Verificación de capacidad</h2>
          <span class="eyebrow">carga frente a la capacidad nominal</span>
        </div>
        <div v-if="desktop" class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th>Elemento</th>
                <th class="der">Capacidad</th>
                <th class="der">Carga</th>
                <th>Uso</th>
                <th>Estado</th>
                <th>Base del cálculo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in capacity.checks" :key="c.node.id" class="fila-clic" @click="selectedId = c.node.id">
                <td class="fuerte">{{ c.node.name }}</td>
                <td class="der">{{ formatNumber(c.capacity, 1) }} {{ c.unit }}</td>
                <td class="der">{{ formatNumber(c.load, 1) }} {{ c.unit }}</td>
                <td>
                  <span class="uso">
                    <span class="pista"><span class="relleno" :class="c.level" :style="{ width: `${Math.min(100, c.ratio * 100)}%` }" /></span>
                    <span class="mono num">{{ formatPercent(c.ratio, 0) }}</span>
                  </span>
                </td>
                <td><StatusChip v-bind="LOADING_STATUS[c.level]" /></td>
                <td class="base">{{ BASIS[c.basis] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul v-else class="filas">
          <li v-for="c in capacity.checks" :key="c.node.id">
            <button type="button" class="fila-boton" @click="selectedId = c.node.id">
              <span class="fila-principal">
                <strong>{{ c.node.name }}</strong>
                <StatusChip v-bind="LOADING_STATUS[c.level]" />
              </span>
              <span class="uso">
                <span class="pista"><span class="relleno" :class="c.level" :style="{ width: `${Math.min(100, c.ratio * 100)}%` }" /></span>
                <span class="mono num">{{ formatPercent(c.ratio, 0) }}</span>
              </span>
              <span class="fila-secundaria">
                <span>{{ formatNumber(c.load, 1) }} de {{ formatNumber(c.capacity, 1) }} {{ c.unit }}</span>
                <span>{{ BASIS_SHORT[c.basis] }}</span>
              </span>
            </button>
          </li>
        </ul>
        <p v-if="capacity.missingCapacity.length" class="aviso-linea">
          <IconInfoCircle :size="16" />
          <span>
            Sin capacidad registrada: {{ capacity.missingCapacity.map((n) => n.name).join(', ') }}. Complétala en
            <RouterLink :to="{ name: 'electrico', params: { projectId } }">Sistema eléctrico</RouterLink>.
          </span>
        </p>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Desbalance de fases</h2>
          <span class="eyebrow">corriente por fase · la línea es el promedio</span>
        </div>
        <div v-if="capacity.imbalance.length" class="desbalances">
          <div v-for="row in capacity.imbalance" :key="row.measurement.id" class="desbalance">
            <div class="cabecera-seccion">
              <h3>{{ row.point }}</h3>
              <span class="eyebrow">{{ formatDateTime(row.measurement.takenAt) }} · promedio {{ formatNumber(row.average, 1) }} A</span>
              <StatusChip v-bind="IMBALANCE_STATUS[row.level]" :label="`${formatPercent(row.imbalance, 1)} · ${IMBALANCE_STATUS[row.level].label.toLowerCase()}`" />
            </div>
            <div class="fases">
              <div v-for="(current, i) in row.currents" :key="i" class="fase">
                <span class="mono etiqueta-fase">L{{ i + 1 }}</span>
                <span class="barra-fase">
                  <span class="relleno-fase" :class="row.level" :style="{ width: `${(current / maxCurrent(row.currents)) * 100}%` }" />
                  <span class="promedio" :style="{ left: `${(row.average / maxCurrent(row.currents)) * 100}%` }" />
                </span>
                <span class="mono num">{{ formatNumber(current, 1) }} A</span>
              </div>
            </div>
          </div>
          <p class="nota">Desbalance = máxima desviación de una fase respecto al promedio. Hasta 10 % es normal; más de 20 % calienta motores y conductores.</p>
        </div>
        <p v-else class="nota">Registra una medición trifásica con la corriente de las tres fases en Mediciones para ver el desbalance.</p>
      </section>
    </template>

    <div v-else-if="ready" class="card">
      <EmptyState :icon="IconBolt" title="Sin sistema eléctrico" text="Registra el transformador, la acometida y los tableros con su capacidad para compararlos con la demanda.">
        <RouterLink :to="{ name: 'electrico', params: { projectId } }">Ir al sistema eléctrico</RouterLink>
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
.medidores {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0;
  min-width: 0;
}
figcaption {
  margin-top: -18px;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}
.demanda {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--divider);
}
.demanda > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 10px 12px;
  background: var(--surface);
}
dt {
  color: var(--muted);
  font-size: 12px;
}
dd {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
dd small {
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}
dd.fuente {
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 400;
}
.interruptor {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-2);
  font-size: 13px;
}
.niveles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  padding: 0;
  color: var(--ink-2);
  font-size: 12px;
  list-style: none;
}
.niveles li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.muestra {
  width: 14px;
  height: 4px;
  border-radius: 2px;
}
.muestra.normal,
.relleno.normal,
.relleno-fase.normal {
  background: var(--accent);
}
.muestra.alta,
.relleno.alta,
.relleno-fase.alto {
  background: var(--warning-text);
}
.muestra.critica,
.relleno.critica,
.relleno-fase.critico {
  background: var(--critical-text);
}
.nota {
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
}
.fuerte {
  font-weight: 600;
}
.base {
  color: var(--muted);
  font-size: 12.5px;
}
.uso {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pista {
  position: relative;
  flex: 1;
  min-width: 60px;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--divider);
}
.relleno {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 3px;
  transition: width 600ms var(--ease);
}
.uso .num {
  min-width: 40px;
  font-size: 12px;
  text-align: right;
}
.filas .fila-boton {
  gap: 6px;
}
.desbalances {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.desbalance {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.desbalance + .desbalance {
  padding-top: 14px;
  border-top: 1px solid var(--divider);
}
.fases {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fase {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 70px;
  align-items: center;
  gap: 8px;
}
.etiqueta-fase {
  color: var(--muted);
  font-size: 11px;
}
.barra-fase {
  position: relative;
  height: 14px;
  border-radius: 4px;
  background: var(--surface-2);
}
.relleno-fase {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 4px;
  transition: width 600ms var(--ease);
}
.promedio {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 0;
  border-left: 2px dashed var(--ink-2);
}
.fase .num {
  font-size: 12.5px;
  text-align: right;
}
@media (min-width: 1024px) {
  .demanda {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .medidores {
    max-width: 640px;
    margin: 0 auto;
  }
}
</style>
