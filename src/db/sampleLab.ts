import { annualEnergyKwh } from '@/domain/calc/equipment';
import { sum } from '@/domain/calc/stats';
import { planTasks } from '@/domain/implementation';
import { hvacMeasure, ledMeasure, measureEconomics, shutdownMeasure, specsText, suggestedPriority, type CalculatorResult } from '@/domain/measures';
import { proposeRoute } from '@/domain/route';
import type {
  Area,
  BaselineAdjustment,
  Bill,
  ElectricalNode,
  EndUseCategory,
  Equipment,
  Finding,
  IntervalDay,
  IntervalSeries,
  MaintenanceRecord,
  Measure,
  Measurement,
  OccupancyRecord,
  Pgee,
  Project,
  RetieVerification,
  SafetyFinding,
  Task,
  TaskExecutor,
} from '@/domain/types';
import { summarizeDays } from './intervals';
import { on, quarterHours } from './sampleProject';
import type { PontiaDb } from './schema';

/**
 * Proyecto de ejemplo «Laboratorios · Sede Riohacha»: una auditoría completa de un bloque de laboratorios con cinco laboratorios de tipos
 * distintos, equipos de 24 horas, gas natural, horarios por periodo académico, hallazgos de seguridad eléctrica, medidas de cada clase
 * de potencial, ruta anual con la meta legal del 15 % y tareas con la verificación del RETIE. Todos los datos son ficticios: no hay
 * personas reales, cédulas ni números de matrícula, y los nombres de los ejecutores y del gestor son roles o dependencias.
 */

// ——— Facturación: 36 meses (octubre de 2023 a septiembre de 2026) ———

const PERIODS = Array.from({ length: 36 }, (_, i) => {
  const total = 2023 * 12 + 9 + i;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
});
/** Peso de cada mes (enero a diciembre) según el calendario académico: vacaciones a mitad y a fin de año, y el semestre más pesado en septiembre y octubre. */
const WEIGHT = [0.78, 0.96, 1.04, 1.04, 1.07, 0.92, 0.74, 1.0, 1.08, 1.12, 1.06, 0.72];
const TEMPERATURE = [27.5, 27.6, 28.0, 28.6, 29.0, 29.2, 29.4, 29.5, 29.0, 28.5, 28.0, 27.7];
/** Festivos de cada mes (aproximados): sirven para los días hábiles de la línea base. */
const HOLIDAYS = [2, 0, 1, 2, 2, 2, 3, 1, 0, 1, 2, 1];
const TARIFF_BY_YEAR: Record<number, number> = { 2023: 790, 2024: 820, 2025: 855, 2026: 890 };
const TARIFF = TARIFF_BY_YEAR[2026];
/** Meses del cierre del laboratorio de electrónica por remodelación: ajuste no rutinario de la línea base. */
const CLOSURE_MONTHS = ['2024-06', '2024-07'];

const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate();
function weekdaysIn(year: number, month: number): number {
  let count = 0;
  for (let day = 1; day <= daysIn(year, month); day++) {
    const weekday = new Date(year, month - 1, day).getDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}
/** Variación repetible de ±0,6 % para que las series no sean una curva perfecta. */
const wiggle = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return 1 + 0.012 * (x - Math.floor(x) - 0.5);
};

// ——— Semana del analizador (cada 15 minutos) ———

const WEEKDAY_KW = [9, 9, 9, 9, 9, 10, 14, 24, 36, 44, 47, 46, 38, 35, 42, 44, 40, 31, 22, 16, 13, 11, 10, 9];
const SATURDAY_KW = [9, 9, 9, 9, 9, 9, 10, 14, 20, 24, 25, 24, 18, 12, 10, 10, 9, 9, 9, 9, 9, 9, 9, 9];
const SUNDAY_KW = [9, 9, 9, 9, 9, 9, 9, 9, 10, 11, 11, 11, 10, 10, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9];
const WEEK = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];

type PanelKey = 'qui' | 'mic' | 'ele' | 'com' | 'tal' | 'aa' | 'uc';
type Lab = 'qui' | 'mic' | 'ele' | 'com' | 'tal' | 'ofi';

export async function createSampleLab(db: PontiaDb, now = Date.now()): Promise<Project> {
  const projectId = crypto.randomUUID();
  const stamp = () => ({ id: crypto.randomUUID(), projectId, createdAt: now, updatedAt: now });

  // ——— Espacios: cinco laboratorios de tipos distintos y la coordinación ———
  const labArea = (name: string, extra: Partial<Area>): Area => ({ ...stamp(), name, ...extra });
  const areas: Area[] = [
    labArea('Laboratorio de química', { spaceType: 'lab-quimica', lengthM: 12, widthM: 8, heightM: 3.4, workPlaneHeightM: 0.9, occupants: 28, hoursPerDay: 9, measuredLuxAvg: 465, floor: '1', code: 'LQ-01' }),
    labArea('Laboratorio de microbiología', { spaceType: 'lab-biologia', lengthM: 10, widthM: 6, heightM: 3, workPlaneHeightM: 0.9, occupants: 16, hoursPerDay: 12, measuredLuxAvg: 520, floor: '1', code: 'LM-01', notes: 'Con equipos de conservación de muestras que funcionan las 24 horas.' }),
    labArea('Laboratorio de electrónica y eléctrica', { spaceType: 'lab-electronica', lengthM: 12, widthM: 7, heightM: 3.2, workPlaneHeightM: 0.85, occupants: 24, hoursPerDay: 9, measuredLuxAvg: 410, floor: '2', code: 'LE-01', roofAvailableM2: 420 }),
    labArea('Laboratorio de cómputo', { spaceType: 'lab-computo', lengthM: 9, widthM: 8, heightM: 3, workPlaneHeightM: 0.8, occupants: 36, hoursPerDay: 10, measuredLuxAvg: 330, floor: '2', code: 'LC-01' }),
    labArea('Taller de mecánica y materiales', { spaceType: 'lab-mecanica', lengthM: 14, widthM: 8, heightM: 4, workPlaneHeightM: 0.9, occupants: 20, hoursPerDay: 8, measuredLuxAvg: 380, floor: '1', code: 'TM-01', roofAvailableM2: 420 }),
    labArea('Coordinación de laboratorios', { spaceType: 'oficina', lengthM: 6, widthM: 5, heightM: 2.8, workPlaneHeightM: 0.8, occupants: 5, hoursPerDay: 9, floor: '1', code: 'CL-01' }),
  ];
  const labKeyOf = (a: Area): Lab =>
    a.spaceType === 'lab-quimica' ? 'qui' : a.spaceType === 'lab-biologia' ? 'mic' : a.spaceType === 'lab-electronica' ? 'ele' : a.spaceType === 'lab-computo' ? 'com' : a.spaceType === 'lab-mecanica' ? 'tal' : 'ofi';
  const areaIds = new Map<Lab, string>(areas.map((a) => [labKeyOf(a), a.id]));

  // ——— Sistema eléctrico: transformador, tablero general, un tablero por laboratorio, el de aires y el circuito de las neveras ———
  const node = (kind: ElectricalNode['kind'], name: string, parentId: string | undefined, extra: Partial<ElectricalNode> = {}): ElectricalNode => ({ ...stamp(), kind, name, parentId, ...extra });
  const red = node('red', 'Red Air-e 13,2 kV', undefined, { primaryKv: 13.2 });
  const transformer = node('transformador', 'Transformador T-LAB', red.id, { ratedKva: 225, primaryKv: 13.2, secondaryV: '208/120 V', phases: 3, ownership: 'Cliente', year: 2009 });
  const meter = node('medidor', 'Medidor principal del bloque', transformer.id, { meterNumber: 'ME-EJEMPLO-01', phases: 3, voltageV: 208 });
  const service = node('acometida', 'Acometida principal', meter.id, { conductor: '3×(3×2/0) + 1×2/0 AWG THHN', ampacityA: 510, lengthM: 30, phases: 3, voltageV: 208 });
  const main = node('tablero', 'TG-LAB · Tablero general', service.id, { breakerA: 400, phases: 3, voltageV: 208, location: 'Cuarto eléctrico, piso 1' });
  const panel = (name: string, breakerA: number, location: string) => node('tablero', name, main.id, { breakerA, phases: 3, voltageV: 208, location });
  const tdQui = panel('TD-QUI · Laboratorio de química', 100, 'Pasillo del laboratorio de química');
  const tdMic = panel('TD-MIC · Laboratorio de microbiología', 100, 'Pasillo del laboratorio de microbiología');
  const tdEle = panel('TD-ELE · Laboratorio de electrónica', 100, 'Piso 2, junto al laboratorio de electrónica');
  const tdCom = panel('TD-COM · Laboratorio de cómputo', 100, 'Piso 2, junto al laboratorio de cómputo');
  const tdTal = panel('TD-TAL · Taller de mecánica', 125, 'Entrada del taller');
  const tdAa = panel('TD-AA · Aires acondicionados', 225, 'Cubierta');
  const cUc = node('circuito', 'C-UC · Ultracongeladores y neveras', tdMic.id, { breakerA: 20, phases: 1, voltageV: 208, conductor: '2×12 AWG' });
  const electrical: ElectricalNode[] = [red, transformer, meter, service, main, tdQui, tdMic, tdEle, tdCom, tdTal, tdAa, cUc];
  const panelIds: Record<PanelKey, string> = { qui: tdQui.id, mic: tdMic.id, ele: tdEle.id, com: tdCom.id, tal: tdTal.id, aa: tdAa.id, uc: cUc.id };

  // ——— Censo de carga por laboratorio ———
  const continuous = { regime: 'continuo' as const, activeHours: on([0, 24]) };
  const cycles = { regime: 'ciclos' as const };
  const T8 = { lampType: 'T8', lumens: 5200 };
  const equipment: Equipment[] = [];
  let sequence = 0;
  const add = (lab: Lab | null, panelKey: PanelKey | null, name: string, category: EndUseCategory, powerKw: number, quantity: number, hoursPerDay: number, useFactor: number, days: number, extra: Partial<Equipment> = {}) => {
    sequence += 1;
    equipment.push({
      ...stamp(),
      name,
      category,
      powerKw,
      quantity,
      hoursPerDay,
      useFactor,
      operatingDaysPerMonth: days,
      condition: 'bueno',
      areaId: lab ? areaIds.get(lab) : undefined,
      panelId: panelKey ? panelIds[panelKey] : undefined,
      code: extra.code ?? `EQ-${String(sequence).padStart(3, '0')}`,
      ...extra,
    });
  };
  const AC24 = { capacityBtuH: 24000, eer: 11.2, inverter: false, acType: 'Mini-split', year: 2013, condition: 'regular' as const };

  // Laboratorio de química
  add('qui', 'qui', 'Campana de extracción de gases', 'laboratorio', 0.75, 4, 9, 0.8, 22, { activeHours: on([7, 16]), brand: 'Marca A (ejemplo)', model: 'CE-120', voltageV: 208, currentA: 3.6, phases: 1, code: 'LQ-CE' });
  add('qui', 'qui', 'Mufla de calcinación', 'laboratorio', 3, 2, 4, 0.7, 22, { ...cycles, voltageV: 208, currentA: 14.4, phases: 1, code: 'LQ-MU' });
  add('qui', 'qui', 'Horno de secado', 'laboratorio', 1.8, 3, 8, 0.5, 22, { ...cycles, code: 'LQ-HS' });
  add('qui', 'qui', 'Plancha de calentamiento con agitación', 'laboratorio', 1, 8, 5, 0.6, 22, { code: 'LQ-PL' });
  add('qui', 'qui', 'Balanza analítica', 'laboratorio', 0.03, 6, 9, 1, 22);
  add('qui', 'qui', 'Destilador de agua', 'laboratorio', 2.4, 1, 6, 0.8, 22);
  add('qui', 'aa', 'Aire acondicionado mini-split 24.000 BTU/h', 'climatizacion', 2.2, 3, 9, 0.75, 22, { ...AC24, activeHours: on([7, 16]), code: 'AC-LQ' });
  add('qui', 'qui', 'Luminaria fluorescente 2×32 W T8', 'iluminacion', 0.07, 24, 9, 1, 22, { ...T8, activeHours: on([7, 16]) });
  add('qui', 'qui', 'Computador de escritorio', 'ti', 0.12, 4, 8, 0.6, 22, { activeHours: on([7, 11], [13, 17]) });
  // Gas natural del laboratorio de química (potencia térmica)
  add('qui', null, 'Mechero Bunsen', 'laboratorio', 1.2, 20, 3, 0.5, 22, { carrier: 'gas-natural', code: 'LQ-MB' });
  add('qui', null, 'Baño de agua a gas', 'laboratorio', 3.5, 2, 2, 0.6, 22, { carrier: 'gas-natural' });

  // Laboratorio de microbiología: equipos que no se apagan
  add('mic', 'uc', 'Ultracongelador de −80 °C', 'refrigeracion', 0.9, 2, 24, 0.7, 30, { ...continuous, nonInterruptible: true, nonInterruptibleReason: 'Conservación de muestras y cepas', brand: 'Marca B (ejemplo)', model: 'UC-80', voltageV: 208, currentA: 6.5, phases: 1, code: 'LM-UC', condition: 'regular' });
  add('mic', 'uc', 'Nevera de laboratorio (2 a 8 °C)', 'refrigeracion', 0.2, 3, 24, 0.5, 30, { ...continuous, nonInterruptible: true, nonInterruptibleReason: 'Reactivos y medios de cultivo', code: 'LM-NV' });
  add('mic', 'mic', 'Incubadora', 'laboratorio', 0.4, 4, 24, 0.6, 30, { ...continuous, code: 'LM-IN' });
  add('mic', 'mic', 'Autoclave', 'laboratorio', 3.5, 1, 3, 0.8, 22, { ...cycles, code: 'LM-AU' });
  add('mic', 'mic', 'Cabina de bioseguridad', 'laboratorio', 0.6, 2, 8, 0.8, 22, { activeHours: on([7, 15]) });
  add('mic', 'mic', 'Baño serológico', 'laboratorio', 0.5, 3, 6, 0.6, 22);
  add('mic', 'aa', 'Aire acondicionado mini-split 18.000 BTU/h', 'climatizacion', 1.65, 2, 12, 0.75, 22, { capacityBtuH: 18000, eer: 11.2, inverter: false, acType: 'Mini-split', year: 2013, condition: 'regular', activeHours: on([6, 18]), code: 'AC-LM' });
  add('mic', 'mic', 'Luminaria fluorescente 2×32 W T8', 'iluminacion', 0.07, 16, 12, 1, 22, { ...T8, activeHours: on([6, 18]) });

  // Laboratorio de electrónica y eléctrica
  add('ele', 'ele', 'Osciloscopio y generador de funciones (puesto)', 'laboratorio', 0.15, 12, 7, 0.7, 22, { code: 'LE-OS' });
  add('ele', 'ele', 'Fuente de poder DC', 'laboratorio', 0.3, 12, 5, 0.5, 22);
  add('ele', 'ele', 'Estación de soldadura', 'laboratorio', 0.09, 12, 4, 0.6, 22);
  add('ele', 'ele', 'Computador de escritorio', 'ti', 0.12, 12, 8, 0.6, 22, { activeHours: on([8, 12], [14, 18]) });
  add('ele', 'aa', 'Aire acondicionado mini-split 24.000 BTU/h', 'climatizacion', 2.2, 2, 9, 0.75, 22, { ...AC24, activeHours: on([8, 17]), code: 'AC-LE' });
  add('ele', 'ele', 'Luminaria fluorescente 2×32 W T8', 'iluminacion', 0.07, 20, 9, 1, 22, { ...T8, activeHours: on([8, 17]) });

  // Laboratorio de cómputo
  add('com', 'com', 'Computador de escritorio', 'ti', 0.12, 36, 10, 0.7, 22, { activeHours: on([7, 12], [13, 21]) });
  add('com', 'com', 'Servidor de práctica (rack)', 'ti', 0.45, 2, 24, 1, 30, { ...continuous, nonInterruptible: true, nonInterruptibleReason: 'Servicios de las prácticas y del aula virtual', code: 'LC-SV' });
  add('com', 'com', 'Videoproyector', 'ti', 0.3, 1, 6, 0.8, 22);
  add('com', 'aa', 'Aire acondicionado central 60.000 BTU/h', 'climatizacion', 5.5, 1, 10, 0.75, 22, { capacityBtuH: 60000, eer: 10.9, inverter: false, acType: 'Central o de paquete', year: 2011, condition: 'regular', activeHours: on([7, 21]), code: 'AC-LC' });
  add('com', 'com', 'Panel LED 40 W', 'iluminacion', 0.04, 18, 10, 1, 22, { lampType: 'LED', lumens: 4000, activeHours: on([7, 21]) });

  // Taller de mecánica y materiales
  add('tal', 'tal', 'Máquina universal de ensayos', 'motores', 7.5, 1, 3, 0.5, 22, { code: 'TM-MU' });
  add('tal', 'tal', 'Torno', 'motores', 3.7, 2, 4, 0.5, 22);
  add('tal', 'tal', 'Fresadora', 'motores', 4, 1, 4, 0.5, 22);
  add('tal', 'tal', 'Compresor de aire', 'motores', 5.5, 1, 6, 0.4, 22);
  add('tal', 'tal', 'Horno mufla de materiales', 'laboratorio', 6, 1, 3, 0.7, 22, { ...cycles });
  add('tal', 'tal', 'Extractor de humos', 'motores', 0.75, 2, 6, 0.5, 22);
  add('tal', 'tal', 'Luminaria fluorescente 2×32 W T8', 'iluminacion', 0.07, 30, 8, 1, 22, { ...T8, activeHours: on([8, 12], [14, 18]) });

  // Coordinación, pasillos y servicios del bloque
  add('ofi', 'ele', 'Computador de escritorio', 'ti', 0.12, 4, 9, 0.6, 22);
  add('ofi', 'aa', 'Aire acondicionado mini-split 18.000 BTU/h', 'climatizacion', 1.65, 1, 9, 0.6, 22, { capacityBtuH: 18000, eer: 11.2, inverter: false, acType: 'Mini-split', year: 2013, activeHours: on([8, 17]) });
  add('ofi', 'ele', 'Panel LED 40 W', 'iluminacion', 0.04, 8, 9, 1, 22, { lampType: 'LED', lumens: 4000 });
  add(null, null, 'Luminaria fluorescente 2×32 W T8', 'iluminacion', 0.07, 60, 12, 1, 22, { ...T8, notes: 'Pasillos, baños y escaleras del bloque.' });
  add(null, null, 'Bomba de agua', 'motores', 1.5, 2, 3, 0.7, 30);
  add(null, null, 'UPS de respaldo', 'ti', 0.6, 1, 24, 0.3, 30, { regime: 'respaldo', activeHours: on([0, 24]) });

  const electric = equipment.filter((e) => !e.carrier);
  const censusKwh = sum(electric.map((e) => annualEnergyKwh(e, e.operatingDaysPerMonth)));

  // ——— Facturas: 36 meses de electricidad con el consumo de los últimos 12 igual al 96,5 % del censo, y 12 meses de gas natural ———
  const weightSum = sum(WEIGHT);
  const scale = (censusKwh * 0.965) / weightSum;
  const bills: Bill[] = PERIODS.map((period, i) => {
    const [year, month] = period.split('-').map(Number);
    const days = daysIn(year, month);
    const yearFactor = i < 12 ? 1.06 : i < 24 ? 1.03 : 1;
    const closure = CLOSURE_MONTHS.includes(period) ? 0.84 : 1;
    const kwh = Math.round(scale * WEIGHT[month - 1] * yearFactor * wiggle(i) * closure);
    // Cada variable lleva su propia variación para que no sean copias exactas del consumo ni entre sí
    const occupancy = Math.min(100, Math.max(35, Math.round(WEIGHT[month - 1] * 92 * (1 + 0.03 * Math.sin(i * 1.3 + 0.5)))));
    return {
      ...stamp(),
      period,
      days,
      kwh,
      kvarh: Math.round(kwh * 0.3),
      demandKw: Math.round((kwh / (days * 24 * 0.33)) * 10) / 10,
      costCop: kwh * TARIFF_BY_YEAR[year],
      tariffCopPerKwh: TARIFF_BY_YEAR[year],
      workingDays: weekdaysIn(year, month) - HOLIDAYS[month - 1],
      occupancyPct: occupancy,
      avgTemperatureC: TEMPERATURE[month - 1],
      populationServed: Math.round(560 * WEIGHT[month - 1] * (1 + 0.04 * Math.sin(i * 2.1 + 1.7))),
      practiceHours: Math.round(1200 * WEIGHT[month - 1] * (1 + 0.06 * Math.sin(i * 0.9 + 2.9)) * (closure === 1 ? 1 : 0.88)),
    };
  });
  const gasBills: Bill[] = PERIODS.slice(-12).map((period, i) => {
    const [year, month] = period.split('-').map(Number);
    const quantity = Math.round(105 * WEIGHT[month - 1] * wiggle(i + 40));
    return { ...stamp(), carrier: 'gas-natural', period, days: daysIn(year, month), quantity, unit: 'm3', kwhPerUnit: 10.5, kwh: Math.round(quantity * 10.5), costCop: quantity * 3650 + 18_000 };
  });
  const lastYearKwh = sum(bills.slice(-12).map((b) => b.kwh));
  const adjustment: BaselineAdjustment = {
    ...stamp(),
    carrier: 'electricidad',
    kind: 'no-rutinario',
    date: '2024-08-05',
    cause: 'Cierre del laboratorio de electrónica por remodelación (ejemplo): el consumo bajó y no representa la operación normal.',
    months: CLOSURE_MONTHS,
    applied: true,
  };

  // ——— Mediciones y registro del analizador ———
  const measurements: Measurement[] = [
    { ...stamp(), takenAt: '2026-09-09T10:30', pointType: 'tablero', pointId: main.id, phases: 3, voltageRef: 'LL', voltageV: [209, 210, 208], currentA: [176, 168, 171], kw: 58.2, kva: 62.6, kvar: 23, pf: 0.93, thdV: 2.6, thdI: 9.8, instrument: 'Analizador de redes', dataType: 'medido', notes: 'Hora de mayor ocupación de los laboratorios.' },
    { ...stamp(), takenAt: '2026-09-09T11:10', pointType: 'tablero', pointId: tdEle.id, phases: 3, voltageRef: 'LL', voltageV: [208, 209, 207], currentA: [64, 52, 47], kw: 17.4, pf: 0.9, instrument: 'Analizador de redes', dataType: 'medido', notes: 'Cargas monofásicas de los puestos concentradas en una fase.' },
    { ...stamp(), takenAt: '2026-09-10T09:00', pointType: 'tablero', pointId: cUc.id, phases: 1, voltageRef: 'LL', voltageV: [207], currentA: [16.8], kw: 3.4, instrument: 'Pinza amperimétrica', dataType: 'medido', notes: 'Ultracongeladores y neveras en el mismo circuito de 20 A.' },
  ];
  const weekDays = WEEK.map((date, day) => ({ date, values: quarterHours(day === 5 ? SATURDAY_KW : day === 6 ? SUNDAY_KW : WEEKDAY_KW, day) }));
  const series: IntervalSeries = {
    ...stamp(),
    name: 'Analizador · TG-LAB',
    source: 'analizador',
    intervalMinutes: 15,
    location: 'TG-LAB · Tablero general',
    fileName: 'analizador_TG-LAB_semana.csv',
    wholeFacility: true,
    ...summarizeDays(weekDays, 15),
  };
  const intervalDays: IntervalDay[] = weekDays.map((d) => ({ seriesId: series.id, projectId, date: d.date, values: d.values }));

  // ——— Horarios de uso por periodo académico (Formato 6) ———
  const use = (lab: Lab, term: string, activity: string, day: string, start: string, end: string, hours: number, avgOccupants: number, usesAc = true): OccupancyRecord => ({
    ...stamp(),
    areaId: areaIds.get(lab)!,
    term,
    activity,
    day,
    start,
    end,
    hours,
    avgOccupants,
    usesAc,
    usesLighting: true,
  });
  const occupancy: OccupancyRecord[] = ['2026-1', '2026-2'].flatMap((term) => [
    use('qui', term, 'Prácticas de química general y orgánica', 'L-V', '07:00', '12:00', 5, 22),
    use('qui', term, 'Prácticas de análisis instrumental', 'L-J', '14:00', '18:00', 4, 18),
    use('mic', term, 'Prácticas de microbiología', 'L-V', '07:00', '17:00', 10, 12),
    use('ele', term, 'Circuitos y electrónica', 'L-J', '08:00', '12:00', 4, 20),
    use('ele', term, 'Prácticas de máquinas eléctricas', 'M-V', '14:00', '18:00', 4, 16),
    use('com', term, 'Programación y simulación', 'L-V', '07:00', '21:00', 14, 30),
    use('tal', term, 'Ensayos de materiales y taller', 'L-V', '08:00', '12:00', 4, 14, false),
    use('tal', term, 'Ensayos de materiales y taller', 'L-J', '14:00', '17:00', 3, 12, false),
  ]);

  // ——— Mantenimiento (Formato 9) ———
  const byCode = (code: string) => equipment.find((e) => e.code === code)!;
  const maintenance: MaintenanceRecord[] = [
    { ...stamp(), equipmentId: byCode('LM-UC').id, type: 'preventivo', lastAt: '2026-03-12', frequency: 'Semestral', activities: 'Limpieza del condensador y revisión de los sellos', failures: 'Sello de la puerta deteriorado', condition: 'regular', recommendation: 'Cambiar el sello para bajar el consumo del compresor', responsible: 'Mantenimiento' },
    { ...stamp(), equipmentId: byCode('AC-LQ').id, type: 'correctivo', lastAt: '2025-06-20', frequency: 'Sin plan', failures: 'Filtros y serpentines con suciedad', condition: 'regular', recommendation: 'Plan preventivo trimestral de limpieza', responsible: 'Mantenimiento' },
    { ...stamp(), equipmentId: byCode('AC-LC').id, type: 'preventivo', lastAt: '2026-01-15', frequency: 'Anual', activities: 'Revisión de presiones y limpieza', condition: 'regular', responsible: 'Servicios Generales' },
    { ...stamp(), equipmentId: byCode('LQ-CE').id, type: 'ninguno', frequency: 'Sin plan', condition: 'bueno', recommendation: 'Medir la velocidad de captura y programar el mantenimiento anual', responsible: 'Laboratorios' },
  ];

  // ——— Hallazgos del diagnóstico (Formato 11) ———
  let order = 0;
  const finding = (title: string, severity: Finding['severity'], category: Finding['category'], status: Finding['status'], description: string, extra: Partial<Finding> = {}): Finding => {
    const at = now + order++;
    return { ...stamp(), createdAt: at, updatedAt: at, title, description, severity, category, status, auto: false, foundAt: '2026-09-09', ...extra };
  };
  const t8 = sum(equipment.filter((e) => e.lampType === 'T8').map((e) => e.quantity));
  const findings = {
    maintenanceAc: finding('Aires sin plan de mantenimiento preventivo', 'alto', 'climatizacion', 'en-medida', 'Los mini-split de química, microbiología y electrónica tienen filtros y serpentines con suciedad y más de diez años de uso.', {
      cause: 'No hay un plan de limpieza ni de revisión de presiones.',
      energyImpact: 'Menor transferencia de calor: los equipos trabajan más horas para la misma carga (estimación del auditor, por verificar con medición).',
      suggestedAction: 'Plan preventivo trimestral y reposición por equipos inverter en los de mayor uso.',
    }),
    lighting: finding('Iluminación T8 y iluminancias por debajo de lo requerido', 'alto', 'iluminacion', 'en-medida', `${t8} luminarias T8 con balasto electromagnético; el taller (380 lx) y el laboratorio de cómputo (330 lx) no llegan al valor de referencia del RETILAP.`, {
      cause: 'Luminarias con más de quince años y sin mantenimiento de difusores.',
      suggestedAction: 'Cambio a paneles LED con la distribución del método de los lúmenes.',
    }),
    afterHours: finding('Equipos encendidos fuera de las prácticas', 'medio', 'laboratorio', 'en-medida', 'En el recorrido de las 6:30 p. m. había plancha de calentamiento, campanas de extracción y osciloscopios encendidos en laboratorios vacíos.', {
      entityType: 'area',
      entityId: areaIds.get('qui'),
      cause: 'No hay un procedimiento de cierre del laboratorio.',
      energyImpact: 'Consumo en horas sin práctica, fuera de la carga base de los equipos que no se pueden apagar.',
      suggestedAction: 'Lista de verificación de cierre y responsables por laboratorio.',
    }),
    freezer: finding('Ultracongelador con el sello de la puerta deteriorado', 'medio', 'refrigeracion', 'abierto', 'El sello no cierra bien y el compresor trabaja más tiempo del necesario.', {
      entityType: 'equipo',
      entityId: byCode('LM-UC').id,
      cause: 'Desgaste del sello.',
      suggestedAction: 'Cambiar el sello y anotar la temperatura interna cada semana.',
    }),
    roof: finding('Cubierta disponible para energía solar', 'bajo', 'envolvente', 'en-medida', 'La cubierta del bloque tiene cerca de 840 m² libres de sombra, con buena exposición.', { suggestedAction: 'Reportar el potencial de referencia; el diseño queda para una etapa posterior.' }),
  };

  // ——— Seguridad eléctrica (RETIE 1.5.1): aparte de los hallazgos de ahorro ———
  const safety = (partial: Partial<SafetyFinding> & Pick<SafetyFinding, 'riskFactor' | 'description'>): SafetyFinding => ({
    ...stamp(),
    foundAt: '2026-09-10',
    real: true,
    highRisk: false,
    imminent: false,
    status: 'abierto',
    auto: false,
    ...partial,
  });
  const safetyFindings: SafetyFinding[] = [
    safety({
      riskFactor: 'contacto-directo',
      description: 'El tablero del taller no tiene la tapa frontal y hay partes energizadas al alcance de los estudiantes.',
      entityType: 'electrico',
      entityId: tdTal.id,
      consequences: { personas: 4 },
      consequence: 4,
      frequency: 'c',
      confirmed: true,
      highRisk: true,
      precedent: 'Contacto con partes energizadas en un tablero abierto de una sede comparable (ejemplo)',
      evaluator: 'Persona competente del área de mantenimiento (ejemplo)',
      immediateAction: 'Señalizar y restringir el acceso al tablero hasta instalar la tapa',
      recommendedAction: 'Instalar la tapa frontal y etiquetar los circuitos',
      control: 'ingenieria',
      responsible: 'Jefatura de mantenimiento (ejemplo)',
      dueDate: '2026-10-15',
      sstRef: 'Peligro eléctrico en el taller (matriz de peligros de la entidad)',
    }),
    safety({
      riskFactor: 'sobrecarga',
      description: 'Regletas conectadas en cascada en los puestos del laboratorio de electrónica; el circuito de esas tomas se calienta.',
      entityType: 'area',
      entityId: areaIds.get('ele'),
      consequences: { personas: 3, economicas: 3 },
      consequence: 3,
      frequency: 'd',
      confirmed: true,
      immediateAction: 'Retirar las regletas en cascada',
      recommendedAction: 'Circuitos independientes por banco de trabajo con protección diferencial',
      control: 'ingenieria',
      responsible: 'Jefatura de mantenimiento (ejemplo)',
      dueDate: '2026-11-30',
      status: 'en-control',
    }),
    safety({
      riskFactor: 'equipo-defectuoso',
      description: 'El cable de alimentación de uno de los ultracongeladores tiene el aislamiento agrietado cerca del enchufe.',
      entityType: 'equipo',
      entityId: byCode('LM-UC').id,
      consequences: { personas: 3, economicas: 4 },
      consequence: 4,
      frequency: 'b',
      confirmed: true,
      recommendedAction: 'Cambiar el cable y el enchufe por unos de la capacidad del equipo',
      control: 'sustitucion',
      responsible: 'Laboratorio de microbiología (ejemplo)',
      dueDate: '2026-10-05',
    }),
    safety({
      riskFactor: 'cortocircuito',
      real: false,
      description: 'Protección sin la capacidad de corte adecuada en un tablero auxiliar del piso 2.',
      entityType: 'electrico',
      entityId: tdEle.id,
      consequences: { economicas: 2 },
      consequence: 2,
      frequency: 'd',
      confirmed: true,
      status: 'cerrado',
      recommendedAction: 'Reemplazada durante el levantamiento',
    }),
  ];

  // ——— Medidas de ahorro: una por cada clase de potencial, con las calculadoras ———
  const measure = (code: string, r: Omit<CalculatorResult, 'specs'>, extra: Pick<Measure, 'selected' | 'findingIds'> & Partial<Measure>): Measure => {
    const values = {
      savingsKwhYear: Math.round(r.savingsKwhYear),
      savingsCopYear: Math.round(r.savingsCopYear),
      investmentCop: Math.round(r.investmentCop),
      annualCostCop: Math.round(r.annualCostCop),
      lifetimeYears: r.lifetimeYears,
    };
    const priority = suggestedPriority(measureEconomics(values, economics), values.investmentCop);
    return { ...stamp(), code, title: r.title, category: r.category, kind: r.kind, ...(r.savingsType ? { savingsType: r.savingsType } : {}), ...values, priority, ...extra };
  };
  const economics: Project['economics'] = { tariffCopPerKwh: TARIFF, discountRate: 0.12, tariffEscalation: 0.04, horizonYears: 10, emissionFactorKgPerKwh: 0.126 };
  const acKwh = sum(electric.filter((e) => e.category === 'climatizacion').map((e) => annualEnergyKwh(e, e.operatingDaysPerMonth)));
  const led = ledMeasure({ currentCount: t8, currentW: 70, proposedCount: t8, proposedW: 36, hoursPerYear: 2376, costPerLuminaire: 150_000, tariff: TARIFF });
  const inverter = hvacMeasure({ units: 7, capacityBtuH: 24_000, currentEer: 11.2, newEer: 18, fullLoadHoursPerYear: 1_900, costPerUnit: 4_500_000, tariff: TARIFF });
  const shutdown = shutdownMeasure({ equipment: electric, categories: ['laboratorio', 'ti', 'motores'], hoursSavedPerDay: 1.5, compliance: 0.75, tariff: TARIFF, investmentCop: 1_800_000 });
  const upkeep = { title: 'Plan de mantenimiento preventivo de los aires acondicionados', category: 'climatizacion', kind: 'operativa', savingsType: 'bpo', savingsKwhYear: Math.round(acKwh * 0.05), savingsCopYear: Math.round(acKwh * 0.05 * TARIFF), investmentCop: 3_200_000, annualCostCop: 0, lifetimeYears: 3 } as const;
  const gasSwap = { title: 'Sustitución de las planchas eléctricas de calentamiento por baños de agua a gas natural', category: 'laboratorio', kind: 'baja-inversion', savingsType: 'sustitucion-energetico', savingsKwhYear: 6_336, savingsCopYear: 6_336 * TARIFF - 3_277_500, investmentCop: 4_200_000, annualCostCop: 0, lifetimeYears: 8 } as const;
  const measures: Measure[] = [
    measure('M1', led, {
      selected: true,
      findingIds: [findings.lighting.id],
      description: specsText(led.specs),
      evidence: 'Luminarias T8 de 70 W con balasto electromagnético e iluminancias por debajo del valor de referencia en el taller y en cómputo.',
      responsible: 'Mantenimiento',
      deadline: '2027-03-31',
      indicator: 'kWh/mes de iluminación frente a la línea base',
      items: [{ action: 'Suministro e instalación de paneles LED', element: 'Panel LED 36 W', brandModel: 'Marca ejemplo PL-36', reference: 'PL-36-6500K', quantity: t8, unit: 'unidad', unitCostCop: 150_000, manufacturer: 'Fabricante de ejemplo', supplier: 'Proveedor de ejemplo', role: 'Iluminación de laboratorios, taller y pasillos' }],
    }),
    measure('M2', inverter, {
      selected: true,
      priority: 'baja',
      findingIds: [findings.maintenanceAc.id],
      description: specsText(inverter.specs),
      responsible: 'Mantenimiento',
      deadline: '2027-09-30',
      indicator: 'kWh/mes de climatización frente a la línea base',
      items: [{ action: 'Reposición de mini-split por equipos inverter', element: 'Mini-split inverter 24.000 BTU/h', brandModel: 'Marca ejemplo INV-24', quantity: 7, unit: 'unidad', unitCostCop: 4_500_000, manufacturer: 'Fabricante de ejemplo', supplier: 'Proveedor de ejemplo', role: 'Climatización de laboratorios' }],
    }),
    measure('M3', shutdown, {
      selected: true,
      findingIds: [findings.afterHours.id],
      description: `${specsText(shutdown.specs)}. Se excluyen los ultracongeladores, las neveras, los servidores y las incubadoras.`,
      evidence: 'Equipos encendidos en laboratorios vacíos al final de la jornada.',
      responsible: 'Coordinación de laboratorios',
      deadline: '2026-12-15',
      indicator: 'Horas de uso de los equipos frente al horario de cada laboratorio',
    }),
    measure('M4', upkeep, { selected: true, findingIds: [findings.maintenanceAc.id], description: 'Limpieza trimestral de filtros y serpentines, y revisión anual de presiones, con un contrato de mantenimiento.', responsible: 'Servicios Generales', deadline: '2026-12-31', indicator: 'Cumplimiento del plan de mantenimiento (%)' }),
    measure('M5', gasSwap, {
      selected: false,
      findingIds: [],
      notes: 'Evaluada como potencial de sustitución de energético: baja el consumo eléctrico pero suma el de gas natural. La decisión la toma la Universidad con criterios de seguridad y de emisiones; no entra al plan.',
    }),
  ];

  // ——— PGEE, ruta anual y tareas ———
  const pgee: Pgee = {
    ...stamp(),
    policy: 'La Universidad se compromete a mejorar de forma continua el desempeño energético de sus laboratorios: usar la energía de manera eficiente, asignar los recursos necesarios para cumplir los objetivos y las metas de este plan y cumplir los requisitos legales aplicables.',
    scope: 'Bloque de laboratorios de la Sede Riohacha (química, microbiología, electrónica, cómputo y taller de mecánica), con su electricidad y su gas natural.',
    team: [
      { role: 'Representante de la dirección', name: 'Vicerrectoría Administrativa (ejemplo)', responsibilities: 'Aprueba la política, asigna los recursos y revisa los resultados cada semestre.' },
      { role: 'Gestor energético', name: 'Oficina de Planeación (ejemplo)', responsibilities: 'Coordina el plan, hace el seguimiento de los indicadores y reporta a la UPME.' },
      { role: 'Responsables de laboratorio', name: 'Coordinación de laboratorios (ejemplo)', responsibilities: 'Aplican el cierre de laboratorio y los horarios de los equipos.' },
    ],
    objectives: [{ description: 'Reducir el consumo eléctrico del bloque frente a la línea base', targetPercent: 18, deadline: '2028-12-31' }],
    energyManager: { name: 'Jefatura de la Oficina de Planeación (ejemplo)', role: 'Gestor energético', appointmentDoc: 'Resolución de ejemplo (sin número)', appointmentDate: '2026-09-01' },
    financing: { models: ['funcionamiento', 'inversion', 'ahorros', 'fenoge'], note: 'Ejemplo: el mantenimiento y las buenas prácticas con gastos de funcionamiento; iluminación y aires con un proyecto de inversión; los ahorros se reinvierten en nuevas medidas.' },
    communication: 'Informe semestral a la Vicerrectoría y aviso mensual a los responsables de laboratorio con el consumo frente a la meta.',
    reviewFrequency: 'Semestral',
  };
  const RESPONSIBLE: Record<string, string> = { M1: 'Mantenimiento', M2: 'Mantenimiento', M3: 'Coordinación de laboratorios', M4: 'Servicios Generales' };
  const codeOf = new Map(measures.map((m) => [m.id, m.code]));
  const tasks: Task[] = planTasks(measures, projectId, '2026-09-01').map((t, i) => {
    const code = codeOf.get(t.measureId ?? '') ?? '';
    return { ...t, createdAt: now + i, updatedAt: now + i, responsible: RESPONSIBLE[code], fundingSource: code === 'M4' || code === 'M3' ? 'Recursos propios' : 'Proyecto de inversión' };
  });
  tasks[0] = { ...tasks[0], status: 'implementada', progress: 100 };
  tasks[1] = { ...tasks[1], status: 'en-ejecucion', progress: 30 };

  // Ejecutores y verificación del RETIE de las obras eléctricas: sin personas reales ni números de matrícula
  const EXECUTOR: Record<string, TaskExecutor> = {
    M1: { kind: 'empresa', name: 'Contratista de iluminación (ejemplo)', role: 'Constructor', registry: { body: 'CONTE', category: 'TE-1' } },
    M2: { kind: 'empresa', name: 'Contratista de climatización (ejemplo)', role: 'Instalación', registry: { body: 'CONTE', category: 'TE-1' } },
  };
  const RETIE: Record<string, Partial<RetieVerification>> = {
    M1: { applies: 'si', status: 'en-revision', riskAnalysisDone: true, documents: [{ kind: 'declaracion-diseno', reference: 'DD-ejemplo-01', issuer: 'Diseñador (ejemplo)', date: '2026-11-20', result: 'cumple' }] },
    M2: { applies: 'si', status: 'pendiente' },
  };
  tasks.forEach((t, i) => {
    const code = codeOf.get(t.measureId ?? '') ?? '';
    if (!t.works || !EXECUTOR[code] || !t.retie) return;
    tasks[i] = { ...t, executor: EXECUTOR[code], works: { ...t.works, startDate: t.start, startProof: 'contrato' }, retie: { ...t.retie, ...RETIE[code] } };
  });
  pgee.annualRoute = proposeRoute({ measures, tasks, firstYear: Number(PERIODS[PERIODS.length - 1].slice(0, 4)) + 1, referenceKwh: lastYearKwh });

  const project: Project = {
    id: projectId,
    createdAt: now,
    updatedAt: now,
    name: 'Laboratorios · Sede Riohacha (ejemplo)',
    code: 'LAB-01',
    client: 'Universidad de La Guajira',
    nit: '900.000.000-0',
    city: 'Riohacha',
    address: 'Sede Riohacha, bloque de laboratorios',
    sector: 'Educativo',
    areaM2: 1150,
    users: 580,
    operatingHours: '06:00 – 22:00',
    gridOperator: 'Air-e',
    voltageLevel: 'Nivel 2',
    calendar: { daysPerWeek: 5, holidays: [], vacationDaysPerYear: 40 },
    economics,
    peakSunHours: 5.5,
    auditor: 'Auditor de ejemplo',
    entity: { kind: 'publica', order: 'territorial' },
    site: { name: 'Sede Riohacha', upmeCode: 'SEDE-EJEMPLO-01' },
    building: { builtYear: 2009, floors: 2, activity: 'Docencia, prácticas y laboratorios de investigación', surroundings: 'Campus universitario en zona urbana', tenure: 'propia' },
    population: { students: 520, staff: 60, floating: 40 },
    institutionalContact: { name: 'Oficina de Planeación (ejemplo)', role: 'Gestor energético' },
    surveyDate: '2026-09-09',
    audit: { date: '2026-09-15' },
    scope: {
      boundary: 'El bloque de laboratorios de la Sede Riohacha: cinco laboratorios y el taller, la coordinación y su tablero general. Incluye la electricidad de Air-e y el gas natural del bloque.',
      objectives: 'Caracterizar el uso de la energía de los laboratorios, identificar el potencial de ahorro y formular el PGEE con la ruta anual de cumplimiento.',
      limitations: 'No se auditaron las demás edificaciones del campus. Los consumos por laboratorio salen del censo de carga: los laboratorios no tienen medición individual.',
      fnce: 'potencial',
    },
  };

  await db.transaction(
    'rw',
    [db.projects, db.bills, db.areas, db.equipment, db.electrical, db.measurements, db.intervalSeries, db.intervalDays, db.findings, db.safetyFindings, db.occupancy, db.maintenance, db.baselineAdjustments, db.measures, db.pgee, db.tasks],
    async () => {
      await db.projects.add(project);
      await db.bills.bulkAdd([...bills, ...gasBills]);
      await db.areas.bulkAdd(areas);
      await db.equipment.bulkAdd(equipment);
      await db.electrical.bulkAdd(electrical);
      await db.measurements.bulkAdd(measurements);
      await db.intervalSeries.add(series);
      await db.intervalDays.bulkAdd(intervalDays);
      await db.findings.bulkAdd(Object.values(findings));
      await db.safetyFindings.bulkAdd(safetyFindings);
      await db.occupancy.bulkAdd(occupancy);
      await db.maintenance.bulkAdd(maintenance);
      await db.baselineAdjustments.add(adjustment);
      await db.measures.bulkAdd(measures);
      await db.pgee.add(pgee);
      await db.tasks.bulkAdd(tasks);
    },
  );
  return project;
}
