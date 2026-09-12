import { describe, expect, it } from 'vitest';
import {
  areaCooling,
  areaLighting,
  billedPowerFactor,
  capacityAnalysis,
  commercialUnits,
  luminaireGrid,
  resolveSizing,
  utilizationFactor,
} from '@/domain/sizing';
import type { Area, Bill, ElectricalNode, Equipment, Measurement } from '@/domain/types';

const base = { projectId: 'p', createdAt: 0, updatedAt: 0 };
const params = resolveSizing();

const aula = (extra: Partial<Area> = {}): Area => ({
  ...base,
  id: 'a1',
  name: 'Aula 601',
  spaceType: 'aula',
  lengthM: 8,
  widthM: 6,
  heightM: 3,
  workPlaneHeightM: 0.8,
  occupants: 35,
  windowAreaM2: 6,
  windowOrientation: 'N',
  ...extra,
});

let next = 0;
const item = (extra: Partial<Equipment>): Equipment => ({
  ...base,
  id: `e${next++}`,
  name: 'Equipo',
  category: 'otros',
  powerKw: 0.1,
  quantity: 1,
  hoursPerDay: 8,
  operatingDaysPerMonth: 22,
  useFactor: 1,
  condition: 'bueno',
  ...extra,
});

const classroom = [
  item({ category: 'climatizacion', powerKw: 1.65, quantity: 2, capacityBtuH: 18000, areaId: 'a1' }),
  item({ category: 'iluminacion', powerKw: 0.07, quantity: 8, lumens: 5200, areaId: 'a1' }),
  item({ category: 'ti', powerKw: 0.3, useFactor: 0.8, areaId: 'a1' }),
  item({ category: 'ti', powerKw: 5, areaId: 'otra' }),
];

describe('parámetros de referencia', () => {
  it('usa los valores por defecto y los cambios del auditor', () => {
    const custom = resolveSizing({ btuHPerPerson: 400, safetyFactor: Number.NaN, spaces: { aula: { lux: 300 } }, solarBtuHPerM2: { O: 900 } });
    expect(custom.btuHPerPerson).toBe(400);
    expect(custom.safetyFactor).toBe(0.1);
    expect(custom.spaces.aula).toEqual({ lux: 300, envelopeBtuHPerM2: 300, veeiLimit: 3.5 });
    expect(custom.spaces.oficina.lux).toBe(500);
    expect(custom.solarBtuHPerM2).toEqual({ N: 300, S: 500, E: 700, O: 900 });
  });
});

describe('climatización por espacio', () => {
  it('suma envolvente, personas, ventanas, iluminación y equipos con el factor de seguridad', () => {
    const result = areaCooling(aula(), classroom, params);
    expect(result).not.toBeNull();
    const r = result!;
    expect(r.load.components.envelope).toBe(14_400);
    expect(r.load.components.people).toBe(15_750);
    expect(r.load.components.solar).toBe(1_800);
    expect(r.load.components.lighting).toBeCloseTo(1_910.72, 2);
    expect(r.load.components.equipment).toBeCloseTo(818.88, 2);
    expect(r.requiredBtuH).toBeCloseTo(38_147.56, 2);
    expect(r.installedBtuH).toBe(36_000);
    expect(r.units).toBe(2);
    expect(r.ratio).toBeCloseTo(0.9437, 4);
    expect(r.status).toBe('adecuado');
    expect(r.suggestion).toEqual({ count: 1, sizeBtuH: 48_000 });
  });

  it('agrega la carga del techo expuesto y marca el espacio sin aire', () => {
    const r = areaCooling(aula({ roofExposed: true }), [], params)!;
    expect(r.load.components.envelope).toBe(48 * 420);
    expect(r.status).toBe('sin-aire');
    expect(r.ratio).toBeNull();
  });

  it('no evalúa espacios sin área ni exteriores', () => {
    expect(areaCooling(aula({ lengthM: undefined, widthM: undefined }), classroom, params)).toBeNull();
    expect(areaCooling(aula({ spaceType: 'exterior' }), classroom, params)).toBeNull();
  });

  it('propone unidades comerciales iguales', () => {
    expect(commercialUnits(10_000)).toEqual({ count: 1, sizeBtuH: 12_000 });
    expect(commercialUnits(150_000)).toEqual({ count: 3, sizeBtuH: 60_000 });
  });
});

describe('iluminación por espacio', () => {
  it('interpola el coeficiente de utilización según el índice del local', () => {
    expect(utilizationFactor(1.5584)).toBeCloseTo(0.56584, 4);
    expect(utilizationFactor(0.3)).toBe(0.35);
    expect(utilizationFactor(9)).toBe(0.74);
  });

  it('aplica el método de los lúmenes, la densidad de potencia y el VEEI', () => {
    const r = areaLighting(aula({ measuredLuxAvg: 312 }), classroom, params)!;
    expect(r.roomIndex).toBeCloseTo(1.5584, 4);
    expect(r.required.exact).toBeCloseTo(10.196, 3);
    expect(r.required.count).toBe(11);
    expect(r.calculatedLux).toBeCloseTo(392.3, 1);
    expect(r.basis).toBe('medido');
    expect(r.status).toBe('insuficiente');
    expect(r.lpd).toBeCloseTo(11.667, 3);
    expect(r.veei).toBeCloseTo(3.739, 3);
    expect(r.veeiOk).toBe(false);
  });

  it('usa la iluminancia calculada o la luminaria de referencia cuando faltan datos', () => {
    const calculated = areaLighting(aula(), classroom, params)!;
    expect(calculated.basis).toBe('calculado');
    expect(calculated.status).toBe('insuficiente');
    const noLumens = areaLighting(aula(), [item({ category: 'iluminacion', powerKw: 0.04, quantity: 6, areaId: 'a1' })], params)!;
    expect(noLumens.lumensAssumed).toBe(true);
    expect(noLumens.lumensBasis).toBe(4000);
    expect(noLumens.calculatedLux).toBeNull();
  });

  it('reparte las luminarias en filas y columnas parejas', () => {
    const eight = luminaireGrid(8, 8, 6);
    expect([eight.cols, eight.rows, eight.points.length]).toEqual([4, 2, 8]);
    expect(eight.points[0]).toEqual({ x: 1, y: 1.5 });
    const eleven = luminaireGrid(11, 8, 6);
    expect([eleven.cols, eleven.rows, eleven.points.length]).toEqual([4, 3, 11]);
    expect(eleven.points.filter((p) => p.y === 5)).toHaveLength(3);
    expect(luminaireGrid(0, 8, 6).points).toEqual([]);
  });
});

describe('capacidad del sistema eléctrico', () => {
  const node = (id: string, kind: ElectricalNode['kind'], parentId: string | undefined, extra: Partial<ElectricalNode> = {}): ElectricalNode => ({
    ...base,
    id,
    kind,
    name: id,
    parentId,
    ...extra,
  });
  const nodes = [
    node('red', 'red', undefined),
    node('T1', 'transformador', 'red', { ratedKva: 150, secondaryV: '208/120 V' }),
    node('acometida', 'acometida', 'T1', { ampacityA: 460, phases: 3 }),
    node('TGD', 'tablero', 'acometida', { breakerA: 400, phases: 3 }),
    node('TD-AA', 'tablero', 'TGD', { breakerA: 225, phases: 3 }),
    node('TD-P1', 'tablero', 'TGD', { breakerA: 125, phases: 3 }),
    node('TD-X', 'tablero', 'TGD', { phases: 3 }),
  ];
  const measurement = (pointId: string, takenAt: string, currentA: number[], kw: number): Measurement => ({
    ...base,
    id: pointId,
    takenAt,
    pointType: 'tablero',
    pointId,
    phases: 3,
    voltageRef: 'LL',
    voltageV: [209, 211, 208],
    currentA,
    kw,
    pf: 0.91,
    dataType: 'medido',
  });
  const measurements = [measurement('TGD', '2026-09-08T10:30', [312, 298, 276], 97.4), measurement('TD-AA', '2026-09-08T11:15', [168, 151, 139], 50.1)];
  const bills: Bill[] = Array.from({ length: 12 }, (_, i) => ({
    ...base,
    id: `b${i}`,
    period: `2026-${String(i + 1).padStart(2, '0')}`,
    kwh: 17_000,
    kvarh: 5_950,
    demandKw: i === 4 ? 111.8 : 100,
    costCop: 0,
  }));
  const equipment = [
    item({ powerKw: 0.86, quantity: 4, panelId: 'TD-P1' }),
    item({ powerKw: 1, quantity: 2, panelId: 'TD-X' }),
  ];

  const result = capacityAnalysis({ nodes, equipment, measurements, bills, series: [], params });

  it('toma la mayor demanda registrada y el factor de potencia medido', () => {
    expect(result.facility).toMatchObject({ kw: 111.8, basis: 'factura', source: '2026-05', pf: 0.91, pfBasis: 'medido' });
    expect(result.facility?.kva).toBeCloseTo(122.857, 3);
  });

  it('verifica el transformador, la acometida y los tableros con su criterio', () => {
    const check = (id: string) => result.byNode.get(id);
    expect(check('T1')?.ratio).toBeCloseTo(0.819, 3);
    expect(check('T1')?.level).toBe('critica');
    expect(check('acometida')?.load).toBeCloseTo(341.02, 2);
    expect(check('acometida')?.level).toBe('alta');
    expect(check('TGD')?.basis).toBe('factura');
    expect(check('TGD')?.level).toBe('critica');
    expect(check('TD-AA')).toMatchObject({ load: 168, basis: 'medido', level: 'alta' });
    expect(check('TD-P1')?.basis).toBe('instalado');
    expect(check('TD-P1')?.load).toBeCloseTo(6.296, 3);
    expect(check('TD-P1')?.level).toBe('normal');
    expect(result.missingCapacity.map((n) => n.id)).toEqual(['TD-X']);
    expect(result.checks.map((c) => c.node.id)).toEqual(['T1', 'acometida', 'TGD', 'TD-AA', 'TD-P1']);
  });

  it('calcula el desbalance de la medición más reciente de cada tablero', () => {
    const hvac = result.imbalance.find((r) => r.point === 'TD-AA');
    expect(hvac?.imbalance).toBeCloseTo(0.1004, 4);
    expect(hvac?.level).toBe('alto');
    expect(result.imbalance.find((r) => r.point === 'TGD')?.level).toBe('normal');
  });

  it('deduce el factor de potencia de las facturas con reactiva', () => {
    expect(billedPowerFactor(bills)).toBeCloseTo(0.9439, 4);
    expect(billedPowerFactor([])).toBeNull();
  });
});
