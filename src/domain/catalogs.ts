import type { Condition, DataType, EndUseCategory, PhotoKind, TaskStatus } from './types';

/**
 * Usos finales con su color fijo. El orden es el de la paleta validada para daltonismo:
 * en barras apiladas los segmentos se dibujan en este orden.
 */
export const END_USES: readonly { id: EndUseCategory; label: string; color: string; colorDark: string }[] = [
  { id: 'climatizacion', label: 'Climatización', color: '#2a78d6', colorDark: '#3987e5' },
  { id: 'motores', label: 'Motores y bombas', color: '#eb6834', colorDark: '#d95926' },
  { id: 'refrigeracion', label: 'Refrigeración', color: '#1baf7a', colorDark: '#199e70' },
  { id: 'iluminacion', label: 'Iluminación', color: '#eda100', colorDark: '#c98500' },
  { id: 'cocina', label: 'Cocina', color: '#e87ba4', colorDark: '#d55181' },
  { id: 'ti', label: 'TI y oficina', color: '#008300', colorDark: '#008300' },
  { id: 'otros', label: 'Otros', color: '#898781', colorDark: '#898781' },
];

export const PHOTO_KINDS: readonly { id: PhotoKind; label: string }[] = [
  { id: 'placa', label: 'Placa de características' },
  { id: 'vista-general', label: 'Vista general' },
  { id: 'instalacion', label: 'Instalación' },
  { id: 'estado-fisico', label: 'Estado físico' },
  { id: 'termografia', label: 'Termografía' },
  { id: 'otra', label: 'Otra evidencia' },
];

export const CONDITIONS: readonly { id: Condition; label: string }[] = [
  { id: 'bueno', label: 'Bueno' },
  { id: 'regular', label: 'Regular' },
  { id: 'deficiente', label: 'Deficiente' },
];

export const DATA_TYPES: readonly { id: DataType; label: string }[] = [
  { id: 'medido', label: 'Medido' },
  { id: 'calculado', label: 'Calculado' },
  { id: 'estimado', label: 'Estimado' },
  { id: 'ingresado', label: 'Ingresado' },
];

export const TASK_STATUSES: readonly { id: TaskStatus; label: string }[] = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'en-ejecucion', label: 'En ejecución' },
  { id: 'implementada', label: 'Implementada' },
];
