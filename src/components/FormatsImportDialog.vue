<script setup lang="ts">
import { IconAlertTriangle, IconCircleCheck, IconFileSpreadsheet, IconInfoCircle } from '@tabler/icons-vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import { computed, ref, watch } from 'vue';
import type { ImportPlan } from '@/db/formatsImport';
import type { SheetPlan } from '@/db/formatsPlanner';
import type { FormatId } from '@/reports/formats';
import { formatNumber } from '@/utils/format';

/**
 * Vista previa de la carga de los formatos de Excel: qué hoja aporta cuántos registros nuevos y cuántos cambios, y los avisos
 * de cada fila. Nada se guarda hasta pulsar «Cargar».
 */
const visible = defineModel<boolean>('visible', { required: true });
const props = defineProps<{ plan: ImportPlan | null; fileName: string; busy: boolean }>();
const emit = defineEmits<{ apply: [sheets: FormatId[]]; 'change-term': [term: string] }>();

const chosen = ref<Set<FormatId>>(new Set());
const open = ref<FormatId | null>(null);
const term = ref('');

const workSheets = computed(() => (props.plan?.sheets ?? []).filter((s) => s.found));
const hasChanges = (s: SheetPlan) => s.creates + s.updates > 0;

watch(
  () => props.plan,
  (plan) => {
    chosen.value = new Set((plan?.sheets ?? []).filter(hasChanges).map((s) => s.id));
    term.value = plan?.term ?? '';
    open.value = null;
  },
  { immediate: true },
);

const toggle = (id: FormatId, on: boolean) => {
  const next = new Set(chosen.value);
  if (on) next.add(id);
  else next.delete(id);
  chosen.value = next;
};

const selected = computed(() => workSheets.value.filter((s) => chosen.value.has(s.id)));
const willCreate = computed(() => selected.value.reduce((t, s) => t + s.creates, 0));
const willUpdate = computed(() => selected.value.reduce((t, s) => t + s.updates, 0));
const hasOccupancy = computed(() => workSheets.value.some((s) => s.id === 'ocupacion' && s.rows > 0));
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Cargar los formatos de Excel" :draggable="false" :style="{ width: 'min(760px, calc(100vw - 24px))' }">
    <div v-if="plan" class="cuerpo">
      <p class="archivo"><IconFileSpreadsheet :size="18" />{{ fileName }}</p>

      <p v-if="!workSheets.length" class="aviso-linea alerta"><IconAlertTriangle :size="16" />No se encontró ninguna hoja de los formatos (02_Areas, 03_Equipos…). Revisa que sea el libro correcto.</p>

      <template v-else>
        <p class="aviso-linea">
          <IconInfoCircle :size="16" />Revisa lo que se cargaría. Una celda vacía o «N/D» nunca borra lo que ya tienes, y una fila con error no detiene a las demás.
        </p>

        <label v-if="hasOccupancy" class="periodo">
          <span>Periodo académico de los horarios</span>
          <InputText v-model="term" placeholder="2026-1" class="mono" @change="emit('change-term', term.trim())" />
        </label>

        <ul class="hojas">
          <li v-for="s in workSheets" :key="s.id" :class="{ apagada: !chosen.has(s.id) }">
            <div class="fila">
              <Checkbox :model-value="chosen.has(s.id)" binary :disabled="!hasChanges(s)" :input-id="`hoja-${s.id}`" @update:model-value="(on: boolean) => toggle(s.id, on)" />
              <label :for="`hoja-${s.id}`" class="nombre mono">{{ s.name }}</label>
              <span class="cifras">
                <span v-if="s.creates" class="nuevo">{{ formatNumber(s.creates) }} nuevos</span>
                <span v-if="s.updates" class="cambio">{{ formatNumber(s.updates) }} con cambios</span>
                <span v-if="s.unchanged" class="igual">{{ formatNumber(s.unchanged) }} iguales</span>
                <span v-if="!s.rows && !s.creates && !s.updates" class="igual">sin filas</span>
              </span>
              <button v-if="s.warnings.length || s.errors.length || s.nd" type="button" class="avisos" :class="{ error: s.errors.length }" @click="open = open === s.id ? null : s.id">
                <IconAlertTriangle :size="14" />
                {{ s.errors.length ? `${s.errors.length} sin cargar` : '' }}{{ s.errors.length && s.warnings.length ? ' · ' : '' }}{{ s.warnings.length ? `${s.warnings.length} avisos` : '' }}
                <template v-if="!s.errors.length && !s.warnings.length">{{ s.nd }} N/D</template>
              </button>
              <IconCircleCheck v-else-if="hasChanges(s) || s.unchanged" :size="16" class="bien" />
            </div>
            <ul v-if="open === s.id" class="detalle">
              <li v-for="(e, i) in s.errors" :key="`e${i}`" class="error"><strong>Fila {{ e.row }}:</strong> {{ e.text }} <em>(no se carga)</em></li>
              <li v-for="(w, i) in s.warnings.slice(0, 60)" :key="`w${i}`"><strong>Fila {{ w.row }}:</strong> {{ w.text }}</li>
              <li v-if="s.warnings.length > 60" class="mas">…y {{ s.warnings.length - 60 }} avisos más.</li>
              <li v-if="s.nd" class="mas">{{ formatNumber(s.nd) }} celdas dicen «N/D»: quedan vacías.</li>
            </ul>
          </li>
        </ul>

        <p class="resumen">
          Se cargarían <strong>{{ formatNumber(willCreate) }}</strong> registros nuevos y se actualizarían <strong>{{ formatNumber(willUpdate) }}</strong>.
        </p>
      </template>
    </div>
    <template #footer>
      <Button label="Cancelar" severity="secondary" text @click="visible = false" />
      <Button label="Cargar" :loading="busy" :disabled="!willCreate && !willUpdate" @click="emit('apply', [...chosen])" />
    </template>
  </Dialog>
</template>

<style scoped>
.cuerpo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.archivo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;
}
.periodo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 240px;
}
.periodo span {
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 600;
}
.hojas {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.hojas > li + li {
  border-top: 1px solid var(--divider);
}
.hojas > li.apagada .nombre,
.hojas > li.apagada .cifras {
  opacity: 0.55;
}
.fila {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 10px 12px;
}
.nombre {
  min-width: 140px;
  font-size: 12.5px;
  font-weight: 600;
}
.cifras {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 12px;
}
.cifras .nuevo {
  color: var(--accent-strong);
  font-weight: 600;
}
.cifras .cambio {
  color: var(--navy);
  font-weight: 600;
}
.app-dark .cifras .cambio {
  color: var(--ink);
}
.cifras .igual {
  color: var(--muted);
}
.avisos {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 0;
  border-radius: 6px;
  background: var(--warning-wash);
  color: var(--warning-text);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.avisos.error {
  background: var(--critical-wash);
  color: var(--critical-text);
}
.bien {
  color: var(--accent-strong);
}
.detalle {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 4px 12px 12px 42px;
  list-style: none;
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.4;
}
.detalle .error {
  color: var(--critical-text);
}
.detalle .mas {
  color: var(--muted);
}
.resumen {
  margin: 0;
  font-size: 14px;
}
</style>
