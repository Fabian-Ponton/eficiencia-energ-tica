<script setup lang="ts">
import { IconDownload } from '@tabler/icons-vue';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import { renderChartPng, type ChartOption } from '@/charts/echarts';
import { dataUrlToBlob, deliverFile } from '@/utils/share';

/**
 * Descarga una gráfica como PNG. Recibe una función que arma la gráfica en modo claro,
 * para que la imagen sirva en informes aunque la app esté en modo oscuro.
 */
const props = withDefaults(defineProps<{ option: () => ChartOption | null; name: string; width?: number; height?: number }>(), { width: 1000, height: 460 });

const toast = useToast();
const busy = ref(false);

async function download() {
  const option = props.option();
  if (!option || busy.value) return;
  busy.value = true;
  try {
    const url = renderChartPng(option, props.width, props.height);
    await deliverFile(dataUrlToBlob(url), `${props.name}.png`);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo generar la imagen', detail: error instanceof Error ? error.message : String(error), life: 5000 });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <button type="button" class="png" :disabled="busy" title="Descargar la gráfica como imagen PNG" @click="download">
    <IconDownload :size="14" />
    <span>PNG</span>
  </button>
</template>

<style scoped>
.png {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition:
    color 150ms var(--ease),
    border-color 150ms var(--ease);
}
.png:hover,
.png:focus-visible {
  border-color: var(--field-border);
  color: var(--ink);
}
.png:disabled {
  cursor: progress;
  opacity: 0.6;
}
</style>
