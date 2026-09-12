import { BarChart, CustomChart, GaugeChart, HeatmapChart, LineChart, SankeyChart, ScatterChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

/** Solo los tipos de gráfica que usa PONTIA, para no cargar ECharts completo. */
echarts.use([
  BarChart,
  CustomChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  SankeyChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export type ChartOption = echarts.EChartsCoreOption;
export { echarts };

/**
 * Dibuja una gráfica fuera de pantalla y la devuelve como PNG (para el informe Word y las descargas).
 * Siempre en modo claro y sin animación.
 */
export function renderChartPng(option: ChartOption, width = 900, height = 420, pixelRatio = 2): string {
  const host = document.createElement('div');
  const chart = echarts.init(host, undefined, { renderer: 'canvas', width, height });
  try {
    chart.setOption({ ...option, animation: false }, true);
    return chart.getDataURL({ type: 'png', pixelRatio, backgroundColor: '#ffffff' });
  } finally {
    chart.dispose();
  }
}
