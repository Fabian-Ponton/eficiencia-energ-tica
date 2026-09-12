import { floorAreaOf, roomIndexOf } from './areas';
import { loadingLevel, singlePhaseCurrentA, threePhaseCurrentA, type LoadingLevel } from './calc/sizing/capacity';
import { coolingAdequacy, coolingLoad, type CoolingAdequacy, type CoolingLoadResult } from './calc/sizing/cooling';
import { achievedLux, lightingStatus, luminairesRequired, type LightingStatus } from './calc/sizing/lighting';
import { COMMERCIAL_SIZES_BTU_H, nearestCommercialSize } from './calc/solutions/hvac';
import { sum } from './calc/stats';
import { SPACE_TYPES, spaceTypeOf } from './catalogs';
import { descendantIds, electricalRows } from './electrical';
import { derivePower, imbalanceLevel, type ImbalanceLevel } from './measurements';
import type { Area, Bill, ElectricalNode, Equipment, IntervalSeries, Measurement, Orientation, SizingOverrides } from './types';

/**
 * Dimensionamiento de la auditoría: climatización e iluminación de cada espacio y carga del sistema eléctrico
 * frente a su capacidad. Los parámetros por defecto son orientativos: el auditor los valida con el RETILAP,
 * el RETIE y su criterio, y los cambia por proyecto.
 */

// ——— Parámetros de referencia ———

export interface SpaceReference {
  /** Iluminancia mantenida requerida (lux). */
  lux: number;
  /** Carga de envolvente, ventilación e infiltración (BTU/h por m²). 0: espacio sin climatización. */
  envelopeBtuHPerM2: number;
  /** Valor límite de eficiencia energética de la iluminación (W/m² por cada 100 lux). */
  veeiLimit: number;
}

export interface SizingParameters {
  spaces: Record<string, SpaceReference>;
  /** Calor sensible y latente por persona (BTU/h). */
  btuHPerPerson: number;
  /** Carga adicional de un techo expuesto al sol (BTU/h por m²). */
  roofExtraBtuHPerM2: number;
  /** Ganancia solar por m² de ventana según su orientación (BTU/h). */
  solarBtuHPerM2: Record<Orientation, number>;
  /** Factor de seguridad de la carga térmica (0,1 = 10 %). */
  safetyFactor: number;
  /** Instalado/requerido por debajo del cual el aire queda corto, y por encima del cual sobra. */
  coolingUnder: number;
  coolingOver: number;
  /** Tolerancia bajo la iluminancia requerida y factor desde el que la iluminación es excesiva. */
  lightingTolerance: number;
  lightingExcess: number;
  /** Factor de mantenimiento del método de los lúmenes. */
  maintenanceFactor: number;
  /** Carga del transformador: alta desde `loadingHigh` y crítica sobre `loadingCritical`. */
  loadingHigh: number;
  loadingCritical: number;
  /** Carga continua máxima de una protección como fracción de su capacidad (criterio del 80 %). */
  breakerCriterion: number;
  /** Factor de demanda para estimar la demanda con la carga instalada cuando no hay medición. */
  demandFactor: number;
  /** Factor de potencia supuesto cuando no hay medición ni facturas con reactiva. */
  defaultPowerFactor: number;
}

export type GlobalSizingKey = Exclude<keyof SizingParameters, 'spaces' | 'solarBtuHPerM2'>;

/** Carga de envolvente y límite VEEI por tipo de espacio; la iluminancia sale del catálogo de espacios. */
const SPACE_DEFAULTS: Record<string, { envelope: number; veei: number }> = {
  aula: { envelope: 300, veei: 3.5 },
  laboratorio: { envelope: 300, veei: 3.5 },
  'sala-computo': { envelope: 300, veei: 3.5 },
  oficina: { envelope: 300, veei: 3 },
  'sala-reuniones': { envelope: 300, veei: 3 },
  biblioteca: { envelope: 300, veei: 3.5 },
  auditorio: { envelope: 300, veei: 4 },
  cafeteria: { envelope: 350, veei: 6 },
  cocina: { envelope: 400, veei: 4 },
  circulacion: { envelope: 200, veei: 4 },
  bano: { envelope: 200, veei: 4 },
  bodega: { envelope: 200, veei: 4 },
  'cuarto-tecnico': { envelope: 300, veei: 4 },
  exterior: { envelope: 0, veei: 5 },
  otro: { envelope: 300, veei: 4 },
};

export const SIZING_DEFAULTS: Omit<SizingParameters, 'spaces'> = {
  btuHPerPerson: 450,
  roofExtraBtuHPerM2: 120,
  solarBtuHPerM2: { N: 300, S: 500, E: 700, O: 800 },
  safetyFactor: 0.1,
  coolingUnder: 0.9,
  coolingOver: 1.15,
  lightingTolerance: 0.1,
  lightingExcess: 1.5,
  maintenanceFactor: 0.8,
  loadingHigh: 0.6,
  loadingCritical: 0.8,
  breakerCriterion: 0.8,
  demandFactor: 0.6,
  defaultPowerFactor: 0.9,
};

export function defaultSpaceReference(spaceType: string): SpaceReference {
  const d = SPACE_DEFAULTS[spaceType] ?? SPACE_DEFAULTS.otro;
  return { lux: spaceTypeOf(spaceType)?.lux ?? 300, envelopeBtuHPerM2: d.envelope, veeiLimit: d.veei };
}

/** Solo los valores numéricos válidos reemplazan a los de por defecto. */
const numbers = <T extends object>(values?: T): Partial<T> =>
  Object.fromEntries(Object.entries(values ?? {}).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))) as Partial<T>;

/** Parámetros del proyecto: los que cambió el auditor sobre los valores por defecto. */
export function resolveSizing(overrides: SizingOverrides = {}): SizingParameters {
  const { spaces: spaceOverrides, solarBtuHPerM2, ...global } = overrides;
  const spaces: Record<string, SpaceReference> = {};
  for (const type of SPACE_TYPES) spaces[type.id] = { ...defaultSpaceReference(type.id), ...numbers(spaceOverrides?.[type.id]) };
  return {
    ...SIZING_DEFAULTS,
    ...numbers(global),
    solarBtuHPerM2: { ...SIZING_DEFAULTS.solarBtuHPerM2, ...numbers(solarBtuHPerM2) },
    spaces,
  };
}

export const spaceReference = (params: SizingParameters, spaceType?: string): SpaceReference =>
  params.spaces[spaceType ?? 'otro'] ?? params.spaces.otro ?? defaultSpaceReference('otro');

// ——— Climatización ———

export type CoolingStatus = CoolingAdequacy | 'sin-aire';

export interface AreaCooling {
  area: Area;
  areaM2: number;
  load: CoolingLoadResult;
  requiredBtuH: number;
  installedBtuH: number;
  /** Unidades de aire asignadas al espacio. */
  units: number;
  ratio: number | null;
  status: CoolingStatus;
  /** Instalado menos requerido: positivo si sobra capacidad. */
  marginBtuH: number;
  /** Unidades comerciales iguales que cubren toda la carga del espacio. */
  suggestion: { count: number; sizeBtuH: number };
}

/** Una unidad comercial si alcanza; si no, varias iguales de la capacidad necesaria. */
export function commercialUnits(btuH: number, sizes: readonly number[] = COMMERCIAL_SIZES_BTU_H): { count: number; sizeBtuH: number } {
  const largest = sizes[sizes.length - 1];
  const count = Math.max(1, Math.ceil(btuH / largest - 1e-9));
  return { count, sizeBtuH: nearestCommercialSize(btuH / count, sizes) };
}

const LIGHTING = 'iluminacion';
const COOLING = 'climatizacion';

/**
 * Carga térmica simplificada del espacio frente a la capacidad de los aires asignados a él.
 * `null` si el espacio no tiene área o su tipo no se climatiza.
 */
export function areaCooling(area: Area, equipment: readonly Equipment[], params: SizingParameters): AreaCooling | null {
  const areaM2 = floorAreaOf(area);
  const ref = spaceReference(params, area.spaceType);
  if (!areaM2 || ref.envelopeBtuHPerM2 <= 0) return null;
  const inArea = equipment.filter((e) => e.areaId === area.id);
  const lightingW = sum(inArea.filter((e) => e.category === LIGHTING).map((e) => e.powerKw * e.quantity * 1000));
  const equipmentW = sum(
    inArea.filter((e) => e.category !== LIGHTING && e.category !== COOLING).map((e) => e.powerKw * e.quantity * (e.useFactor ?? 1) * 1000),
  );
  const units = inArea.filter((e) => e.category === COOLING && (e.capacityBtuH ?? 0) > 0);
  const installedBtuH = sum(units.map((e) => (e.capacityBtuH ?? 0) * e.quantity));
  // Sin orientación registrada se usa el promedio de las cuatro
  const solar = area.windowOrientation ? params.solarBtuHPerM2[area.windowOrientation] : sum(Object.values(params.solarBtuHPerM2)) / 4;
  const load = coolingLoad({
    areaM2,
    envelopeBtuHPerM2: ref.envelopeBtuHPerM2 + (area.roofExposed ? params.roofExtraBtuHPerM2 : 0),
    people: area.occupants ?? 0,
    btuHPerPerson: params.btuHPerPerson,
    lightingW,
    equipmentW,
    windowAreaM2: area.windowAreaM2,
    solarBtuHPerM2: solar,
    safetyFactor: params.safetyFactor,
  });
  const adequacy = installedBtuH > 0 ? coolingAdequacy(load.totalBtuH, installedBtuH, { under: params.coolingUnder, over: params.coolingOver }) : null;
  return {
    area,
    areaM2,
    load,
    requiredBtuH: load.totalBtuH,
    installedBtuH,
    units: sum(units.map((e) => e.quantity)),
    ratio: adequacy?.ratio ?? null,
    status: adequacy?.status ?? 'sin-aire',
    marginBtuH: installedBtuH - load.totalBtuH,
    suggestion: commercialUnits(load.totalBtuH),
  };
}

// ——— Iluminación ———

/**
 * Coeficiente de utilización orientativo según el índice del local, para luminarias de distribución directa
 * y reflectancias de techo, paredes y piso de 0,7 / 0,5 / 0,2. Para un cálculo fino, usar la tabla del fabricante.
 */
const CU_TABLE: readonly [k: number, cu: number][] = [
  [0.6, 0.35],
  [0.8, 0.42],
  [1, 0.47],
  [1.25, 0.52],
  [1.5, 0.56],
  [2, 0.61],
  [2.5, 0.65],
  [3, 0.68],
  [4, 0.72],
  [5, 0.74],
];

export function utilizationFactor(roomIndex: number): number {
  if (roomIndex <= CU_TABLE[0][0]) return CU_TABLE[0][1];
  for (let i = 1; i < CU_TABLE.length; i++) {
    const [k1, u1] = CU_TABLE[i];
    if (roomIndex <= k1) {
      const [k0, u0] = CU_TABLE[i - 1];
      return u0 + ((u1 - u0) * (roomIndex - k0)) / (k1 - k0);
    }
  }
  return CU_TABLE[CU_TABLE.length - 1][1];
}

/** Luminaria de referencia cuando no se registró el flujo luminoso: panel LED de 40 W y 4.000 lm. */
export const REFERENCE_LUMINAIRE = { watts: 40, lumens: 4000 } as const;

export interface AreaLighting {
  area: Area;
  areaM2: number;
  requiredLux: number;
  roomIndex: number;
  /** Índice del local supuesto (1,0) porque el espacio es irregular o no tiene alto. */
  roomIndexAssumed: boolean;
  utilization: number;
  installed: { count: number; watts: number; lumensEach: number | null };
  /** Luminarias que pide el método de los lúmenes con el flujo de las instaladas o de la luminaria de referencia. */
  required: { exact: number; count: number };
  lumensBasis: number;
  lumensAssumed: boolean;
  /** Iluminancia media que dan las luminarias instaladas según el método de los lúmenes. */
  calculatedLux: number | null;
  measuredLux: number | null;
  /** Iluminancia con la que se califica: la medida o, si no hay, la calculada. */
  lux: number | null;
  basis: 'medido' | 'calculado' | null;
  status: LightingStatus | null;
  /** Densidad de potencia instalada (W/m²). */
  lpd: number | null;
  /** Valor de eficiencia energética de la instalación: W/m² por cada 100 lux. */
  veei: number | null;
  veeiLimit: number;
  veeiOk: boolean | null;
}

export function areaLighting(area: Area, equipment: readonly Equipment[], params: SizingParameters): AreaLighting | null {
  const areaM2 = floorAreaOf(area);
  if (!areaM2) return null;
  const ref = spaceReference(params, area.spaceType);
  const lights = equipment.filter((e) => e.areaId === area.id && e.category === LIGHTING);
  const count = sum(lights.map((e) => e.quantity));
  const watts = sum(lights.map((e) => e.powerKw * e.quantity * 1000));
  const withLumens = lights.filter((e) => (e.lumens ?? 0) > 0);
  const lumensCount = sum(withLumens.map((e) => e.quantity));
  const lumensEach = lumensCount ? sum(withLumens.map((e) => (e.lumens ?? 0) * e.quantity)) / lumensCount : null;
  const k = roomIndexOf(area);
  const roomIndex = k ?? 1;
  const utilization = utilizationFactor(roomIndex);
  const lumensBasis = lumensEach ?? REFERENCE_LUMINAIRE.lumens;
  const base = { areaM2, lumensPerLuminaire: lumensBasis, utilizationFactor: utilization, maintenanceFactor: params.maintenanceFactor };
  const required = luminairesRequired({ ...base, targetLux: ref.lux });
  const calculatedLux = count && lumensEach ? achievedLux(count, base) : null;
  const measuredLux = area.measuredLuxAvg ?? null;
  const lux = measuredLux ?? calculatedLux;
  const status = lux !== null && ref.lux > 0 ? lightingStatus(lux, ref.lux, { tolerance: params.lightingTolerance, excessFactor: params.lightingExcess }) : null;
  const veei = watts && lux ? (watts * 100) / (areaM2 * lux) : null;
  return {
    area,
    areaM2,
    requiredLux: ref.lux,
    roomIndex,
    roomIndexAssumed: k === null,
    utilization,
    installed: { count, watts, lumensEach },
    required,
    lumensBasis,
    lumensAssumed: lumensEach === null,
    calculatedLux,
    measuredLux,
    lux,
    basis: measuredLux !== null ? 'medido' : calculatedLux !== null ? 'calculado' : null,
    status,
    lpd: watts ? watts / areaM2 : null,
    veei,
    veeiLimit: ref.veeiLimit,
    veeiOk: veei === null ? null : veei <= ref.veeiLimit + 1e-9,
  };
}

export interface LuminaireGrid {
  cols: number;
  rows: number;
  /** Posición de cada luminaria en metros desde la esquina del local. */
  points: { x: number; y: number }[];
}

/**
 * Distribución uniforme de `count` luminarias en un local de `lengthM` × `widthM`: elige filas y columnas
 * con separaciones parecidas en los dos sentidos y pocos puestos vacíos; la última fila se reparte a lo ancho.
 */
export function luminaireGrid(count: number, lengthM: number, widthM: number): LuminaireGrid {
  if (count <= 0 || lengthM <= 0 || widthM <= 0) return { cols: 0, rows: 0, points: [] };
  let best = { cols: count, rows: 1, score: Number.POSITIVE_INFINITY };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    if (cols * (rows - 1) >= count) continue;
    const score = Math.abs(lengthM / cols - widthM / rows) / Math.max(lengthM, widthM) + 0.15 * (cols * rows - count);
    if (score < best.score - 1e-9) best = { cols, rows, score };
  }
  const points: { x: number; y: number }[] = [];
  for (let r = 0; r < best.rows; r++) {
    const inRow = r === best.rows - 1 ? count - best.cols * (best.rows - 1) : best.cols;
    for (let c = 0; c < inRow; c++) points.push({ x: ((c + 0.5) * lengthM) / inRow, y: ((r + 0.5) * widthM) / best.rows });
  }
  return { cols: best.cols, rows: best.rows, points };
}

// ——— Capacidad del sistema eléctrico ———

export type DemandBasis = 'analizador' | 'factura' | 'medido' | 'instalado';

export interface FacilityDemand {
  /** Demanda máxima (kW) y de dónde sale. */
  kw: number;
  basis: DemandBasis;
  /** Texto corto de la fuente: nombre de la serie, periodo de la factura o punto medido. */
  source: string;
  pf: number;
  pfBasis: 'medido' | 'factura' | 'supuesto';
  kva: number;
  /** Carga instalada de todo el inventario (kW). */
  installedKw: number;
}

export interface NodeCheck {
  node: ElectricalNode;
  /** kVA en transformadores; amperios en acometidas, tableros y circuitos. */
  unit: 'kVA' | 'A';
  load: number;
  capacity: number;
  ratio: number;
  level: LoadingLevel;
  basis: DemandBasis;
  /** Carga instalada de los equipos asignados a este elemento o a lo que alimenta (kW). */
  installedKw: number;
  /** Corriente medida en cada fase, si hay medición en el elemento. */
  phaseCurrents?: number[];
}

export interface ImbalanceRow {
  measurement: Measurement;
  point: string;
  currents: number[];
  average: number;
  imbalance: number;
  level: ImbalanceLevel;
}

export interface CapacityInput {
  nodes: readonly ElectricalNode[];
  equipment: readonly Equipment[];
  measurements: readonly Measurement[];
  bills: readonly Bill[];
  series: readonly IntervalSeries[];
  areas?: readonly Area[];
  params: SizingParameters;
}

export interface CapacityResult {
  facility: FacilityDemand | null;
  checks: NodeCheck[];
  byNode: Map<string, NodeCheck>;
  /** Elementos que se podrían verificar pero no tienen su capacidad registrada. */
  missingCapacity: ElectricalNode[];
  imbalance: ImbalanceRow[];
}

const validNumbers = (values?: (number | null)[]) => (values ?? []).filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
const byNewest = (a: Measurement, b: Measurement) => b.takenAt.localeCompare(a.takenAt);

/** Factor de potencia de las facturas de los últimos 12 meses con energía reactiva registrada. */
export function billedPowerFactor(bills: readonly Bill[]): number | null {
  const recent = [...bills].sort((a, b) => a.period.localeCompare(b.period)).slice(-12).filter((b) => b.kvarh !== undefined && b.kwh > 0);
  if (!recent.length) return null;
  const kwh = sum(recent.map((b) => b.kwh));
  const kvarh = sum(recent.map((b) => b.kvarh ?? 0));
  return kwh / Math.hypot(kwh, kvarh);
}

/** Corriente de línea para una potencia aparente según las fases y la tensión del elemento. */
function currentFor(kva: number, node: ElectricalNode, fallbackV: number): number {
  const volts = node.voltageV ?? fallbackV;
  return (node.phases ?? 3) === 3 ? threePhaseCurrentA(kva, volts) : singlePhaseCurrentA(kva, volts);
}

/** Tensión secundaria del transformador: «208/120 V» → 208. */
const secondaryVolts = (node?: ElectricalNode) => (node?.secondaryV ? Number.parseFloat(node.secondaryV.replace(',', '.')) || undefined : undefined);

export function capacityAnalysis(input: CapacityInput): CapacityResult {
  const { nodes, equipment, measurements, bills, series, params } = input;
  const rows = electricalRows(nodes);
  const depthOf = new Map(rows.map((r) => [r.node.id, r.depth]));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, ElectricalNode[]>();
  for (const n of nodes) if (n.parentId && nodeById.has(n.parentId)) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);

  const subtreeIds = (id: string) => new Set([id, ...descendantIds(nodes, id)]);
  const installedUnder = (ids: Set<string>) => sum(equipment.filter((e) => e.panelId && ids.has(e.panelId)).map((e) => e.powerKw * e.quantity));
  const installedKw = sum(equipment.map((e) => e.powerKw * e.quantity));

  // Medición más reciente de cada tablero o elemento
  const latest = new Map<string, Measurement>();
  for (const m of [...measurements].sort(byNewest)) if (m.pointType === 'tablero' && m.pointId && !latest.has(m.pointId)) latest.set(m.pointId, m);
  const topMeasured = [...latest.entries()]
    .filter(([id]) => depthOf.has(id))
    .sort(([a], [b]) => (depthOf.get(a) ?? 0) - (depthOf.get(b) ?? 0))[0];
  const general = measurements.filter((m) => m.pointType === 'general').sort(byNewest)[0];
  const topMeasurement = general ?? topMeasured?.[1];

  // Demanda de la instalación: la mayor de las fuentes medidas (analizador, facturas, medición puntual)
  const candidates: { kw: number; basis: DemandBasis; source: string }[] = [];
  for (const s of series) if (s.wholeFacility && s.peakKw) candidates.push({ kw: s.peakKw, basis: 'analizador', source: s.name });
  const recentBills = [...bills].sort((a, b) => a.period.localeCompare(b.period)).slice(-12);
  const maxBill = recentBills.filter((b) => b.demandKw).sort((a, b) => (b.demandKw ?? 0) - (a.demandKw ?? 0))[0];
  if (maxBill?.demandKw) candidates.push({ kw: maxBill.demandKw, basis: 'factura', source: maxBill.period });
  const measuredKw = topMeasurement ? derivePower(topMeasurement).kw : null;
  if (topMeasurement && measuredKw) {
    const name = topMeasurement.pointType === 'general' ? 'Medición general' : (nodeById.get(topMeasurement.pointId ?? '')?.name ?? 'Medición');
    candidates.push({ kw: measuredKw, basis: 'medido', source: name });
  }
  const measuredPf = topMeasurement ? derivePower(topMeasurement).pf : null;
  const billPf = billedPowerFactor(bills);
  const pf = measuredPf ?? billPf ?? params.defaultPowerFactor;
  const pfBasis = measuredPf !== null ? 'medido' : billPf !== null ? 'factura' : 'supuesto';
  const best = candidates.sort((a, b) => b.kw - a.kw)[0];
  const facility: FacilityDemand | null =
    best || installedKw
      ? {
          ...(best ?? { kw: installedKw * params.demandFactor, basis: 'instalado' as const, source: `${Math.round(params.demandFactor * 100)} % de la carga instalada` }),
          pf,
          pfBasis,
          kva: (best?.kw ?? installedKw * params.demandFactor) / pf,
          installedKw,
        }
      : null;

  // Camino principal: del origen hasta el primer elemento que se ramifica; lleva toda la carga
  const roots = rows.filter((r) => r.depth === 0).map((r) => r.node);
  const mainPath = new Set<string>();
  const transformers = nodes.filter((n) => n.kind === 'transformador');
  if (roots.length === 1 && transformers.length <= 1) {
    let current: ElectricalNode | undefined = roots[0];
    while (current) {
      mainPath.add(current.id);
      const kids: ElectricalNode[] = children.get(current.id) ?? [];
      current = kids.length === 1 ? kids[0] : undefined;
    }
  }

  const baseVolts = secondaryVolts(transformers[0]) ?? 208;
  const checks: NodeCheck[] = [];
  const missingCapacity: ElectricalNode[] = [];
  for (const { node } of rows) {
    const ids = subtreeIds(node.id);
    const underKw = installedUnder(ids);
    const measured = latest.get(node.id);
    const currents = measured ? validNumbers(measured.currentA).slice(0, measured.phases ?? 3) : [];
    const onMainPath = mainPath.has(node.id) && facility !== null;

    if (node.kind === 'transformador') {
      if (!node.ratedKva) {
        missingCapacity.push(node);
        continue;
      }
      const measuredHere = [...ids].map((id) => latest.get(id)).find(Boolean);
      const kva = onMainPath && facility ? facility.kva : measuredHere ? (derivePower(measuredHere).kva ?? 0) : (underKw * params.demandFactor) / pf;
      const basis: DemandBasis = onMainPath && facility ? facility.basis : measuredHere ? 'medido' : 'instalado';
      const ratio = kva / node.ratedKva;
      checks.push({
        node,
        unit: 'kVA',
        load: kva,
        capacity: node.ratedKva,
        ratio,
        level: loadingLevel(ratio, { high: params.loadingHigh, critical: params.loadingCritical }),
        basis,
        installedKw: onMainPath ? installedKw : underKw,
      });
      continue;
    }

    const capacity = node.kind === 'acometida' ? node.ampacityA : node.kind === 'tablero' || node.kind === 'circuito' ? node.breakerA : undefined;
    if (node.kind !== 'acometida' && node.kind !== 'tablero' && node.kind !== 'circuito') continue;
    const relevant = onMainPath || currents.length > 0 || underKw > 0;
    if (!relevant) continue;
    if (!capacity) {
      missingCapacity.push(node);
      continue;
    }
    const measuredI = currents.length ? Math.max(...currents) : null;
    const demandI = onMainPath && facility ? currentFor(facility.kva, node, baseVolts) : null;
    // Un circuito ramal alimenta pocas cargas que trabajan juntas: sin factor de demanda
    const diversity = node.kind === 'circuito' ? 1 : params.demandFactor;
    const installedI = underKw > 0 ? currentFor((underKw * diversity) / pf, node, baseVolts) : null;
    let load: number;
    let basis: DemandBasis;
    if (demandI !== null && (measuredI === null || demandI >= measuredI)) {
      load = demandI;
      basis = facility?.basis ?? 'instalado';
    } else if (measuredI !== null) {
      load = measuredI;
      basis = 'medido';
    } else {
      load = installedI ?? 0;
      basis = 'instalado';
    }
    const ratio = load / capacity;
    checks.push({
      node,
      unit: 'A',
      load,
      capacity,
      ratio,
      level: loadingLevel(ratio, { high: params.loadingHigh, critical: params.breakerCriterion }),
      basis,
      installedKw: onMainPath ? installedKw : underKw,
      phaseCurrents: currents.length ? currents : undefined,
    });
  }

  // Desbalance de corrientes: la medición trifásica más reciente de cada punto
  const areaById = new Map((input.areas ?? []).map((a) => [a.id, a.name]));
  const equipmentById = new Map(equipment.map((e) => [e.id, e.name]));
  const pointName = (m: Measurement) =>
    m.pointType === 'tablero'
      ? (nodeById.get(m.pointId ?? '')?.name ?? 'Tablero')
      : m.pointType === 'equipo'
        ? (equipmentById.get(m.pointId ?? '') ?? 'Equipo')
        : m.pointType === 'area'
          ? (areaById.get(m.pointId ?? '') ?? 'Espacio')
          : 'Medición general';
  const seen = new Set<string>();
  const imbalance: ImbalanceRow[] = [];
  for (const m of [...measurements].sort(byNewest)) {
    const key = `${m.pointType}:${m.pointId ?? ''}`;
    if (seen.has(key)) continue;
    const derived = derivePower(m);
    if (derived.imbalance === null) continue;
    seen.add(key);
    const currents = validNumbers(m.currentA).slice(0, 3);
    imbalance.push({
      measurement: m,
      point: pointName(m),
      currents,
      average: sum(currents) / currents.length,
      imbalance: derived.imbalance,
      level: imbalanceLevel(derived.imbalance),
    });
  }

  return { facility, checks, byNode: new Map(checks.map((c) => [c.node.id, c])), missingCapacity, imbalance };
}
