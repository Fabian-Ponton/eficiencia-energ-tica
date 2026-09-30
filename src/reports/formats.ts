import type { Workbook, Worksheet } from 'exceljs';
import { powerFactorFromEnergy } from '@/domain/calc/bills';
import { floorAreaOf } from '@/domain/areas';
import { carrierInfo, CARRIERS, equivalentKwh, isElectric, unitLabel } from '@/domain/carriers';
import { generatedEquipmentCode } from '@/domain/codes';
import { AC_TYPES, CONDITIONS, END_USES, endUseOf, LAMP_TYPES, LIGHT_CONTROLS, PHOTO_KINDS, SPACE_TYPES, spaceTypeOf } from '@/domain/catalogs';
import { buildCollection, STATUS_LABEL } from '@/domain/collection';
import { FREQUENCIES, MAINTENANCE_TYPES } from '@/domain/maintenance';
import { DAY_OPTIONS, termsOf } from '@/domain/occupancy';
import { tenureInfo, TENURES } from '@/domain/tenure';
import type { Equipment } from '@/domain/types';
import { formatNumber } from '@/utils/format';
import type { ReportData } from './model';

/**
 * Formatos de recolección de información en Excel. Las hojas, los títulos y las columnas son los del libro que el auditor
 * ya usa en campo (`00_Guia` … `13_Control`), con listas desplegables, las unidades a la vista y «N/D» para el dato que no
 * está disponible. El mismo libro se puede volver a cargar en PONTIA (`db/formatsImport.ts`). Aquí están las definiciones,
 * que también usa la lectura, y la escritura del libro.
 */

export type FormatId =
  | 'guia'
  | 'general'
  | 'areas'
  | 'equipos'
  | 'aires'
  | 'iluminacion'
  | 'ocupacion'
  | 'mediciones'
  | 'facturacion'
  | 'gas'
  | 'mantenimiento'
  | 'evidencia'
  | 'hallazgos'
  | 'oportunidades'
  | 'control';

export type ListKey =
  | 'estado'
  | 'tipoUso'
  | 'areas'
  | 'siNo'
  | 'dias'
  | 'tipoAire'
  | 'tecnologia'
  | 'controlLuz'
  | 'tipoMto'
  | 'frecuencia'
  | 'prioridadHallazgo'
  | 'prioridad'
  | 'sistema'
  | 'estadoControl'
  | 'energetico'
  | 'unidad'
  | 'tenencia'
  | 'tipoEntidad';

export type CellFormat = 'text' | 'date' | 'period' | 'int' | 'dec1' | 'dec2' | 'dec3';

export interface FormatColumn {
  /** Encabezado tal como está en el libro del auditor. */
  header: string;
  width: number;
  list?: ListKey;
  format?: CellFormat;
  /** Columna que PONTIA agrega al formato original: si un libro no la trae, no es una falta. */
  extension?: boolean;
}

export interface FormatDef {
  id: Exclude<FormatId, 'guia' | 'general'>;
  name: string;
  title: string;
  columns: FormatColumn[];
}

const col = (header: string, width: number, list?: ListKey, format?: CellFormat, extension?: boolean): FormatColumn => ({ header, width, list, format, extension });
const useFactor = () => col('Factor de uso (%)', 17, undefined, 'int', true);
/** Los formatos 4 y 5 no traen el nombre del equipo; PONTIA lo agrega para no perderlo al volver a cargar el libro. */
const equipmentName = () => col('Nombre del equipo', 34, undefined, undefined, true);

/** Las hojas en el orden del libro. La `08b` es una ampliación de PONTIA para el gas natural y los demás energéticos. */
export const FORMAT_DEFS: Record<FormatDef['id'], FormatDef> = {
  areas: {
    id: 'areas',
    name: '02_Areas',
    title: 'FORMATO 2 – CARACTERIZACIÓN DE ÁREAS, USO Y OCUPACIÓN',
    columns: [col('ID Área', 12), col('Piso', 8), col('Área/espacio', 30), col('Tipo de uso', 30, 'tipoUso'), col('Área aprox. (m²)', 15, undefined, 'dec1'), col('Ocupación habitual', 16, undefined, 'int'), col('Horario de uso', 26), col('Observaciones', 34)],
  },
  equipos: {
    id: 'equipos',
    name: '03_Equipos',
    title: 'FORMATO 3 – INVENTARIO Y CARACTERIZACIÓN DE EQUIPOS ELÉCTRICOS',
    columns: [
      col('ID', 12),
      col('Piso/Área', 26, 'areas'),
      col('Equipo', 30),
      col('Marca', 16),
      col('Modelo', 16),
      col('Cantidad', 10, undefined, 'int'),
      col('Potencia (W/kW)', 16),
      col('Voltaje (V)', 12, undefined, 'int'),
      col('Corriente (A)', 13, undefined, 'dec1'),
      col('Horas/día', 11, undefined, 'dec1'),
      col('Días/mes', 10, undefined, 'int'),
      col('Estado', 13, 'estado'),
      col('Modo de uso', 26),
      col('Observaciones', 34),
      col('Uso final', 22, 'sistema', undefined, true),
      useFactor(),
    ],
  },
  aires: {
    id: 'aires',
    name: '04_Aires',
    title: 'FORMATO 4 – CARACTERIZACIÓN DE AIRES ACONDICIONADOS',
    columns: [
      col('ID', 12),
      col('Piso/Área', 26, 'areas'),
      col('Marca', 16),
      col('Modelo', 16),
      col('Tipo', 22, 'tipoAire'),
      col('Capacidad (BTU/h)', 17, undefined, 'int'),
      col('Voltaje (V)', 12, undefined, 'int'),
      col('Corriente nominal (A)', 18, undefined, 'dec1'),
      col('Potencia (W/kW)', 16),
      col('EER/SEER (si aparece)', 18, undefined, 'dec2'),
      col('Temp. configurada (°C)', 19, undefined, 'int'),
      col('Horas/día', 11, undefined, 'dec1'),
      col('Días/mes', 10, undefined, 'int'),
      col('Estado', 13, 'estado'),
      col('Mantenimiento reciente', 20, undefined, 'date'),
      col('Observaciones', 34),
      col('Cantidad', 10, undefined, 'int', true),
      useFactor(),
      equipmentName(),
    ],
  },
  iluminacion: {
    id: 'iluminacion',
    name: '05_Iluminacion',
    title: 'FORMATO 5 – CARACTERIZACIÓN DE ILUMINACIÓN',
    columns: [
      col('ID', 12),
      col('Piso/Área', 26, 'areas'),
      col('Tipo de luminaria', 24),
      col('Tecnología', 22, 'tecnologia'),
      col('Cantidad', 10, undefined, 'int'),
      col('Potencia/unidad (W)', 18, undefined, 'dec1'),
      col('Potencia total (W)', 17, undefined, 'dec1'),
      col('Horas/día', 11, undefined, 'dec1'),
      col('Días/mes', 10, undefined, 'int'),
      col('Control', 24, 'controlLuz'),
      col('Estado', 13, 'estado'),
      col('Observaciones', 34),
      useFactor(),
      equipmentName(),
    ],
  },
  ocupacion: {
    id: 'ocupacion',
    name: '06_Uso_Ocupacion',
    title: 'FORMATO 6 – HORARIOS, USO Y OCUPACIÓN',
    columns: [
      col('ID Área', 12),
      col('Piso/Área', 26, 'areas'),
      col('Actividad', 30),
      col('Día', 9, 'dias'),
      col('Hora inicio', 12),
      col('Hora fin', 12),
      col('Horas de uso', 13, undefined, 'dec2'),
      col('Ocupación promedio', 17, undefined, 'int'),
      col('Aire usado (Sí/No)', 17, 'siNo'),
      col('Iluminación usada (Sí/No)', 22, 'siNo'),
      col('Observaciones', 34),
    ],
  },
  mediciones: {
    id: 'mediciones',
    name: '07_Mediciones',
    title: 'FORMATO 7 – REGISTRO DE MEDICIONES ELÉCTRICAS',
    columns: [
      col('ID', 10),
      col('Fecha', 13, undefined, 'date'),
      col('Hora', 9),
      col('Punto de medición', 18),
      col('Equipo/circuito', 28),
      col('Instrumento', 22),
      col('V (V)', 20),
      col('I (A)', 20),
      col('P (kW)', 11, undefined, 'dec2'),
      col('FP', 8, undefined, 'dec3'),
      col('Frecuencia (Hz)', 15, undefined, 'dec2'),
      col('Energía (kWh)', 14, undefined, 'dec2'),
      col('Condición', 26),
      col('Responsable', 20),
      col('Observaciones', 34),
    ],
  },
  facturacion: {
    id: 'facturacion',
    name: '08_Facturacion',
    title: 'FORMATO 8 – INFORMACIÓN HISTÓRICA DE CONSUMO Y FACTURACIÓN',
    columns: [
      col('Mes/Año', 12, undefined, 'period'),
      col('Periodo', 24),
      col('Días', 8, undefined, 'int'),
      col('Consumo (kWh)', 15, undefined, 'int'),
      col('Demanda (kW)', 14, undefined, 'dec1'),
      col('Factor de potencia', 17, undefined, 'dec3'),
      col('Valor energía (COP)', 19, undefined, 'int'),
      col('Total factura (COP)', 19, undefined, 'int'),
      col('Tarifa ($/kWh)', 15, undefined, 'dec1'),
      col('Observaciones', 34),
      col('Personas atendidas', 17, undefined, 'int', true),
      col('Horas de práctica', 17, undefined, 'int', true),
      col('Grados-día de enfriamiento', 24, undefined, 'int', true),
    ],
  },
  gas: {
    id: 'gas',
    name: '08b_Gas_Otros',
    title: 'FORMATO 8b – FACTURAS DE GAS NATURAL Y OTROS ENERGÉTICOS (ampliación de PONTIA)',
    columns: [
      col('Mes/Año', 12, undefined, 'period'),
      col('Periodo', 24),
      col('Días', 8, undefined, 'int'),
      col('Energético', 20, 'energetico'),
      col('Cantidad', 12, undefined, 'dec2'),
      col('Unidad', 9, 'unidad'),
      col('Factor (kWh/unidad)', 19, undefined, 'dec3'),
      col('Energía equivalente (kWh)', 22, undefined, 'int'),
      col('Valor energía (COP)', 19, undefined, 'int'),
      col('Total factura (COP)', 19, undefined, 'int'),
      col('Observaciones', 34),
    ],
  },
  mantenimiento: {
    id: 'mantenimiento',
    name: '09_Mantenimiento',
    title: 'FORMATO 9 – REGISTRO DE MANTENIMIENTO Y CONDICIÓN',
    columns: [
      col('ID Equipo', 16),
      col('Área', 26, 'areas'),
      col('Tipo', 22, 'tipoMto'),
      col('Último mantenimiento', 20, undefined, 'date'),
      col('Frecuencia', 14, 'frecuencia'),
      col('Actividades realizadas', 34),
      col('Fallas reportadas', 30),
      col('Condición actual', 16, 'estado'),
      col('Recomendación existente', 30),
      col('Responsable', 20),
      col('Observaciones', 34),
    ],
  },
  evidencia: {
    id: 'evidencia',
    name: '10_Evidencia',
    title: 'FORMATO 10 – REGISTRO FOTOGRÁFICO Y EVIDENCIAS',
    columns: [col('ID Evidencia', 14), col('Fecha', 13, undefined, 'date'), col('Piso/Área', 26, 'areas'), col('Tipo de evidencia', 24), col('Descripción', 40), col('Archivo fotográfico', 22), col('Formato relacionado', 20), col('Observaciones', 28)],
  },
  hallazgos: {
    id: 'hallazgos',
    name: '11_Hallazgos',
    title: 'FORMATO 11 – REGISTRO DE HALLAZGOS Y OBSERVACIONES',
    columns: [
      col('ID', 10),
      col('Fecha', 13, undefined, 'date'),
      col('Piso/Área', 26, 'areas'),
      col('Sistema/equipo', 26),
      col('Hallazgo', 36),
      col('Posible causa', 30),
      col('Impacto energético observado', 30),
      col('Evidencia asociada', 22),
      col('Acción sugerida', 30),
      col('Prioridad preliminar', 19, 'prioridadHallazgo'),
      col('Observaciones', 34),
    ],
  },
  oportunidades: {
    id: 'oportunidades',
    name: '12_Oportunidades',
    title: 'FORMATO 12 – MATRIZ DE OPORTUNIDADES DE MEJORA',
    columns: [
      col('ID', 10),
      col('Sistema', 22, 'sistema'),
      col('Problema', 34),
      col('Evidencia', 28),
      col('Medida propuesta', 36),
      col('Consumo actual (kWh/año)', 22, undefined, 'int'),
      col('Ahorro (kWh/año)', 17, undefined, 'int'),
      col('Ahorro (COP/año)', 17, undefined, 'int'),
      col('Inversión (COP)', 16, undefined, 'int'),
      col('Payback (años)', 15, undefined, 'dec1'),
      col('Prioridad', 11, 'prioridad'),
      col('Responsable', 18),
      col('Plazo', 12),
      col('Indicador', 20),
      col('Observaciones', 34),
    ],
  },
  control: {
    id: 'control',
    name: '13_Control',
    title: 'CONTROL DE RECOLECCIÓN – ETAPA 5',
    columns: [col('Información requerida', 36), col('Responsable', 22), col('Fecha objetivo', 15, undefined, 'date'), col('Fecha obtenida', 15, undefined, 'date'), col('Estado', 15, 'estadoControl'), col('Evidencia/archivo', 28), col('Observaciones', 40)],
  },
};

/** Campos de la hoja `01_General`, en el orden del libro; los últimos completan el art. 4(a) de la Res. 40412, que el formato no cubría. */
export const GENERAL_FIELDS: readonly { label: string; list?: ListKey; extension?: boolean }[] = [
  { label: 'Fecha de levantamiento' },
  { label: 'Responsable' },
  { label: 'Bloque' },
  { label: 'Sede' },
  { label: 'Ubicación' },
  { label: 'Número de pisos' },
  { label: 'Área construida aproximada (m²)' },
  { label: 'Horario general' },
  { label: 'Días de operación/semana' },
  { label: 'Estudiantes aproximados' },
  { label: 'Funcionarios aproximados' },
  { label: 'Responsable institucional' },
  { label: 'Observaciones' },
  { label: 'Entidad', extension: true },
  { label: 'Tipo de entidad', list: 'tipoEntidad', extension: true },
  { label: 'Año de construcción', extension: true },
  { label: 'Proceso o actividad', extension: true },
  { label: 'Entorno', extension: true },
  { label: 'Tenencia del edificio', list: 'tenencia', extension: true },
];

export const GENERAL_SHEET = { name: '01_General', title: 'FORMATO 1 – INFORMACIÓN GENERAL DEL EDIFICIO' } as const;
export const GUIDE_SHEET = { name: '00_Guia', title: 'FORMATOS DE RECOLECCIÓN DE INFORMACIÓN ENERGÉTICA' } as const;
export const LISTS_SHEET = '_Listas';

/** Orden de las hojas de datos en el libro. */
export const FORMAT_ORDER: FormatDef['id'][] = ['areas', 'equipos', 'aires', 'iluminacion', 'ocupacion', 'mediciones', 'facturacion', 'gas', 'mantenimiento', 'evidencia', 'hallazgos', 'oportunidades', 'control'];

/** Filas de encabezado: el título va en la fila 1 y los encabezados en la 4, como en el libro original. */
export const HEADER_ROW = 4;
const BLANK_ROWS = 100;

// ——— Celdas ———

type Cell = string | number | Date | null;
const utc = (date: string | undefined): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};
const utcPeriod = (period: string): Date | null => utc(`${period}-01`);
const text = (value: string | undefined): Cell => value?.trim() || null;
const num = (value: number | undefined): Cell => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const trimNumber = (value: number, decimals = 3) => formatNumber(value, decimals).replace(/,0+$/, '').replace(/(,\d*?)0+$/, '$1');

/** «1,5 kW» o «250 W»: siempre con unidad, como pide la guía de los formatos. */
export const powerText = (kw: number): Cell => (Number.isFinite(kw) && kw > 0 ? (kw < 1 ? `${trimNumber(kw * 1000, 1)} W` : `${trimNumber(kw, 3)} kW`) : null);

const phaseText = (values: (number | null)[] | undefined, decimals: number): Cell =>
  values?.some((v) => v !== null) ? values.map((v) => (v === null ? '–' : formatNumber(v, decimals))).join(' / ') : null;

const findingPriority: Record<string, string> = { critico: 'Crítica', alto: 'Alta', medio: 'Media', bajo: 'Baja' };
const measurePriority: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const POINT_LABEL = { general: 'General', tablero: 'Tablero', area: 'Espacio', equipo: 'Equipo' } as const;
/** El equipo medido se rotula «CÓDIGO · Nombre»: varios equipos comparten nombre, pero no código. */
const equipmentPoint = (e: Equipment | undefined) => (e ? `${generatedEquipmentCode(e)} · ${e.name}` : undefined);
const RELATED_FORMAT: Record<string, string> = {
  area: '02 Áreas',
  equipo: '03 Equipos',
  electrico: 'Sistema eléctrico',
  medicion: '07 Mediciones',
  factura: '08 Facturación',
  hallazgo: '11 Hallazgos',
  medida: '12 Oportunidades',
  tarea: 'Implementación',
  seguridad: 'Seguridad eléctrica',
  mantenimiento: '09 Mantenimiento',
  proyecto: '01 General',
};

// ——— Filas de cada hoja ———

interface Lookups {
  area: Map<string, { name: string; code?: string; floor?: string }>;
  equipment: Map<string, Equipment>;
  node: Map<string, string>;
}

function lookups(data: ReportData): Lookups {
  return {
    area: new Map(data.areas.map((a) => [a.id, { name: a.name, code: a.code, floor: a.floor }])),
    equipment: new Map([...data.equipment, ...data.otherEquipment].map((e) => [e.id, e])),
    node: new Map(data.electrical.map((n) => [n.id, n.name])),
  };
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es', { numeric: true });

/** Filas de la hoja `01_General`: [campo, valor]. */
export function generalRows(data: ReportData): [string, Cell][] {
  const p = data.project;
  const value: Record<string, Cell> = {
    'Fecha de levantamiento': utc(p.surveyDate),
    Responsable: text(p.auditor),
    Bloque: text(p.name),
    Sede: text(p.site?.name),
    Ubicación: text(p.address),
    'Número de pisos': num(p.building?.floors),
    'Área construida aproximada (m²)': num(p.areaM2),
    'Horario general': text(p.operatingHours),
    'Días de operación/semana': num(p.calendar.daysPerWeek),
    'Estudiantes aproximados': num(p.population?.students),
    'Funcionarios aproximados': num(p.population?.staff),
    'Responsable institucional': text(p.institutionalContact?.name),
    Observaciones: null,
    Entidad: text(p.client),
    'Tipo de entidad': p.entity ? (p.entity.kind === 'publica' ? 'Pública' : 'Privada') : null,
    'Año de construcción': num(p.building?.builtYear),
    'Proceso o actividad': text(p.building?.activity),
    Entorno: text(p.building?.surroundings),
    'Tenencia del edificio': tenureInfo(p.building?.tenure)?.label ?? null,
  };
  return GENERAL_FIELDS.map((f) => [f.label, value[f.label] ?? null]);
}

/** Filas de una hoja de datos con lo que ya está registrado. */
export function formatRows(id: FormatDef['id'], data: ReportData): Cell[][] {
  const look = lookups(data);
  const areaName = (areaId?: string) => (areaId ? (look.area.get(areaId)?.name ?? null) : null);
  const conditionLabel = (c: string | undefined) => CONDITIONS.find((x) => x.id === c)?.label ?? null;
  const lastMaintenance = (equipmentId: string) => [...data.maintenance].filter((m) => m.equipmentId === equipmentId && m.lastAt).sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))[0]?.lastAt;

  switch (id) {
    case 'areas':
      return [...data.areas]
        .sort((a, b) => (a.floor ?? '').localeCompare(b.floor ?? '', 'es', { numeric: true }) || byName(a, b))
        .map((a) => [
          text(a.code),
          text(a.floor),
          a.name,
          spaceTypeOf(a.spaceType)?.label ?? null,
          num(floorAreaOf(a) ?? undefined),
          num(a.occupants),
          a.hoursPerDay ? `${trimNumber(a.hoursPerDay, 1)} h/día` : null,
          text(a.notes),
        ]);
    case 'equipos':
      return data.equipment
        .filter((e) => e.category !== 'climatizacion' && e.category !== 'iluminacion')
        .sort(byName)
        .map((e) => [generatedEquipmentCode(e), areaName(e.areaId), e.name, text(e.brand), text(e.model), e.quantity, powerText(e.powerKw), num(e.voltageV), num(e.currentA), e.hoursPerDay, e.operatingDaysPerMonth, conditionLabel(e.condition), text(e.usageMode), text(e.notes), endUseOf(e.category).label, Math.round(e.useFactor * 100)]);
    case 'aires':
      return data.equipment
        .filter((e) => e.category === 'climatizacion')
        .sort(byName)
        .map((e) => [
          generatedEquipmentCode(e),
          areaName(e.areaId),
          text(e.brand),
          text(e.model),
          text(e.acType),
          num(e.capacityBtuH),
          num(e.voltageV),
          num(e.currentA),
          powerText(e.powerKw),
          num(e.eer),
          num(e.setpointC),
          e.hoursPerDay,
          e.operatingDaysPerMonth,
          conditionLabel(e.condition),
          utc(lastMaintenance(e.id)),
          text(e.notes),
          e.quantity,
          Math.round(e.useFactor * 100),
          e.name,
        ]);
    case 'iluminacion':
      return data.equipment
        .filter((e) => e.category === 'iluminacion')
        .sort(byName)
        .map((e) => [
          generatedEquipmentCode(e),
          areaName(e.areaId),
          text(e.fixtureType),
          LAMP_TYPES.find((l) => l.id === e.lampType)?.label ?? text(e.lampType),
          e.quantity,
          e.powerKw * 1000,
          e.powerKw * 1000 * e.quantity,
          e.hoursPerDay,
          e.operatingDaysPerMonth,
          LIGHT_CONTROLS.find((c) => c.id === e.lightControl)?.label ?? null,
          conditionLabel(e.condition),
          text(e.notes),
          Math.round(e.useFactor * 100),
          e.name,
        ]);
    case 'ocupacion': {
      const term = termsOf(data.occupancy)[0];
      return data.occupancy
        .filter((o) => o.term === term)
        .sort((a, b) => (areaName(a.areaId) ?? '').localeCompare(areaName(b.areaId) ?? '', 'es', { numeric: true }) || a.day.localeCompare(b.day) || a.start.localeCompare(b.start))
        .map((o) => [text(look.area.get(o.areaId)?.code), areaName(o.areaId), o.activity, o.day, o.start, o.end, o.hours, num(o.avgOccupants), o.usesAc === undefined ? null : o.usesAc ? 'Sí' : 'No', o.usesLighting === undefined ? null : o.usesLighting ? 'Sí' : 'No', text(o.notes)]);
    }
    case 'mediciones':
      return data.measurements.map((m, i) => {
        const point = m.pointType === 'tablero' ? look.node.get(m.pointId ?? '') : m.pointType === 'area' ? areaName(m.pointId) : m.pointType === 'equipo' ? equipmentPoint(look.equipment.get(m.pointId ?? '')) : undefined;
        return [
          `M-${String(i + 1).padStart(2, '0')}`,
          utc(m.takenAt),
          m.takenAt.slice(11, 16) || null,
          POINT_LABEL[m.pointType],
          point ?? null,
          text(m.instrument),
          phaseText(m.voltageV, 1),
          phaseText(m.currentA, 2),
          num(m.kw),
          num(m.pf),
          num(m.frequencyHz),
          num(m.energyKwh),
          text(m.condition),
          text(m.responsible),
          text(m.notes),
        ];
      });
    case 'facturacion':
      return data.bills.map((b) => [
        utcPeriod(b.period),
        b.startDate && b.endDate ? `${b.startDate} a ${b.endDate}` : null,
        num(b.days),
        b.kwh,
        num(b.demandKw),
        b.kvarh !== undefined && b.kwh > 0 ? Math.round(powerFactorFromEnergy(b.kwh, b.kvarh) * 1000) / 1000 : null,
        num(b.energyCostCop),
        b.costCop,
        b.tariffCopPerKwh ?? (b.kwh > 0 ? Math.round((b.costCop / b.kwh) * 10) / 10 : null),
        text(b.notes),
        num(b.populationServed),
        num(b.practiceHours),
        num(b.coolingDegreeDays),
      ]);
    case 'gas':
      return data.otherBills.map((b) => [
        utcPeriod(b.period),
        b.startDate && b.endDate ? `${b.startDate} a ${b.endDate}` : null,
        num(b.days),
        carrierInfo(b.carrier).label,
        num(b.quantity),
        b.quantity === undefined ? null : unitLabel(b.unit),
        num(b.kwhPerUnit),
        num(equivalentKwh(b) ?? undefined),
        num(b.energyCostCop),
        b.costCop,
        text(b.notes),
      ]);
    case 'mantenimiento':
      return [...data.maintenance]
        .sort((a, b) => (look.equipment.get(a.equipmentId)?.name ?? '').localeCompare(look.equipment.get(b.equipmentId)?.name ?? '', 'es', { numeric: true }))
        .map((m) => {
          const e = look.equipment.get(m.equipmentId);
          return [
            e ? generatedEquipmentCode(e) : null,
            areaName(e?.areaId),
            MAINTENANCE_TYPES.find((t) => t.id === m.type)?.label ?? null,
            utc(m.lastAt),
            FREQUENCIES.find((f) => f.id === m.frequency)?.label ?? text(m.frequency),
            text(m.activities),
            text(m.failures),
            conditionLabel(m.condition),
            text(m.recommendation),
            text(m.responsible),
            text(m.notes),
          ];
        });
    case 'evidencia':
      return data.photos.map((p, i) => {
        const owner = p.entityType === 'area' ? p.entityId : p.entityType === 'equipo' ? look.equipment.get(p.entityId ?? '')?.areaId : undefined;
        const code = p.code?.trim() || `F-${String(i + 1).padStart(3, '0')}`;
        return [code, utc(p.takenAt), areaName(owner), PHOTO_KINDS.find((k) => k.id === p.kind)?.label ?? null, text(p.caption), `${code}.jpg`, RELATED_FORMAT[p.entityType] ?? null, p.authorized ? 'Con autorización' : null];
      });
    case 'hallazgos':
      return data.findings.map((f, i) => {
        const owner = f.entityType === 'area' ? f.entityId : f.entityType === 'equipo' ? look.equipment.get(f.entityId ?? '')?.areaId : undefined;
        const system = f.category === 'electrico' ? 'Sistema eléctrico' : f.category === 'envolvente' ? 'Envolvente' : f.category ? endUseOf(f.category).label : null;
        const fotos = data.photos.filter((p) => p.entityType === 'hallazgo' && p.entityId === f.id).length;
        return [
          `H-${String(i + 1).padStart(2, '0')}`,
          utc(f.foundAt),
          areaName(owner),
          system,
          f.title,
          text(f.cause),
          text(f.energyImpact),
          fotos ? `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}` : null,
          text(f.suggestedAction),
          findingPriority[f.severity] ?? null,
          text(f.description),
        ];
      });
    case 'oportunidades':
      return data.measures.map((m) => {
        const net = m.savingsCopYear - m.annualCostCop;
        return [
          m.code,
          m.category ? endUseOf(m.category).label : null,
          text(m.description),
          null,
          m.title,
          num(m.currentConsumptionKwhYear),
          m.savingsKwhYear,
          m.savingsCopYear,
          m.investmentCop,
          net > 0 ? Math.round((m.investmentCop / net) * 10) / 10 : null,
          m.priority ? measurePriority[m.priority] : null,
          null,
          null,
          null,
          text(m.notes),
        ];
      });
    case 'control': {
      const rows = buildCollection({
        project: data.project,
        areas: data.areas,
        equipment: [...data.equipment, ...data.otherEquipment],
        occupancy: data.occupancy,
        maintenance: data.maintenance,
        electricBills: data.bills.filter(isElectric).length,
        measurementRecords: data.measurements.length + data.readings.length + data.series.length,
        photos: data.photos.length,
        findings: data.findings.length,
        stored: data.collection,
      });
      return rows.map((r) => [
        r.key === 'general' ? `${r.label} de ${data.project.name}` : r.label,
        text(r.stored?.responsible),
        utc(r.stored?.targetDate),
        utc(r.stored?.obtainedDate),
        STATUS_LABEL[r.status],
        text(r.stored?.evidence),
        text(r.stored?.notes),
      ]);
    }
  }
}

// ——— Listas desplegables ———

export function formatLists(data: ReportData): Record<ListKey, string[]> {
  return {
    estado: CONDITIONS.map((c) => c.label),
    tipoUso: SPACE_TYPES.map((t) => t.label),
    areas: data.areas.map((a) => a.name),
    siNo: ['Sí', 'No'],
    dias: DAY_OPTIONS.map((d) => d.value),
    tipoAire: [...AC_TYPES],
    tecnologia: LAMP_TYPES.map((l) => l.label),
    controlLuz: LIGHT_CONTROLS.map((c) => c.label),
    tipoMto: MAINTENANCE_TYPES.map((t) => t.label),
    frecuencia: FREQUENCIES.map((f) => f.label),
    prioridadHallazgo: ['Crítica', 'Alta', 'Media', 'Baja'],
    prioridad: ['Alta', 'Media', 'Baja'],
    sistema: [...END_USES.map((u) => u.label), 'Sistema eléctrico', 'Envolvente'],
    estadoControl: ['Pendiente', 'En curso', 'Obtenido', 'No disponible'],
    energetico: CARRIERS.filter((c) => c.id !== 'electricidad').map((c) => c.label),
    unidad: ['m³', 'kg', 'gal'],
    tenencia: TENURES.map((t) => t.label),
    tipoEntidad: ['Pública', 'Privada'],
  };
}

// ——— Libro ———

const NUM_FMT: Record<CellFormat, string | undefined> = {
  text: undefined,
  date: 'dd/mm/yyyy',
  period: 'mmm yyyy',
  int: '#,##0',
  dec1: '#,##0.0',
  dec2: '#,##0.00',
  dec3: '#,##0.000',
};

const NAVY = 'FF10234B';
/** Encabezado de las columnas que PONTIA agrega a los formatos originales. */
const EXTENSION_GREEN = 'FF1A7F4B';
const columnLetter = (index: number): string => {
  let n = index;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

const GUIDE_LINES = [
  '1. No inventar datos. Si un dato no está disponible, registrar N/D.',
  '2. Registrar siempre las unidades: W, kW, V, A, BTU/h, h/día, kWh, COP, etc.',
  '3. Tomar fotografías de equipos, placas y hallazgos, con las autorizaciones correspondientes.',
  '4. Los formatos 1 al 8 se usan principalmente para el levantamiento y diagnóstico.',
  '5. El formato de oportunidades se diligencia después de analizar la información.',
  '6. La generación solar fotovoltaica NO forma parte del alcance del proyecto.',
];
const GUIDE_EXTRA = [
  'Este libro lo generó PONTIA: se puede volver a cargar en la app (paso «Control de recolección», botón «Importar formatos»).',
  'No cambies los nombres de las hojas ni los encabezados de la fila 4: así PONTIA reconoce cada columna. Las columnas que no reconoce se ignoran.',
  'Las celdas con lista desplegable ayudan a escribir igual que PONTIA; si un valor no está en la lista puedes dejarlo y la app lo avisará al cargarlo.',
  'La potencia se escribe con su unidad («1500 W», «1,5 kW», «2 HP»). Un número sin unidad no se carga: la app avisa cuál fila corregir.',
  'La columna ID identifica cada registro: al volver a cargar el libro, una fila con el mismo ID actualiza el registro en vez de duplicarlo.',
  'La hoja 08b_Gas_Otros es una ampliación de PONTIA para el gas natural y otros energéticos; copia el factor de conversión de la factura del proveedor.',
  'Las columnas con el encabezado verde las agrega PONTIA al final de la hoja (uso final, cantidad, factor de uso, nombre del equipo…). Son opcionales, pero sin ellas un aire o una luminaria pierde esos datos al volver a cargar el libro.',
];

function styleHeader(row: ReturnType<Worksheet['getRow']>) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 34;
}

export interface FormatsWorkbookOptions {
  /** `true`: con lo ya registrado. `false`: en blanco, solo con los encabezados, las listas y el proyecto. */
  filled: boolean;
  created?: Date;
}

/** Libro con las hojas del auditor. ExcelJS se carga solo al generar. */
export async function buildFormatsWorkbook(data: ReportData, options: FormatsWorkbookOptions): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook: Workbook = new ExcelJS.Workbook();
  workbook.creator = 'PONTIA';
  workbook.title = `Formatos de recolección · ${data.project.name}`;
  workbook.created = options.created ?? new Date();
  const p = data.project;
  const created = options.created ?? new Date();
  const where = [p.client, p.site?.name, p.city].filter(Boolean).join(' · ');
  const stamp = created.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const subtitle = `Proyecto: ${p.name}${where ? ` · ${where}` : ''} · Generado con PONTIA el ${stamp}`;
  const lists = formatLists(data);
  const listRange = new Map<ListKey, string>();

  // Guía
  const guide = workbook.addWorksheet(GUIDE_SHEET.name);
  guide.getColumn(1).width = 130;
  guide.getCell('A1').value = GUIDE_SHEET.title;
  guide.getCell('A1').font = { bold: true, size: 15, color: { argb: NAVY } };
  guide.getCell('A3').value = subtitle;
  guide.getCell('A3').font = { italic: true };
  guide.getCell('A4').value = 'Instrucciones';
  guide.getCell('A4').font = { bold: true, size: 12 };
  [...GUIDE_LINES, '', 'Cómo trabajar con PONTIA', ...GUIDE_EXTRA].forEach((line, i) => {
    const cell = guide.getCell(5 + i, 1);
    cell.value = line;
    cell.alignment = { wrapText: true, vertical: 'top' };
    if (line === 'Cómo trabajar con PONTIA') cell.font = { bold: true, size: 12 };
  });

  const validate = (sheet: Worksheet, columns: readonly { list?: ListKey }[], lastRow: number, offset = 1) => {
    columns.forEach((c, i) => {
      const range = c.list ? listRange.get(c.list) : undefined;
      if (!range) return;
      for (let r = HEADER_ROW + 1; r <= lastRow; r++) {
        sheet.getCell(r, i + offset).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [range],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Valor fuera de la lista',
          error: 'Puedes dejarlo si es correcto: la lista solo ayuda a escribirlo igual que PONTIA.',
        };
      }
    });
  };

  // Cada lista ocupa una columna de la hoja oculta `_Listas`, que se escribe al final; su rango se conoce desde ahora
  (Object.keys(lists) as ListKey[]).forEach((key, i) => {
    const items = lists[key];
    if (items.length) listRange.set(key, `${LISTS_SHEET}!$${columnLetter(i + 1)}$2:$${columnLetter(i + 1)}$${items.length + 1}`);
  });

  const start = (sheet: Worksheet, title: string, note: string) => {
    sheet.getCell('A1').value = title;
    sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } };
    sheet.getCell('A2').value = subtitle;
    sheet.getCell('A2').font = { italic: true, color: { argb: 'FF5C6A80' } };
    sheet.getCell('A3').value = note;
    sheet.getCell('A3').font = { color: { argb: 'FF5C6A80' } };
    sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  };
  const defaultNote = 'Anota siempre las unidades (W, kW, V, A, BTU/h). Si un dato no está disponible, escribe N/D. No cambies los encabezados de la fila 4.';

  // 01_General: dos columnas, campo e información
  const general = workbook.addWorksheet(GENERAL_SHEET.name);
  start(general, GENERAL_SHEET.title, defaultNote);
  general.getRow(HEADER_ROW).values = ['Campo', 'Información'];
  styleHeader(general.getRow(HEADER_ROW));
  general.getColumn(1).width = 36;
  general.getColumn(2).width = 60;
  const generalValues = options.filled ? generalRows(data) : GENERAL_FIELDS.map((f): [string, Cell] => [f.label, null]);
  generalValues.forEach(([label, value], i) => {
    const row = HEADER_ROW + 1 + i;
    general.getCell(row, 1).value = label;
    general.getCell(row, 2).value = value;
    general.getCell(row, 2).alignment = { horizontal: 'left', wrapText: true };
    if (value instanceof Date) general.getCell(row, 2).numFmt = 'dd/mm/yyyy';
    const list = GENERAL_FIELDS[i].list ? listRange.get(GENERAL_FIELDS[i].list as ListKey) : undefined;
    if (list) {
      general.getCell(row, 2).dataValidation = { type: 'list', allowBlank: true, formulae: [list], showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Valor fuera de la lista', error: 'Puedes dejarlo si es correcto.' };
    }
  });
  general.getCell(HEADER_ROW + 1 + GENERAL_FIELDS.findIndex((f) => f.extension), 3).value = '← Desde aquí, datos que PONTIA agrega al formato original (art. 4, literal a, de la Res. 40412 de 2024).';
  general.getCell(HEADER_ROW + 1 + GENERAL_FIELDS.findIndex((f) => f.extension), 3).font = { italic: true, color: { argb: 'FF5C6A80' } };

  // Hojas de datos
  for (const id of FORMAT_ORDER) {
    const def = FORMAT_DEFS[id];
    const sheet = workbook.addWorksheet(def.name);
    const term = id === 'ocupacion' ? termsOf(data.occupancy)[0] : undefined;
    start(sheet, def.title, id === 'ocupacion' ? `Periodo académico: ${term ?? '(escríbelo al cargar el libro en PONTIA)'} · ${defaultNote}` : defaultNote);
    sheet.getRow(HEADER_ROW).values = def.columns.map((c) => c.header);
    styleHeader(sheet.getRow(HEADER_ROW));
    def.columns.forEach((c, i) => {
      const column = sheet.getColumn(i + 1);
      column.width = c.width;
      const fmt = NUM_FMT[c.format ?? 'text'];
      if (fmt) column.numFmt = fmt;
      if (c.extension) sheet.getCell(HEADER_ROW, i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXTENSION_GREEN } };
    });
    const rows = options.filled ? formatRows(id, data) : [];
    rows.forEach((values, r) => {
      const row = sheet.getRow(HEADER_ROW + 1 + r);
      values.forEach((value, i) => {
        if (value !== null) row.getCell(i + 1).value = value;
      });
    });
    validate(sheet, def.columns, HEADER_ROW + Math.max(BLANK_ROWS, rows.length + 40));
  }

  // La hoja de listas queda al final y oculta
  const hidden = workbook.addWorksheet(LISTS_SHEET, { state: 'hidden' });
  (Object.keys(lists) as ListKey[]).forEach((key, i) => {
    hidden.getCell(1, i + 1).value = key;
    lists[key].forEach((item, r) => (hidden.getCell(r + 2, i + 1).value = item));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Nombre del archivo: «PONTIA_Formatos-recoleccion_LAB-01_2026-09-29.xlsx». */
export function formatsFileName(projectCode: string | undefined, projectName: string, filled: boolean, when = new Date()): string {
  const slug = (projectCode || projectName)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `PONTIA_Formatos-recoleccion${filled ? '' : '-en-blanco'}_${slug || 'proyecto'}_${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}.xlsx`;
}
