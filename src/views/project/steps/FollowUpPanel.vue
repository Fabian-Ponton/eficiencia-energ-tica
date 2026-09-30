<script setup lang="ts">
import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconTrendingDown } from '@tabler/icons-vue';
import { computed, ref } from 'vue';
import { followUpChart } from '@/charts/builders';
import EChart from '@/components/charts/EChart.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useTheme } from '@/composables/useTheme';
import { followUp, followUpYears, type FollowUpStatus } from '@/domain/followUp';
import type { RoutePlan } from '@/domain/route';
import type { Bill } from '@/domain/types';
import type { UpmeBaseline } from '@/domain/upmeBaseline';
import type { Tone } from '@/ui/icons';
import { formatNumber, formatPercent } from '@/utils/format';

/**
 * Seguimiento del ahorro real: el consumo facturado desde el primer año de la ruta frente al año anterior (la meta de la ley) y a la línea
 * base. Con el consumo facturado, sin corregir por clima ni ocupación.
 */
const props = defineProps<{ bills: readonly Bill[]; plan: RoutePlan; baseline: UpmeBaseline | null }>();
const { isDark } = useTheme();

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const years = computed(() => followUpYears(props.bills, props.plan.legal.firstYear));
const chosen = ref<number>();
const year = computed(() => (chosen.value !== undefined && years.value.includes(chosen.value) ? chosen.value : years.value[0]));
const yearOptions = computed(() => years.value.map((y) => ({ value: y, label: String(y) })));

/** Meta del año: la de la ruta o, el primer año, el mínimo legal. */
const targetPct = computed(() => {
  const row = props.plan.rows.find((r) => r.year === year.value);
  if (row?.targetPct !== null && row?.targetPct !== undefined) return row.targetPct;
  return year.value === props.plan.legal.firstYear ? props.plan.legal.pct : null;
});
const result = computed(() => (year.value === undefined ? null : followUp({ bills: props.bills, year: year.value, targetPct: targetPct.value, referenceKwh: props.plan.legal.referenceKwh, baseline: props.baseline })));

const STATUS: Record<FollowUpStatus, { tone: Tone; label: string }> = {
  'sin-datos': { tone: 'neutral', label: 'Sin facturas del año' },
  'sin-comparacion': { tone: 'neutral', label: 'Sin meses del año anterior para comparar' },
  'sin-meta': { tone: 'neutral', label: 'Sin meta para este año' },
  'en-ruta': { tone: 'good', label: 'En ruta' },
  atrasado: { tone: 'critical', label: 'Por debajo de la meta' },
  cumplida: { tone: 'good', label: 'Meta cumplida' },
  'no-alcanzada': { tone: 'critical', label: 'Meta no alcanzada' },
};

const pct = (fraction: number | null | undefined, decimals = 1) => (fraction === null || fraction === undefined ? '—' : formatPercent(fraction, decimals));
const chartMonths = computed(() => {
  const r = result.value;
  if (!r) return [];
  return MONTHS.map((label, i) => {
    const m = r.months.find((x) => x.month === i + 1);
    const previous = props.bills.find((b) => b.period === `${r.year - 1}-${String(i + 1).padStart(2, '0')}`);
    return { label, previousKwh: previous ? previous.kwh : null, actualKwh: m ? m.actualKwh : null, baselineKwh: m?.baselineKwh ?? null };
  });
});
const option = computed(() => (result.value ? followUpChart({ months: chartMonths.value, yearLabel: String(result.value.year), previousLabel: String(result.value.year - 1), dark: isDark.value }) : null));
const rows = computed(() =>
  (result.value?.months ?? []).map((m) => ({
    ...m,
    label: `${MONTHS[m.month - 1]} ${result.value?.year}`,
    saving: m.previousKwh !== null ? m.previousKwh - m.actualKwh : null,
    savingPct: m.previousKwh ? (m.previousKwh - m.actualKwh) / m.previousKwh : null,
    baselinePct: m.baselineKwh && m.actual30Kwh !== null ? (m.baselineKwh - m.actual30Kwh) / m.baselineKwh : null,
  })),
);
</script>

<template>
  <section class="card seccion panel-seguimiento">
    <div class="cabecera-seccion apilada">
      <h2><IconTrendingDown :size="18" />Seguimiento del ahorro real</h2>
      <span class="eyebrow">consumo facturado frente al año anterior y a la línea base</span>
      <StatusChip v-if="result" v-bind="STATUS[result.status]" :icon="result.status === 'en-ruta' || result.status === 'cumplida' ? IconCircleCheck : result.status === 'atrasado' || result.status === 'no-alcanzada' ? IconAlertTriangle : undefined" />
    </div>

    <p v-if="!years.length" class="nota">
      Aún no hay facturas desde {{ plan.legal.firstYear }}, el primer año después de la auditoría. Cuando las registres en Facturación, aquí se compara el consumo real con el del año anterior y con la línea
      base.
    </p>

    <template v-else-if="result">
      <div v-if="years.length > 1" class="campo">
        <span class="etiqueta">Año de seguimiento</span>
        <ChoiceChips :model-value="year" :options="yearOptions" label="Año de seguimiento" @update:model-value="(v) => (chosen = v)" />
      </div>

      <dl class="cifras">
        <div>
          <dt>Ahorro frente a {{ result.year - 1 }}</dt>
          <dd>
            <strong>{{ pct(result.savingPct) }}</strong>
            <span class="suave">{{ result.comparedMonths ? `${formatNumber(result.savingKwh)} kWh en ${result.comparedMonths} ${result.comparedMonths === 1 ? 'mes' : 'meses'}` : 'sin meses comparables' }}</span>
          </dd>
        </div>
        <div>
          <dt>Meta del año</dt>
          <dd>
            <strong>{{ targetPct !== null ? pct(targetPct / 100, Number.isInteger(targetPct) ? 0 : 1) : '—' }}</strong>
            <span class="suave">{{ result.targetKwh !== null ? `${formatNumber(result.targetKwh)} kWh/año` : 'sin meta' }}</span>
          </dd>
        </div>
        <div v-if="result.baselineSavingPct !== null">
          <dt>Ahorro frente a la línea base</dt>
          <dd>
            <strong>{{ pct(result.baselineSavingPct) }}</strong>
            <span class="suave">{{ result.baselineMonths }} {{ result.baselineMonths === 1 ? 'mes' : 'meses' }}, normalizados a 30 días</span>
          </dd>
        </div>
        <div v-if="!result.complete && result.remainingKwh !== null && result.remainingKwh > 0">
          <dt>Falta para la meta anual</dt>
          <dd>
            <strong>{{ formatNumber(result.remainingKwh) }} kWh</strong>
            <span class="suave">{{ result.requiredPct !== null ? `${pct(result.requiredPct)} de lo que se consumió en los meses que faltan` : '' }}</span>
          </dd>
        </div>
      </dl>

      <EChart v-if="option" :option="option" label="Consumo mensual real frente al año anterior y a la línea base" height="250px">
        <p v-for="m in rows" :key="m.period">{{ m.label }}: real {{ formatNumber(m.actualKwh) }} kWh; año anterior {{ m.previousKwh === null ? 'sin factura' : `${formatNumber(m.previousKwh)} kWh` }}.</p>
      </EChart>

      <div class="tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Mes</th>
              <th class="der">Año anterior <small>kWh</small></th>
              <th class="der">Real <small>kWh</small></th>
              <th class="der">Ahorro <small>kWh</small></th>
              <th class="der">Ahorro</th>
              <th v-if="result.baselineMonths" class="der">Frente a la LBEn</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in rows" :key="m.period">
              <td class="mono">{{ m.label }}</td>
              <td class="der">{{ m.previousKwh === null ? '—' : formatNumber(m.previousKwh) }}</td>
              <td class="der">{{ formatNumber(m.actualKwh) }}</td>
              <td class="der" :class="{ mal: m.saving !== null && m.saving < 0 }">{{ m.saving === null ? '—' : formatNumber(m.saving) }}</td>
              <td class="der" :class="{ mal: m.savingPct !== null && m.savingPct < 0 }">{{ pct(m.savingPct) }}</td>
              <td v-if="result.baselineMonths" class="der">{{ pct(m.baselinePct) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="nota">
        <IconInfoCircle :size="14" />
        Se compara el consumo facturado (kWh), sin corregir por clima, ocupación ni cambios en la operación. Los ajustes de la línea base (§7.6 de la Res. UPME 016) se documentan en Balance e indicadores.
      </p>
    </template>
  </section>
</template>

<style scoped>
.nota {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--muted);
  font-size: 12.5px;
}
.nota svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.cifras {
  display: grid;
  gap: 10px 18px;
  margin: 0;
}
.cifras div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cifras dt {
  color: var(--muted);
  font-size: 12px;
}
.cifras dd {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  margin: 0;
}
.cifras strong {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}
.suave {
  color: var(--muted);
  font-size: 12.5px;
}
.tabla-contenedor {
  overflow-x: auto;
}
.tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.tabla th,
.tabla td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--divider);
  text-align: left;
  white-space: nowrap;
}
.tabla th {
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 600;
}
.tabla small {
  font-weight: 400;
}
.tabla .der {
  text-align: right;
}
.tabla .mal {
  color: var(--critical-text);
}
@media (max-width: 719px) {
  .tabla {
    font-size: 12px;
  }
  .tabla th,
  .tabla td {
    padding: 6px 4px;
  }
  .tabla th {
    font-size: 10.5px;
    line-height: 1.25;
    white-space: normal;
  }
  .tabla th small {
    display: block;
  }
}
@media (min-width: 720px) {
  .cifras {
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  }
}
</style>
