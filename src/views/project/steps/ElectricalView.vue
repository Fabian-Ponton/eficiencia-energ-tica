<script setup lang="ts">
import { IconCamera, IconPlug, IconPlus } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import { useConfirm } from 'primevue/useconfirm';
import { computed } from 'vue';
import EmptyState from '@/components/EmptyState.vue';
import ElectricalIcon from '@/components/icons/ElectricalIcon.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useFabAction } from '@/composables/useFab';
import { usePhotoCounts, useProjectRecords } from '@/composables/useProjectRecords';
import { useQuickAdd } from '@/composables/useQuickAdd';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { electricalKindOf } from '@/domain/catalogs';
import { canHaveChildren, descendantIds, electricalRows, KIND_ORDER, suggestedChildKind } from '@/domain/electrical';
import type { ElectricalKind, ElectricalNode } from '@/domain/types';
import { formatNumber } from '@/utils/format';
import { incrementCode } from '@/utils/text';
import ElectricalForm from './ElectricalForm.vue';

const { projectId } = useCurrentProject();
const confirm = useConfirm();
const desktop = useMediaQuery('(min-width: 1024px)');
const { rows: nodes, ready } = useProjectRecords('electrical');
const { rows: equipment } = useProjectRecords('equipment');
const photoCounts = usePhotoCounts('electrico');

const rows = computed(() => electricalRows(nodes.value));
const kindCounts = computed(() => {
  const counts = new Map<ElectricalKind, number>();
  for (const n of nodes.value) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1);
  return counts;
});
const equipmentByPanel = computed(() => {
  const counts = new Map<string, number>();
  for (const e of equipment.value) if (e.panelId) counts.set(e.panelId, (counts.get(e.panelId) ?? 0) + e.quantity);
  return counts;
});
const totalKva = computed(() => nodes.value.filter((n) => n.kind === 'transformador').reduce((t, n) => t + (n.ratedKva ?? 0), 0));
const stats = computed(() => [
  { label: 'Transformación', value: totalKva.value ? formatNumber(totalKva.value, 1) : '—', unit: totalKva.value ? 'kVA' : 'sin dato' },
  { label: 'Tableros', value: formatNumber(kindCounts.value.get('tablero') ?? 0) },
  { label: 'Circuitos', value: formatNumber(kindCounts.value.get('circuito') ?? 0) },
  { label: 'Elementos', value: formatNumber(nodes.value.length) },
]);

/** Resumen técnico de una línea: «150 kVA · 13,2 kV / 208/120 V», «Prot. 400 A · 3F · 208 V»… */
function summary(n: ElectricalNode): string {
  const parts: string[] = [];
  if (n.kind === 'transformador') {
    if (n.ratedKva) parts.push(`${formatNumber(n.ratedKva, 1)} kVA`);
    const voltages = [n.primaryKv ? `${formatNumber(n.primaryKv, 1)} kV` : '', n.secondaryV ?? ''].filter(Boolean).join(' / ');
    if (voltages) parts.push(voltages);
  }
  if (n.kind === 'red' && n.primaryKv) parts.push(`${formatNumber(n.primaryKv, 1)} kV`);
  if (n.kind === 'medidor' && n.meterNumber) parts.push(`N.º ${n.meterNumber}`);
  if (n.kind === 'acometida' && n.conductor) parts.push(n.conductor);
  if (n.ampacityA) parts.push(`${formatNumber(n.ampacityA)} A`);
  if (n.breakerA) parts.push(`Prot. ${formatNumber(n.breakerA)} A`);
  if (n.phases) parts.push(`${n.phases}F`);
  if (n.voltageV) parts.push(`${formatNumber(n.voltageV)} V`);
  if (n.location) parts.push(n.location);
  return parts.join(' · ') || electricalKindOf(n.kind).label;
}

/** Posición horizontal de las líneas del árbol: 24 px por nivel, alineadas con el centro de cada ícono. */
const x = (column: number) => `${12 + 24 * column + 16}px`;

const { visible, draft, isNew, errors, saving, openNew, openEdit, save, saveAndDuplicate, remove } = useRecordEditor('electrical', {
  empty: () => ({ id: crypto.randomUUID(), projectId: projectId.value, kind: suggestedChildKind(), name: '' }),
  validate: (d) => ({ name: d.name.trim() ? undefined : 'Escribe un nombre, p. ej. «TGD · Tablero general».' }),
  describe: (d) => d.name || electricalKindOf(d.kind).label,
  photoEntity: 'electrico',
  duplicate: (d) => ({ ...d, name: incrementCode(d.name) ?? d.name }),
});

const voltageOf = (node?: ElectricalNode) => node?.voltageV ?? (node?.secondaryV ? Number.parseFloat(node.secondaryV) || undefined : undefined);

function addUnder(parent?: ElectricalNode) {
  openNew({ parentId: parent?.id, kind: suggestedChildKind(parent?.kind), phases: parent?.phases, voltageV: voltageOf(parent) });
}

// Si el elemento alimenta a otros, se eliminan juntos (y se pueden recuperar juntos)
function removeNode() {
  const id = draft.value.id;
  const below = [...descendantIds(nodes.value, id)];
  if (!below.length) return void remove();
  confirm.require({
    header: 'Eliminar con lo que depende de él',
    message: `«${draft.value.name}» alimenta ${below.length} ${below.length === 1 ? 'elemento' : 'elementos'}. Se eliminarán todos; podrás deshacerlo enseguida.`,
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Eliminar todo', severity: 'danger' },
    accept: () => void remove([id, ...below]),
  });
}

useFabAction({ label: 'Agregar elemento', icon: IconPlus, run: () => addUnder() });
useQuickAdd(() => addUnder());
</script>

<template>
  <div class="vista">
    <PageHeader step="electrico" :stats="nodes.length ? stats : undefined">
      <template v-if="desktop" #actions>
        <Button label="Agregar elemento" @click="addUnder()">
          <template #icon><IconPlus :size="18" stroke="2.2" /></template>
        </Button>
      </template>
    </PageHeader>

    <section class="card recorrido" aria-label="Recorrido de la energía">
      <template v-for="(kind, i) in KIND_ORDER" :key="kind">
        <svg v-if="i" class="conector" :class="{ activo: kindCounts.get(kind) && kindCounts.get(KIND_ORDER[i - 1]) }" viewBox="0 0 28 8" aria-hidden="true">
          <line x1="0" y1="4" x2="28" y2="4" />
        </svg>
        <span class="etapa" :class="{ presente: kindCounts.get(kind) }">
          <span class="etapa-icono"><ElectricalIcon :kind="kind" :size="20" /></span>
          <span class="etapa-nombre">{{ electricalKindOf(kind).label }}</span>
          <span class="mono etapa-conteo">{{ kindCounts.get(kind) ?? 0 }}</span>
        </span>
      </template>
    </section>

    <ul v-if="rows.length" class="card arbol">
      <li v-for="row in rows" :key="row.node.id" class="fila">
        <template v-for="(on, column) in row.guides" :key="column">
          <span v-if="on" class="linea vertical" :style="{ left: x(column) }" aria-hidden="true" />
        </template>
        <template v-if="row.depth > 0">
          <span class="linea codo" :class="{ ultimo: row.isLast }" :style="{ left: x(row.depth - 1) }" aria-hidden="true" />
          <span class="linea brazo" :style="{ left: x(row.depth - 1) }" aria-hidden="true" />
        </template>
        <span v-if="row.childCount" class="linea bajada" :style="{ left: x(row.depth) }" aria-hidden="true" />

        <button type="button" class="nodo" :style="{ marginLeft: `${24 * row.depth}px` }" @click="openEdit(row.node)">
          <span class="icono" :class="row.node.kind"><ElectricalIcon :kind="row.node.kind" :size="18" /></span>
          <span class="textos">
            <span class="nombre">{{ row.node.name }}</span>
            <span class="mono detalle">{{ summary(row.node) }}</span>
          </span>
          <span class="datos">
            <span v-if="equipmentByPanel.get(row.node.id)" class="dato"><IconPlug :size="14" />{{ formatNumber(equipmentByPanel.get(row.node.id) ?? 0) }}</span>
            <span v-if="photoCounts.get(row.node.id)" class="dato"><IconCamera :size="14" />{{ photoCounts.get(row.node.id) }}</span>
          </span>
        </button>
        <button
          v-if="canHaveChildren(row.node.kind)"
          type="button"
          class="boton-icono agregar"
          :aria-label="`Agregar un elemento alimentado por ${row.node.name}`"
          title="Agregar debajo"
          @click="addUnder(row.node)"
        >
          <IconPlus :size="18" />
        </button>
      </li>
    </ul>

    <div v-else-if="ready" class="card">
      <EmptyState
        :icon="IconPlug"
        title="Aún no hay sistema eléctrico"
        text="Empieza por el transformador o por el tablero general y agrega debajo lo que cada uno alimenta: tableros, circuitos y acometidas."
      >
        <Button label="Agregar el transformador" @click="addUnder()" />
      </EmptyState>
    </div>

    <FormSheet
      v-model:visible="visible"
      :title="isNew ? `Nuevo: ${electricalKindOf(draft.kind).label.toLowerCase()}` : draft.name || electricalKindOf(draft.kind).label"
      eyebrow="Sistema eléctrico"
      :saving="saving"
      :can-delete="!isNew"
      can-duplicate
      @submit="save"
      @delete="removeNode"
      @duplicate="saveAndDuplicate"
    >
      <ElectricalForm :key="draft.id" v-model:draft="draft" :errors="errors" :project-id="projectId" :nodes="nodes" />
    </FormSheet>
  </div>
</template>

<style scoped>
.recorrido {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  padding: 12px 14px;
  scrollbar-width: thin;
}
.etapa {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 72px;
  color: var(--muted);
  opacity: 0.65;
}
.etapa.presente {
  color: var(--ink);
  opacity: 1;
}
.etapa-icono {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1.5px dashed var(--field-border);
  border-radius: 10px;
}
.presente .etapa-icono {
  border: 1.5px solid var(--navy);
  background: var(--info-wash);
  color: var(--navy);
}
.app-dark .presente .etapa-icono {
  border-color: var(--accent);
  color: var(--ink);
}
.etapa-nombre {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.etapa-conteo {
  font-size: 11px;
}
.conector {
  flex-shrink: 0;
  width: 28px;
  height: 8px;
  margin-bottom: 34px;
}
.conector line {
  stroke: var(--field-border);
  stroke-width: 2;
  stroke-dasharray: 3 3;
}
/* La energía «fluye» entre los elementos registrados */
.conector.activo line {
  stroke: var(--accent);
  animation: flujo 900ms linear infinite;
}
@keyframes flujo {
  to {
    stroke-dashoffset: -12;
  }
}

.arbol {
  margin: 0;
  padding: 6px 0;
  list-style: none;
}
.fila {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 58px;
  padding: 4px 8px 4px 12px;
}
.fila + .fila {
  border-top: 1px solid color-mix(in srgb, var(--divider) 60%, transparent);
}
.linea {
  position: absolute;
  width: 0;
  border-left: 1.5px solid var(--field-border);
  pointer-events: none;
}
.vertical {
  top: 0;
  bottom: 0;
}
.codo {
  top: 0;
  bottom: 0;
}
.codo.ultimo {
  bottom: 50%;
}
.brazo {
  top: 50%;
  width: 8px;
  border-top: 1.5px solid var(--field-border);
  border-left: 0;
}
.bajada {
  top: calc(50% + 16px);
  bottom: 0;
}
.nodo {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 6px 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.icono {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--info-wash);
  color: var(--navy);
}
.app-dark .icono {
  color: var(--ink);
}
.icono.transformador {
  background: var(--warning-wash);
  color: var(--warning-text);
}
.icono.tablero {
  background: var(--accent-wash);
  color: var(--accent-ink);
}
.icono.circuito,
.icono.acometida {
  background: var(--surface-2);
  color: var(--ink-2);
}
.textos {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.nombre {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}
.detalle {
  overflow: hidden;
  color: var(--muted);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.datos {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
}
.dato {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 12px;
}
.agregar {
  color: var(--accent-strong);
}
@media (max-width: 480px) {
  .datos {
    display: none;
  }
}
</style>
