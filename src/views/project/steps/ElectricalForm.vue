<script setup lang="ts">
import { IconBolt, IconNotes, IconTag } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import { computed } from 'vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { COMMON_KVA, COMMON_SECONDARY_V, ELECTRICAL_KINDS, electricalKindOf } from '@/domain/catalogs';
import { canHaveChildren, descendantIds } from '@/domain/electrical';
import type { ElectricalNode } from '@/domain/types';
import { ELECTRICAL_ICONS } from '@/ui/icons';
import { formatNumber } from '@/utils/format';

const draft = defineModel<Draft<ElectricalNode>>('draft', { required: true });
const props = defineProps<{ errors: FieldErrors; projectId: string; nodes: ElectricalNode[] }>();

const KINDS = ELECTRICAL_KINDS.map((k) => ({ value: k.id, label: k.label, icon: ELECTRICAL_ICONS[k.id] }));
const PHASES = [
  { value: 1, label: 'Monofásico' },
  { value: 2, label: 'Bifásico' },
  { value: 3, label: 'Trifásico' },
] as const;
const OWNERS = ['Cliente', 'Operador de red'];
const thisYear = new Date().getFullYear();

const kind = computed(() => draft.value.kind);
const hint = computed(() => electricalKindOf(kind.value).hint);

// Un elemento no puede colgar de sí mismo ni de algo que él mismo alimenta
const parents = computed(() => {
  const below = descendantIds(props.nodes, draft.value.id);
  return props.nodes
    .filter((n) => n.id !== draft.value.id && !below.has(n.id) && canHaveChildren(n.kind))
    .map((n) => ({ id: n.id, label: `${n.name} · ${electricalKindOf(n.kind).label}` }));
});
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconBolt :size="16" />Tipo de elemento</h3>
    <ChoiceChips v-model="draft.kind" :options="KINDS" label="Tipo de elemento" />
    <small class="ayuda">{{ hint }}</small>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconTag :size="16" />Identificación</h3>
    <div class="form-grid">
      <label class="campo completo">
        <span class="etiqueta">Nombre</span>
        <InputText v-model="draft.name" :placeholder="kind === 'tablero' ? 'Ej.: TGD · Tablero general' : 'Ej.: Transformador T1'" :invalid="Boolean(errors.name)" />
        <small v-if="errors.name" class="error">{{ errors.name }}</small>
      </label>
      <label class="campo completo">
        <span class="etiqueta">Alimentado desde</span>
        <Select
          v-model="draft.parentId"
          :options="parents"
          option-label="label"
          option-value="id"
          placeholder="Origen de la instalación"
          show-clear
          :filter="parents.length > 8"
        />
        <small class="ayuda">Arma el recorrido de la energía; con él se dibuja el diagrama unifilar.</small>
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><component :is="ELECTRICAL_ICONS[kind]" :size="16" />Datos técnicos</h3>

    <div v-if="kind === 'red'" class="form-grid">
      <label class="campo">
        <span class="etiqueta">Tensión de la red</span>
        <NumberInput v-model="draft.primaryKv" :decimals="1" suffix="kV" />
      </label>
    </div>

    <template v-else-if="kind === 'transformador'">
      <div class="form-grid">
        <label class="campo">
          <span class="etiqueta">Capacidad</span>
          <NumberInput v-model="draft.ratedKva" :decimals="1" suffix="kVA" />
        </label>
        <label class="campo">
          <span class="etiqueta">Tensión primaria</span>
          <NumberInput v-model="draft.primaryKv" :decimals="1" suffix="kV" />
        </label>
      </div>
      <div class="valores-rapidos">
        <button v-for="kva in COMMON_KVA" :key="kva" type="button" class="valor-rapido" :class="{ activo: draft.ratedKva === kva }" @click="draft.ratedKva = kva">
          {{ formatNumber(kva, 1) }}
        </button>
      </div>
      <div class="form-grid">
        <label class="campo">
          <span class="etiqueta">Tensión secundaria</span>
          <Select v-model="draft.secondaryV" :options="COMMON_SECONDARY_V" editable placeholder="208/120 V" />
        </label>
        <label class="campo">
          <span class="etiqueta">Propiedad</span>
          <Select v-model="draft.ownership" :options="OWNERS" editable placeholder="Elegir" />
        </label>
        <label class="campo">
          <span class="etiqueta">Año</span>
          <NumberInput v-model="draft.year" :decimals="0" :min="1950" :max="thisYear" :grouping="false" />
        </label>
      </div>
      <ChoiceChips v-model="draft.phases" :options="PHASES" label="Fases" fill clearable />
    </template>

    <template v-else>
      <div class="form-grid">
        <label v-if="kind === 'medidor'" class="campo completo">
          <span class="etiqueta">Número del medidor</span>
          <InputText v-model="draft.meterNumber" class="mono" />
        </label>
        <label v-if="kind === 'acometida' || kind === 'circuito'" class="campo completo">
          <span class="etiqueta">Conductores</span>
          <InputText v-model="draft.conductor" class="mono" :placeholder="kind === 'acometida' ? 'Ej.: 3×4/0 + 1×2/0 AWG THHN' : 'Ej.: 2×12 AWG'" />
        </label>
        <label v-if="kind === 'acometida'" class="campo">
          <span class="etiqueta">Capacidad del conductor</span>
          <NumberInput v-model="draft.ampacityA" :decimals="0" suffix="A" />
        </label>
        <label v-if="kind === 'acometida'" class="campo">
          <span class="etiqueta">Longitud</span>
          <NumberInput v-model="draft.lengthM" :decimals="1" suffix="m" />
        </label>
        <label v-if="kind === 'tablero' || kind === 'circuito'" class="campo">
          <span class="etiqueta">{{ kind === 'tablero' ? 'Protección principal' : 'Protección' }}</span>
          <NumberInput v-model="draft.breakerA" :decimals="0" suffix="A" />
        </label>
        <label class="campo">
          <span class="etiqueta">Tensión</span>
          <NumberInput v-model="draft.voltageV" :decimals="0" suffix="V" />
        </label>
        <label v-if="kind === 'tablero'" class="campo completo">
          <span class="etiqueta">Ubicación</span>
          <InputText v-model="draft.location" placeholder="Ej.: Cuarto eléctrico, piso 1" />
        </label>
      </div>
      <ChoiceChips v-model="draft.phases" :options="PHASES" label="Fases" fill clearable />
    </template>
  </section>

  <section class="form-seccion">
    <EntityPhotos :project-id="projectId" entity-type="electrico" :entity-id="draft.id" default-kind="instalacion" title="Fotos" hint="Tablero abierto, placa del transformador, protecciones y conductores." />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Observaciones</h3>
    <Textarea v-model="draft.notes" auto-resize rows="3" placeholder="Estado, calentamiento, marcación de circuitos…" />
  </section>
</template>
