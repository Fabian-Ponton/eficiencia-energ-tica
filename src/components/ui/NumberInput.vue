<script setup lang="ts" generic="T extends number | undefined">
import InputNumber from 'primevue/inputnumber';
import { onMounted, ref, watch } from 'vue';

/** Campo numérico con formato colombiano (1.234,5). Vacío: NaN si el dato es obligatorio, sin valor si es opcional. */
const model = defineModel<T>({ required: true });
const props = withDefaults(
  defineProps<{
    suffix?: string;
    decimals?: number;
    min?: number;
    max?: number;
    placeholder?: string;
    invalid?: boolean;
    inputId?: string;
    grouping?: boolean;
    ariaLabel?: string;
    required?: boolean;
  }>(),
  { suffix: undefined, decimals: 2, min: 0, max: undefined, placeholder: undefined, inputId: undefined, grouping: true, ariaLabel: undefined },
);

const root = ref<{ $el?: Element } | null>(null);

// Sin decimales mínimos PrimeVue pide el teclado numérico sin coma; en el iPhone no dejaría escribir «1,5»
function keyboard() {
  root.value?.$el?.querySelector('input')?.setAttribute('inputmode', props.decimals > 0 ? 'decimal' : 'numeric');
}
onMounted(keyboard);
watch(
  () => props.decimals,
  () => requestAnimationFrame(keyboard),
);

function update(value: number | null | undefined) {
  model.value = (value ?? (props.required ? Number.NaN : undefined)) as T;
}
</script>

<template>
  <InputNumber
    ref="root"
    :model-value="typeof model === 'number' && Number.isFinite(model) ? model : null"
    locale="es-CO"
    :min-fraction-digits="0"
    :max-fraction-digits="decimals"
    :min="min"
    :max="max"
    :use-grouping="grouping"
    :suffix="suffix ? ` ${suffix}` : undefined"
    :placeholder="placeholder"
    :invalid="invalid"
    :input-id="inputId"
    :aria-label="ariaLabel"
    fluid
    @update:model-value="update"
  />
</template>
