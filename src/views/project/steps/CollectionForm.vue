<script setup lang="ts">
import { IconCalendar, IconChecklist, IconNotes, IconUser } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { STATUS_LABEL } from '@/domain/collection';
import type { CollectionItem } from '@/domain/types';

const draft = defineModel<Draft<CollectionItem>>('draft', { required: true });
const props = defineProps<{ errors: FieldErrors; custom: boolean; automatic: string }>();

const STATUS_OPTIONS = (['pendiente', 'en-curso', 'obtenido', 'no-disponible'] as const).map((value) => ({ value, label: STATUS_LABEL[value] }));
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconChecklist :size="16" />Información requerida</h3>
    <label v-if="custom" class="campo">
      <span class="etiqueta">Nombre del renglón</span>
      <InputText v-model="draft.label" placeholder="Ej.: Contrato de suministro de gas" :invalid="Boolean(errors.label)" />
      <small v-if="errors.label" class="error">{{ errors.label }}</small>
    </label>
    <p v-else class="fija">{{ draft.label }}</p>
    <div class="campo">
      <span class="etiqueta">Estado que marcas tú</span>
      <ChoiceChips v-model="draft.status" :options="STATUS_OPTIONS" label="Estado de la recolección" />
      <small class="ayuda">
        La app ya calcula el estado con los datos registrados ({{ props.automatic }}). Aquí solo marcas lo que no puede saber, como los planos, o declaras que la entidad
        no tiene el dato. «No disponible» siempre manda.
      </small>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconUser :size="16" />Quién y cuándo</h3>
    <div class="form-grid">
      <label class="campo completo">
        <span class="etiqueta">Responsable de entregarla</span>
        <InputText v-model="draft.responsible" placeholder="Persona o dependencia que tiene la información" />
      </label>
      <label class="campo">
        <span class="etiqueta"><IconCalendar :size="12" /> Fecha objetivo</span>
        <input v-model="draft.targetDate" type="date" class="p-inputtext p-component" />
      </label>
      <label class="campo">
        <span class="etiqueta"><IconCalendar :size="12" /> Fecha obtenida</span>
        <input v-model="draft.obtainedDate" type="date" class="p-inputtext p-component" />
      </label>
      <label class="campo completo">
        <span class="etiqueta">Evidencia o archivo</span>
        <InputText v-model="draft.evidence" placeholder="Ej.: planos_bloque.pdf, oficio 123 del 12-sep" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Observaciones</h3>
    <Textarea v-model="draft.notes" auto-resize rows="2" placeholder="A quién se le pidió, qué falta, por qué no está disponible…" />
  </section>
</template>

<style scoped>
.fija {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.etiqueta svg {
  vertical-align: -1px;
}
</style>
