import { describe, expect, it } from 'vitest';
import {
  baseLoadKw,
  dayTypeOf,
  energyByDay,
  loadFactor,
  peakDemand,
  typicalDayProfile,
  weekdayHourMatrix,
  type IntervalReading,
} from '@/domain/calc/interval';

const LABORABLE = [6.7, 6.6, 6.4, 6.4, 6.6, 7.8, 17.8, 32.2, 41.1, 45.6, 48.9, 50.0, 43.4, 44.5, 47.8, 48.9, 46.7, 41.1, 36.7, 33.4, 28.9, 22.2, 12.2, 7.8];
const FIN_SEMANA = [6.7, 6.6, 6.4, 6.4, 6.4, 6.6, 7.2, 8.9, 12.2, 14.5, 15.6, 16.1, 15.6, 15.0, 14.5, 13.9, 13.3, 12.2, 11.1, 10.0, 8.9, 7.8, 7.2, 6.9];

// Semana del lunes 9 al domingo 15 de marzo de 2026, con un registro por hora
const lecturas: IntervalReading[] = [];
for (let dia = 0; dia < 7; dia++) {
  for (let hora = 0; hora < 24; hora++) {
    lecturas.push({ start: new Date(2026, 2, 9 + dia, hora), kw: dia < 5 ? LABORABLE[hora] : FIN_SEMANA[hora] });
  }
}

describe('curva de carga', () => {
  it('reconstruye la curva típica laborable y de fin de semana', () => {
    typicalDayProfile(lecturas, 'laborable').forEach((kw, h) => expect(kw).toBeCloseTo(LABORABLE[h], 10));
    typicalDayProfile(lecturas, 'finDeSemana').forEach((kw, h) => expect(kw).toBeCloseTo(FIN_SEMANA[h], 10));
  });

  it('trata los festivos como días no laborables', () => {
    expect(dayTypeOf(new Date(2026, 2, 9, 10), new Set(['2026-03-09']))).toBe('finDeSemana');
    expect(dayTypeOf(new Date(2026, 2, 10, 10))).toBe('laborable');
  });

  it('encuentra la demanda máxima, la carga base y el factor de carga', () => {
    const pico = peakDemand(lecturas);
    expect(pico?.kw).toBe(50);
    expect(pico?.start.getHours()).toBe(11);
    expect(baseLoadKw(lecturas)).toBeCloseTo(6.4, 10);
    expect(loadFactor(LABORABLE)).toBeCloseTo(0.57475, 5);
  });

  it('integra la energía de cada día', () => {
    const dias = energyByDay(lecturas, 60);
    expect(dias.get('2026-03-09')).toBeCloseTo(689.7, 6);
    expect(dias.get('2026-03-15')).toBeCloseTo(250, 6);
  });

  it('arma la matriz del mapa de calor con el lunes primero', () => {
    const matriz = weekdayHourMatrix(lecturas);
    expect(matriz[0][11]).toBe(50);
    expect(matriz[6][11]).toBe(16.1);
  });
});
