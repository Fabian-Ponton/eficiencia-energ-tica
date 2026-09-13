import { annualEnergyKwh } from '@/domain/calc/equipment';
import { CONDITIONS, electricalKindOf, endUseOf, spaceTypeOf } from '@/domain/catalogs';
import { FINDING_STATUS_LABEL, findingTopicLabel, SEVERITY_LABEL } from '@/domain/diagnosis';
import { MEASURE_KIND_LABEL, measureEconomics, PRIORITY_LABEL } from '@/domain/measures';
import { derivePower } from '@/domain/measurements';
import type { CsvColumn } from './csv';
import type { AuditModel } from './model';

/**
 * Tablas que se exportan a CSV y a Excel: los registros del levantamiento, los resultados del análisis
 * y el plan (hallazgos y medidas). Los números van sin formato (el CSV y el Excel les dan el suyo);
 * los textos, ya legibles.
 */
export interface ExportTable {
  id: string;
  /** Nombre de la hoja de Excel (máximo 31 caracteres) y del archivo CSV. */
  title: string;
  columns: CsvColumn<never>[];
  rows: unknown[];
}

/** Arma una tabla con tipos: las filas y las columnas del mismo registro. */
function table<T>(id: string, title: string, rows: readonly T[], columns: CsvColumn<T>[]): ExportTable {
  return { id, title, rows: [...rows], columns: columns as unknown as CsvColumn<never>[] };
}

const LOADING = { normal: 'Normal', alta: 'Alta', critica: 'Crítica' } as const;
const COOLING = { adecuado: 'Adecuada', subdimensionado: 'Insuficiente', sobredimensionado: 'Sobredimensionada', 'sin-aire': 'Sin aire' } as const;
const LIGHTING = { adecuada: 'Adecuada', insuficiente: 'Insuficiente', excesiva: 'Excesiva' } as const;
const BASIS = { analizador: 'Analizador', factura: 'Factura', medido: 'Medido', instalado: 'Estimado' } as const;
const POINT = { general: 'General', area: 'Espacio', equipo: 'Equipo', tablero: 'Tablero' } as const;

const finite = (value: number | null | undefined) => (value === null || value === undefined || !Number.isFinite(value) ? null : value);

export function exportTables(m: AuditModel): ExportTable[] {
  const { data } = m;
  const areaName = new Map(data.areas.map((a) => [a.id, a.name]));
  const nodeName = new Map(data.electrical.map((n) => [n.id, n.name]));
  const equipmentName = new Map(data.equipment.map((e) => [e.id, e.name]));
  const findingTitle = new Map(data.findings.map((f) => [f.id, f.title]));
  const economics = new Map(data.measures.map((x) => [x.id, measureEconomics(x, data.project.economics)]));
  const pointName = (type: string, id?: string) =>
    type === 'general' ? 'General' : ((type === 'tablero' ? nodeName : type === 'area' ? areaName : equipmentName).get(id ?? '') ?? '');
  const phase = (values: (number | null)[] | undefined, i: number) => values?.[i] ?? null;

  return [
    table('inventario', 'Inventario', data.equipment, [
      { header: 'Código', value: (e) => e.code },
      { header: 'Equipo', value: (e) => e.name },
      { header: 'Uso final', value: (e) => endUseOf(e.category).label },
      { header: 'Espacio', value: (e) => (e.areaId ? areaName.get(e.areaId) : '') },
      { header: 'Tablero o circuito', value: (e) => (e.panelId ? nodeName.get(e.panelId) : '') },
      { header: 'Potencia unitaria (kW)', value: (e) => e.powerKw, decimals: 3 },
      { header: 'Cantidad', value: (e) => e.quantity },
      { header: 'Potencia instalada (kW)', value: (e) => e.powerKw * e.quantity, decimals: 2 },
      { header: 'Horas por día', value: (e) => e.hoursPerDay, decimals: 1 },
      { header: 'Factor de uso', value: (e) => e.useFactor, decimals: 2 },
      { header: 'Días por mes', value: (e) => e.operatingDaysPerMonth },
      { header: 'Energía anual (kWh)', value: (e) => annualEnergyKwh(e, e.operatingDaysPerMonth), decimals: 0 },
      { header: 'Estado', value: (e) => CONDITIONS.find((c) => c.id === e.condition)?.label },
      { header: 'Capacidad (BTU/h)', value: (e) => e.capacityBtuH },
      { header: 'EER', value: (e) => e.eer, decimals: 1 },
      { header: 'Lúmenes', value: (e) => e.lumens },
      { header: 'Tipo de lámpara', value: (e) => e.lampType },
      { header: 'Año', value: (e) => e.year },
      { header: 'Observaciones', value: (e) => e.notes },
    ]),
    table('facturas', 'Facturas', data.bills, [
      { header: 'Periodo', value: (b) => b.period },
      { header: 'Desde', value: (b) => b.startDate },
      { header: 'Hasta', value: (b) => b.endDate },
      { header: 'Días facturados', value: (b) => b.days },
      { header: 'Energía (kWh)', value: (b) => b.kwh },
      { header: 'Reactiva (kvarh)', value: (b) => b.kvarh },
      { header: 'Demanda (kW)', value: (b) => b.demandKw, decimals: 1 },
      { header: 'Valor (COP)', value: (b) => b.costCop },
      { header: 'Tarifa (COP/kWh)', value: (b) => b.tariffCopPerKwh ?? (b.kwh ? b.costCop / b.kwh : null), decimals: 2 },
      { header: 'Cobro por reactiva (COP)', value: (b) => b.reactiveChargeCop },
      { header: 'Días hábiles', value: (b) => b.workingDays },
      { header: 'Temperatura media (°C)', value: (b) => b.avgTemperatureC, decimals: 1 },
      { header: 'Ocupación (%)', value: (b) => b.occupancyPct },
      { header: 'Observaciones', value: (b) => b.notes },
    ]),
    table('espacios', 'Espacios', data.areas, [
      { header: 'Espacio', value: (a) => a.name },
      { header: 'Tipo', value: (a) => spaceTypeOf(a.spaceType)?.label },
      { header: 'Largo (m)', value: (a) => a.lengthM, decimals: 2 },
      { header: 'Ancho (m)', value: (a) => a.widthM, decimals: 2 },
      { header: 'Alto (m)', value: (a) => a.heightM, decimals: 2 },
      { header: 'Área (m²)', value: (a) => (a.lengthM && a.widthM ? a.lengthM * a.widthM : a.areaM2), decimals: 1 },
      { header: 'Personas', value: (a) => a.occupants },
      { header: 'Horas por día', value: (a) => a.hoursPerDay, decimals: 1 },
      { header: 'Ventanas (m²)', value: (a) => a.windowAreaM2, decimals: 1 },
      { header: 'Orientación', value: (a) => a.windowOrientation },
      { header: 'Iluminancia medida (lx)', value: (a) => a.measuredLuxAvg },
      { header: 'Iluminancia mínima (lx)', value: (a) => a.measuredLuxMin },
      { header: 'Observaciones', value: (a) => a.notes },
    ]),
    table('sistema-electrico', 'Sistema eléctrico', data.electrical, [
      { header: 'Tipo', value: (n) => electricalKindOf(n.kind).label },
      { header: 'Elemento', value: (n) => n.name },
      { header: 'Alimentado por', value: (n) => (n.parentId ? nodeName.get(n.parentId) : '') },
      { header: 'Capacidad (kVA)', value: (n) => n.ratedKva, decimals: 1 },
      { header: 'Protección (A)', value: (n) => n.breakerA },
      { header: 'Capacidad de corriente (A)', value: (n) => n.ampacityA },
      { header: 'Fases', value: (n) => n.phases },
      { header: 'Tensión (V)', value: (n) => n.voltageV ?? n.secondaryV },
      { header: 'Conductor', value: (n) => n.conductor },
      { header: 'Ubicación', value: (n) => n.location },
    ]),
    table('mediciones', 'Mediciones', data.measurements, [
      { header: 'Fecha y hora', value: (x) => x.takenAt.replace('T', ' ') },
      { header: 'Tipo de punto', value: (x) => POINT[x.pointType] },
      { header: 'Punto medido', value: (x) => pointName(x.pointType, x.pointId) },
      { header: 'Fases', value: (x) => x.phases },
      { header: 'Referencia de tensión', value: (x) => x.voltageRef },
      { header: 'V1 (V)', value: (x) => phase(x.voltageV, 0), decimals: 1 },
      { header: 'V2 (V)', value: (x) => phase(x.voltageV, 1), decimals: 1 },
      { header: 'V3 (V)', value: (x) => phase(x.voltageV, 2), decimals: 1 },
      { header: 'I1 (A)', value: (x) => phase(x.currentA, 0), decimals: 1 },
      { header: 'I2 (A)', value: (x) => phase(x.currentA, 1), decimals: 1 },
      { header: 'I3 (A)', value: (x) => phase(x.currentA, 2), decimals: 1 },
      { header: 'kW', value: (x) => derivePower(x).kw, decimals: 2 },
      { header: 'kVA', value: (x) => derivePower(x).kva, decimals: 2 },
      { header: 'kvar', value: (x) => derivePower(x).kvar, decimals: 2 },
      { header: 'FP', value: (x) => derivePower(x).pf, decimals: 3 },
      { header: 'THD V (%)', value: (x) => x.thdV, decimals: 1 },
      { header: 'THD I (%)', value: (x) => x.thdI, decimals: 1 },
      { header: 'Instrumento', value: (x) => x.instrument },
      { header: 'Tipo de dato', value: (x) => x.dataType },
      { header: 'Observaciones', value: (x) => x.notes },
    ]),
    table('lecturas', 'Lecturas del medidor', data.readings, [
      { header: 'Medidor', value: (r) => r.meter },
      { header: 'Fecha y hora', value: (r) => r.at.replace('T', ' ') },
      { header: 'Lectura (kWh)', value: (r) => r.kwh },
    ]),
    table('climatizacion', 'Climatización', m.cooling, [
      { header: 'Espacio', value: (c) => c.area.name },
      { header: 'Área (m²)', value: (c) => c.areaM2, decimals: 1 },
      { header: 'Personas', value: (c) => c.area.occupants },
      { header: 'Envolvente (BTU/h)', value: (c) => c.load.components.envelope, decimals: 0 },
      { header: 'Personas (BTU/h)', value: (c) => c.load.components.people, decimals: 0 },
      { header: 'Ventanas (BTU/h)', value: (c) => c.load.components.solar, decimals: 0 },
      { header: 'Iluminación (BTU/h)', value: (c) => c.load.components.lighting, decimals: 0 },
      { header: 'Equipos (BTU/h)', value: (c) => c.load.components.equipment, decimals: 0 },
      { header: 'Seguridad (BTU/h)', value: (c) => c.load.components.safety, decimals: 0 },
      { header: 'Carga requerida (BTU/h)', value: (c) => c.requiredBtuH, decimals: 0 },
      { header: 'Capacidad instalada (BTU/h)', value: (c) => c.installedBtuH },
      { header: 'Cobertura', value: (c) => c.ratio, decimals: 3 },
      { header: 'Estado', value: (c) => COOLING[c.status] },
    ]),
    table('iluminacion', 'Iluminación', m.lighting, [
      { header: 'Espacio', value: (l) => l.area.name },
      { header: 'Iluminancia requerida (lx)', value: (l) => l.requiredLux },
      { header: 'Iluminancia medida (lx)', value: (l) => l.measuredLux },
      { header: 'Iluminancia calculada (lx)', value: (l) => l.calculatedLux, decimals: 0 },
      { header: 'Luminarias instaladas', value: (l) => l.installed.count },
      { header: 'Luminarias requeridas', value: (l) => l.required.count },
      { header: 'Índice del local', value: (l) => l.roomIndex, decimals: 2 },
      { header: 'Coeficiente de utilización', value: (l) => l.utilization, decimals: 2 },
      { header: 'Densidad de potencia (W/m²)', value: (l) => l.lpd, decimals: 2 },
      { header: 'VEEI (W/m²·100 lx)', value: (l) => l.veei, decimals: 2 },
      { header: 'Límite VEEI', value: (l) => l.veeiLimit, decimals: 1 },
      { header: 'Estado', value: (l) => (l.status ? LIGHTING[l.status] : '') },
    ]),
    table('capacidad', 'Capacidad eléctrica', m.capacity.checks, [
      { header: 'Elemento', value: (c) => c.node.name },
      { header: 'Tipo', value: (c) => electricalKindOf(c.node.kind).label },
      { header: 'Capacidad', value: (c) => c.capacity, decimals: 1 },
      { header: 'Carga', value: (c) => c.load, decimals: 1 },
      { header: 'Unidad', value: (c) => c.unit },
      { header: 'Uso de la capacidad', value: (c) => c.ratio, decimals: 3 },
      { header: 'Estado', value: (c) => LOADING[c.level] },
      { header: 'Base del cálculo', value: (c) => BASIS[c.basis] },
      { header: 'Carga instalada (kW)', value: (c) => c.installedKw, decimals: 1 },
    ]),
    table('hallazgos', 'Hallazgos', data.findings, [
      { header: 'Hallazgo', value: (f) => f.title },
      { header: 'Gravedad', value: (f) => SEVERITY_LABEL[f.severity] },
      { header: 'Tema', value: (f) => findingTopicLabel(f.category) },
      { header: 'Estado', value: (f) => FINDING_STATUS_LABEL[f.status] },
      { header: 'Origen', value: (f) => (f.auto ? 'Sugerido por PONTIA' : 'Auditor') },
      { header: 'Descripción', value: (f) => f.description },
    ]),
    table('medidas', 'Medidas de ahorro', data.measures, [
      { header: 'Código', value: (x) => x.code },
      { header: 'Medida', value: (x) => x.title },
      { header: 'Uso final', value: (x) => endUseOf(x.category).label },
      { header: 'Tipo', value: (x) => MEASURE_KIND_LABEL[x.kind] },
      { header: 'Ahorro (kWh/año)', value: (x) => x.savingsKwhYear, decimals: 0 },
      { header: 'Ahorro (COP/año)', value: (x) => x.savingsCopYear, decimals: 0 },
      { header: 'Inversión (COP)', value: (x) => x.investmentCop, decimals: 0 },
      { header: 'Costo anual (COP)', value: (x) => x.annualCostCop, decimals: 0 },
      { header: 'Vida útil (años)', value: (x) => x.lifetimeYears },
      { header: 'Retorno simple (años)', value: (x) => finite(economics.get(x.id)?.paybackYears), decimals: 1 },
      { header: 'VPN (COP)', value: (x) => finite(economics.get(x.id)?.npvCop), decimals: 0 },
      { header: 'TIR (%)', value: (x) => { const irr = finite(economics.get(x.id)?.irr); return irr === null ? null : irr * 100; }, decimals: 1 },
      { header: 'CO₂ evitado (t/año)', value: (x) => finite(economics.get(x.id)?.co2TonnesYear), decimals: 2 },
      { header: 'En el plan', value: (x) => (x.selected ? 'Sí' : 'No') },
      { header: 'Prioridad', value: (x) => (x.priority ? PRIORITY_LABEL[x.priority] : '') },
      { header: 'Hallazgos que atiende', value: (x) => x.findingIds.map((id) => findingTitle.get(id)).filter(Boolean).join('; ') },
      { header: 'Descripción', value: (x) => x.description },
      { header: 'Observaciones', value: (x) => x.notes },
    ]),
  ].filter((t) => t.rows.length > 0);
}
