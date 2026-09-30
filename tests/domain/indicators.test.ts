import { describe, expect, it } from 'vitest';
import { activityIndicators, laboratoryIndicators, operatingWeeksPerYear } from '@/domain/calc/indicators';
import type { Area, Bill, Equipment, OccupancyRecord } from '@/domain/types';

const area = (id: string, name: string, spaceType: string, extra: Partial<Area> = {}): Area => ({ id, projectId: 'p', createdAt: 0, updatedAt: 0, name, spaceType, ...extra }) as Area;
const equipo = (id: string, areaId: string, powerKw: number, hoursPerDay: number): Equipment =>
  ({ id, projectId: 'p', createdAt: 0, updatedAt: 0, name: id, category: 'laboratorio', areaId, powerKw, quantity: 1, hoursPerDay, operatingDaysPerMonth: 20, useFactor: 1, condition: 'bueno' }) as Equipment;
const bloque = (areaId: string, hours: number, day: string, avgOccupants?: number): OccupancyRecord =>
  ({ id: `${areaId}-${day}`, projectId: 'p', createdAt: 0, updatedAt: 0, areaId, term: '2026-1', activity: 'Práctica', day, start: '07:00', end: '11:00', hours, avgOccupants }) as OccupancyRecord;

describe('indicadores por laboratorio', () => {
  const areas = [
    area('q', 'Laboratorio de química', 'lab-quimica', { lengthM: 10, widthM: 8 }),
    area('c', 'Laboratorio de cómputo', 'lab-computo', { lengthM: 8, widthM: 6 }),
    area('a', 'Aula 101', 'aula', { lengthM: 8, widthM: 6 }),
    area('s', 'Laboratorio sin equipos', 'lab-fisica'),
  ];
  const equipos = [equipo('e1', 'q', 2, 8), equipo('e2', 'c', 1, 10), equipo('e3', 'a', 1, 6)];
  // L-V de 4 h: 20 h por semana en química, 8 h por semana en cómputo (solo los lunes y miércoles)
  const horarios = [bloque('q', 4, 'L-V', 20), bloque('c', 4, 'L,X', 30)];

  it('solo cuenta los laboratorios que tienen equipos y calcula kWh/m² y kWh por hora de uso', () => {
    const filas = laboratoryIndicators(areas, equipos, horarios, { weeksPerYear: 40 });
    // Ordenados por intensidad: cómputo (50 kWh/m²) antes que química (48)
    expect(filas.map((f) => f.name)).toEqual(['Laboratorio de cómputo', 'Laboratorio de química']);
    const [computo, quimica] = filas;
    // Química: 2 kW × 8 h × 20 d × 12 = 3.840 kWh/año en 80 m²; 20 h/semana × 40 semanas = 800 h
    expect(quimica.annualKwh).toBeCloseTo(3840, 6);
    expect(quimica.kwhPerM2Year).toBeCloseTo(48, 6);
    expect(quimica.weeklyHours).toBe(20);
    expect(quimica.kwhPerUseHour).toBeCloseTo(3840 / 800, 6);
    expect(quimica.kwhPerPersonHour).toBeCloseTo(3840 / 800 / 20, 6);
    // Cómputo: 1 kW × 10 h × 20 d × 12 = 2.400 kWh/año en 48 m²; 8 h/semana × 40 = 320 h
    expect(computo.kwhPerM2Year).toBeCloseTo(50, 6);
    expect(computo.kwhPerUseHour).toBeCloseTo(2400 / 320, 6);
  });

  it('un laboratorio sin horario registrado no tiene indicador por hora, y con all entran también las aulas', () => {
    const sinHorario = laboratoryIndicators(areas, equipos, [], { weeksPerYear: 40 });
    expect(sinHorario.every((f) => f.weeklyHours === null && f.kwhPerUseHour === null && f.kwhPerPersonHour === null)).toBe(true);
    expect(laboratoryIndicators(areas, equipos, horarios, { all: true }).map((f) => f.name)).toContain('Aula 101');
  });

  it('las semanas de operación descuentan las vacaciones colectivas', () => {
    expect(operatingWeeksPerYear({ vacationDaysPerYear: 0 })).toBeCloseTo(52.14, 2);
    expect(operatingWeeksPerYear({ vacationDaysPerYear: 60 })).toBeCloseTo(43.57, 2);
    expect(operatingWeeksPerYear({ vacationDaysPerYear: 400 })).toBe(1);
  });
});

describe('indicadores por actividad', () => {
  const factura = (period: string, kwh: number, populationServed?: number, practiceHours?: number): Bill => ({ id: period, projectId: 'p', createdAt: 0, updatedAt: 0, period, kwh, costCop: 0, populationServed, practiceHours }) as Bill;

  it('divide la energía entre las personas y las horas de los meses que traen el dato', () => {
    const bills = [factura('2026-01', 10_000, 500, 200), factura('2026-02', 12_000, 600, undefined), factura('2026-03', 9_000)];
    const r = activityIndicators(bills);
    expect(r.kwhPerPerson).toBeCloseTo(22_000 / 1100, 6);
    expect(r.monthsWithPeople).toBe(2);
    expect(r.kwhPerPracticeHour).toBeCloseTo(10_000 / 200, 6);
    expect(r.monthsWithHours).toBe(1);
  });

  it('sin la variable no hay indicador y solo cuentan los últimos meses pedidos', () => {
    expect(activityIndicators([factura('2026-01', 100)]).kwhPerPerson).toBeNull();
    const bills = ['2026-01', '2026-02', '2026-03'].map((p, i) => factura(p, 100 * (i + 1), 10));
    expect(activityIndicators(bills, 2).kwhPerPerson).toBeCloseTo(500 / 20, 6);
  });
});
