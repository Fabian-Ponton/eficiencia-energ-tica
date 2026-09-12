/** Modelo de datos de PONTIA. Todo se guarda en el equipo (IndexedDB). */

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
export type EntityType = 'proyecto' | 'area' | 'equipo' | 'electrico' | 'hallazgo' | 'medida' | 'tarea';
export type Severity = 'critico' | 'alto' | 'medio' | 'bajo';
export type TaskStatus = 'pendiente' | 'en-ejecucion' | 'implementada';

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
  windowOrientation?: 'N' | 'S' | 'E' | 'O';
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
  kind: 'red' | 'transformador' | 'medidor' | 'tablero' | 'circuito';
  name: string;
  parentId?: string;
  ratedKva?: number;
  primaryKv?: number;
  secondaryV?: string;
  breakerA?: number;
  phases?: 1 | 2 | 3;
  voltageV?: number;
  conductor?: string;
  ownership?: string;
  year?: number;
  notes?: string;
}

export interface Measurement extends ProjectScoped {
  /** Fecha y hora local tal como la registró el auditor (AAAA-MM-DDTHH:mm). */
  takenAt: string;
  pointType: 'general' | 'area' | 'equipo' | 'tablero';
  pointId?: string;
  /** Tensión por fase (V). */
  voltageV?: number[];
  /** Corriente por fase (A). */
  currentA?: number[];
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

export interface Settings {
  id: 'app';
  auditorName?: string;
  csvFormat: 'es-CO' | 'estandar';
  theme: 'claro' | 'oscuro' | 'sistema';
  lastBackupAt?: number;
}
