<script setup lang="ts">
import { IconAdjustmentsHorizontal, IconAlertTriangle } from '@tabler/icons-vue';
import Select from 'primevue/select';
import { computed, reactive, watch } from 'vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import { capacitorMeasure, hvacMeasure, ledMeasure, measureEconomics, pvMeasure, type CalculatorResult } from '@/domain/measures';
import type { Equipment, Project } from '@/domain/types';
import { formatCop, formatNumber, round } from '@/utils/format';

export type CalculatorTool = 'fv' | 'condensadores' | 'aires' | 'led';

/** Datos del proyecto con los que arranca cada calculadora; el auditor los ajusta. */
export interface CalculatorContext {
  economics: Project['economics'];
  peakSunHours?: number;
  billedDailyKwh: number | null;
  roofM2: number | null;
  demandKw: number | null;
  powerFactor: number | null;
  reactiveChargeCop: number;
  hvac: readonly Equipment[];
  lighting: readonly Equipment[];
}

const visible = defineModel<boolean>('visible', { required: true });
const props = defineProps<{ tool: CalculatorTool; context: CalculatorContext }>();
const emit = defineEmits<{ create: [result: CalculatorResult] }>();

const TITLES: Record<CalculatorTool, string> = {
  fv: 'Sistema solar fotovoltaico',
  condensadores: 'Banco de condensadores',
  aires: 'Reemplazo de aires acondicionados',
  led: 'Cambio a iluminación LED',
};

const pv = reactive({ dailyEnergyKwh: 0, peakSunHours: 5, performanceRatio: 0.8, moduleWp: 550, moduleAreaM2: 2.6, costPerKwp: 4_000_000, availableRoofM2: undefined as number | undefined });
const cap = reactive({ demandKw: 0, currentPf: 0.85, targetPf: 0.95, costPerKvar: 150_000, annualReactiveChargeCop: 0 });
const ac = reactive({ equipmentId: undefined as string | undefined, units: 1, capacityBtuH: 18_000, currentEer: 10, newEer: 16, fullLoadHoursPerYear: 1500, costPerUnit: 3_600_000 });
const led = reactive({ equipmentId: undefined as string | undefined, currentCount: 1, currentW: 70, proposedCount: 1, proposedW: 40, hoursPerYear: 2000, costPerLuminaire: 180_000 });

/** Horas al año de un equipo del inventario: horas por día × días por mes × 12 (con su factor de uso). */
const hoursPerYear = (e: Equipment, withUseFactor: boolean) => e.hoursPerDay * (withUseFactor ? e.useFactor : 1) * e.operatingDaysPerMonth * 12;

function pickHvac(id?: string) {
  const e = props.context.hvac.find((x) => x.id === id);
  if (!e) return;
  ac.units = e.quantity;
  ac.capacityBtuH = e.capacityBtuH ?? ac.capacityBtuH;
  ac.currentEer = e.eer ?? (e.capacityBtuH ? round(e.capacityBtuH / (e.powerKw * 1000), 1) : ac.currentEer);
  ac.fullLoadHoursPerYear = round(hoursPerYear(e, true));
  // Costo orientativo de un equipo inverter instalado: unos 200 COP por BTU/h
  ac.costPerUnit = round((e.capacityBtuH ?? ac.capacityBtuH) * 200, -3);
}
function pickLighting(id?: string) {
  const e = props.context.lighting.find((x) => x.id === id);
  if (!e) return;
  led.currentCount = e.quantity;
  led.currentW = round(e.powerKw * 1000);
  led.proposedCount = e.quantity;
  // LED del mismo flujo luminoso con 110 lm/W; sin lúmenes registrados, 55 % de la potencia actual
  led.proposedW = e.lumens ? Math.max(5, Math.round(e.lumens / 110)) : Math.max(5, Math.round(e.powerKw * 1000 * 0.55));
  led.hoursPerYear = round(hoursPerYear(e, false));
}

// Cada vez que se abre, arranca con los datos actuales del proyecto
watch(visible, (open) => {
  if (!open) return;
  const c = props.context;
  pv.dailyEnergyKwh = c.billedDailyKwh ? round(c.billedDailyKwh * 0.3) : 100;
  pv.peakSunHours = c.peakSunHours ?? 5;
  pv.availableRoofM2 = c.roofM2 ?? undefined;
  cap.demandKw = c.demandKw ? round(c.demandKw, 1) : 100;
  cap.currentPf = c.powerFactor ? round(c.powerFactor, 2) : 0.85;
  cap.annualReactiveChargeCop = round(c.reactiveChargeCop);
  ac.equipmentId = c.hvac[0]?.id;
  pickHvac(ac.equipmentId);
  led.equipmentId = c.lighting[0]?.id;
  pickLighting(led.equipmentId);
});
watch(() => ac.equipmentId, pickHvac);
watch(() => led.equipmentId, pickLighting);

const positive = (...values: (number | undefined)[]) => values.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
const tariff = computed(() => props.context.economics.tariffCopPerKwh);
const result = computed<(CalculatorResult & { warning?: string }) | null>(() => {
  switch (props.tool) {
    case 'fv': {
      if (!positive(pv.dailyEnergyKwh, pv.peakSunHours, pv.performanceRatio, pv.moduleWp, pv.moduleAreaM2)) return null;
      const r = pvMeasure({ ...pv, tariff: tariff.value });
      return { ...r, warning: r.fitsRoof === false ? `El arreglo necesita ${formatNumber(r.sizing.arrayAreaM2, 1)} m² y hay ${formatNumber(pv.availableRoofM2 ?? 0, 1)} m² de techo disponible.` : undefined };
    }
    case 'condensadores': {
      if (!positive(cap.demandKw, cap.currentPf, cap.targetPf)) return null;
      const r = capacitorMeasure(cap);
      return { ...r, warning: r.bankKvar === 0 ? 'El factor de potencia ya es igual o mayor que el objetivo: no hace falta banco.' : undefined };
    }
    case 'aires':
      return positive(ac.units, ac.capacityBtuH, ac.currentEer, ac.newEer, ac.fullLoadHoursPerYear) ? hvacMeasure({ ...ac, tariff: tariff.value }) : null;
    default:
      return positive(led.currentCount, led.currentW, led.proposedCount, led.proposedW, led.hoursPerYear) ? ledMeasure({ ...led, tariff: tariff.value }) : null;
  }
});
const items = computed(() => {
  const r = result.value;
  if (!r) return [];
  const e = measureEconomics(r, props.context.economics);
  return [
    ...r.specs.slice(0, 2).map((s) => ({ label: s.label, value: s.value })),
    { label: 'Ahorro', value: formatNumber(r.savingsKwhYear), unit: 'kWh/año' },
    { label: 'Ahorro en pesos', value: formatCop(r.savingsCopYear), unit: 'COP/año' },
    { label: 'Inversión', value: formatCop(r.investmentCop), unit: 'COP' },
    { label: 'Retorno', value: Number.isFinite(e.paybackYears) ? formatNumber(e.paybackYears, 1) : '—', unit: 'años', strong: true },
  ];
});

function create() {
  if (!result.value) return;
  emit('create', result.value);
  visible.value = false;
}
const equipmentLabel = (e: Equipment) => `${e.name} · ${e.quantity} ${e.quantity === 1 ? 'unidad' : 'unidades'}`;
</script>

<template>
  <FormSheet v-model:visible="visible" :title="TITLES[tool]" eyebrow="Calculadora de medidas" submit-label="Crear medida" @submit="create">
    <section class="form-seccion">
      <h3 class="form-seccion-titulo"><IconAdjustmentsHorizontal :size="16" />Datos</h3>

      <div v-if="tool === 'fv'" class="form-grid">
        <label class="campo completo">
          <span class="etiqueta">Energía a cubrir</span>
          <NumberInput v-model="pv.dailyEnergyKwh" :decimals="0" suffix="kWh/día" />
          <small class="ayuda">Arranca con el 30 % del consumo diario facturado.</small>
        </label>
        <label class="campo">
          <span class="etiqueta">Horas solares pico</span>
          <NumberInput v-model="pv.peakSunHours" :decimals="1" :max="12" suffix="HSP" />
        </label>
        <label class="campo">
          <span class="etiqueta">Rendimiento (PR)</span>
          <NumberInput v-model="pv.performanceRatio" :decimals="2" :max="1" />
        </label>
        <label class="campo">
          <span class="etiqueta">Módulo</span>
          <NumberInput v-model="pv.moduleWp" :decimals="0" suffix="Wp" />
        </label>
        <label class="campo">
          <span class="etiqueta">Área por módulo</span>
          <NumberInput v-model="pv.moduleAreaM2" :decimals="2" suffix="m²" />
        </label>
        <label class="campo">
          <span class="etiqueta">Costo instalado</span>
          <NumberInput v-model="pv.costPerKwp" :decimals="0" suffix="COP/kWp" />
        </label>
        <label class="campo">
          <span class="etiqueta">Techo disponible</span>
          <NumberInput v-model="pv.availableRoofM2" :decimals="0" suffix="m²" />
        </label>
      </div>

      <div v-else-if="tool === 'condensadores'" class="form-grid">
        <label class="campo">
          <span class="etiqueta">Demanda máxima</span>
          <NumberInput v-model="cap.demandKw" :decimals="1" suffix="kW" />
        </label>
        <label class="campo">
          <span class="etiqueta">Costo instalado</span>
          <NumberInput v-model="cap.costPerKvar" :decimals="0" suffix="COP/kvar" />
        </label>
        <label class="campo">
          <span class="etiqueta">FP actual</span>
          <NumberInput v-model="cap.currentPf" :decimals="2" :max="1" />
        </label>
        <label class="campo">
          <span class="etiqueta">FP objetivo</span>
          <NumberInput v-model="cap.targetPf" :decimals="2" :max="1" />
        </label>
        <label class="campo completo">
          <span class="etiqueta">Cobro anual por reactiva que se elimina</span>
          <NumberInput v-model="cap.annualReactiveChargeCop" :decimals="0" suffix="COP/año" />
          <small class="ayuda">Suma de los cobros por reactiva de las facturas de los últimos 12 meses.</small>
        </label>
      </div>

      <div v-else-if="tool === 'aires'" class="form-grid">
        <label v-if="context.hvac.length" class="campo completo">
          <span class="etiqueta">Equipos del inventario</span>
          <Select v-model="ac.equipmentId" :options="[...context.hvac]" :option-label="equipmentLabel" option-value="id" />
        </label>
        <label class="campo">
          <span class="etiqueta">Unidades</span>
          <NumberInput v-model="ac.units" :decimals="0" :min="1" />
        </label>
        <label class="campo">
          <span class="etiqueta">Capacidad</span>
          <NumberInput v-model="ac.capacityBtuH" :decimals="0" suffix="BTU/h" />
        </label>
        <label class="campo">
          <span class="etiqueta">EER actual</span>
          <NumberInput v-model="ac.currentEer" :decimals="1" />
        </label>
        <label class="campo">
          <span class="etiqueta">EER nuevo</span>
          <NumberInput v-model="ac.newEer" :decimals="1" />
        </label>
        <label class="campo">
          <span class="etiqueta">Horas a plena carga</span>
          <NumberInput v-model="ac.fullLoadHoursPerYear" :decimals="0" suffix="h/año" />
        </label>
        <label class="campo">
          <span class="etiqueta">Costo por unidad</span>
          <NumberInput v-model="ac.costPerUnit" :decimals="0" suffix="COP" />
        </label>
      </div>

      <div v-else class="form-grid">
        <label v-if="context.lighting.length" class="campo completo">
          <span class="etiqueta">Luminarias del inventario</span>
          <Select v-model="led.equipmentId" :options="[...context.lighting]" :option-label="equipmentLabel" option-value="id" />
        </label>
        <label class="campo">
          <span class="etiqueta">Luminarias actuales</span>
          <NumberInput v-model="led.currentCount" :decimals="0" :min="1" />
        </label>
        <label class="campo">
          <span class="etiqueta">Potencia actual</span>
          <NumberInput v-model="led.currentW" :decimals="0" suffix="W" />
        </label>
        <label class="campo">
          <span class="etiqueta">Luminarias LED</span>
          <NumberInput v-model="led.proposedCount" :decimals="0" :min="1" />
        </label>
        <label class="campo">
          <span class="etiqueta">Potencia LED</span>
          <NumberInput v-model="led.proposedW" :decimals="0" suffix="W" />
        </label>
        <label class="campo">
          <span class="etiqueta">Uso</span>
          <NumberInput v-model="led.hoursPerYear" :decimals="0" suffix="h/año" />
        </label>
        <label class="campo">
          <span class="etiqueta">Costo por luminaria</span>
          <NumberInput v-model="led.costPerLuminaire" :decimals="0" suffix="COP" />
        </label>
      </div>
    </section>

    <section class="form-seccion">
      <p v-if="result?.warning" class="aviso-linea alerta"><IconAlertTriangle :size="16" />{{ result.warning }}</p>
      <CalcPanel v-if="result" :title="result.title" :items="items" note="Costos orientativos: ajústalos con las cotizaciones antes de presentar la medida." />
      <p v-else class="aviso-linea">Completa los datos para ver el dimensionamiento.</p>
    </section>
  </FormSheet>
</template>
