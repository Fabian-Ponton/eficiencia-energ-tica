import type { Area, Bill, ElectricalNode, EndUseCategory, Equipment, Measurement, MeterReadingRecord, Project } from '@/domain/types';
import type { PontiaDb } from './schema';

/**
 * Proyecto de ejemplo (Bloque 6, Riohacha) para conocer la app sin datos reales.
 * Los valores son ilustrativos y coinciden con el prototipo visual.
 */
const PERIODS = [
  '2024-10', '2024-11', '2024-12', '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
];
const KWH = [
  17900, 17600, 12500, 11200, 17100, 18600, 18400, 19100, 13800, 13100, 17900, 17400,
  17200, 16800, 11900, 10800, 16400, 17900, 17600, 18300, 13200, 12600, 17100, 16600,
];
const TARIFF = 850;

type EquipmentSeed = [name: string, category: EndUseCategory, powerKw: number, quantity: number, hoursPerDay: number, useFactor: number, daysPerMonth: number, extra?: Partial<Equipment>];

const EQUIPMENT: EquipmentSeed[] = [
  ['Aire acondicionado mini-split 18.000 BTU/h', 'climatizacion', 1.65, 38, 8, 0.6, 22, { capacityBtuH: 18000, eer: 10.9, condition: 'regular' }],
  ['Aire acondicionado central 60.000 BTU/h', 'climatizacion', 5.5, 2, 10, 0.75, 22, { capacityBtuH: 60000, eer: 10.9 }],
  ['Luminaria fluorescente 2×32 W T8', 'iluminacion', 0.07, 206, 8, 1, 22, { lampType: 'T8', lumens: 5200 }],
  ['Panel LED 40 W', 'iluminacion', 0.04, 36, 8, 1, 22, { lampType: 'LED', lumens: 4000 }],
  ['Computador de escritorio', 'ti', 0.12, 96, 8, 0.6, 22],
  ['Videoproyector', 'ti', 0.3, 14, 6, 0.8, 22],
  ['Servidor', 'ti', 0.4, 2, 24, 1, 30],
  ['Nevera', 'refrigeracion', 0.2, 9, 24, 0.5, 30],
  ['Dispensador de agua', 'refrigeracion', 0.5, 3, 10, 0.5, 22],
  ['Bomba de agua de 3 HP', 'motores', 2.24, 2, 6, 0.9, 30, { efficiency: 0.82 }],
  ['Horno de cafetería', 'cocina', 3, 2, 3, 0.5, 22],
  ['Greca', 'cocina', 1.5, 1, 4, 0.5, 22],
  ['Horno microondas', 'cocina', 1.2, 2, 1, 0.6, 22],
  ['Cargadores y equipos menores', 'otros', 0.06, 80, 8, 0.6, 22],
];

/** Lecturas diarias del medidor a las 7:00: consumo de cada día anterior (fin de semana más bajo). */
const DAILY_KWH = [655, 648, 662, 610, 268, 252, 640, 651];
const FIRST_READING = 1_284_350;

export async function createSampleProject(db: PontiaDb, now = Date.now()): Promise<Project> {
  const projectId = crypto.randomUUID();
  const stamp = () => ({ id: crypto.randomUUID(), projectId, createdAt: now, updatedAt: now });

  const project: Project = {
    id: projectId,
    createdAt: now,
    updatedAt: now,
    name: 'Bloque 6 · Aulas y laboratorios (ejemplo)',
    code: 'BL-06',
    client: 'Universidad de La Guajira',
    city: 'Riohacha',
    sector: 'Educativo',
    areaM2: 3000,
    users: 900,
    operatingHours: '06:00 – 22:00',
    gridOperator: 'Air-e',
    voltageLevel: 'Nivel 2',
    calendar: { daysPerWeek: 5, holidays: [], vacationDaysPerYear: 40 },
    economics: { tariffCopPerKwh: TARIFF, discountRate: 0.12, tariffEscalation: 0.04, horizonYears: 10, emissionFactorKgPerKwh: 0.126 },
    peakSunHours: 5.5,
  };

  // Días del mes facturado, reactiva del 35 % (FP ≈ 0,94) y demanda con un factor de carga del 22 %
  const bills: Bill[] = PERIODS.map((period, i) => {
    const [year, month] = period.split('-').map(Number);
    const days = new Date(year, month, 0).getDate();
    return {
      ...stamp(),
      period,
      days,
      kwh: KWH[i],
      kvarh: Math.round(KWH[i] * 0.35),
      demandKw: Math.round((KWH[i] / (days * 24 * 0.22)) * 10) / 10,
      costCop: KWH[i] * TARIFF,
      tariffCopPerKwh: TARIFF,
    };
  });

  const areas: Area[] = [
    ...[601, 602, 603, 604].map((n) => ({
      ...stamp(),
      name: `Aula ${n}`,
      spaceType: 'aula',
      lengthM: 8,
      widthM: 6,
      heightM: 3,
      workPlaneHeightM: 0.8,
      occupants: 35,
      hoursPerDay: 9,
      windowAreaM2: 6,
      windowOrientation: 'N' as const,
      measuredLuxAvg: n === 601 ? 312 : 340,
    })),
    { ...stamp(), name: 'Laboratorio de física', spaceType: 'laboratorio', lengthM: 12, widthM: 8, heightM: 3.2, workPlaneHeightM: 0.9, occupants: 30, hoursPerDay: 8 },
    { ...stamp(), name: 'Sala de cómputo', spaceType: 'sala-computo', lengthM: 10, widthM: 8, heightM: 3, workPlaneHeightM: 0.8, occupants: 40, hoursPerDay: 10 },
    { ...stamp(), name: 'Coordinación académica', spaceType: 'oficina', lengthM: 6, widthM: 5, heightM: 2.8, workPlaneHeightM: 0.8, occupants: 6, hoursPerDay: 9 },
  ];

  const node = (kind: ElectricalNode['kind'], name: string, parentId: string | undefined, extra: Partial<ElectricalNode> = {}): ElectricalNode => ({
    ...stamp(),
    kind,
    name,
    parentId,
    ...extra,
  });
  const red = node('red', 'Red Air-e 13,2 kV', undefined, { primaryKv: 13.2 });
  const transformer = node('transformador', 'Transformador T1', red.id, { ratedKva: 150, primaryKv: 13.2, secondaryV: '208/120 V', phases: 3, ownership: 'Cliente', year: 2012 });
  const meter = node('medidor', 'Medidor principal', transformer.id, { meterNumber: 'ME-458921', phases: 3, voltageV: 208 });
  const service = node('acometida', 'Acometida principal', meter.id, { conductor: '2×(3×4/0) + 1×4/0 AWG THHN', ampacityA: 460, lengthM: 25, phases: 3, voltageV: 208 });
  const main = node('tablero', 'TGD · Tablero general', service.id, { breakerA: 400, phases: 3, voltageV: 208, location: 'Cuarto eléctrico, piso 1' });
  const floor1 = node('tablero', 'TD-P1 · Piso 1', main.id, { breakerA: 125, phases: 3, voltageV: 208, location: 'Pasillo del piso 1' });
  const floor2 = node('tablero', 'TD-P2 · Piso 2', main.id, { breakerA: 125, phases: 3, voltageV: 208, location: 'Pasillo del piso 2' });
  const hvac = node('tablero', 'TD-AA · Aires acondicionados', main.id, { breakerA: 225, phases: 3, voltageV: 208, location: 'Cubierta' });
  const labs = node('tablero', 'TD-LAB · Laboratorios', main.id, { breakerA: 100, phases: 3, voltageV: 208, location: 'Laboratorio de física' });
  const electrical: ElectricalNode[] = [
    red,
    transformer,
    meter,
    service,
    main,
    floor1,
    floor2,
    hvac,
    labs,
    node('circuito', 'C1 · Iluminación aulas 601–602', floor1.id, { breakerA: 20, phases: 1, voltageV: 120, conductor: '2×12 AWG' }),
    node('circuito', 'C2 · Tomas aulas 601–602', floor1.id, { breakerA: 20, phases: 1, voltageV: 120, conductor: '2×12 AWG' }),
    node('circuito', 'C3 · Iluminación aulas 603–604', floor1.id, { breakerA: 20, phases: 1, voltageV: 120, conductor: '2×12 AWG' }),
    node('circuito', 'C-AA1 · Mini-split aula 601', hvac.id, { breakerA: 20, phases: 2, voltageV: 208, conductor: '2×12 AWG' }),
    node('circuito', 'C-AA2 · Aire central del laboratorio', hvac.id, { breakerA: 40, phases: 3, voltageV: 208, conductor: '3×8 AWG' }),
  ];

  const equipment: Equipment[] = EQUIPMENT.map(([name, category, powerKw, quantity, hoursPerDay, useFactor, operatingDaysPerMonth, extra]) => ({
    ...stamp(),
    name,
    category,
    powerKw,
    quantity,
    hoursPerDay,
    useFactor,
    operatingDaysPerMonth,
    condition: 'bueno',
    ...(category === 'climatizacion' ? { panelId: hvac.id } : {}),
    ...extra,
  }));
  const miniSplit = equipment[0];

  const measurements: Measurement[] = [
    {
      ...stamp(),
      takenAt: '2026-09-08T10:30',
      pointType: 'tablero',
      pointId: main.id,
      phases: 3,
      voltageRef: 'LL',
      voltageV: [209, 211, 208],
      currentA: [312, 298, 276],
      kw: 97.4,
      kva: 107.1,
      kvar: 44.6,
      pf: 0.91,
      thdV: 2.8,
      thdI: 11.5,
      instrument: 'Analizador de redes',
      dataType: 'medido',
      notes: 'Hora de mayor ocupación del bloque.',
    },
    {
      ...stamp(),
      takenAt: '2026-09-08T11:15',
      pointType: 'tablero',
      pointId: hvac.id,
      phases: 3,
      voltageRef: 'LL',
      voltageV: [208, 210, 207],
      currentA: [168, 151, 139],
      kw: 50.1,
      pf: 0.91,
      instrument: 'Analizador de redes',
      dataType: 'medido',
    },
    {
      ...stamp(),
      takenAt: '2026-09-09T09:00',
      pointType: 'equipo',
      pointId: miniSplit.id,
      phases: 1,
      voltageRef: 'LL',
      voltageV: [207],
      currentA: [8.4],
      kw: 1.62,
      instrument: 'Pinza amperimétrica',
      dataType: 'medido',
      notes: 'Unidad del aula 601 en operación normal.',
    },
  ];

  let cumulative = FIRST_READING;
  const readings: MeterReadingRecord[] = [0, ...DAILY_KWH].map((kwh, day) => {
    cumulative += kwh;
    return { ...stamp(), meter: 'Medidor principal', at: `2026-09-${String(day + 1).padStart(2, '0')}T07:00`, kwh: cumulative };
  });

  await db.transaction('rw', [db.projects, db.bills, db.areas, db.equipment, db.electrical, db.measurements, db.meterReadings], async () => {
    await db.projects.add(project);
    await db.bills.bulkAdd(bills);
    await db.areas.bulkAdd(areas);
    await db.equipment.bulkAdd(equipment);
    await db.electrical.bulkAdd(electrical);
    await db.measurements.bulkAdd(measurements);
    await db.meterReadings.bulkAdd(readings);
  });
  return project;
}
