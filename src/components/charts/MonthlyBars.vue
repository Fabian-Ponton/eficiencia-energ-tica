<script setup lang="ts">
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { formatNumber } from '@/utils/format';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const props = withDefaults(defineProps<{ labels: string[]; values: number[]; unit: string; title: string; color?: string }>(), {
  color: '#2a78d6',
});

const el = ref<HTMLDivElement>();
const { isDark } = useTheme();
let chart: echarts.ECharts | undefined;
let observer: ResizeObserver | undefined;

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function render() {
  if (!chart) return;
  const maxIndex = props.values.indexOf(Math.max(...props.values));
  const mono = { fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 };
  chart.setOption(
    {
      animationDuration: 500,
      animationEasing: 'cubicOut',
      grid: { left: 8, right: 8, top: 22, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(122, 135, 155, 0.12)' } },
        backgroundColor: token('--surface'),
        borderColor: token('--border'),
        textStyle: { color: token('--ink'), fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 13 },
        valueFormatter: (value: unknown) => `${formatNumber(Number(value))} ${props.unit}`,
      },
      xAxis: {
        type: 'category',
        data: props.labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: token('--field-border') } },
        axisLabel: { ...mono, color: token('--axis') },
      },
      yAxis: {
        type: 'value',
        splitNumber: 2,
        axisLabel: { ...mono, color: token('--axis'), formatter: (value: number) => formatNumber(value) },
        splitLine: { lineStyle: { color: token('--divider'), width: 1 } },
      },
      series: [
        {
          type: 'bar',
          name: props.title,
          data: props.values,
          barMaxWidth: 16,
          itemStyle: { color: props.color, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { opacity: 0.85 } },
          label: {
            show: true,
            position: 'top',
            ...mono,
            fontWeight: 600,
            color: token('--ink'),
            formatter: (p: { dataIndex: number; value: unknown }) => (p.dataIndex === maxIndex ? formatNumber(Number(p.value)) : ''),
          },
        },
      ],
    },
    true,
  );
}

onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value, undefined, { renderer: 'canvas' });
  render();
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(el.value);
});
watch(() => [props.labels, props.values], render, { deep: true });
watch(isDark, () => requestAnimationFrame(render));
onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
});

defineExpose({ toPng: () => chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' }) });
</script>

<template>
  <div ref="el" class="grafico" role="img" :aria-label="title" />
  <table class="sr-only">
    <caption>{{ title }}</caption>
    <tbody>
      <tr v-for="(label, i) in labels" :key="label + i">
        <th scope="row">{{ label }}</th>
        <td>{{ formatNumber(values[i] ?? 0) }} {{ unit }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.grafico {
  width: 100%;
  height: 200px;
}
</style>
