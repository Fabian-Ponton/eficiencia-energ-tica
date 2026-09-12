<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { reactive, ref, watch } from 'vue';
import type { NewProjectInput } from '@/db/projects';

const visible = defineModel<boolean>('visible', { required: true });
const emit = defineEmits<{ create: [input: NewProjectInput] }>();

const SECTORS = ['Educativo', 'Comercial', 'Industrial', 'Salud', 'Público', 'Hotelero', 'Residencial', 'Otro'];
const empty = () => ({ name: '', code: '', client: '', city: '', sector: null as string | null, areaM2: null as number | null });
const form = reactive(empty());
const submitted = ref(false);

watch(visible, (open) => {
  if (!open) return;
  Object.assign(form, empty());
  submitted.value = false;
});

function submit() {
  submitted.value = true;
  if (!form.name.trim()) return;
  emit('create', {
    name: form.name,
    code: form.code,
    client: form.client,
    city: form.city,
    sector: form.sector ?? undefined,
    areaM2: form.areaM2 ?? undefined,
  });
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Nuevo proyecto"
    :draggable="false"
    :style="{ width: 'min(560px, calc(100vw - 24px))' }"
  >
    <form class="formulario" @submit.prevent="submit">
      <label class="campo completo">
        <span>Nombre del proyecto</span>
        <InputText v-model="form.name" placeholder="Ej.: Bloque 6 · Aulas y laboratorios" :invalid="submitted && !form.name.trim()" autofocus />
        <small v-if="submitted && !form.name.trim()" class="error">Escribe un nombre para el proyecto.</small>
      </label>
      <label class="campo">
        <span>Código</span>
        <InputText v-model="form.code" placeholder="BL-06" class="mono" />
      </label>
      <label class="campo">
        <span>Sector</span>
        <Select v-model="form.sector" :options="SECTORS" placeholder="Elegir" />
      </label>
      <label class="campo completo">
        <span>Cliente o institución</span>
        <InputText v-model="form.client" placeholder="Ej.: Universidad de La Guajira" />
      </label>
      <label class="campo">
        <span>Ciudad</span>
        <InputText v-model="form.city" placeholder="Ej.: Riohacha" />
      </label>
      <label class="campo">
        <span>Área total</span>
        <InputNumber v-model="form.areaM2" :min="0" :max-fraction-digits="1" locale="es-CO" suffix=" m²" placeholder="0 m²" />
      </label>
      <button type="submit" class="sr-only" tabindex="-1">Crear</button>
    </form>
    <template #footer>
      <Button label="Cancelar" severity="secondary" text @click="visible = false" />
      <Button label="Crear proyecto" @click="submit" />
    </template>
  </Dialog>
</template>

<style scoped>
.formulario {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 12px;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.campo > span {
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 600;
}
.completo {
  grid-column: 1 / -1;
}
.error {
  color: var(--critical);
}
@media (max-width: 520px) {
  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
