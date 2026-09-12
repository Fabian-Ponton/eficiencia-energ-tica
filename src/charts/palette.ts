/** Colores de las gráficas, iguales a los tokens del sistema de diseño (dirección A) en modo claro y oscuro. */
export interface ChartPalette {
  text: string;
  muted: string;
  axis: string;
  grid: string;
  line: string;
  surface: string;
  border: string;
  /** Paleta categórica validada para daltonismo, en orden fijo. */
  series: string[];
  /** Series estimadas o de referencia. */
  estimate: string;
  /** Escala secuencial de un solo tono para el mapa de calor. */
  heat: string[];
  accent: string;
  navy: string;
}

export const SANS = 'IBM Plex Sans, Segoe UI, system-ui, sans-serif';
export const MONO = 'IBM Plex Mono, Cascadia Mono, Consolas, monospace';

const LIGHT: ChartPalette = {
  text: '#0f1b33',
  muted: '#5c6a80',
  axis: '#7a879b',
  grid: '#e3e8ef',
  line: '#c9d3df',
  surface: '#ffffff',
  border: '#dbe1ea',
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#898781'],
  estimate: '#898781',
  heat: ['#eef3fb', '#9cc2f0', '#2a78d6', '#10234b'],
  accent: '#22a056',
  navy: '#10234b',
};

const DARK: ChartPalette = {
  text: '#eef2f8',
  muted: '#9aa7bc',
  axis: '#8793a8',
  grid: '#22304a',
  line: '#34455f',
  surface: '#131d31',
  border: '#26344f',
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#898781'],
  estimate: '#9aa7bc',
  heat: ['#19253d', '#23508f', '#3987e5', '#cfe3ff'],
  accent: '#22a056',
  navy: '#cfe3ff',
};

export const chartPalette = (dark: boolean): ChartPalette => (dark ? DARK : LIGHT);

/** «#2a78d6» → «rgba(42, 120, 214, 0.2)» */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
