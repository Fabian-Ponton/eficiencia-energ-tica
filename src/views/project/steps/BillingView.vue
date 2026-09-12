<script setup lang="ts">
import { IconAlertTriangle, IconCamera, IconInfoCircle, IconPlus, IconReceipt } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import { computed, ref } from 'vue';
import MonthlyBars from '@/components/charts/MonthlyBars.vue';
import EmptyState from '@/components/EmptyState.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useFabAction } from '@/composables/useFab';
import { usePhotoCounts, useProjectRecords } from '@/composables/useProjectRecords';
import { useQuickAdd } from '@/composables/useQuickAdd';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { powerFactorFromEnergy, summarizeBills } from '@/domain/calc/bills';
import type { Bill } from '@/domain/types';
import { MONTHS_SHORT, missingPeriods, nextPeriod, periodLabel, periodLabelLong, toPeriod } from '@/utils/dates';
import { formatCop, formatMillionsCop, formatNumber } from '@/utils/format';
import BillForm from './BillForm.vue';

const { projectId } = useCurrentProject();
const desktop = useMediaQuery('(min-width: 1024px)');
const { rows: bills, ready } = useProjectRecords('bills', (a, b) => a.period.localeCompare(b.period));
const photoCounts = usePhotoCounts('factura');

const RANGES = [
  { value: 12, label: '12 meses' },
  { value: 24, label: '24 meses' },
] as const;
const range = ref<12 | 24>(12);
const shown = computed(() => bills.value.slice(-range.value));
const lastYear = computed(() => bills.value.slice(-12));
const summary = computed(() => summarizeBills(lastYear.value));
const newestFirst = computed(() => [...bills.value].reverse());
const missing = computed(() => missingPeriods(bills.value.map((b) => b.period)));

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const perDay = (b: Bill) => (b.days ? b.kwh / b.days : null);
const tariffOf = (b: Bill) => b.tariffCopPerKwh ?? (b.kwh > 0 ? b.costCop / b.kwh : null);
const pfOf = (b: Bill) => (b.kvarh !== undefined && b.kwh > 0 ? powerFactorFromEnergy(b.kwh, b.kvarh) : null);
/** En la gráfica de 24 meses, enero lleva el año para ubicarse. */
function monthLabel(period: string) {
  const [year, month] = period.split('-');
  const name = MONTHS_SHORT[Number(month) - 1] ?? month;
  return range.value === 24 && month === '01' ? `${name} ${year.slice(2)}` : name;
}

const stats = computed(() => {
  const s = summary.value;
  if (!s) return undefined;
  const withDays = lastYear.value.filter((b) => b.days);
  const days = withDays.reduce((t, b) => t + (b.days ?? 0), 0);
  const daily = days ? withDays.reduce((t, b) => t + b.kwh, 0) / days : null;
  const months = lastYear.value.length;
  return [
    { label: months === 12 ? 'Consumo 12 meses' : `Consumo · ${months} ${months === 1 ? 'mes' : 'meses'}`, value: formatNumber(s.totalKwh), unit: 'kWh' },
    { label: 'Costo', value: formatMillionsCop(s.totalCostCop), unit: 'COP' },
    { label: 'Tarifa media', value: formatNumber(s.effectiveTariffCopPerKwh, 1), unit: 'COP/kWh' },
    daily !== null
      ? { label: 'Promedio diario', value: formatNumber(daily), unit: 'kWh/día' }
      : { label: 'Promedio mensual', value: formatNumber(s.averageMonthlyKwh), unit: 'kWh/mes' },
  ];
});

const { visible, draft, isNew, errors, saving, openNew, openEdit, save, remove } = useRecordEditor('bills', {
  empty: () => ({
    id: crypto.randomUUID(),
    projectId: projectId.value,
    period: bills.value.length ? nextPeriod(bills.value[bills.value.length - 1].period) : nextPeriod(toPeriod(), -1),
    kwh: Number.NaN,
    costCop: Number.NaN,
  }),
  validate: (d) => ({
    period: !d.period
      ? 'Elige el mes facturado.'
      : bills.value.some((b) => b.period === d.period && b.id !== d.id)
        ? `Ya hay una factura de ${periodLabelLong(d.period)}.`
        : undefined,
    kwh: d.kwh > 0 ? undefined : 'Escribe la energía activa facturada (kWh).',
    costCop: d.costCop >= 0 ? undefined : 'Escribe el valor total de la factura.',
    days: d.days === undefined || (d.days >= 1 && d.days <= 62) ? undefined : 'Los días facturados van de 1 a 62.',
  }),
  describe: (d) => (d.period ? `Factura de ${periodLabelLong(d.period)}` : 'Factura'),
  photoEntity: 'factura',
});

useFabAction({ label: 'Registrar factura', icon: IconPlus, run: () => openNew() });
useQuickAdd(() => openNew());
</script>

<template>
  <div class="vista">
    <PageHeader step="facturacion" :stats="stats">
      <template v-if="desktop" #actions>
        <Button label="Registrar factura" @click="openNew()">
          <template #icon><IconPlus :size="18" stroke="2.2" /></template>
        </Button>
      </template>
    </PageHeader>

    <template v-if="bills.length">
      <p v-if="bills.length < 12" class="aviso-linea">
        <IconInfoCircle :size="16" />Con 12 facturas consecutivas se completa este paso y se calcula el consumo anual. Llevas {{ bills.length }}.
      </p>
      <p v-if="missing.length" class="aviso-linea alerta"><IconAlertTriangle :size="16" />Faltan facturas de {{ missing.map(periodLabel).join(', ') }}.</p>

      <section class="card grafica">
        <div class="grafica-cabecera">
          <h2>Consumo mensual facturado</h2>
          <ChoiceChips v-if="bills.length > 12" v-model="range" :options="RANGES" label="Meses en la gráfica" />
          <span v-else class="eyebrow">kWh</span>
        </div>
        <MonthlyBars :labels="shown.map((b) => monthLabel(b.period))" :values="shown.map((b) => b.kwh)" unit="kWh" title="Consumo mensual facturado" />
      </section>

      <div v-if="desktop" class="card tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Periodo</th>
              <th class="der">Días</th>
              <th class="der">Energía <small>kWh</small></th>
              <th class="der">Diario <small>kWh/día</small></th>
              <th class="der">Reactiva <small>kvarh</small></th>
              <th class="der">FP</th>
              <th class="der">Demanda <small>kW</small></th>
              <th class="der">Valor <small>COP</small></th>
              <th class="der">Tarifa <small>COP/kWh</small></th>
              <th class="der">Fotos</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in newestFirst" :key="b.id" class="fila-clic" tabindex="0" @click="openEdit(b)" @keydown.enter="openEdit(b)">
              <td class="periodo">{{ capitalize(periodLabelLong(b.period)) }}</td>
              <td class="der">{{ b.days ?? '—' }}</td>
              <td class="der fuerte">{{ formatNumber(b.kwh) }}</td>
              <td class="der">{{ perDay(b) === null ? '—' : formatNumber(perDay(b) ?? 0) }}</td>
              <td class="der">{{ b.kvarh === undefined ? '—' : formatNumber(b.kvarh) }}</td>
              <td class="der">{{ pfOf(b) === null ? '—' : formatNumber(pfOf(b) ?? 0, 2) }}</td>
              <td class="der">{{ b.demandKw === undefined ? '—' : formatNumber(b.demandKw, 1) }}</td>
              <td class="der">{{ formatCop(b.costCop) }}</td>
              <td class="der">{{ tariffOf(b) === null ? '—' : formatNumber(tariffOf(b) ?? 0, 1) }}</td>
              <td class="der">{{ photoCounts.get(b.id) ?? '—' }}</td>
            </tr>
          </tbody>
          <tfoot v-if="summary">
            <tr>
              <td>Últimos {{ lastYear.length }} meses</td>
              <td />
              <td class="der">{{ formatNumber(summary.totalKwh) }}</td>
              <td />
              <td />
              <td />
              <td />
              <td class="der">{{ formatCop(summary.totalCostCop) }}</td>
              <td class="der">{{ formatNumber(summary.effectiveTariffCopPerKwh, 1) }}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <TransitionGroup v-else name="list" tag="div" class="lista">
        <button v-for="b in newestFirst" :key="b.id" type="button" class="card factura" @click="openEdit(b)">
          <span class="fila">
            <span class="mono periodo-corto">{{ periodLabel(b.period).toUpperCase() }}</span>
            <span class="kwh"><strong class="num">{{ formatNumber(b.kwh) }}</strong><small>kWh</small></span>
          </span>
          <span class="fila secundaria">
            <span>{{ b.days ? `${b.days} días · ${formatNumber(perDay(b) ?? 0)} kWh/día` : '' }}</span>
            <span class="num">{{ formatCop(b.costCop) }}</span>
          </span>
          <span class="fila secundaria">
            <span class="chips">
              <StatusChip v-if="pfOf(b) !== null" :tone="(pfOf(b) ?? 1) < 0.9 ? 'warning' : 'neutral'" :label="`FP ${formatNumber(pfOf(b) ?? 0, 2)}`" />
              <span v-if="photoCounts.get(b.id)" class="dato"><IconCamera :size="14" />{{ photoCounts.get(b.id) }}</span>
            </span>
            <span v-if="tariffOf(b) !== null">{{ formatNumber(tariffOf(b) ?? 0, 1) }} COP/kWh</span>
          </span>
        </button>
      </TransitionGroup>
    </template>

    <div v-else-if="ready" class="card">
      <EmptyState :icon="IconReceipt" title="Sin facturas todavía" text="Registra al menos 12 meses de facturas: con ellas se calcula el consumo mensual y anual, la tarifa y la línea base.">
        <Button label="Registrar la primera factura" @click="openNew()" />
      </EmptyState>
    </div>

    <FormSheet
      v-model:visible="visible"
      :title="isNew ? 'Nueva factura' : draft.period ? capitalize(periodLabelLong(draft.period)) : 'Factura'"
      eyebrow="Facturación"
      :saving="saving"
      :can-delete="!isNew"
      @submit="save"
      @delete="remove()"
    >
      <BillForm :key="draft.id" v-model:draft="draft" :errors="errors" :project-id="projectId" />
    </FormSheet>
  </div>
</template>

<style scoped>
.grafica {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
}
.grafica-cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}
.grafica h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.periodo,
.fuerte {
  font-weight: 600;
}
.lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.factura {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.periodo-corto {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
}
.kwh {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.kwh strong {
  font-size: 18px;
}
.kwh small {
  color: var(--muted);
  font-size: 12px;
}
.secundaria {
  color: var(--ink-2);
  font-size: 13px;
}
.chips {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dato {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 12px;
}
</style>
