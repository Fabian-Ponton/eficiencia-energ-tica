import type { Area, Bill, EndUseCategory, Equipment, Project } from '@/domain/types';
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
    calendar: { daysPerWeek: 5, holidays: [], vacationDaysPerYear: 40 },
    economics: { tariffCopPerKwh: TARIFF, discountRate: 0.12, tariffEscalation: 0.04, horizonYears: 10, emissionFactorKgPerKwh: 0.126 },
    peakSunHours: 5.5,
  };

  const bills: Bill[] = PERIODS.map((period, i) => ({ ...stamp(), period, kwh: KWH[i], costCop: KWH[i] * TARIFF, tariffCopPerKwh: TARIFF }));

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
    ...extra,
  }));

  await db.transaction('rw', [db.projects, db.bills, db.areas, db.equipment], async () => {
    await db.projects.add(project);
    await db.bills.bulkAdd(bills);
    await db.areas.bulkAdd(areas);
    await db.equipment.bulkAdd(equipment);
  });
  return project;
}
