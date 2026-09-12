<script setup lang="ts">
import { IconCopy, IconTrash, IconX } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import Drawer from 'primevue/drawer';
import { useId } from 'vue';

const visible = defineModel<boolean>('visible', { required: true });
withDefaults(
  defineProps<{
    title: string;
    eyebrow?: string;
    saving?: boolean;
    canDelete?: boolean;
    canDuplicate?: boolean;
    submitLabel?: string;
  }>(),
  { eyebrow: undefined, submitLabel: 'Guardar' },
);
defineEmits<{ submit: []; delete: []; duplicate: [] }>();

const desktop = useMediaQuery('(min-width: 1024px)');
const formId = useId();
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="desktop ? 'right' : 'bottom'"
    :class="['hoja', desktop ? 'hoja-lateral' : 'hoja-inferior']"
    :style="desktop ? { width: 'min(560px, 100vw)' } : { height: 'auto', maxHeight: '94dvh' }"
    :dismissable="false"
    :show-close-icon="false"
    block-scroll
  >
    <template #header>
      <div class="cabecera">
        <span class="asa" aria-hidden="true" />
        <div class="titulos">
          <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
          <h2>{{ title }}</h2>
        </div>
        <button type="button" class="cerrar" aria-label="Cerrar sin guardar" @click="visible = false">
          <IconX :size="20" />
        </button>
      </div>
    </template>

    <form :id="formId" class="formulario" novalidate @submit.prevent="$emit('submit')">
      <slot />
      <button type="submit" class="sr-only" tabindex="-1">Guardar</button>
    </form>

    <template #footer>
      <div class="pie">
        <button v-if="canDelete" type="button" class="accion peligro" @click="$emit('delete')">
          <IconTrash :size="18" /><span class="texto-largo">Eliminar</span>
        </button>
        <button v-if="canDuplicate" type="button" class="accion" title="Guarda este registro y crea otro igual" @click="$emit('duplicate')">
          <IconCopy :size="18" /><span class="texto-largo">Guardar y duplicar</span>
        </button>
        <span class="espacio" />
        <Button type="button" label="Cancelar" severity="secondary" text @click="visible = false" />
        <Button type="submit" :form="formId" :label="submitLabel" :loading="saving" class="guardar" />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.cabecera {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 18px 12px 12px 16px;
  border-bottom: 1px solid var(--divider);
}
.asa {
  position: absolute;
  top: 7px;
  left: 50%;
  width: 36px;
  height: 4px;
  margin-left: -18px;
  border-radius: 2px;
  background: var(--field-border);
}
.titulos {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
h2 {
  margin: 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cerrar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--ink-2);
  cursor: pointer;
}
.formulario {
  display: flex;
  flex-direction: column;
}
.pie {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}
.espacio {
  flex: 1;
}
.accion {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.accion:hover {
  background: var(--surface-2);
}
.accion.peligro {
  color: var(--critical-text);
}
.accion.peligro:hover {
  background: var(--critical-wash);
}
.guardar {
  min-width: 110px;
}
@media (max-width: 560px) {
  .texto-largo {
    display: none;
  }
  .accion {
    width: 40px;
    justify-content: center;
    padding: 0;
  }
}
@media (min-width: 1024px) {
  .asa {
    display: none;
  }
  .cabecera {
    padding: 16px 16px 14px 20px;
  }
}
</style>
