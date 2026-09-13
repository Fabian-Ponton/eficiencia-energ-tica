import { BarChart, CustomChart, GaugeChart, HeatmapChart, LineChart, SankeyChart, ScatterChart } from 'echarts/charts';
import {
  GraphicComponent,
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
  // Formas libres: el diagrama unifilar y los planos del informe se dibujan con ellas
  GraphicComponent,
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
 * Siempre en modo claro y sin animación. Espera el aviso «finished» de ECharts antes de capturarla.
 */
export async function renderChartPng(option: ChartOption, width = 900, height = 420, pixelRatio = 2): Promise<string> {
  const host = document.createElement('div');
  const chart = echarts.init(host, undefined, { renderer: 'canvas', width, height });
  try {
    const finished = new Promise<void>((resolve) => {
      chart.on('finished', () => resolve());
      // Si el aviso no llega, no se queda esperando
      setTimeout(resolve, 3000);
    });
    chart.setOption({ ...option, animation: false }, true);
    await finished;
    const url = chart.getDataURL({ type: 'png', pixelRatio, backgroundColor: '#ffffff' });
    // zrender pinta las capas pesadas por partes y deja el resto para el cuadro siguiente; ese cuadro
    // se descarta solo si hubo un dibujo más nuevo. Se vacía la gráfica y se pinta al instante antes
    // de cerrarla, para que el cuadro pendiente no pinte sobre un lienzo ya cerrado.
    chart.clear();
    chart.getZr().refreshImmediately();
    return url;
  } finally {
    chart.dispose();
  }
}
