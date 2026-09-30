import type { Condition, DataType, ElectricalKind, EndUseCategory, PhotoKind, TaskStatus, UsageRegime } from './types';

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
  // Octavo color de la paleta validada (violeta). Se validó el orden completo, en claro y oscuro, con el validador de la habilidad dataviz
  { id: 'laboratorio', label: 'Equipos de laboratorio', color: '#4a3aa7', colorDark: '#9085e9' },
  { id: 'otros', label: 'Otros', color: '#898781', colorDark: '#898781' },
];

export const endUseOf = (id: EndUseCategory) => END_USES.find((use) => use.id === id) ?? END_USES[END_USES.length - 1];

export const PHOTO_KINDS: readonly { id: PhotoKind; label: string }[] = [
  { id: 'placa', label: 'Placa de características' },
  { id: 'vista-general', label: 'Vista general' },
  { id: 'instalacion', label: 'Instalación' },
  { id: 'estado-fisico', label: 'Estado físico' },
  { id: 'termografia', label: 'Termografía' },
  { id: 'documento', label: 'Documento o plano' },
  { id: 'instrumento', label: 'Instrumento y medición' },
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

/** La Res. 40412 de 2024 rige a las entidades públicas; una privada no queda obligada por ella. */
export const ENTITY_KINDS = [
  { value: 'publica', label: 'Pública' },
  { value: 'privada', label: 'Privada' },
] as const;

export const ENTITY_ORDERS = [
  { value: 'nacional', label: 'Nacional' },
  { value: 'territorial', label: 'Territorial' },
] as const;

export interface SpaceType {
  id: string;
  label: string;
  /** Iluminancia mantenida de referencia (lux). */
  lux?: number;
  /** Uniformidad mínima (Uo), índice de reproducción cromática mínimo (Ra) y deslumbramiento máximo (UGRL) de la misma fila. */
  uo?: number;
  ra?: number;
  ugr?: number;
  /** Fila de la tabla de iluminancias del RETILAP de la que sale el valor. */
  reference?: string;
  /** Los tipos de laboratorio se agrupan aparte en el selector. */
  group?: 'laboratorio';
}

/**
 * Tipos de espacio con su iluminancia de referencia.
 * Los de aula y laboratorio salen de la tabla 36 («Locales educativos») del Libro 3 del RETILAP (Res. 40286 de 2026),
 * verificada en el texto oficial el 2026-09-29. Los demás son orientativos y el auditor los valida con el RETILAP.
 */
const RETILAP_EDU = 'RETILAP 2026, Libro 3, tabla 36';
const LAB_ROW = { uo: 0.6, ra: 80, ugr: 19 } as const;
export const SPACE_TYPES: readonly SpaceType[] = [
  { id: 'aula', label: 'Aula', lux: 500, ...LAB_ROW, reference: `${RETILAP_EDU}, ref. 36,1 (aula o salón de clases)` },
  { id: 'laboratorio', label: 'Laboratorio', lux: 500, ...LAB_ROW, reference: `${RETILAP_EDU}, ref. 36,14 (salas de prácticas y laboratorios)`, group: 'laboratorio' },
  { id: 'lab-quimica', label: 'Laboratorio de química', lux: 500, ...LAB_ROW, reference: `${RETILAP_EDU}, ref. 36,14`, group: 'laboratorio' },
  { id: 'lab-fisica', label: 'Laboratorio de física', lux: 500, ...LAB_ROW, reference: `${RETILAP_EDU}, ref. 36,14`, group: 'laboratorio' },
  { id: 'lab-biologia', label: 'Laboratorio de biología y microbiología', lux: 500, ...LAB_ROW, reference: `${RETILAP_EDU}, ref. 36,14`, group: 'laboratorio' },
  { id: 'lab-electronica', label: 'Laboratorio de electrónica y eléctrica', lux: 500, ...LAB_ROW, reference: `${RETILAP_EDU}, ref. 36,14`, group: 'laboratorio' },
  { id: 'lab-computo', label: 'Laboratorio de cómputo', lux: 300, ...LAB_ROW, reference: `${RETILAP_EDU}, ref. 36,11 (solo trabajos con computadoras)`, group: 'laboratorio' },
  { id: 'lab-mecanica', label: 'Taller de mecánica y materiales', lux: 500, ...LAB_ROW, reference: `${RETILAP_EDU}, ref. 36,16 (taller de enseñanza)`, group: 'laboratorio' },
  { id: 'lab-ambiental', label: 'Laboratorio ambiental y de suelos', lux: 500, ...LAB_ROW, reference: `${RETILAP_EDU}, ref. 36,14`, group: 'laboratorio' },
  { id: 'lab-otro', label: 'Otro laboratorio', lux: 500, ...LAB_ROW, reference: `${RETILAP_EDU}, ref. 36,14`, group: 'laboratorio' },
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

/** Tipos de espacio para el selector: los laboratorios aparte del resto. */
export const SPACE_GROUPS: readonly { label: string; items: readonly SpaceType[] }[] = [
  { label: 'Laboratorios y talleres', items: SPACE_TYPES.filter((t) => t.group === 'laboratorio') },
  { label: 'Otros espacios', items: SPACE_TYPES.filter((t) => t.group !== 'laboratorio') },
];

export const isLabType = (id?: string): boolean => spaceTypeOf(id)?.group === 'laboratorio';

/** Cómo se usa un equipo a lo largo del día. */
export const USAGE_REGIMES: readonly { id: UsageRegime; label: string; hint: string }[] = [
  { id: 'horario', label: 'Por horario', hint: 'Funciona en el horario de clases o de trabajo.' },
  { id: 'continuo', label: 'Continuo 24 h', hint: 'Está encendido todo el día, todos los días: neveras, ultracongeladores, servidores.' },
  { id: 'ciclos', label: 'Por ciclos', hint: 'Trabaja por tandas: hornos, mufla, autoclaves. Indica las horas efectivas al día.' },
  { id: 'respaldo', label: 'De respaldo', hint: 'Solo entra en una falla o emergencia: planta, UPS.' },
];

export const regimeOf = (id?: UsageRegime) => USAGE_REGIMES.find((r) => r.id === (id ?? 'horario')) ?? USAGE_REGIMES[0];

export const AC_TYPES = ['Mini-split', 'De ventana', 'Central o de paquete', 'Cassette', 'Piso-techo', 'Manejadora con chiller', 'Otro'];

export const FIXTURE_TYPES = ['Panel LED', 'Tubo LED', 'Luminaria fluorescente T8', 'Luminaria fluorescente T5', 'Reflector', 'Bombillo', 'Downlight', 'Otra'];

export const LIGHT_CONTROLS: readonly { id: 'manual' | 'sensor' | 'temporizador' | 'automatico' | 'otro'; label: string }[] = [
  { id: 'manual', label: 'Interruptor manual' },
  { id: 'sensor', label: 'Sensor de presencia' },
  { id: 'temporizador', label: 'Temporizador' },
  { id: 'automatico', label: 'Automático por luz natural' },
  { id: 'otro', label: 'Otro' },
];

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
  refrigeracion: ['Nevera', 'Congelador', 'Enfriador de agua', 'Cuarto frío', 'Dispensador de agua', 'Refrigerador de laboratorio', 'Ultracongelador de −80 °C', 'Cámara de conservación de muestras'],
  iluminacion: ['Luminaria LED', 'Panel LED 60×60', 'Luminaria fluorescente 2×32 W T8', 'Bombillo LED', 'Reflector LED', 'Luminaria de alumbrado exterior'],
  cocina: ['Horno microondas', 'Estufa eléctrica', 'Greca', 'Cafetera', 'Horno eléctrico', 'Licuadora'],
  ti: ['Computador de escritorio', 'Portátil', 'Monitor', 'Impresora', 'Videoproyector', 'Servidor', 'Switch de red', 'Televisor'],
  laboratorio: [
    'Horno de secado',
    'Mufla',
    'Autoclave',
    'Incubadora',
    'Campana de extracción',
    'Cabina de bioseguridad',
    'Centrífuga',
    'Balanza analítica',
    'Agitador magnético con calefacción',
    'Baño termostático',
    'Destilador de agua',
    'Espectrofotómetro',
    'Microscopio',
    'Osciloscopio',
    'Fuente de poder',
    'Plancha de calentamiento',
  ],
  otros: ['Cargadores y equipos menores', 'UPS', 'Secador de manos'],
};

/** Días de operación al mes según los días de trabajo por semana (5 → 22, 6 → 26, 7 → 30). */
export const daysPerMonth = (daysPerWeek: number): number => Math.round((daysPerWeek * 52) / 12);
