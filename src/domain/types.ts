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
export type EndUseCategory = 'climatizacion' | 'motores' | 'refrigeracion' | 'iluminacion' | 'cocina' | 'ti' | 'laboratorio' | 'otros';
export type Condition = 'bueno' | 'regular' | 'deficiente';
export type DataType = 'medido' | 'calculado' | 'estimado' | 'ingresado';
export type PhotoKind = 'placa' | 'vista-general' | 'instalacion' | 'estado-fisico' | 'termografia' | 'documento' | 'instrumento' | 'otra';
export type EntityType = 'proyecto' | 'area' | 'equipo' | 'electrico' | 'medicion' | 'factura' | 'hallazgo' | 'medida' | 'tarea' | 'seguridad' | 'mantenimiento';
export type Severity = 'critico' | 'alto' | 'medio' | 'bajo';
export type TaskStatus = 'pendiente' | 'en-ejecucion' | 'implementada';
/** Elementos del sistema eléctrico, en el orden en que los recorre la energía. */
export type ElectricalKind = 'red' | 'transformador' | 'medidor' | 'acometida' | 'tablero' | 'circuito';
export type Orientation = 'N' | 'S' | 'E' | 'O';
/** Tenencia del edificio: si no es propio, la Res. 40412 (art. 3) solo permite buenas prácticas de operación. */
export type Tenure = 'propia' | 'arrendada' | 'comodato' | 'compartida' | 'otra';
export type EntityKind = 'publica' | 'privada';
export type EntityOrder = 'nacional' | 'territorial';
/** Energético. Un registro sin `carrier` es electricidad. */
export type EnergyCarrier = 'electricidad' | 'gas-natural' | 'glp' | 'otro';
/** Variables relevantes de la línea base de la Res. UPME 016 de 2024 (§7.3) y modelos que propone (§7.4). */
export type UpmeVariable = 'personas' | 'horasPractica' | 'gde' | 'diasHabiles' | 'temperatura' | 'ocupacion';
export type UpmeModelKind = 'valor-absoluto' | 'cociente' | 'estadistico';
/** Cómo se usa un equipo. Un equipo sin régimen se trata como `horario`. */
export type UsageRegime = 'continuo' | 'horario' | 'ciclos' | 'respaldo';
/** Clase de potencial de ahorro del art. 4(d) de la Res. 40412. */
export type SavingsType = 'bpo' | 'cambio-tecnologico' | 'sustitucion-energetico' | 'fncer' | 'pasiva';
/** Factores de riesgo eléctrico del RETIE (art. 1.5.1.3). */
export type RetieRiskFactor =
  | 'arcos'
  | 'ausencia-electricidad'
  | 'campos-electromagneticos'
  | 'contacto-directo'
  | 'contacto-indirecto'
  | 'cortocircuito'
  | 'electricidad-estatica'
  | 'equipo-defectuoso'
  | 'rayos'
  | 'sobrecarga'
  | 'tension-contacto'
  | 'tension-paso';

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
  /** Naturaleza de la entidad. Su nombre y su NIT son `client` y `nit`; la Res. 40412 de 2024 aplica a las entidades públicas. */
  entity?: { kind: EntityKind; order?: EntityOrder };
  /** Sede. El código único que pide la UPME lo define la propia entidad. */
  site?: { name?: string; upmeCode?: string };
  /** Caracterización del edificio (art. 4a): edad, pisos, actividad, entorno y tenencia. */
  building?: { builtYear?: number; floors?: number; activity?: string; surroundings?: string; tenure?: Tenure };
  /** Población fija y flotante. `users` se conserva: es lo que usan los indicadores por usuario. */
  population?: { students?: number; staff?: number; floating?: number };
  institutionalContact?: { name?: string; role?: string };
  /** Fecha del levantamiento en campo (AAAA-MM-DD). */
  surveyDate?: string;
  /** Fecha de la auditoría. Se repite cada cuatro años (Ley 1715, art. 30, modificado por la Ley 2294, art. 237). */
  audit?: { date?: string };
  /** Alcance y frontera de la auditoría; `fnce` dice cómo se trata el potencial de fuentes no convencionales. */
  scope?: { boundary?: string; objectives?: string; limitations?: string; fnce: 'potencial' | 'excluida'; fnceNote?: string };
  /** El auditor revisó la seguridad eléctrica y no encontró hallazgos. */
  safetyReviewed?: boolean;
  /** Decisiones del auditor sobre la línea base de la Res. UPME 016; sin ellas la app propone el modelo y usa todos los datos. */
  baseline?: BaselineConfig;
}

export interface BaselineConfig {
  model?: UpmeModelKind;
  /** Variable del modelo de cociente. */
  ratioVariable?: UpmeVariable;
  /** Variables candidatas del modelo estadístico. */
  variables?: UpmeVariable[];
  /** Primer y último mes del periodo base (AAAA-MM); sin ellos, todas las facturas. */
  from?: string;
  to?: string;
  /** Justificación de un periodo base de menos de 36 meses (§7.2) o de la exclusión de meses. */
  note?: string;
  /** Conservar los datos que quedan fuera de la banda de ±10 % (por omisión se eliminan, §7.5.1). */
  keepOutliers?: boolean;
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
  /** Código legible del espacio (el `id` es interno). */
  code?: string;
  /** Piso o nivel, p. ej. «1» o «Sótano». */
  floor?: string;
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
  /** Energético del equipo; ausente = electricidad. Para gas, `powerKw` es la potencia térmica. */
  carrier?: EnergyCarrier;
  /** Régimen de uso; ausente = `horario`. */
  regime?: UsageRegime;
  /** No puede apagarse (p. ej. conservación de muestras): se excluye de las medidas de apagado. */
  nonInterruptible?: boolean;
  nonInterruptibleReason?: string;
  voltageV?: number;
  currentA?: number;
  phases?: 1 | 2 | 3;
  /** «Modo de uso» del Formato 3. */
  usageMode?: string;
  /** Tipo de aire acondicionado y temperatura configurada (Formato 4). */
  acType?: string;
  setpointC?: number;
  /** Tipo de luminaria y control de la iluminación (Formato 5). */
  fixtureType?: string;
  lightControl?: 'manual' | 'sensor' | 'temporizador' | 'automatico' | 'otro';
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
  /** Frecuencia (Hz), energía registrada durante la medición (kWh), condición de carga en que se midió y responsable (Formato 7). */
  frequencyHz?: number;
  energyKwh?: number;
  condition?: string;
  responsible?: string;
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
  /** Energético de la factura; ausente = electricidad. */
  carrier?: EnergyCarrier;
  /** Cantidad facturada de un energético no eléctrico y su unidad; `kwh` guarda su equivalente en kWh. */
  quantity?: number;
  unit?: 'kWh' | 'm3' | 'kg' | 'gal';
  kwhPerUnit?: number;
  /** «Valor energía» (Formato 8); `costCop` sigue siendo el total de la factura. */
  energyCostCop?: number;
  /** Variables de la metodología de la UPME 016. */
  populationServed?: number;
  practiceHours?: number;
  coolingDegreeDays?: number;
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
  /** Se cuenta con la autorización para fotografiar (guía del Formato 10). */
  authorized?: boolean;
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
  /** Fecha, posible causa, impacto energético observado y acción sugerida (Formato 11). */
  foundAt?: string;
  cause?: string;
  energyImpact?: string;
  suggestedAction?: string;
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
  /** Clase de potencial (art. 4d). Si falta, se infiere de `kind`: operativa = buenas prácticas. */
  savingsType?: SavingsType;
  carrier?: EnergyCarrier;
  /** Consumo actual del sistema que la medida interviene (kWh/año, Formato 12). */
  currentConsumptionKwhYear?: number;
  /** Ítems de la medida para la plantilla 5 del reporte a la UPME. */
  items?: MeasureItem[];
  /** Formato 12: evidencia del problema, responsable, plazo e indicador de seguimiento de la medida. */
  evidence?: string;
  responsible?: string;
  deadline?: string;
  indicator?: string;
  notes?: string;
}

export interface MeasureItem {
  action: string;
  element?: string;
  brandModel?: string;
  reference?: string;
  quantity?: number;
  unit?: string;
  unitCostCop?: number;
  manufacturer?: string;
  supplier?: string;
  role?: string;
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
  /** Responsable designado para el seguimiento y la evaluación del PGEE (Res. 40412, art. 4, par. 3). */
  energyManager?: { name: string; role?: string; appointmentDoc?: string; appointmentDate?: string };
  /** Meta legal (Ley 1715, art. 30): al menos el 15 % del consumo del año anterior. */
  legalGoal?: { baseYear: number; previousYearKwh?: number; pct: number };
  /** Ruta de cumplimiento anual de ahorro. */
  annualRoute?: RouteYear[];
}

export interface RouteYear {
  year: number;
  targetKwh?: number;
  targetPct?: number;
  measureCodes: string[];
  budgetCop?: number;
  note?: string;
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
  /** Quién ejecuta la intervención. */
  executor?: TaskExecutor;
  works?: { interventionType: 'nueva' | 'ampliacion' | 'remodelacion' | 'mantenimiento' | 'reposicion'; startDate?: string; startProof?: 'acta' | 'contrato' | 'otro' };
  /** Verificación de cumplimiento del RETIE de la intervención. */
  retie?: RetieVerification;
  notes?: string;
}

export interface TaskExecutor {
  kind: 'persona' | 'empresa' | 'dependencia';
  name: string;
  role?: string;
  registry?: { body: 'CONTE' | 'COPNIA' | 'otra'; category?: string; number?: string };
}

export interface RetieDocument {
  kind: 'esquema-constructivo' | 'declaracion-cumplimiento' | 'dictamen-inspeccion' | 'certificado-producto' | 'otro';
  reference?: string;
  issuer?: string;
  date?: string;
  result?: 'cumple' | 'no-cumple';
}

export interface RetieVerification {
  applies: 'si' | 'no' | 'por-definir';
  documents: RetieDocument[];
  riskAnalysisDone?: boolean;
  commissioningNotes?: string;
  status: 'pendiente' | 'en-revision' | 'cumple' | 'no-cumple' | 'no-aplica';
  verifiedBy?: string;
  verifiedAt?: string;
}

/** Formato 6: horarios, uso y ocupación de un espacio en un periodo académico. */
export interface OccupancyRecord extends ProjectScoped {
  areaId: string;
  /** Periodo académico, p. ej. «2026-1». */
  term: string;
  activity: string;
  /** «L-V» o un día: L, M, X, J, V, S, D. */
  day: string;
  /** Hora de inicio y de fin (HH:mm). */
  start: string;
  end: string;
  /** Horas de uso del bloque. */
  hours: number;
  avgOccupants?: number;
  usesAc?: boolean;
  usesLighting?: boolean;
  notes?: string;
}

/** Formato 9: mantenimiento y condición de un equipo. */
export interface MaintenanceRecord extends ProjectScoped {
  equipmentId: string;
  type: 'preventivo' | 'correctivo' | 'predictivo' | 'ninguno';
  /** Fecha del último mantenimiento (AAAA-MM-DD). */
  lastAt?: string;
  frequency?: string;
  activities?: string;
  failures?: string;
  condition?: Condition;
  recommendation?: string;
  responsible?: string;
  notes?: string;
}

export type CollectionStatus = 'pendiente' | 'en-curso' | 'obtenido' | 'no-disponible';

/** Formato 13: control de recolección de la información. */
export interface CollectionItem extends ProjectScoped {
  /** Ítem estándar (general, planos, areas…) o `otro-…` si lo agregó el auditor. */
  key: string;
  label: string;
  responsible?: string;
  targetDate?: string;
  obtainedDate?: string;
  status: CollectionStatus;
  evidence?: string;
  notes?: string;
}

/** Hallazgo de seguridad eléctrica o SST. Va aparte de los hallazgos energéticos y no suma ahorros. */
export interface SafetyFinding extends ProjectScoped {
  foundAt: string;
  entityType?: EntityType;
  entityId?: string;
  riskFactor: RetieRiskFactor;
  /** Riesgo real o potencial. */
  real: boolean;
  /** Consecuencia (1 a 5) y frecuencia (a a e) de la matriz del RETIE (1.5.1.4.1). */
  consequence: 1 | 2 | 3 | 4 | 5;
  frequency: 'a' | 'b' | 'c' | 'd' | 'e';
  /** Alto riesgo o peligro inminente según los criterios del RETIE (1.5.1.4.2). */
  highRisk: boolean;
  imminent: boolean;
  description: string;
  immediateAction?: string;
  recommendedAction?: string;
  control?: 'eliminacion' | 'sustitucion' | 'ingenieria' | 'administrativo' | 'epp';
  responsible?: string;
  dueDate?: string;
  status: 'abierto' | 'en-control' | 'cerrado';
  normRef?: string;
  taskId?: string;
  /** Sugerido por las reglas automáticas y adoptado por el auditor. */
  auto: boolean;
  ruleId?: string;
}

/** Ajuste o actualización de la línea base (UPME 016, §7.6): queda documentado para poder verificar los ahorros. */
export interface BaselineAdjustment extends ProjectScoped {
  carrier: EnergyCarrier;
  kind: 'rutinario' | 'no-rutinario' | 'actualizacion';
  date: string;
  cause: string;
  /** Meses afectados (AAAA-MM). */
  months?: string[];
  kwhEffect?: number;
  notes?: string;
  /** Ajuste no rutinario del periodo base (Anexo 4, A4.1): los meses afectados se corrigen en el cálculo de la línea base. */
  applied?: boolean;
}

/** Ciclo de reporte de una auditoría a la UPME. */
export interface UpmeCycle extends ProjectScoped {
  year: number;
  caseNumber?: string;
  filedAt?: string;
  concept?: { at?: string; result?: string; note?: string };
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
