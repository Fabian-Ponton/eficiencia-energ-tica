import { describe, expect, it } from 'vitest';
import { peakDemand } from '@/domain/calc/interval';
import { expandDays, groupReadingsByDay, parseDecimal, parseIntervalCsv, parseTimestamp } from '@/domain/importers/intervalCsv';

describe('lectura de números y fechas', () => {
  it('respeta la convención decimal del archivo', () => {
    expect(parseDecimal('1.234,5', ',')).toBe(1234.5);
    expect(parseDecimal('1,234.5', '.')).toBe(1234.5);
    expect(parseDecimal('', ',')).toBeNull();
    expect(parseDecimal('abc', '.')).toBeNull();
  });

  it('reconoce los formatos de fecha habituales', () => {
    const colombiano = parseTimestamp('5/9/2026, 10:42:13 a. m.', 'DMY');
    expect([colombiano?.getMonth(), colombiano?.getDate(), colombiano?.getHours(), colombiano?.getMinutes()]).toEqual([8, 5, 10, 42]);
    const estadounidense = parseTimestamp('09/05/2026 2:15 PM', 'MDY');
    expect([estadounidense?.getMonth(), estadounidense?.getDate(), estadounidense?.getHours()]).toEqual([8, 5, 14]);
    expect(parseTimestamp('2026-03-12T10:45:00', 'DMY')?.getHours()).toBe(10);
    expect(parseTimestamp('2026-02-30 10:00', 'YMD')).toBeNull();
  });
});

describe('importación de archivos de intervalos', () => {
  it('lee un analizador con encabezado propio, punto y coma y coma decimal', () => {
    const archivo = [
      'Equipo: analizador trifásico;;',
      'Sitio: Bloque 6;;',
      'Fecha;Hora;P total (kW)',
      '12/03/2026;10:00:00;48,9',
      '12/03/2026;10:15:00;49,6',
      '12/03/2026;10:30:00;50,1',
      '12/03/2026;10:45:00;53,8',
      '12/03/2026;11:00:00;50,0',
    ].join('\r\n');
    const r = parseIntervalCsv(archivo, {
      skipRows: 2,
      decimal: ',',
      timestampColumn: 'Fecha',
      timeColumn: 'Hora',
      dateOrder: 'DMY',
      valueColumn: 'P total (kW)',
      valueKind: 'potencia',
      unit: 'kW',
    });
    expect(r.readings).toHaveLength(5);
    expect(r.intervalMinutes).toBe(15);
    expect(peakDemand(r.readings)).toMatchObject({ kw: 53.8 });
    expect(r.warnings).toEqual([]);
  });

  it('convierte energía por intervalo del operador en potencia media', () => {
    const archivo = 'timestamp,energy_kwh\n2026-03-12T10:00:00,12.5\n2026-03-12T10:15:00,13.0\n2026-03-12T10:30:00,12.0\n';
    const r = parseIntervalCsv(archivo, {
      decimal: '.',
      timestampColumn: 0,
      dateOrder: 'YMD',
      valueColumn: 'energy_kwh',
      valueKind: 'energia-intervalo',
      unit: 'kWh',
    });
    expect(r.readings.map((x) => x.kw)).toEqual([50, 52, 48]);
  });

  it('usa lecturas acumuladas y avisa cuando el medidor se reinicia', () => {
    const archivo = 'fecha,acumulado\n2026-03-12 10:00,1000000\n2026-03-12 11:00,1045000\n2026-03-12 12:00,1093000\n2026-03-12 13:00,500\n';
    const r = parseIntervalCsv(archivo, {
      decimal: '.',
      timestampColumn: 'fecha',
      dateOrder: 'YMD',
      valueColumn: 'acumulado',
      valueKind: 'energia-acumulada',
      unit: 'Wh',
    });
    expect(r.intervalMinutes).toBe(60);
    expect(r.readings.map((x) => x.kw)).toEqual([45, 48]);
    expect(r.warnings).toHaveLength(1);
  });

  it('rechaza columnas inexistentes o unidades incoherentes', () => {
    const base = { decimal: '.' as const, timestampColumn: 'fecha', dateOrder: 'YMD' as const, valueColumn: 'kw', valueKind: 'potencia' as const, unit: 'kW' as const };
    expect(() => parseIntervalCsv('otra,columna\n1,2\n', base)).toThrow(/columnas/);
    expect(() => parseIntervalCsv('fecha,kw\n', { ...base, unit: 'kWh' })).toThrow(/potencia/);
  });

  it('agrupa por día para guardar y reconstruye sin perder datos', () => {
    const lecturas = [0, 15, 30].map((min, i) => ({ start: new Date(2026, 2, 12, 10, min), kw: 48 + i }));
    const dias = groupReadingsByDay(lecturas, 15);
    expect(dias).toHaveLength(1);
    expect(dias[0].values).toHaveLength(96);
    expect(dias[0].values[40]).toBe(48);
    expect(Number.isNaN(dias[0].values[0])).toBe(true);
    expect(expandDays(dias, 15)).toEqual(lecturas);
  });
});
