import { describe, expect, it } from 'vitest';
import { budgetByPhase, FUNDING_SOURCES, ganttRows, monthlyBudget, planCashFlow, planTasks, scheduleSummary, taskDays } from '@/domain/implementation';
import type { Measure, Task } from '@/domain/types';

const measure = (id: string, code: string, priority: Measure['priority'], kind: Measure['kind'], extra: Partial<Measure> = {}): Measure => ({
  id,
  projectId: 'p',
  createdAt: 0,
  updatedAt: 0,
  code,
  title: `Medida ${code}`,
  category: 'iluminacion',
  kind,
  savingsKwhYear: 1000,
  savingsCopYear: 1_200_000,
  investmentCop: 1_200_000,
  annualCostCop: 0,
  lifetimeYears: 10,
  selected: true,
  priority,
  findingIds: [],
  ...extra,
});
const task = (extra: Partial<Task>): Task => ({ id: crypto.randomUUID(), projectId: 'p', createdAt: 0, updatedAt: 0, name: 'Tarea', phase: 'corto', status: 'pendiente', progress: 0, ...extra });

describe('plan de implementación', () => {
  it('propone preparación y ejecución por medida, en el plazo que da su prioridad', () => {
    const tasks = planTasks(
      [measure('a', 'M1', 'alta', 'operativa'), measure('b', 'M2', 'media', 'baja-inversion'), measure('c', 'M3', 'media', 'alta-inversion'), measure('d', 'M4', 'alta', 'operativa', { selected: false })],
      'p',
      '2027-01-01',
    );
    expect(tasks).toHaveLength(6);
    expect(tasks[0]).toMatchObject({ measureId: 'a', phase: 'corto', start: '2027-01-01', end: '2027-01-14', budgetCop: undefined });
    expect(tasks[1]).toMatchObject({ measureId: 'a', start: '2027-01-15', end: '2027-03-15', budgetCop: 1_200_000, kpi: '1.000 kWh/año ahorrados' });
    // Mediano plazo: seis meses después; la segunda medida del mismo plazo arranca un mes más tarde
    expect(tasks[2]).toMatchObject({ measureId: 'b', phase: 'mediano', start: '2027-07-01', end: '2027-07-30' });
    expect(tasks[3]).toMatchObject({ start: '2027-07-31', end: '2027-09-28' });
    expect(tasks[4]).toMatchObject({ measureId: 'c', start: '2027-08-01' });
    expect(taskDays({ start: '2027-01-01', end: '2027-01-31' })).toBe(31);
    expect(taskDays({ start: '2027-02-01', end: '2027-01-31' })).toBeNull();
  });

  it('la ejecución de una medida que interviene la instalación eléctrica sale con obra y el RETIE por definir; las buenas prácticas y la preparación, no', () => {
    const tasks = planTasks(
      [
        measure('a', 'M1', 'alta', 'operativa'),
        measure('b', 'M2', 'alta', 'baja-inversion'),
        measure('c', 'M3', 'media', 'alta-inversion', { savingsType: 'fncer' }),
      ],
      'p',
      '2027-01-01',
    );
    const de = (id: string) => tasks.filter((t) => t.measureId === id);
    // Operativa: ninguna tarea toca la instalación
    expect(de('a').every((t) => !t.works && !t.retie)).toBe(true);
    // Baja inversión: solo la última tarea (la instalación) es obra, una remodelación con el RETIE por definir
    expect(de('b')[0].works).toBeUndefined();
    expect(de('b')[1].works).toEqual({ interventionType: 'remodelacion' });
    expect(de('b')[1].retie).toEqual({ applies: 'por-definir', documents: [], status: 'pendiente' });
    // Generación con FNCER: instalación nueva
    expect(de('c')[1].works).toEqual({ interventionType: 'nueva' });
  });

  it('entre las fuentes de financiación están los ahorros reinvertidos (Ley 1715, art. 30) y el FENOGE', () => {
    expect(FUNDING_SOURCES).toContain('Ahorros reinvertidos (Ley 1715, art. 30)');
    expect(FUNDING_SOURCES).toContain('FENOGE');
    expect(FUNDING_SOURCES).toContain('Recursos propios');
  });

  it('reparte el presupuesto por días y pondera el avance por la duración', () => {
    const budget = monthlyBudget([task({ start: '2027-01-16', end: '2027-02-14', budgetCop: 3_000_000 })]);
    expect(budget.get('2027-01')).toBeCloseTo(1_600_000);
    expect(budget.get('2027-02')).toBeCloseTo(1_400_000);
    const summary = scheduleSummary(
      [task({ start: '2027-01-01', end: '2027-01-10', progress: 100, status: 'implementada' }), task({ start: '2027-01-11', end: '2027-02-09' })],
      '2027-03-01',
    );
    // 10 días hechos de 40
    expect(summary.progress).toBeCloseTo(0.25);
    expect(summary).toMatchObject({ count: 2, done: 1, overdue: 1, start: '2027-01-01', end: '2027-02-09' });
  });

  it('el flujo de caja se recupera cuando el ahorro acumulado alcanza la inversión', () => {
    const flow = planCashFlow([measure('a', 'M1', 'alta', 'baja-inversion')], [task({ measureId: 'a', start: '2027-01-01', end: '2027-01-31', budgetCop: 1_200_000 })], { tariffEscalation: 0 });
    expect(flow.periods[0]).toBe('2027-01');
    expect(flow.investment[0]).toBeCloseTo(1_200_000);
    // El ahorro empieza en febrero: 100.000 al mes, doce meses hasta enero de 2028
    expect(flow.savings[0]).toBe(0);
    expect(flow.savings[1]).toBeCloseTo(100_000);
    expect(flow.breakEven).toBe('2028-01');
    expect(flow).toMatchObject({ scheduled: 1, unscheduled: 0 });
    expect(planCashFlow([measure('a', 'M1', 'alta', 'baja-inversion')], [], { tariffEscalation: 0 })).toMatchObject({ periods: [], unscheduled: 1 });
  });

  it('ordena el Gantt por plazo y fecha y marca las atrasadas', () => {
    const tasks = [task({ name: 'B', phase: 'mediano', start: '2027-02-01', end: '2027-02-10' }), task({ name: 'A', phase: 'corto', start: '2027-03-01', end: '2027-03-05' }), task({ name: 'Sin fechas' })];
    const rows = ganttRows(tasks, [], '2027-03-10');
    expect(rows.map((r) => r.label)).toEqual(['A', 'B']);
    expect(rows[0]).toMatchObject({ index: 1, overdue: true });
    // El presupuesto por plazo cuenta también las tareas sin fechas
    expect(budgetByPhase(tasks).map((p) => p.count)).toEqual([2, 1, 0]);
  });
});
