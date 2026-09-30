<script setup lang="ts">
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-vue';
import { computed } from 'vue';
import { chartPalette } from '@/charts/palette';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useTheme } from '@/composables/useTheme';
import { estimatedByCarrier, isNotElectric, summarizeCarriers, totalEnergy, unitLabel } from '@/domain/carriers';
import type { Bill, EnergyCarrier, Equipment } from '@/domain/types';
import { readableTextOn } from '@/utils/color';
import { periodLabel } from '@/utils/dates';
import { formatCop, formatNumber, formatPercent } from '@/utils/format';

/**
 * Balance de todos los energéticos: la electricidad y los demás, sumados solo en kWh equivalentes. La electricidad se
 * calcula como siempre (su balance está más abajo); aquí solo se ve cuánto pesa cada energético en el total.
 */
const props = defineProps<{ bills: readonly Bill[]; equipment: readonly Equipment[] }>();
const { isDark } = useTheme();

const summaries = computed(() => summarizeCarriers([...props.bills]));
const totals = computed(() => totalEnergy(summaries.value));
const estimated = computed(() => estimatedByCarrier(props.equipment));

// Cada energético conserva su color: el orden fijo de la paleta validada
const COLOR_INDEX: Record<EnergyCarrier, number> = { electricidad: 0, 'gas-natural': 1, glp: 2, otro: 3 };
const colorOf = (carrier: EnergyCarrier) => chartPalette(isDark.value).series[COLOR_INDEX[carrier]];

const segments = computed(() =>
  summaries.value
    .filter((s) => s.kwh > 0)
    .map((s) => ({ carrier: s.carrier, label: s.info.label, share: s.share, color: colorOf(s.carrier), text: readableTextOn(colorOf(s.carrier)) })),
);

/** Censo de los equipos que usan ese energético frente a lo facturado: solo cuando hay las dos cosas. */
const reconciliation = computed(() =>
  summaries.value
    .filter((s) => s.carrier !== 'electricidad' && s.kwh > 0 && s.missingFactor === 0 && (estimated.value.get(s.carrier) ?? 0) > 0)
    .map((s) => {
      const census = estimated.value.get(s.carrier) ?? 0;
      const yearly = s.count === 12 ? s.kwh : (s.kwh / s.count) * 12;
      return { label: s.info.label, census, billed: yearly, deviation: (census - yearly) / yearly, annualized: s.count !== 12 };
    }),
);
const hasOthers = computed(() => props.bills.some(isNotElectric));
defineExpose({ hasOthers });
</script>

<template>
  <section class="card panel">
    <div class="cabecera">
      <h2>Todos los energéticos</h2>
      <span class="eyebrow">últimos 12 meses · kWh equivalentes</span>
    </div>

    <div v-if="segments.length" class="barra" role="img" :aria-label="`Reparto de la energía: ${segments.map((s) => `${s.label} ${formatPercent(s.share, 0)}`).join(', ')}`">
      <div v-for="s in segments" :key="s.carrier" class="segmento" :style="{ flexGrow: s.share, background: s.color, color: s.text }">
        <span v-if="s.share >= 0.12" class="mono">{{ formatPercent(s.share, 0) }}</span>
      </div>
    </div>

    <div class="tabla-contenedor">
      <table class="tabla">
        <thead>
          <tr>
            <th>Energético</th>
            <th class="der">Facturado</th>
            <th class="der">Energía <small>kWh</small></th>
            <th class="der">Parte</th>
            <th class="der">Costo <small>COP</small></th>
            <th class="der">Por kWh <small>COP</small></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in summaries" :key="s.carrier">
            <td><span class="muestra" :style="{ background: colorOf(s.carrier) }" />{{ s.info.label }}</td>
            <td class="der" data-label="Facturado">{{ formatNumber(s.quantity) }} <small>{{ unitLabel(s.unit) }}</small></td>
            <td class="der fuerte" data-label="Energía (kWh)">{{ formatNumber(s.kwh) }}</td>
            <td class="der" data-label="Parte">{{ formatPercent(s.share, 1) }}</td>
            <td class="der" data-label="Costo (COP)">{{ formatCop(s.costCop) }}</td>
            <td class="der" data-label="Por kWh (COP)">{{ s.copPerKwh === null ? '—' : formatNumber(s.copPerKwh, 1) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="vacio" />
            <td class="der" data-label="Energía (kWh)">{{ formatNumber(totals.kwh) }}</td>
            <td class="der" data-label="Parte">{{ totals.kwh > 0 ? '100 %' : '—' }}</td>
            <td class="der" data-label="Costo (COP)">{{ formatCop(totals.costCop) }}</td>
            <td class="der" data-label="Por kWh (COP)">{{ totals.kwh > 0 && totals.missingFactor === 0 ? formatNumber(totals.costCop / totals.kwh, 1) : '—' }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <StatusChip
      v-if="totals.missingFactor"
      tone="warning"
      :icon="IconAlertTriangle"
      :label="`${totals.missingFactor} ${totals.missingFactor === 1 ? 'factura no tiene' : 'facturas no tienen'} factor de conversión: el total está incompleto`"
    />

    <ul v-if="reconciliation.length" class="conciliacion">
      <li v-for="r in reconciliation" :key="r.label">
        <IconInfoCircle :size="16" />
        <span>
          {{ r.label }}: el censo estima <strong>{{ formatNumber(r.census) }}</strong> kWh térmicos al año frente a <strong>{{ formatNumber(r.billed) }}</strong> kWh
          {{ r.annualized ? 'anualizados' : 'facturados' }} ({{ r.deviation < 0 ? '−' : '+' }}{{ formatPercent(Math.abs(r.deviation), 1) }}).
        </span>
      </li>
    </ul>
    <p class="nota">
      Cada energético se concilia por separado: el censo eléctrico se compara solo con la factura eléctrica, y el de gas, con la factura de gas.
      <template v-if="summaries.length"> Periodos: {{ summaries.map((s) => `${s.info.label} ${periodLabel(s.firstPeriod)} – ${periodLabel(s.lastPeriod)}`).join(' · ') }}.</template>
    </p>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
}
/* En el celular cada energético es una tarjeta con sus cifras rotuladas, no una tabla de seis columnas */
@media (max-width: 639px) {
  .tabla thead {
    display: none;
  }
  .tabla,
  .tabla tbody,
  .tabla tfoot {
    display: block;
  }
  .tabla tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 12px;
    padding: 10px 2px;
    border-bottom: 1px solid var(--divider);
  }
  .tabla td {
    padding: 0 !important;
    border: 0 !important;
    background: none !important;
    text-align: left !important;
  }
  .tabla td:first-child {
    grid-column: 1 / -1;
    font-weight: 600;
  }
  .tabla td.vacio {
    display: none;
  }
  .tabla td[data-label]::before {
    content: attr(data-label);
    display: block;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .tabla tfoot tr {
    border-bottom: 0;
    border-top: 2px solid var(--border);
  }
}
.cabecera {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.cabecera h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.barra {
  display: flex;
  gap: 2px;
  height: 18px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--surface);
}
.segmento {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  min-width: 3px;
  padding-left: 6px;
  font-size: 10px;
  font-weight: 600;
}
.muestra {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 8px;
  border-radius: 2px;
}
.conciliacion {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}
.conciliacion li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--ink-2);
}
.conciliacion svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.nota {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}
</style>
