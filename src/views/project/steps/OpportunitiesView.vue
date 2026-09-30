<script setup lang="ts">
import { IconAirConditioning, IconAlertTriangle, IconBolt, IconBulb, IconCalculator, IconInfoCircle, IconPlus, IconPower, IconSun, IconTarget } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, ref, type Component } from 'vue';
import { RouterLink } from 'vue-router';
import { bubbleChart } from '@/charts/builders';
import { chartPalette } from '@/charts/palette';
import EChart from '@/components/charts/EChart.vue';
import PngButton from '@/components/charts/PngButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useFabAction } from '@/composables/useFab';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { isElectric } from '@/domain/carriers';
import { useQuickAdd } from '@/composables/useQuickAdd';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { useTheme } from '@/composables/useTheme';
import { lastTwelveMonthsKwh } from '@/db/projects';
import { saveRecord } from '@/db/records';
import { getDb } from '@/db/schema';
import { sum } from '@/domain/calc/stats';
import { endUseOf } from '@/domain/catalogs';
import { fncePotential, fnceStatement } from '@/domain/fncePotential';
import { excessHoursByEquipment, measureEconomics, nextMeasureCode, paybackText, planSummary, savingsTypeInfo, savingsTypeOf, specsText, suggestedPriority, type CalculatorResult } from '@/domain/measures';
import { dailyUseHours, useByArea } from '@/domain/occupancy';
import { billedPowerFactor } from '@/domain/sizing';
import { measureAllowance, tenureScope, tenureStatement } from '@/domain/tenure';
import type { Measure } from '@/domain/types';
import { billedDailyKwh } from '@/reports/model';
import { PRIORITY_STATUS } from '@/ui/icons';
import { formatCop, formatMillionsCop, formatNumber, formatPercent, round } from '@/utils/format';
import { fileSlug } from '@/utils/text';
import MeasureCalculator, { type CalculatorContext, type CalculatorTool } from './MeasureCalculator.vue';
import MeasureForm from './MeasureForm.vue';

const db = getDb();
const { projectId, project } = useCurrentProject();
const { isDark } = useTheme();
const desktop = useMediaQuery('(min-width: 1024px)');
const byCode = (a: Measure, b: Measure) => a.code.localeCompare(b.code, 'es', { numeric: true });
const { rows: measures, ready } = useProjectRecords('measures', byCode);
const { rows: findings } = useProjectRecords('findings');
const { rows: bills } = useProjectRecords('bills', undefined, isElectric);
const { rows: equipment } = useProjectRecords('equipment', undefined, isElectric);
const { rows: areas } = useProjectRecords('areas');
const { rows: occupancy } = useProjectRecords('occupancy');

const DEFAULT_ECONOMICS = { tariffCopPerKwh: 0, discountRate: 0.12, tariffEscalation: 0, horizonYears: 10, emissionFactorKgPerKwh: 0 };
const economics = computed(() => project.value?.economics ?? DEFAULT_ECONOMICS);
const rows = computed(() => measures.value.map((m) => ({ m, e: measureEconomics(m, economics.value) })));
const inPlan = computed(() => rows.value.filter((r) => r.m.selected));
const annualKwh = computed(() => lastTwelveMonthsKwh(bills.value));
const summary = computed(() => planSummary(measures.value, annualKwh.value));
const totals = computed(() => ({
  kwh: summary.value.kwh,
  cop: summary.value.cop,
  investment: summary.value.investment,
  payback: summary.value.paybackYears,
  npv: sum(inPlan.value.map((r) => r.e.npvCop)),
  share: annualKwh.value ? summary.value.kwh / annualKwh.value : null,
}));

// Tenencia del edificio: en arriendo, comodato u otra figura solo se pueden implementar buenas prácticas de operación (Res. 40412, art. 3, par. 3)
const tenure = computed(() => ({
  scope: tenureScope(project.value?.building?.tenure, project.value?.entity?.kind),
  statement: tenureStatement(project.value?.building?.tenure, project.value?.entity?.kind),
}));
const allowance = (m: Measure) => measureAllowance(tenure.value.scope, savingsTypeOf(m));
const blocked = computed(() => measures.value.filter((m) => allowance(m) === 'no-permitida'));

// Potencial de FNCER: dato de referencia o exclusión motivada, según el alcance que definió el auditor
const fnce = computed(() =>
  fnceStatement(
    project.value?.scope,
    fncePotential({ areas: areas.value, peakSunHours: project.value?.peakSunHours, annualKwh: annualKwh.value, tariffCopPerKwh: economics.value.tariffCopPerKwh }),
  ),
);
const FNCE_TONE = { potencial: 'good', excluida: 'neutral' } as const;
const FNCE_LABEL = { potencial: 'Potencial de referencia', excluida: 'Excluida del alcance' } as const;

const stats = computed(() => [
  { label: 'Medidas', value: formatNumber(measures.value.length), unit: `${inPlan.value.length} en el plan` },
  { label: 'Ahorro anual', value: formatNumber(totals.value.kwh), unit: totals.value.share === null ? 'kWh' : `kWh · ${formatPercent(totals.value.share, 1)}` },
  { label: 'Inversión', value: formatMillionsCop(totals.value.investment), unit: 'COP' },
  { label: 'Retorno del plan', value: Number.isFinite(totals.value.payback) ? formatNumber(totals.value.payback, 1) : '—', unit: 'años' },
]);

// Matriz de priorización: inversión frente a ahorro; el tamaño es la energía ahorrada
const PRIORITY_COLOR = (dark: boolean) => {
  const p = chartPalette(dark);
  return { alta: p.serious, media: p.warning, baja: p.estimate } as const;
};
function buildMatrix(dark: boolean) {
  const colors = PRIORITY_COLOR(dark);
  const p = chartPalette(dark);
  return bubbleChart({
    dark,
    xUnit: 'M COP',
    yUnit: 'M COP/año',
    points: rows.value.map(({ m }) => ({
      label: m.code,
      x: round(m.investmentCop / 1_000_000, 2),
      y: round(m.savingsCopYear / 1_000_000, 2),
      size: m.savingsKwhYear,
      color: m.priority ? colors[m.priority] : p.series[0],
    })),
  });
}
const matrixOption = computed(() => buildMatrix(isDark.value));
const pngName = computed(() => `${fileSlug(project.value?.name ?? 'proyecto')}_matriz-de-priorizacion`);

// Calculadoras: arrancan con los datos del proyecto
const TOOLS: { id: CalculatorTool; label: string; hint: string; icon: Component }[] = [
  { id: 'fv', label: 'Solar fotovoltaica', hint: 'kWp, módulos, área y generación', icon: IconSun },
  { id: 'condensadores', label: 'Banco de condensadores', hint: 'kvar para corregir el factor de potencia', icon: IconBolt },
  { id: 'aires', label: 'Reemplazo de aires', hint: 'ahorro por eficiencia (EER)', icon: IconAirConditioning },
  { id: 'led', label: 'Cambio a LED', hint: 'luminarias y potencia propuesta', icon: IconBulb },
  { id: 'apagado', label: 'Apagado y horarios', hint: 'buenas prácticas; deja fuera lo que no se apaga', icon: IconPower },
];
const tool = ref<CalculatorTool>('led');
const calculating = ref(false);
function openTool(id: CalculatorTool) {
  tool.value = id;
  calculating.value = true;
}
const context = computed<CalculatorContext>(() => {
  const recent = [...bills.value].sort((a, b) => a.period.localeCompare(b.period)).slice(-12);
  const demands = recent.map((b) => b.demandKw ?? 0).filter((d) => d > 0);
  const roof = sum(areas.value.map((a) => a.roofAvailableM2 ?? 0));
  // Horas de más: lo que cada equipo que se puede apagar funciona por encima del uso de su espacio, ponderado por su potencia
  const perDay = new Map([...useByArea(occupancy.value)].map(([id, use]) => [id, dailyUseHours(use, project.value?.calendar.daysPerWeek ?? 5)]));
  const excess = excessHoursByEquipment(equipment.value, perDay);
  const weight = (e: { powerKw: number; quantity: number }) => e.powerKw * e.quantity;
  const weights = sum(excess.map((r) => weight(r.equipment)));
  return {
    economics: economics.value,
    peakSunHours: project.value?.peakSunHours,
    billedDailyKwh: billedDailyKwh(bills.value),
    roofM2: roof || null,
    demandKw: demands.length ? Math.max(...demands) : null,
    powerFactor: billedPowerFactor(bills.value),
    reactiveChargeCop: sum(recent.map((b) => b.reactiveChargeCop ?? 0)),
    hvac: equipment.value.filter((e) => e.category === 'climatizacion' && (e.capacityBtuH ?? 0) > 0),
    lighting: equipment.value.filter((e) => e.category === 'iluminacion'),
    equipment: equipment.value,
    excessHours: weights > 0 ? sum(excess.map((r) => r.excessHours * weight(r.equipment))) / weights : null,
  };
});

const { visible, draft, isNew, errors, saving, openNew, openEdit, save, saveAndDuplicate, remove } = useRecordEditor('measures', {
  empty: () => ({
    id: crypto.randomUUID(),
    projectId: projectId.value,
    code: nextMeasureCode(measures.value),
    title: '',
    category: 'otros',
    kind: 'baja-inversion',
    savingsKwhYear: Number.NaN,
    savingsCopYear: Number.NaN,
    investmentCop: Number.NaN,
    annualCostCop: 0,
    lifetimeYears: 10,
    selected: true,
    findingIds: [],
  }),
  validate: (d) => {
    const money = (v: number, text: string) => (Number.isFinite(v) && v >= 0 ? undefined : text);
    return {
      code: d.code.trim() ? undefined : 'Escribe un código, p. ej. M1.',
      title: d.title.trim() ? undefined : 'Escribe el nombre de la medida.',
      savingsKwhYear: money(d.savingsKwhYear, 'Escribe el ahorro de energía (0 si solo ahorra dinero).'),
      savingsCopYear: money(d.savingsCopYear, 'Escribe el ahorro en pesos.'),
      investmentCop: money(d.investmentCop, 'Escribe la inversión (0 si es operativa).'),
      lifetimeYears: d.lifetimeYears > 0 ? undefined : 'La vida útil debe ser mayor que cero.',
    };
  },
  describe: (d) => `${d.code} · ${d.title}`,
  photoEntity: 'medida',
  duplicate: (d) => ({ ...d, code: nextMeasureCode(measures.value), findingIds: [] }),
});

function createFromCalculator(r: CalculatorResult) {
  const e = measureEconomics(r, economics.value);
  openNew({
    title: r.title,
    description: specsText(r.specs),
    category: r.category,
    kind: r.kind,
    savingsKwhYear: round(r.savingsKwhYear),
    savingsCopYear: round(r.savingsCopYear),
    investmentCop: round(r.investmentCop),
    annualCostCop: round(r.annualCostCop),
    lifetimeYears: r.lifetimeYears,
    savingsType: r.savingsType,
    priority: suggestedPriority(e, r.investmentCop),
  });
}

async function togglePlan(m: Measure) {
  // Lo que la tenencia no permite no entra al plan
  if (!m.selected && allowance(m) === 'no-permitida') return;
  await saveRecord(db, 'measures', { ...m, selected: !m.selected });
}

useFabAction({ label: 'Agregar medida', icon: IconPlus, run: () => openNew() });
useQuickAdd(() => openNew());

const payback = (years: number, investmentCop?: number) => {
  const text = paybackText({ paybackYears: years }, investmentCop ?? 1);
  return text.unit && text.value !== '—' ? `${text.value} ${text.unit}` : text.value;
};
const useLabel = (m: Measure) => endUseOf(m.category).label;
const typeLabel = (m: Measure) => savingsTypeInfo(savingsTypeOf(m)).short;
const categoryNames = (categories: readonly string[]) => categories.map((c) => endUseOf(c as Measure['category']).label.toLowerCase()).join(' y ');
</script>

<template>
  <div class="vista">
    <PageHeader step="oportunidades" :stats="measures.length ? stats : undefined">
      <template v-if="desktop" #actions>
        <Button label="Agregar medida" @click="openNew()">
          <template #icon><IconPlus :size="18" stroke="2.2" /></template>
        </Button>
      </template>
    </PageHeader>

    <p v-if="tenure.statement && tenure.scope !== 'todas'" class="aviso-linea alerta">
      <IconAlertTriangle :size="16" />
      <span>
        {{ tenure.statement }}
        <template v-if="blocked.length">
          {{ blocked.length }} {{ blocked.length === 1 ? 'medida queda' : 'medidas quedan' }} solo como potencial y no {{ blocked.length === 1 ? 'puede' : 'pueden' }} entrar al plan.
        </template>
        <RouterLink :to="{ name: 'datos', params: { projectId } }">Cambiar la tenencia</RouterLink>
      </span>
    </p>

    <section class="card seccion">
      <div class="cabecera-seccion apilada">
        <h2><IconSun :size="18" />Potencial de FNCER</h2>
        <StatusChip :tone="FNCE_TONE[fnce.kind]" :label="FNCE_LABEL[fnce.kind]" />
      </div>
      <p class="fnce">{{ fnce.text }}</p>
      <RouterLink class="enlace" :to="{ name: 'datos', params: { projectId } }">Cambiar el alcance de las FNCER en Datos generales</RouterLink>
    </section>

    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2><IconCalculator :size="18" />Calculadoras</h2>
        <span class="eyebrow">dimensionan la solución y arman la medida</span>
      </div>
      <div class="herramientas">
        <button v-for="t in TOOLS" :key="t.id" type="button" class="herramienta" @click="openTool(t.id)">
          <span class="icono"><component :is="t.icon" :size="22" /></span>
          <span class="textos">
            <strong>{{ t.label }}</strong>
            <small>{{ t.hint }}</small>
          </span>
        </button>
      </div>
    </section>

    <template v-if="measures.length">
      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Matriz de priorización</h2>
          <span class="eyebrow">inversión frente a ahorro anual · el tamaño es la energía</span>
          <PngButton :option="() => buildMatrix(false)" :name="pngName" />
        </div>
        <EChart :option="matrixOption" label="Medidas según su inversión y su ahorro anual" height="300px" />
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2><IconTarget :size="18" />Medidas de ahorro</h2>
          <span class="eyebrow">{{ inPlan.length }} de {{ measures.length }} en el plan de gestión</span>
        </div>
        <div v-if="desktop" class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th>Medida</th>
                <th>Potencial</th>
                <th class="der">Ahorro <small>kWh/año</small></th>
                <th class="der">Ahorro <small>COP/año</small></th>
                <th class="der">Inversión <small>COP</small></th>
                <th class="der">Retorno</th>
                <th class="der">VPN <small>COP</small></th>
                <th class="der">TIR</th>
                <th>Prioridad</th>
                <th>En el plan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="{ m, e } in rows" :key="m.id" class="fila-clic" @click="openEdit(m)">
                <td>
                  <span class="medida"><span class="mono codigo">{{ m.code }}</span>{{ m.title }}</span>
                  <span class="uso">{{ useLabel(m) }}</span>
                </td>
                <td><StatusChip :tone="allowance(m) === 'permitida' ? 'neutral' : 'warning'" :label="typeLabel(m)" /></td>
                <td class="der">{{ formatNumber(m.savingsKwhYear) }}</td>
                <td class="der">{{ formatCop(m.savingsCopYear) }}</td>
                <td class="der">{{ formatCop(m.investmentCop) }}</td>
                <td class="der fuerte">{{ payback(e.paybackYears, m.investmentCop) }}</td>
                <td class="der">{{ formatCop(e.npvCop) }}</td>
                <td class="der">{{ e.irr === null ? '—' : formatPercent(e.irr, 1) }}</td>
                <td><StatusChip v-if="m.priority" v-bind="PRIORITY_STATUS[m.priority]" /></td>
                <td @click.stop>
                  <ToggleSwitch
                    :model-value="m.selected"
                    :disabled="allowance(m) === 'no-permitida'"
                    :title="allowance(m) === 'no-permitida' ? 'La tenencia del edificio solo permite buenas prácticas de operación' : undefined"
                    :aria-label="`Incluir ${m.code} en el plan`"
                    @update:model-value="togglePlan(m)"
                  />
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2">Plan de gestión · {{ inPlan.length }} medidas</td>
                <td class="der">{{ formatNumber(totals.kwh) }}</td>
                <td class="der">{{ formatCop(totals.cop) }}</td>
                <td class="der">{{ formatCop(totals.investment) }}</td>
                <td class="der">{{ payback(totals.payback) }}</td>
                <td class="der">{{ formatCop(totals.npv) }}</td>
                <td colspan="3" />
              </tr>
            </tfoot>
          </table>
        </div>
        <ul v-else class="filas">
          <li v-for="{ m, e } in rows" :key="m.id">
            <button type="button" class="fila-boton" @click="openEdit(m)">
              <span class="fila-principal">
                <span class="medida"><span class="mono codigo">{{ m.code }}</span>{{ m.title }}</span>
              </span>
              <span class="fila-secundaria">
                <span>{{ formatNumber(m.savingsKwhYear) }} kWh/año · {{ formatCop(m.savingsCopYear) }}</span>
                <strong>{{ payback(e.paybackYears, m.investmentCop) }}</strong>
              </span>
              <span class="fila-secundaria">
                <span>{{ typeLabel(m) }} · Inversión {{ formatCop(m.investmentCop) }}</span>
                <StatusChip v-if="m.priority" v-bind="PRIORITY_STATUS[m.priority]" />
              </span>
            </button>
          </li>
        </ul>

        <div v-if="summary.byType.length" class="por-clase">
          <span class="eyebrow">Ahorro del plan por clase de potencial</span>
          <ul>
            <li v-for="t in summary.byType" :key="t.type">
              <strong>{{ savingsTypeInfo(t.type).label }}</strong>
              <span>{{ t.count }} {{ t.count === 1 ? 'medida' : 'medidas' }} · {{ formatNumber(t.kwh) }} kWh/año<template v-if="annualKwh"> · {{ formatPercent(t.kwh / annualKwh, 1) }}</template></span>
            </li>
          </ul>
        </div>
        <p v-if="summary.interaction" class="aviso-linea alerta">
          <IconInfoCircle :size="16" />
          <span>
            Las medidas de {{ categoryNames(summary.interaction.categories) }} se solapan: sumar sus ahorros sobrestima el total, como advierte el Anexo 5 de la Res. UPME 016.
            <template v-if="summary.interaction.combinedKwh !== null">
              Aplicadas una tras otra sobre el consumo que queda, ahorran unos {{ formatNumber(summary.interaction.combinedKwh) }} kWh/año frente a {{ formatNumber(summary.kwh) }} de la suma simple.
            </template>
          </span>
        </p>
      </section>
    </template>

    <div v-else-if="ready" class="card">
      <EmptyState
        :icon="IconTarget"
        title="Aún no hay medidas"
        text="Usa una calculadora para dimensionar una solución (solar, condensadores, aires o LED) o registra una medida con su ahorro y su inversión."
      >
        <Button label="Agregar una medida" @click="openNew()" />
      </EmptyState>
    </div>

    <MeasureCalculator v-model:visible="calculating" :tool="tool" :context="context" @create="createFromCalculator" />

    <FormSheet
      v-model:visible="visible"
      :title="isNew ? 'Nueva medida' : `${draft.code} · ${draft.title}`"
      eyebrow="Oportunidades"
      :saving="saving"
      :can-delete="!isNew"
      can-duplicate
      @submit="save"
      @delete="remove()"
      @duplicate="saveAndDuplicate"
    >
      <MeasureForm :key="draft.id" v-model:draft="draft" :errors="errors" :project-id="projectId" :economics="economics" :findings="findings" :tenure="tenure" />
    </FormSheet>
  </div>
</template>

<style scoped>
.herramientas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.fnce {
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.5;
}
.enlace {
  align-self: flex-start;
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 600;
}
.por-clase {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.por-clase ul {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.por-clase li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 2px 12px;
  padding: 9px 12px;
  font-size: 13px;
}
.por-clase li + li {
  border-top: 1px solid var(--divider);
}
.por-clase li span {
  color: var(--ink-2);
}
.herramienta {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface-2);
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 150ms var(--ease),
    background-color 150ms var(--ease);
}
.herramienta:hover {
  border-color: var(--accent);
  background: var(--accent-wash);
}
.herramienta .icono {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--surface);
  color: var(--accent-strong);
}
.app-dark .herramienta .icono {
  color: var(--accent);
}
.herramienta .textos {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.herramienta strong {
  font-size: 14px;
}
.herramienta small {
  color: var(--muted);
  font-size: 12px;
}
.medida {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-weight: 600;
}
.codigo {
  color: var(--accent-strong);
  font-size: 12px;
}
.app-dark .codigo {
  color: var(--accent);
}
.uso {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
.fuerte {
  font-weight: 600;
}
@media (min-width: 1024px) {
  .herramientas {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
</style>
