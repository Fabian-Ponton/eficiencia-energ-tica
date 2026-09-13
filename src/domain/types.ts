/** Modelo de datos de PONTIA. Todo se guarda en el equipo (IndexedDB). */
import type { IntervalCsvMapping } from './importers/intervalCsv';

/** Campos comunes de cada registro. `updatedAt` y `deletedAt` preparan la sincronización futura con la nube. */
export interface BaseRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface ProjectScoped extends BaseRecord {
  projectId: string;
}

/** Usos finales, en el orden de la paleta validada para daltonismo (importa en barras apiladas). */
export type EndUseCategory = 'climatizacion' | 'motores' | 'refrigeracion' | 'iluminacion' | 'cocina' | 'ti' | 'otros';
export type Condition = 'bueno' | 'regular' | 'deficiente';
export type DataType = 'medido' | 'calculado' | 'estimado' | 'ingresado';
export type PhotoKind = 'placa' | 'vista-general' | 'instalacion' | 'estado-fisico' | 'termografia' | 'otra';
export type EntityType = 'proyecto' | 'area' | 'equipo' | 'electrico' | 'medicion' | 'factura' | 'hallazgo' | 'medida' | 'tarea';
export type Severity = 'critico' | 'alto' | 'medio' | 'bajo';
export type TaskStatus = 'pendiente' | 'en-ejecucion' | 'implementada';
/** Elementos del sistema eléctrico, en el orden en que los recorre la energía. */
export type ElectricalKind = 'red' | 'transformador' | 'medidor' | 'acometida' | 'tablero' | 'circuito';
export type Orientation = 'N' | 'S' | 'E' | 'O';

export interface Project extends BaseRecord {
  name: string;
  code?: string;
  client?: string;
  nit?: string;
  city?: string;
  address?: string;
  sector?: string;
  areaM2?: number;
  users?: number;
  operatingHours?: string;
  gridOperator?: string;
  accountNumber?: string;
  voltageLevel?: string;
  calendar: {
    daysPerWeek: number;
    /** Festivos en formato AAAA-MM-DD. */
    holidays: string[];
    vacationDaysPerYear: number;
  };
  economics: {
    tariffCopPerKwh: number;
    discountRate: number;
    tariffEscalation: number;
    horizonYears: number;
    /** 0 mientras el auditor no configure el factor de emisión vigente. */
    emissionFactorKgPerKwh: number;
  };
  peakSunHours?: number;
  auditor?: string;
  clientLogoPhotoId?: string;
  startDate?: string;
  endDate?: string;
  /** Última descarga del respaldo .zip. No cuenta como modificación del proyecto. */
  lastBackupAt?: number;
  /** Parámetros de referencia del dimensionamiento que el auditor cambió; los demás usan los valores por defecto. */
  sizing?: SizingOverrides;
  /** Informes y exportaciones generados (el más reciente primero): historial y avance del paso de informes. */
  reports?: ReportRecord[];
}

export type ReportKind = 'auditoria' | 'pgee' | 'implementacion' | 'csv' | 'excel' | 'graficas';

export interface ReportRecord {
  id: string;
  kind: ReportKind;
  fileName: string;
  /** Fecha de generación (ms). */
  at: number;
}

/** Referencias editables del dimensionamiento. Solo se guardan las que difieren de los valores por defecto. */
export interface SizingOverrides {
  /** Por tipo de espacio: iluminancia requerida (lux), carga de envolvente (BTU/h·m²) y límite VEEI (W/m² por 100 lux). */
  spaces?: Record<string, { lux?: number; envelopeBtuHPerM2?: number; veeiLimit?: number }>;
  btuHPerPerson?: number;
  roofExtraBtuHPerM2?: number;
  solarBtuHPerM2?: Partial<Record<Orientation, number>>;
  safetyFactor?: number;
  coolingUnder?: number;
  coolingOver?: number;
  lightingTolerance?: number;
  lightingExcess?: number;
  maintenanceFactor?: number;
  loadingHigh?: number;
  loadingCritical?: number;
  breakerCriterion?: number;
  demandFactor?: number;
  defaultPowerFactor?: number;
}

export interface Area extends ProjectScoped {
  name: string;
  spaceType?: string;
  lengthM?: number;
  widthM?: number;
  heightM?: number;
  /** Área ingresada a mano cuando el espacio es irregular. */
  areaM2?: number;
  workPlaneHeightM?: number;
  occupants?: number;
  hoursPerDay?: number;
  windowAreaM2?: number;
  windowOrientation?: Orientation;
  roofExposed?: boolean;
  roofAvailableM2?: number;
  measuredLuxAvg?: number;
  measuredLuxMin?: number;
  notes?: string;
}

export interface Equipment extends ProjectScoped {
  name: string;
  code?: string;
  category: EndUseCategory;
  areaId?: string;
  panelId?: string;
  brand?: string;
  model?: string;
  powerKw: number;
  quantity: number;
  hoursPerDay: number;
  /** 24 valores: horas del día en que el equipo funciona. */
  activeHours?: boolean[];
  operatingDaysPerMonth: number;
  useFactor: number;
  condition: Condition;
  year?: number;
  capacityBtuH?: number;
  eer?: number;
  inverter?: boolean;
  lumens?: number;
  lampType?: string;
  efficiency?: number;
  notes?: string;
}

export interface ElectricalNode extends ProjectScoped {
  kind: ElectricalKind;
  name: string;
  parentId?: string;
  /** Capacidad nominal del transformador (kVA). */
  ratedKva?: number;
  /** Tensión del lado de media tensión (kV). */
  primaryKv?: number;
  /** Tensión secundaria, p. ej. «208/120 V». */
  secondaryV?: string;
  /** Protección principal del tablero o del circuito (A). */
  breakerA?: number;
  /** Capacidad de corriente de los conductores (A). */
  ampacityA?: number;
  lengthM?: number;
  phases?: 1 | 2 | 3;
  voltageV?: number;
  conductor?: string;
  meterNumber?: string;
  location?: string;
  ownership?: string;
  year?: number;
  notes?: string;
}

export interface Measurement extends ProjectScoped {
  /** Fecha y hora local tal como la registró el auditor (AAAA-MM-DDTHH:mm). */
  takenAt: string;
  pointType: 'general' | 'area' | 'equipo' | 'tablero';
  pointId?: string;
  phases?: 1 | 2 | 3;
  /** Tensiones medidas entre fase y neutro (LN) o entre fases (LL). */
  voltageRef?: 'LN' | 'LL';
  /** Tensión por fase (V); `null` si no se midió esa fase. */
  voltageV?: (number | null)[];
  /** Corriente por fase (A); `null` si no se midió esa fase. */
  currentA?: (number | null)[];
  kw?: number;
  kva?: number;
  kvar?: number;
  pf?: number;
  thdV?: number;
  thdI?: number;
  instrument?: string;
  dataType: DataType;
  notes?: string;
}

export interface MeterReadingRecord extends ProjectScoped {
  meter: string;
  at: string;
  kwh: number;
}

export interface IntervalSeries extends ProjectScoped {
  name: string;
  source: 'analizador' | 'operador' | 'otro';
  intervalMinutes: number;
  location?: string;
  fileName?: string;
  /** La serie mide todo el consumo de la instalación (no un subtablero): se puede comparar con el inventario. */
  wholeFacility?: boolean;
  /** Resumen guardado al importar, para listar las series sin leer todos los días. */
  firstDate?: string;
  lastDate?: string;
  dayCount?: number;
  peakKw?: number;
  energyKwh?: number;
  /** Cómo se leyó el archivo, para poder repetirlo o revisarlo. */
  mapping?: IntervalCsvMapping;
}

/** Plantilla reutilizable para importar archivos del mismo equipo u operador. */
export interface ImportTemplate {
  id: string;
  name: string;
  source: IntervalSeries['source'];
  mapping: IntervalCsvMapping;
  createdAt: number;
}

/** Un día de una serie de intervalos: potencia media (kW) de cada intervalo. */
export interface IntervalDay {
  seriesId: string;
  projectId: string;
  date: string;
  values: number[];
}

export interface Bill extends ProjectScoped {
  /** AAAA-MM */
  period: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  kwh: number;
  kvarh?: number;
  demandKw?: number;
  costCop: number;
  tariffCopPerKwh?: number;
  reactiveChargeCop?: number;
  /** Variables relevantes del periodo para la línea base (ISO 50006). */
  workingDays?: number;
  avgTemperatureC?: number;
  occupancyPct?: number;
  notes?: string;
}

export interface Photo extends ProjectScoped {
  entityType: EntityType;
  entityId?: string;
  kind: PhotoKind;
  code?: string;
  caption?: string;
  takenAt: string;
  blob: Blob;
  thumb?: Blob;
  width?: number;
  height?: number;
  lat?: number;
  lng?: number;
}

export interface Finding extends ProjectScoped {
  title: string;
  description?: string;
  severity: Severity;
  category?: EndUseCategory | 'electrico' | 'envolvente';
  entityType?: EntityType;
  entityId?: string;
  /** Hallazgo sugerido por las reglas automáticas y no escrito por el auditor. */
  auto: boolean;
  ruleId?: string;
  status: 'abierto' | 'en-medida' | 'cerrado';
}

export interface Measure extends ProjectScoped {
  code: string;
  title: string;
  description?: string;
  category: EndUseCategory;
  kind: 'operativa' | 'baja-inversion' | 'alta-inversion';
  savingsKwhYear: number;
  savingsCopYear: number;
  investmentCop: number;
  annualCostCop: number;
  lifetimeYears: number;
  selected: boolean;
  priority?: 'alta' | 'media' | 'baja';
  findingIds: string[];
  notes?: string;
}

export interface Pgee extends ProjectScoped {
  policy?: string;
  scope?: string;
  team: { role: string; name: string; responsibilities?: string }[];
  objectives: { description: string; targetPercent?: number; deadline?: string }[];
  monitoring?: string;
  communication?: string;
  training?: string;
  reviewFrequency?: string;
}

export interface Task extends ProjectScoped {
  measureId?: string;
  name: string;
  phase: 'corto' | 'mediano' | 'largo';
  responsible?: string;
  start?: string;
  end?: string;
  budgetCop?: number;
  fundingSource?: string;
  status: TaskStatus;
  /** Avance de 0 a 100. */
  progress: number;
  kpi?: string;
  verification?: string;
  notes?: string;
}

/** Sesión del usuario en su proyecto de Supabase: tokens y vencimiento (ms). La contraseña nunca se guarda. */
export interface CloudSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string;
}

/** Conexión con el proyecto de Supabase del propio usuario, para trabajar los mismos proyectos en varios equipos. */
export interface CloudSettings {
  /** URL del proyecto, p. ej. https://abcd.supabase.co */
  url: string;
  /** Clave pública «anon»: las políticas RLS la limitan a los datos de cada usuario. */
  anonKey: string;
  session?: CloudSession;
  /** Sincroniza sola al abrir la app, al volver la conexión y cada 10 minutos. */
  autoSync: boolean;
  /** Último cambio de la nube ya recibido (secuencia del servidor). */
  lastSeq?: number;
  /** Hasta cuándo se subieron los cambios de este equipo (su reloj, ms). */
  lastPushedAt?: number;
  lastSyncAt?: number;
  lastError?: string;
}

export interface Settings {
  id: 'app';
  auditorName?: string;
  csvFormat: 'es-CO' | 'estandar';
  theme: 'claro' | 'oscuro' | 'sistema';
  lastBackupAt?: number;
  importTemplates?: ImportTemplate[];
  cloud?: CloudSettings;
}
