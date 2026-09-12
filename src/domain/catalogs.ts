import type { Condition, DataType, ElectricalKind, EndUseCategory, PhotoKind, TaskStatus } from './types';

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

export const endUseOf = (id: EndUseCategory) => END_USES.find((use) => use.id === id) ?? END_USES[END_USES.length - 1];

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

export const SECTORS = ['Educativo', 'Comercial', 'Industrial', 'Salud', 'Público', 'Hotelero', 'Residencial', 'Otro'];

export interface SpaceType {
  id: string;
  label: string;
  /** Iluminancia media de referencia (lux). */
  lux?: number;
}

/**
 * Tipos de espacio con una iluminancia de referencia orientativa.
 * Cada valor se debe validar con el RETILAP y el criterio del auditor antes de usarlo en un informe.
 */
export const SPACE_TYPES: readonly SpaceType[] = [
  { id: 'aula', label: 'Aula', lux: 500 },
  { id: 'laboratorio', label: 'Laboratorio', lux: 500 },
  { id: 'sala-computo', label: 'Sala de cómputo', lux: 500 },
  { id: 'oficina', label: 'Oficina', lux: 500 },
  { id: 'sala-reuniones', label: 'Sala de reuniones', lux: 500 },
  { id: 'biblioteca', label: 'Biblioteca', lux: 500 },
  { id: 'auditorio', label: 'Auditorio', lux: 300 },
  { id: 'cafeteria', label: 'Cafetería o comedor', lux: 200 },
  { id: 'cocina', label: 'Cocina', lux: 500 },
  { id: 'circulacion', label: 'Pasillo o circulación', lux: 100 },
  { id: 'bano', label: 'Baño', lux: 150 },
  { id: 'bodega', label: 'Bodega o almacén', lux: 150 },
  { id: 'cuarto-tecnico', label: 'Cuarto técnico', lux: 200 },
  { id: 'exterior', label: 'Exterior o parqueadero', lux: 20 },
  { id: 'otro', label: 'Otro' },
];

export const spaceTypeOf = (id?: string) => SPACE_TYPES.find((type) => type.id === id);

export const LAMP_TYPES: readonly { id: string; label: string }[] = [
  { id: 'LED', label: 'LED' },
  { id: 'T8', label: 'Fluorescente T8' },
  { id: 'T5', label: 'Fluorescente T5' },
  { id: 'T12', label: 'Fluorescente T12' },
  { id: 'CFL', label: 'Fluorescente compacta' },
  { id: 'halogena', label: 'Halógena' },
  { id: 'incandescente', label: 'Incandescente' },
  { id: 'halogenuro', label: 'Halogenuro metálico' },
  { id: 'sodio', label: 'Sodio' },
  { id: 'otra', label: 'Otra' },
];

export const ELECTRICAL_KINDS: readonly { id: ElectricalKind; label: string; hint: string }[] = [
  { id: 'red', label: 'Red del operador', hint: 'Punto de conexión en media tensión' },
  { id: 'transformador', label: 'Transformador', hint: 'Capacidad en kVA y tensiones' },
  { id: 'medidor', label: 'Medidor', hint: 'Medidor de energía de la frontera comercial' },
  { id: 'acometida', label: 'Acometida', hint: 'Conductores hasta el tablero general' },
  { id: 'tablero', label: 'Tablero', hint: 'Tablero general o de distribución' },
  { id: 'circuito', label: 'Circuito', hint: 'Circuito ramal con su protección' },
];

export const electricalKindOf = (id: ElectricalKind) => ELECTRICAL_KINDS.find((kind) => kind.id === id) ?? ELECTRICAL_KINDS[4];

/** Niveles de tensión de la regulación colombiana (CREG). */
export const VOLTAGE_LEVELS: readonly { id: string; label: string }[] = [
  { id: 'Nivel 1', label: 'Nivel 1 · menos de 1 kV' },
  { id: 'Nivel 2', label: 'Nivel 2 · de 1 a 30 kV' },
  { id: 'Nivel 3', label: 'Nivel 3 · de 30 a 57,5 kV' },
  { id: 'Nivel 4', label: 'Nivel 4 · 57,5 kV o más' },
];

export const GRID_OPERATORS = ['Air-e', 'Afinia', 'Enel Colombia', 'EPM', 'Celsia', 'CHEC', 'CENS', 'ESSA', 'EBSA', 'Emcali', 'Electrohuila', 'Cedenar', 'EMSA', 'Enerca', 'Dispac'];

/** Capacidades comerciales frecuentes, para elegir con un toque. */
export const COMMON_BTU = [9000, 12000, 18000, 24000, 36000, 48000, 60000];
export const COMMON_KVA = [15, 30, 45, 75, 112.5, 150, 225, 300, 400, 500, 630, 800, 1000];
export const COMMON_SECONDARY_V = ['208/120 V', '220/127 V', '240/120 V', '440/254 V', '480/277 V'];

/** Nombres frecuentes por uso final, como sugerencias al escribir. */
export const EQUIPMENT_SUGGESTIONS: Record<EndUseCategory, string[]> = {
  climatizacion: ['Aire acondicionado mini-split', 'Aire acondicionado de ventana', 'Aire acondicionado central', 'Unidad manejadora de aire', 'Ventilador de techo', 'Extractor'],
  motores: ['Bomba de agua', 'Motor trifásico', 'Compresor de aire', 'Ascensor', 'Motobomba'],
  refrigeracion: ['Nevera', 'Congelador', 'Enfriador de agua', 'Cuarto frío', 'Dispensador de agua'],
  iluminacion: ['Luminaria LED', 'Panel LED 60×60', 'Luminaria fluorescente 2×32 W T8', 'Bombillo LED', 'Reflector LED', 'Luminaria de alumbrado exterior'],
  cocina: ['Horno microondas', 'Estufa eléctrica', 'Greca', 'Cafetera', 'Horno eléctrico', 'Licuadora'],
  ti: ['Computador de escritorio', 'Portátil', 'Monitor', 'Impresora', 'Videoproyector', 'Servidor', 'Switch de red', 'Televisor'],
  otros: ['Cargadores y equipos menores', 'UPS', 'Secador de manos', 'Equipo de laboratorio'],
};

/** Días de operación al mes según los días de trabajo por semana (5 → 22, 6 → 26, 7 → 30). */
export const daysPerMonth = (daysPerWeek: number): number => Math.round((daysPerWeek * 52) / 12);
