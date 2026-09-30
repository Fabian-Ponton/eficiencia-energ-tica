import { describe, expect, it } from 'vitest';
import {
  addRouteYear,
  combinedSavingsKwh,
  defaultBaseYear,
  firstYearCheck,
  implementationYear,
  LEGAL_GOAL_PCT,
  legalGoalOf,
  measureClassOf,
  moveMeasure,
  patchRouteYear,
  planRoute,
  proposeRoute,
  removeRouteYear,
  routeNotices,
  routeRows,
  unassignedMeasures,
} from '@/domain/route';
import type { Measure, RouteYear, Task } from '@/domain/types';

const REFERENCE = 100_000;
/** Cada medida de prueba cae en un uso final distinto, para que no se solapen salvo que la prueba lo pida. */
const CATEGORIAS = ['ti', 'otros', 'motores', 'refrigeracion', 'cocina'] as const;

const medida = (code: string, kwh: number, extra: Partial<Measure> = {}): Measure => ({
  id: `id-${code}`,
  projectId: 'p',
  createdAt: 0,
  updatedAt: 0,
  code,
  title: `Medida ${code}`,
  category: CATEGORIAS[Number(code.replace(/\D/g, '')) % CATEGORIAS.length],
  kind: 'operativa',
  savingsKwhYear: kwh,
  savingsCopYear: kwh * 850,
  investmentCop: kwh * 1000,
  annualCostCop: 0,
  lifetimeYears: 10,
  selected: true,
  priority: 'alta',
  findingIds: [],
  ...extra,
});

const tarea = (measure: string, end: string | undefined): Task => ({
  id: `t-${measure}-${end}`,
  projectId: 'p',
  createdAt: 0,
  updatedAt: 0,
  measureId: `id-${measure}`,
  name: 'Tarea',
  phase: 'corto',
  status: 'pendiente',
  progress: 0,
  end,
});

describe('tipo de medida por retorno (guía UPME de PGEE, Tabla 9)', () => {
  it('A si se recupera en menos de un año, B de uno a tres años y C en más de tres', () => {
    expect(measureClassOf(0)).toBe('A');
    expect(measureClassOf(0.99)).toBe('A');
    expect(measureClassOf(1)).toBe('B');
    expect(measureClassOf(3)).toBe('B');
    expect(measureClassOf(3.01)).toBe('C');
    // Sin ahorro neto la inversión nunca se recupera
    expect(measureClassOf(Number.POSITIVE_INFINITY)).toBe('C');
    expect(measureClassOf(Number.NaN)).toBe('C');
  });
});

describe('año de referencia y meta legal (Ley 1715, art. 30)', () => {
  it('el año de la auditoría sale de su fecha; sin ella, de la última factura o del año actual', () => {
    const hoy = new Date(2026, 8, 30);
    expect(defaultBaseYear({ auditDate: '2025-11-03', lastPeriod: '2026-09', today: hoy })).toBe(2025);
    expect(defaultBaseYear({ lastPeriod: '2026-09', today: hoy })).toBe(2026);
    expect(defaultBaseYear({ today: hoy })).toBe(2026);
    expect(defaultBaseYear({ auditDate: 'sin fecha', today: new Date(2030, 0, 1) })).toBe(2030);
  });

  it('el 15 % del consumo del año anterior, en el año siguiente a la auditoría', () => {
    const meta = legalGoalOf({ baseYear: 2026, referenceKwh: 186_400 });
    expect(meta).toMatchObject({ baseYear: 2026, firstYear: 2027, pct: 15, referenceKwh: 186_400, overridden: false });
    expect(meta.targetKwh).toBeCloseTo(27_960, 6);
    expect(LEGAL_GOAL_PCT).toBe(15);
  });

  it('lo que escribe el auditor manda: el año, el consumo y una meta mayor; una menor sube al 15 %', () => {
    const escrito = legalGoalOf({ stored: { baseYear: 2025, previousYearKwh: 200_000, pct: 20 }, baseYear: 2026, referenceKwh: 186_400 });
    expect(escrito).toMatchObject({ baseYear: 2025, firstYear: 2026, pct: 20, referenceKwh: 200_000, overridden: true });
    expect(escrito.targetKwh).toBe(40_000);
    expect(legalGoalOf({ stored: { pct: 10 }, baseYear: 2026, referenceKwh: 100 }).pct).toBe(15);
    // Un consumo escrito en cero o negativo no reemplaza al de las facturas
    expect(legalGoalOf({ stored: { previousYearKwh: 0 }, baseYear: 2026, referenceKwh: 100 }).referenceKwh).toBe(100);
  });

  it('sin consumo de referencia no hay meta en kWh', () => {
    expect(legalGoalOf({ baseYear: 2026, referenceKwh: null }).targetKwh).toBeNull();
  });
});

describe('año en que entra en operación cada medida', () => {
  it('el de su última tarea con fecha; nunca antes del primer año', () => {
    const m = medida('M1', 1000);
    expect(implementationYear(m, [tarea('M1', '2027-03-30'), tarea('M1', '2028-01-15')], 2027)).toEqual({ year: 2028, basis: 'tareas' });
    expect(implementationYear(m, [tarea('M1', '2026-11-13')], 2027)).toEqual({ year: 2027, basis: 'tareas' });
  });

  it('sin tareas con fecha, lo da la prioridad: alta el primer año, media el segundo y baja el tercero', () => {
    expect(implementationYear(medida('M1', 1, { priority: 'alta' }), [], 2027)).toEqual({ year: 2027, basis: 'prioridad' });
    expect(implementationYear(medida('M2', 1, { priority: 'media' }), [tarea('M2', undefined)], 2027)).toEqual({ year: 2028, basis: 'prioridad' });
    expect(implementationYear(medida('M3', 1, { priority: 'baja' }), [], 2027)).toEqual({ year: 2029, basis: 'prioridad' });
    expect(implementationYear(medida('M4', 1, { priority: undefined }), [], 2027).year).toBe(2029);
    // Las tareas de otra medida no cuentan
    expect(implementationYear(medida('M5', 1, { priority: 'media' }), [tarea('M1', '2030-01-01')], 2027).year).toBe(2028);
  });
});

describe('ahorro combinado de varias medidas', () => {
  it('con medidas que se solapan (iluminación y climatización) descuenta el solapamiento; sin ellas, suma', () => {
    const luces = medida('M1', 10_000, { category: 'iluminacion' });
    const aires = medida('M2', 20_000, { category: 'climatizacion' });
    const solar = medida('M3', 5_000, { category: 'otros' });
    expect(combinedSavingsKwh([solar, medida('M4', 1_000, { category: 'ti' })], REFERENCE)).toBe(6_000);
    const combinado = combinedSavingsKwh([luces, aires], REFERENCE);
    expect(combinado).toBeCloseTo(REFERENCE * (1 - (1 - 0.1) * (1 - 0.2)), 6);
    expect(combinado).toBeLessThan(30_000);
    // Sin consumo de referencia no se puede descontar: queda la suma
    expect(combinedSavingsKwh([luces, aires], null)).toBe(30_000);
    expect(combinedSavingsKwh([], REFERENCE)).toBe(0);
  });
});

describe('ruta propuesta', () => {
  const medidas = [medida('M1', 12_000, { priority: 'alta' }), medida('M2', 9_000, { priority: 'media' }), medida('M3', 4_000, { priority: 'baja' }), medida('M9', 50_000, { selected: false })];

  it('un año por cada año hasta la última medida, con cada medida en el suyo y solo las del plan', () => {
    const ruta = proposeRoute({ measures: medidas, tasks: [], firstYear: 2027, referenceKwh: REFERENCE });
    expect(ruta.map((r) => [r.year, r.measureCodes])).toEqual([
      [2027, ['M1']],
      [2028, ['M2']],
      [2029, ['M3']],
    ]);
  });

  it('las metas suben con el ahorro del plan y el primer año no baja del mínimo legal', () => {
    const ruta = proposeRoute({ measures: medidas, tasks: [], firstYear: 2027, referenceKwh: REFERENCE });
    // 12.000 kWh son el 12 %: el primer año se queda en el 15 % de la ley; luego 21 % y 25 %
    expect(ruta.map((r) => r.targetPct)).toEqual([15, 21, 25]);
  });

  it('con las fechas de las tareas las medidas se acomodan a ellas y se rellenan los años intermedios', () => {
    const ruta = proposeRoute({
      measures: [medida('M1', 20_000, { priority: 'alta' }), medida('M2', 5_000, { priority: 'alta' })],
      tasks: [tarea('M1', '2027-05-01'), tarea('M2', '2029-02-01')],
      firstYear: 2027,
      referenceKwh: REFERENCE,
    });
    expect(ruta.map((r) => [r.year, r.measureCodes])).toEqual([
      [2027, ['M1']],
      [2028, []],
      [2029, ['M2']],
    ]);
  });

  it('sin consumo de referencia solo se propone el mínimo legal del primer año', () => {
    const ruta = proposeRoute({ measures: medidas, tasks: [], firstYear: 2027, referenceKwh: null });
    expect(ruta.map((r) => r.targetPct)).toEqual([15, undefined, undefined]);
  });

  it('sin medidas en el plan la ruta tiene solo el primer año', () => {
    expect(proposeRoute({ measures: [medida('M1', 1, { selected: false })], tasks: [], firstYear: 2027, referenceKwh: REFERENCE })).toEqual([{ year: 2027, targetPct: 15, measureCodes: [] }]);
  });
});

describe('filas de la ruta frente a la meta', () => {
  const medidas = [medida('M1', 12_000), medida('M2', 9_000)];
  const legal = legalGoalOf({ baseYear: 2026, referenceKwh: REFERENCE });
  const entrada = { measures: medidas, tasks: [], firstYear: 2027, referenceKwh: REFERENCE, legal };

  it('acumula el ahorro de las medidas que ya operan y compara con la meta del año', () => {
    const filas = routeRows(
      [
        { year: 2027, measureCodes: ['M1'], targetPct: 15 },
        { year: 2028, measureCodes: ['M2'], targetPct: 21 },
      ],
      entrada,
    );
    expect(filas[0]).toMatchObject({ year: 2027, addedKwh: 12_000, plannedKwh: 12_000, targetPct: 15, targetKwh: 15_000, legalMinimum: true, status: 'no-cumple' });
    expect(filas[0].gapKwh).toBeCloseTo(3_000, 6);
    expect(filas[0].plannedPct).toBeCloseTo(12, 6);
    // 12.000 + 9.000 = 21.000 kWh: el 21 % justo
    expect(filas[1]).toMatchObject({ year: 2028, plannedKwh: 21_000, targetKwh: 21_000, legalMinimum: false, status: 'cumple', gapKwh: 0 });
  });

  it('el mínimo legal manda en el primer año aunque la meta escrita sea menor; los demás años sin meta quedan sin comparar', () => {
    const filas = routeRows(
      [
        { year: 2027, measureCodes: ['M1'], targetPct: 5 },
        { year: 2028, measureCodes: ['M2'] },
      ],
      entrada,
    );
    expect(filas[0].targetPct).toBe(15);
    expect(filas[1]).toMatchObject({ targetPct: null, targetKwh: null, status: 'sin-meta', gapKwh: 0 });
  });

  it('ordena por año, ignora códigos que no están en el plan y toma el presupuesto de las inversiones si no se escribió', () => {
    const filas = routeRows(
      [
        { year: 2028, measureCodes: ['M2', 'M77'], budgetCop: 5 },
        { year: 2027, measureCodes: ['M1'] },
      ],
      entrada,
    );
    expect(filas.map((f) => f.year)).toEqual([2027, 2028]);
    expect(filas[0].budgetCop).toBe(12_000_000);
    expect(filas[1]).toMatchObject({ budgetCop: 5, addedKwh: 9_000 });
  });

  it('una medida repetida en dos años cuenta una sola vez', () => {
    const filas = routeRows(
      [
        { year: 2027, measureCodes: ['M1'] },
        { year: 2028, measureCodes: ['M1'] },
      ],
      entrada,
    );
    expect(filas[1].plannedKwh).toBe(12_000);
  });

  it('el primer año de la ley depende del año de referencia: con otro año de referencia cambia la fila marcada', () => {
    const otra = legalGoalOf({ stored: { baseYear: 2027 }, baseYear: 2026, referenceKwh: REFERENCE });
    const filas = routeRows([{ year: 2027, measureCodes: ['M1'], targetPct: 15 }, { year: 2028, measureCodes: [] }], { ...entrada, legal: otra });
    expect(filas.map((f) => f.legalMinimum)).toEqual([false, true]);
    expect(firstYearCheck(filas)).toMatchObject({ year: 2028, meets: false });
  });
});

describe('avisos de la ruta', () => {
  const medidas = [medida('M1', 12_000), medida('M2', 9_000)];
  const legal = legalGoalOf({ baseYear: 2026, referenceKwh: REFERENCE });
  const filasDe = (ruta: RouteYear[], referenceKwh: number | null = REFERENCE) => routeRows(ruta, { measures: medidas, tasks: [], firstYear: 2027, referenceKwh, legal: legalGoalOf({ baseYear: 2026, referenceKwh }) });

  it('avisa como crítico que el plan no alcanza el 15 % el primer año y cuántos kWh faltan', () => {
    const filas = filasDe([{ year: 2027, measureCodes: ['M1'] }]);
    const avisos = routeNotices(filas, legal, { count: 2, unassigned: ['M2'] });
    const critico = avisos.find((a) => a.tone === 'critical');
    expect(critico?.text).toContain('el año 2027 prevé 12,0 %');
    expect(critico?.text).toContain('al menos 15 %');
    expect(critico?.text).toContain('faltan 3.000 kWh/año');
    expect(avisos.some((a) => a.text.includes('ninguna fila de la ruta menciona: M2'))).toBe(true);
  });

  it('sin consumo, sin medidas o sin el primer año lo dice', () => {
    expect(routeNotices([], legalGoalOf({ baseYear: 2026, referenceKwh: null }), { count: 0, unassigned: [] }).map((a) => a.text)).toEqual([
      'Falta el consumo del año anterior: registra 12 facturas o escríbelo para calcular la meta en kWh.',
      'No hay medidas incluidas en el plan: sin ellas la ruta no prevé ahorros.',
      'La ruta no incluye el año 2027, el primero después de la auditoría, en el que la ley exige al menos 15 % de ahorro.',
    ]);
  });

  it('una ruta que cumple todas sus metas no tiene avisos; una meta que baja de un año a otro es solo una nota', () => {
    const cumple = filasDe([{ year: 2027, measureCodes: ['M1', 'M2'], targetPct: 20 }]);
    expect(routeNotices(cumple, legal, { count: 2, unassigned: [] })).toEqual([]);
    const baja = filasDe([
      { year: 2027, measureCodes: ['M1', 'M2'], targetPct: 20 },
      { year: 2028, measureCodes: [], targetPct: 18 },
    ]);
    expect(routeNotices(baja, legal, { count: 2, unassigned: [] })).toEqual([{ tone: 'info', text: 'Una meta anual es menor que la del año anterior: la ruta acumula ahorros, por eso las metas no suelen bajar.' }]);
  });

  it('un año posterior que no llega a su meta es una advertencia, no un error', () => {
    const filas = filasDe([
      { year: 2027, measureCodes: ['M1', 'M2'], targetPct: 15 },
      { year: 2028, measureCodes: [], targetPct: 30 },
    ]);
    const avisos = routeNotices(filas, legal, { count: 2, unassigned: [] });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ tone: 'warning' });
    expect(avisos[0].text).toContain('El año 2028 prevé 21,0 % y la meta es 30,0 %: faltan 9.000 kWh/año');
  });
});

describe('edición de la ruta', () => {
  const ruta: RouteYear[] = [
    { year: 2027, measureCodes: ['M1', 'M3'], targetPct: 15 },
    { year: 2028, measureCodes: ['M2'] },
  ];

  it('cambia la meta, el presupuesto o la nota de un año sin tocar las medidas ni la ruta original', () => {
    const nueva = patchRouteYear(ruta, 2028, { targetPct: 22, budgetCop: 1_000, note: 'Depende de la cotización' });
    expect(nueva[1]).toEqual({ year: 2028, measureCodes: ['M2'], targetPct: 22, budgetCop: 1_000, note: 'Depende de la cotización' });
    expect(ruta[1]).toEqual({ year: 2028, measureCodes: ['M2'] });
  });

  it('pasa una medida a otro año (la quita de donde estaba) y crea el año si no existe', () => {
    const movida = moveMeasure(ruta, 'M3', 2028);
    expect(movida.map((r) => [r.year, r.measureCodes])).toEqual([
      [2027, ['M1']],
      [2028, ['M2', 'M3']],
    ]);
    const nuevoAnio = moveMeasure(ruta, 'M2', 2030);
    expect(nuevoAnio.map((r) => [r.year, r.measureCodes])).toEqual([
      [2027, ['M1', 'M3']],
      [2028, []],
      [2030, ['M2']],
    ]);
    expect(ruta[0].measureCodes).toEqual(['M1', 'M3']);
  });

  it('agrega el año siguiente al último, o el primero si la ruta está vacía', () => {
    expect(addRouteYear(ruta, 2027).map((r) => r.year)).toEqual([2027, 2028, 2029]);
    expect(addRouteYear([], 2027)).toEqual([{ year: 2027, measureCodes: [] }]);
  });

  it('un año con medidas no se quita: primero hay que pasarlas a otro', () => {
    expect(removeRouteYear(ruta, 2028)).toEqual(ruta);
    const sinMedidas = moveMeasure(ruta, 'M2', 2027);
    expect(removeRouteYear(sinMedidas, 2028).map((r) => r.year)).toEqual([2027]);
  });

  it('las medidas del plan que ninguna fila menciona', () => {
    const medidas = [medida('M1', 1), medida('M2', 1), medida('M10', 1), medida('M11', 1, { selected: false })];
    expect(unassignedMeasures([{ year: 2027, measureCodes: ['M2'] }], medidas).map((m) => m.code)).toEqual(['M1', 'M10']);
  });
});

describe('todo junto', () => {
  const medidas = [medida('M1', 20_000, { priority: 'alta' }), medida('M2', 4_000, { priority: 'media' })];
  const base = { today: new Date(2026, 8, 30), lastPeriod: '2026-09', measures: medidas, tasks: [], referenceKwh: REFERENCE };

  it('sin ruta guardada muestra la propuesta y la marca como tal; con ruta guardada gana la del auditor', () => {
    const propuesta = planRoute({ ...base, stored: undefined });
    expect(propuesta.route.proposed).toBe(true);
    expect(propuesta.legal.firstYear).toBe(2027);
    expect(propuesta.rows.map((r) => r.measureCodes)).toEqual([['M1'], ['M2']]);
    expect(propuesta.firstYear).toMatchObject({ year: 2027, meets: true });
    expect(propuesta.firstYear?.plannedPct).toBeCloseTo(20, 9);
    expect(propuesta.suggested).toEqual({ M1: { year: 2027, basis: 'prioridad' }, M2: { year: 2028, basis: 'prioridad' } });
    expect(propuesta.notices).toEqual([]);

    const guardada = planRoute({ ...base, stored: { annualRoute: [{ year: 2027, measureCodes: ['M2'], targetPct: 15 }] } });
    expect(guardada.route.proposed).toBe(false);
    expect(guardada.firstYear).toMatchObject({ year: 2027, meets: false });
    expect(guardada.unassigned.map((m) => m.code)).toEqual(['M1']);
    expect(guardada.notices.map((n) => n.tone)).toEqual(['warning', 'critical']);
  });

  it('el año de la auditoría de las facturas cambia el primer año de la ruta', () => {
    expect(planRoute({ ...base, auditDate: '2025-06-10' }).legal.firstYear).toBe(2026);
    expect(planRoute({ ...base, stored: { legalGoal: { baseYear: 2024, pct: 15 } } }).legal.firstYear).toBe(2025);
  });
});
