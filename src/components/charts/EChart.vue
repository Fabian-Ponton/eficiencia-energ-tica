<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { echarts, type ChartOption } from '@/charts/echarts';

/** Gráfica genérica: recibe las opciones ya armadas (con los colores del tema) y se ajusta al ancho. */
const props = withDefaults(defineProps<{ option: ChartOption; label: string; height?: string }>(), { height: '240px' });
/** Toque o clic sobre un elemento (barra, punto…): su serie, su posición y su valor. */
const emit = defineEmits<{ itemClick: [item: { seriesIndex: number; dataIndex: number; value: unknown }] }>();

const el = ref<HTMLDivElement>();
let chart: echarts.ECharts | undefined;
let observer: ResizeObserver | undefined;

onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value, undefined, { renderer: 'canvas' });
  chart.setOption(props.option, true);
  chart.on('click', (params) => {
    const item = params as { seriesIndex?: number; dataIndex?: number; value?: unknown };
    emit('itemClick', { seriesIndex: item.seriesIndex ?? 0, dataIndex: item.dataIndex ?? 0, value: item.value });
  });
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(el.value);
});
watch(
  () => props.option,
  (option) => chart?.setOption(option, true),
);
onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
});

defineExpose({ toPng: () => chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' }) });
</script>

<template>
  <div ref="el" class="grafica" role="img" :aria-label="label" :style="{ height }">
    <div class="sr-only"><slot /></div>
  </div>
</template>

<style scoped>
.grafica {
  width: 100%;
}
</style>
