<script setup lang="ts">
import { IconAlertTriangle, IconFlame, IconInfoCircle, IconPlus } from '@tabler/icons-vue';
import Button from 'primevue/button';
import { computed } from 'vue';
import MonthlyBars from '@/components/charts/MonthlyBars.vue';
import EmptyState from '@/components/EmptyState.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { usePhotoCounts } from '@/composables/useProjectRecords';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { carrierInfo, equivalentKwh, summarizeCarriers, unitLabel } from '@/domain/carriers';
import type { Bill } from '@/domain/types';
import { MONTHS_SHORT, nextPeriod, periodLabel, periodLabelLong, toPeriod } from '@/utils/dates';
import { formatCop, formatNumber } from '@/utils/format';
import OtherBillForm from './OtherBillForm.vue';

/** Facturas de gas natural, GLP y otros energéticos. Nunca se mezclan con la electricidad: se suman solo en kWh equivalentes. */
const props = defineProps<{ bills: readonly Bill[]; ready: boolean }>();
const { projectId } = useCurrentProject();
const photoCounts = usePhotoCounts('factura');

const summaries = computed(() => summarizeCarriers([...props.bills]));
const newestFirst = computed(() => [...props.bills].sort((a, b) => b.period.localeCompare(a.period) || a.id.localeCompare(b.id)));
const monthLabel = (period: string) => MONTHS_SHORT[Number(period.split('-')[1]) - 1] ?? period;
const chartBills = (carrier: string) => props.bills.filter((b) => b.carrier === carrier).sort((a, b) => a.period.localeCompare(b.period)).slice(-12);

const { visible, draft, isNew, errors, saving, openNew, openEdit, save, remove } = useRecordEditor('bills', {
  empty: () => {
    const last = [...props.bills].sort((a, b) => a.period.localeCompare(b.period)).pop();
    return {
      id: crypto.randomUUID(),
      projectId: projectId.value,
      carrier: last?.carrier ?? 'gas-natural',
      unit: last?.unit ?? carrierInfo(last?.carrier ?? 'gas-natural').unit,
      // El factor cambia poco de un mes al otro: se propone el último para no volver a escribirlo
      kwhPerUnit: last?.kwhPerUnit,
      period: last ? nextPeriod(last.period) : nextPeriod(toPeriod(), -1),
      kwh: 0,
      costCop: Number.NaN,
    };
  },
  validate: (d) => ({
    period: !d.period
      ? 'Elige el mes facturado.'
      : props.bills.some((b) => b.period === d.period && b.carrier === d.carrier && b.id !== d.id)
        ? `Ya hay una factura de ${carrierInfo(d.carrier).label.toLowerCase()} de ${periodLabelLong(d.period)}.`
        : undefined,
    quantity: d.quantity !== undefined && d.quantity > 0 ? undefined : 'Escribe la cantidad facturada.',
    kwhPerUnit: d.kwhPerUnit === undefined || d.kwhPerUnit > 0 ? undefined : 'El factor debe ser mayor que cero.',
    costCop: d.costCop >= 0 ? undefined : 'Escribe el valor total de la factura.',
    days: d.days === undefined || (d.days >= 1 && d.days <= 62) ? undefined : 'Los días facturados van de 1 a 62.',
  }),
  describe: (d) => `${carrierInfo(d.carrier).label}${d.period ? ` de ${periodLabelLong(d.period)}` : ''}`,
  photoEntity: 'factura',
});

defineExpose({ openNew: () => openNew() });
</script>

<template>
  <template v-if="bills.length">
    <p class="aviso-linea">
      <IconInfoCircle :size="16" />Estas facturas no cambian ninguna cifra eléctrica. Se suman a la electricidad solo en el balance de todos los energéticos, en kWh equivalentes.
    </p>

    <div class="resumenes">
      <section v-for="s in summaries.filter((x) => x.carrier !== 'electricidad')" :key="s.carrier" class="card energetico">
        <header>
          <span class="icono"><IconFlame :size="20" /></span>
          <div>
            <h2>{{ s.info.label }}</h2>
            <span class="eyebrow">{{ s.count }} {{ s.count === 1 ? 'factura' : 'facturas' }} · {{ periodLabel(s.firstPeriod) }} – {{ periodLabel(s.lastPeriod) }}</span>
          </div>
        </header>
        <dl class="cifras">
          <div>
            <dt>Cantidad</dt>
            <dd><strong class="num">{{ formatNumber(s.quantity) }}</strong> <small>{{ unitLabel(s.unit) }}</small></dd>
          </div>
          <div>
            <dt>Energía equivalente</dt>
            <dd><strong class="num">{{ formatNumber(s.kwh) }}</strong> <small>kWh</small></dd>
          </div>
          <div>
            <dt>Costo</dt>
            <dd><strong class="num">{{ formatCop(s.costCop) }}</strong></dd>
          </div>
          <div>
            <dt>Por kWh</dt>
            <dd><strong class="num">{{ s.copPerKwh === null ? '—' : formatNumber(s.copPerKwh, 1) }}</strong> <small>COP/kWh</small></dd>
          </div>
        </dl>
        <StatusChip v-if="s.missingFactor" tone="warning" :icon="IconAlertTriangle" :label="`${s.missingFactor} ${s.missingFactor === 1 ? 'factura sin factor' : 'facturas sin factor'} de conversión`" />
        <MonthlyBars
          v-if="chartBills(s.carrier).length > 1"
          :labels="chartBills(s.carrier).map((b) => monthLabel(b.period))"
          :values="chartBills(s.carrier).map((b) => equivalentKwh(b) ?? 0)"
          unit="kWh"
          :title="`Energía equivalente mensual de ${s.info.label.toLowerCase()}`"
        />
      </section>
    </div>

    <TransitionGroup name="list" tag="div" class="lista">
      <button v-for="b in newestFirst" :key="b.id" type="button" class="card factura" @click="openEdit(b)">
        <span class="fila">
          <span class="mono periodo">{{ periodLabel(b.period).toUpperCase() }}</span>
          <StatusChip tone="info" :label="carrierInfo(b.carrier).label" />
        </span>
        <span class="cantidad">
          <strong class="num">{{ b.quantity === undefined ? '—' : formatNumber(b.quantity, 1) }}</strong> <small>{{ unitLabel(b.unit) }}</small>
          <span class="equiv">
            <template v-if="equivalentKwh(b) !== null">= {{ formatNumber(equivalentKwh(b) ?? 0) }} kWh</template>
            <StatusChip v-else tone="warning" :icon="IconAlertTriangle" label="Sin factor" />
          </span>
        </span>
        <span class="detalle">{{ formatCop(b.costCop) }}<template v-if="photoCounts.get(b.id)"> · {{ photoCounts.get(b.id) }} {{ photoCounts.get(b.id) === 1 ? 'foto' : 'fotos' }}</template></span>
      </button>
    </TransitionGroup>
  </template>

  <div v-else-if="ready" class="card">
    <EmptyState
      :icon="IconFlame"
      title="Aún no hay facturas de gas natural u otros energéticos"
      text="Si el edificio usa gas natural, GLP u otro combustible, regístralo aquí con la cantidad y el factor de conversión de la factura. La electricidad se registra en su pestaña."
    >
      <Button label="Registrar la primera factura" @click="openNew()">
        <template #icon><IconPlus :size="18" stroke="2.2" /></template>
      </Button>
    </EmptyState>
  </div>

  <FormSheet
    v-model:visible="visible"
    :title="isNew ? 'Nueva factura' : `${carrierInfo(draft.carrier).label}${draft.period ? ` · ${periodLabelLong(draft.period)}` : ''}`"
    eyebrow="Otros energéticos"
    :saving="saving"
    :can-delete="!isNew"
    @submit="save"
    @delete="remove()"
  >
    <OtherBillForm :key="draft.id" v-model:draft="draft" :errors="errors" :project-id="projectId" />
  </FormSheet>
</template>

<style scoped>
.resumenes {
  display: grid;
  gap: 10px;
}
.energetico {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
}
.energetico header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.energetico h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.icono {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--warning-wash);
  color: var(--warning-text);
}
.cifras {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  margin: 0;
}
.cifras dt {
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.cifras dd {
  margin: 2px 0 0;
}
.cifras strong {
  font-size: 17px;
  font-weight: 600;
}
.cifras small {
  color: var(--muted);
  font-size: 11px;
}
.lista {
  display: grid;
  gap: 10px;
}
.factura {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 150ms var(--ease),
    box-shadow 150ms var(--ease);
}
.factura:hover {
  border-color: var(--field-border);
  box-shadow: 0 4px 16px rgba(16, 35, 75, 0.08);
}
.fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.periodo {
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 600;
}
.cantidad {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
}
.cantidad strong {
  font-size: 20px;
  font-weight: 600;
}
.cantidad small,
.equiv {
  color: var(--muted);
  font-size: 12px;
}
.detalle {
  color: var(--ink-2);
  font-size: 13px;
}
@media (min-width: 720px) {
  .lista {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1024px) {
  .resumenes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .lista {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
