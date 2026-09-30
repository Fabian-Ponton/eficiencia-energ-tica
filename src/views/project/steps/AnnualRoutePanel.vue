<script setup lang="ts">
import { IconAlertTriangle, IconCalendarPlus, IconCircleCheck, IconInfoCircle, IconRefresh, IconRoute, IconSparkles, IconTrash } from '@tabler/icons-vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { computed } from 'vue';
import { routeChart } from '@/charts/builders';
import EChart from '@/components/charts/EChart.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { offerUndo } from '@/composables/useUndo';
import { useTheme } from '@/composables/useTheme';
import { addRouteYear, moveMeasure, patchRouteYear, removeRouteYear, type RoutePlan, type RouteRow } from '@/domain/route';
import type { Measure, RouteYear } from '@/domain/types';
import type { Tone } from '@/ui/icons';
import { formatCop, formatNumber, formatPercent } from '@/utils/format';

/**
 * Ruta de cumplimiento anual de ahorro (Res. 40412 de 2024, art. 4, par. 3): qué medidas entran en operación cada año, cuánto ahorra el
 * plan acumulado frente al consumo del año anterior y con qué presupuesto. Mientras el auditor no la confirma, se ve la que propone
 * PONTIA a partir de las tareas y prioridades de las medidas; la primera edición la guarda.
 */
const route = defineModel<RouteYear[] | undefined>({ required: true });
const props = defineProps<{ plan: RoutePlan; measures: readonly Measure[] }>();

const { isDark } = useTheme();

const planMeasures = computed(() => props.measures.filter((m) => m.selected).sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true })));
const current = computed<RouteYear[]>(() => props.plan.route.rows.map((r) => ({ ...r, measureCodes: [...r.measureCodes] })));
const years = computed(() => props.plan.rows.map((r) => r.year));
const yearOptions = computed(() => years.value.map((year) => ({ value: year, label: String(year) })));

const option = computed(() => routeChart({ rows: props.plan.rows, legalPct: props.plan.legal.pct, dark: isDark.value }));

const STATUS: Record<RouteRow['status'], { tone: Tone; label: string }> = {
  cumple: { tone: 'good', label: 'Cumple la meta' },
  'no-cumple': { tone: 'critical', label: 'No alcanza la meta' },
  'sin-meta': { tone: 'neutral', label: 'Sin meta' },
};
const NOTICE_TONE: Record<string, Tone> = { critical: 'critical', warning: 'warning', info: 'info' };

const byCode = computed(() => new Map(planMeasures.value.map((m) => [m.code, m])));
const yearOf = (code: string) => props.plan.rows.find((r) => r.measureCodes.includes(code))?.year;
const BASIS_TEXT = { tareas: 'según sus tareas', prioridad: 'según su prioridad' } as const;

const percent = (value: number | null) => (value === null ? '—' : formatPercent(value / 100, 1));

function setTarget(year: number, value: number | undefined) {
  route.value = patchRouteYear(current.value, year, { targetPct: value });
}
function setBudget(year: number, value: number | undefined) {
  route.value = patchRouteYear(current.value, year, { budgetCop: value });
}
function setNote(year: number, value: string) {
  route.value = patchRouteYear(current.value, year, { note: value.trim() ? value : undefined });
}
function assign(code: string, year: number | undefined) {
  if (year === undefined) return;
  route.value = moveMeasure(current.value, code, year);
}
function addYear() {
  route.value = addRouteYear(current.value, props.plan.legal.firstYear);
}
function removeYear(year: number) {
  route.value = removeRouteYear(current.value, year);
}
function confirm() {
  route.value = current.value;
}
function reset() {
  const before = route.value?.map((r) => ({ ...r, measureCodes: [...r.measureCodes] }));
  route.value = undefined;
  offerUndo('La ruta volvió a la propuesta del plan', () => {
    route.value = before;
  });
}
</script>

<template>
  <section class="card seccion panel-ruta">
    <div class="cabecera-seccion apilada">
      <h2><IconRoute :size="18" />3.3 Ruta de cumplimiento anual</h2>
      <span class="eyebrow">Res. 40412 · art. 4, par. 3 · ahorro acumulado frente al año anterior</span>
      <StatusChip v-if="plan.route.proposed" tone="info" label="Propuesta de PONTIA · sin confirmar" :icon="IconSparkles" />
      <StatusChip v-else tone="good" label="Ruta confirmada" :icon="IconCircleCheck" />
    </div>
    <p class="texto">
      Cada año dice qué medidas entran en operación, cuánto ahorra el plan acumulado y con qué presupuesto. La ley pide al menos el {{ formatNumber(plan.legal.pct, 0) }} % el primer año; desde el segundo,
      son metas que fija la auditoría.
    </p>

    <ul v-if="plan.notices.length" class="avisos">
      <li v-for="(notice, i) in plan.notices" :key="i" :class="NOTICE_TONE[notice.tone]">
        <IconAlertTriangle v-if="notice.tone !== 'info'" :size="16" />
        <IconInfoCircle v-else :size="16" />
        <span>{{ notice.text }}</span>
      </li>
    </ul>

    <template v-if="plan.rows.length">
      <EChart :option="option" label="Ahorro previsto por año frente a la meta y al mínimo legal" height="250px">
        <p v-for="row in plan.rows" :key="row.year">Año {{ row.year }}: ahorro previsto {{ percent(row.plannedPct) }}, meta {{ percent(row.targetPct) }}.</p>
      </EChart>

      <div v-for="row in plan.rows" :key="row.year" class="anio" :class="row.status">
        <div class="anio-cabeza">
          <strong class="mono anio-numero">{{ row.year }}</strong>
          <StatusChip v-bind="STATUS[row.status]" />
          <span v-if="row.legalMinimum" class="etiqueta-legal">primer año · mínimo legal</span>
          <button v-if="!row.measureCodes.length" type="button" class="boton-icono quitar" :aria-label="`Quitar el año ${row.year}`" @click="removeYear(row.year)"><IconTrash :size="18" /></button>
        </div>
        <p class="anio-medidas">
          <template v-if="row.measureCodes.length">
            <span v-for="code in row.measureCodes" :key="code" class="medida-chip" :title="byCode.get(code)?.title"><b class="mono">{{ code }}</b> {{ byCode.get(code)?.title }}</span>
          </template>
          <span v-else class="vacio">Ninguna medida entra en operación este año.</span>
        </p>
        <dl class="cifras">
          <div>
            <dt>Ahorro previsto</dt>
            <dd>{{ formatNumber(row.plannedKwh) }} kWh/año <span class="suave">· {{ percent(row.plannedPct) }}</span></dd>
          </div>
          <div>
            <dt>Meta</dt>
            <dd>
              {{ row.targetKwh === null ? '—' : `${formatNumber(row.targetKwh)} kWh/año` }} <span class="suave">· {{ percent(row.targetPct) }}</span>
              <span v-if="row.gapKwh > 0" class="falta">faltan {{ formatNumber(row.gapKwh) }} kWh/año</span>
            </dd>
          </div>
        </dl>
        <div class="campos">
          <label class="campo">
            <span class="etiqueta">Meta acumulada</span>
            <NumberInput :model-value="row.targetPct ?? undefined" :decimals="1" :min="row.legalMinimum ? plan.legal.pct : 0" :max="100" suffix="%" @update:model-value="(v) => setTarget(row.year, v)" />
          </label>
          <label class="campo">
            <span class="etiqueta">Presupuesto del año</span>
            <NumberInput :model-value="route?.find((r) => r.year === row.year)?.budgetCop" :decimals="0" :placeholder="formatCop(row.budgetCop)" suffix="COP" @update:model-value="(v) => setBudget(row.year, v)" />
            <small class="ayuda">{{ route?.find((r) => r.year === row.year)?.budgetCop === undefined ? 'Automático: suma de las inversiones de sus medidas.' : 'Escrito por ti.' }}</small>
          </label>
          <label class="campo nota-campo">
            <span class="etiqueta">Nota</span>
            <InputText :model-value="row.note ?? ''" placeholder="Supuestos, riesgos o decisiones de ese año" @update:model-value="(v) => setNote(row.year, String(v ?? ''))" />
          </label>
        </div>
      </div>

      <div class="asignacion">
        <h3>Año en que entra en operación cada medida</h3>
        <p class="ayuda-seccion">El ahorro de una medida cuenta desde el año en que entra en operación. PONTIA sugiere el año con las fechas de sus tareas o, sin ellas, con su prioridad.</p>
        <div v-for="m in planMeasures" :key="m.id" class="medida-fila">
          <span class="medida-titulo">
            <b class="mono codigo">{{ m.code }}</b> {{ m.title }}
            <small>{{ formatNumber(m.savingsKwhYear) }} kWh/año</small>
          </span>
          <ChoiceChips :model-value="yearOf(m.code)" :options="yearOptions" :label="`Año en que entra en operación ${m.code}`" @update:model-value="(y) => assign(m.code, y)" />
          <small v-if="plan.suggested[m.code] && plan.suggested[m.code].year !== yearOf(m.code)" class="sugerido">
            Sugerido: {{ plan.suggested[m.code].year }} ({{ BASIS_TEXT[plan.suggested[m.code].basis] }})
          </small>
        </div>
      </div>
    </template>
    <p v-else class="vacio">La ruta se arma con las medidas del plan: márcalas en Oportunidades y aquí aparecen por año.</p>

    <div class="acciones">
      <Button label="Agregar año" size="small" severity="secondary" outlined @click="addYear">
        <template #icon><IconCalendarPlus :size="16" /></template>
      </Button>
      <Button v-if="plan.route.proposed && plan.rows.length" label="Confirmar la ruta" size="small" @click="confirm">
        <template #icon><IconCircleCheck :size="16" /></template>
      </Button>
      <Button v-else-if="!plan.route.proposed" label="Volver a la propuesta del plan" size="small" severity="secondary" text @click="reset">
        <template #icon><IconRefresh :size="16" /></template>
      </Button>
    </div>
    <p v-if="route === undefined && plan.rows.length" class="nota-pie"><IconInfoCircle :size="14" />Sin confirmar, el PGEE en Word lleva esta ruta marcada como propuesta para aprobación.</p>
  </section>
</template>

<style scoped>
.texto {
  margin: 0;
  color: var(--ink-2);
  font-size: 13.5px;
}
.avisos {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.avisos li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 12px;
  border-radius: var(--radius);
  font-size: 13px;
  line-height: 1.4;
}
.avisos li svg {
  flex-shrink: 0;
  margin-top: 1px;
}
.avisos .critical {
  background: var(--critical-wash);
  color: var(--critical-text);
}
.avisos .warning {
  background: var(--warning-wash);
  color: var(--warning-text);
}
.avisos .info {
  background: var(--info-wash);
  color: var(--ink-2);
}
.anio {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--axis);
  border-radius: var(--radius);
}
.anio.cumple {
  border-left-color: var(--good);
}
.anio.no-cumple {
  border-left-color: var(--critical-text);
}
.anio-cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.anio-numero {
  font-size: 18px;
}
.etiqueta-legal {
  color: var(--muted);
  font-size: 12px;
}
.quitar {
  margin-left: auto;
}
.anio-medidas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}
.medida-chip {
  max-width: 100%;
  padding: 3px 8px;
  overflow: hidden;
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--ink-2);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.medida-chip b {
  color: var(--accent-strong);
}
.app-dark .medida-chip b {
  color: var(--accent);
}
.vacio {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.cifras {
  display: grid;
  gap: 6px 18px;
  margin: 0;
}
.cifras div {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}
.cifras dt {
  min-width: 108px;
  color: var(--muted);
  font-size: 12px;
}
.cifras dd {
  margin: 0;
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
}
.suave {
  color: var(--muted);
}
.falta {
  margin-left: 6px;
  color: var(--critical-text);
  font-size: 12.5px;
  font-weight: 600;
}
.campos {
  display: grid;
  gap: 10px;
}
.asignacion {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--divider);
}
.asignacion h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.medida-fila {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.medida-titulo {
  font-size: 13.5px;
}
.medida-titulo small {
  margin-left: 6px;
  color: var(--muted);
  font-size: 12px;
}
.codigo {
  color: var(--accent-strong);
}
.app-dark .codigo {
  color: var(--accent);
}
.sugerido {
  color: var(--muted);
  font-size: 12px;
}
.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.nota-pie {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
@media (min-width: 720px) {
  .campos {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 2fr);
  }
  .cifras {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .medida-fila {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
  }
  .medida-titulo {
    flex: 1 1 260px;
  }
}
</style>
