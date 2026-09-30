import { describe, expect, it } from 'vitest';
import { cellText, isND, matchOption, norm, normHeader, parseDate, parseNumber, parsePeriod, parsePower, parseTime, parseYesNo, plainCell } from '@/db/formatsCells';

describe('lectura de celdas de los formatos', () => {
  it('reduce el valor que entrega Excel a un valor simple', () => {
    expect(plainCell('  hola ')).toBe('hola');
    expect(plainCell('   ')).toBeUndefined();
    expect(plainCell(null)).toBeUndefined();
    expect(plainCell(12)).toBe(12);
    expect(plainCell({ richText: [{ text: 'Aula ' }, { text: '601' }] })).toBe('Aula 601');
    expect(plainCell({ formula: 'A1*2', result: 24 })).toBe(24);
    expect(plainCell({ text: 'enlace', hyperlink: 'https://x' })).toBe('enlace');
    expect(plainCell({ error: '#N/A' })).toBeUndefined();
  });

  it('N/D es dato no disponible y no cuenta como texto', () => {
    for (const nd of ['N/D', 'n/d', ' N / D ']) expect(isND(nd)).toBe(true);
    expect(isND('ND')).toBe(false);
    expect(cellText('N/D')).toBeUndefined();
    expect(cellText('  Aula 601 ')).toBe('Aula 601');
    expect(cellText(undefined)).toBeUndefined();
  });

  it('compara textos y encabezados sin tildes, mayúsculas ni unidades', () => {
    expect(norm('  Área   ÚTIL ')).toBe('area util');
    expect(normHeader('Potencia (W/kW)')).toBe('potencia');
    expect(normHeader('Aire usado (Sí/No)')).toBe('aire usado');
    expect(normHeader('V (V)')).toBe('v');
    expect(normHeader('Potencia/unidad (W)')).toBe('potencia/unidad');
  });

  it('lee números escritos a la colombiana o a la inglesa', () => {
    expect(parseNumber(12.5)).toBe(12.5);
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('1.500')).toBe(1500);
    expect(parseNumber('0.75')).toBe(0.75);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('$ 850')).toBe(850);
    expect(parseNumber('-3')).toBe(-3);
    expect(parseNumber('1.234.567')).toBe(1_234_567);
    expect(parseNumber('abc')).toBeUndefined();
    expect(parseNumber('N/D')).toBeUndefined();
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber(Number.NaN)).toBeUndefined();
  });

  it('la potencia exige unidad, salvo que el encabezado ya la fije', () => {
    expect(parsePower('1500 W')).toEqual({ kw: 1.5 });
    expect(parsePower('1500W')).toEqual({ kw: 1.5 });
    expect(parsePower('1,5 kW')).toEqual({ kw: 1.5 });
    expect(parsePower('2 kw')).toEqual({ kw: 2 });
    expect(parsePower('1 500 W')).toEqual({ kw: 1.5 });
    expect(parsePower('2 HP').kw).toBeCloseTo(1.492, 6);
    expect(parsePower('1500')).toEqual({ problem: 'sin-unidad', raw: '1500' });
    expect(parsePower(1500)).toEqual({ problem: 'sin-unidad', raw: '1500' });
    expect(parsePower('220 V')).toMatchObject({ problem: 'no-numero' });
    expect(parsePower('mucha')).toMatchObject({ problem: 'no-numero' });
    expect(parsePower('N/D')).toEqual({});
    expect(parsePower(undefined)).toEqual({});
    // En «Potencia/unidad (W)» el encabezado ya dice que son vatios
    expect(parsePower(36, 'W')).toEqual({ kw: 0.036 });
    expect(parsePower('40', 'W')).toEqual({ kw: 0.04 });
    expect(parsePower('0,04 kW', 'W')).toEqual({ kw: 0.04 });
  });

  it('lee fechas de Excel, en texto día-mes-año y con el mes escrito', () => {
    expect(parseDate(new Date(Date.UTC(2026, 2, 15)))).toBe('2026-03-15');
    expect(parseDate('2026-03-15')).toBe('2026-03-15');
    expect(parseDate('15/03/2026')).toBe('2026-03-15');
    expect(parseDate('5-3-26')).toBe('2026-03-05');
    expect(parseDate('15 sep 2026')).toBe('2026-09-15');
    expect(parseDate('15 de septiembre de 2026')).toBe('2026-09-15');
    expect(parseDate(46096)).toBe('2026-03-15');
    expect(parseDate('31/02/2026')).toBeUndefined();
    expect(parseDate('mañana')).toBeUndefined();
    expect(parseDate('N/D')).toBeUndefined();
    expect(parseDate(12)).toBeUndefined();
  });

  it('lee horas de Excel, fracciones de día y texto con a. m. y p. m.', () => {
    expect(parseTime('07:00')).toBe('07:00');
    expect(parseTime('7:30')).toBe('07:30');
    expect(parseTime('7:30 a. m.')).toBe('07:30');
    expect(parseTime('5 pm')).toBe('17:00');
    expect(parseTime('12:15 a. m.')).toBe('00:15');
    expect(parseTime('19h')).toBe('19:00');
    expect(parseTime(new Date(Date.UTC(1899, 11, 30, 7, 0)))).toBe('07:00');
    expect(parseTime(7 / 24)).toBe('07:00');
    expect(parseTime(7)).toBe('07:00');
    expect(parseTime('25:00')).toBeUndefined();
    expect(parseTime('tarde')).toBeUndefined();
  });

  it('lee el periodo de la factura como AAAA-MM', () => {
    for (const texto of ['sep-2026', 'Sep 2026', 'septiembre de 2026', '2026-09', '09/2026', '9-2026', '2026/09', '15/09/2026', 'sep-26']) {
      expect(parsePeriod(texto), texto).toBe('2026-09');
    }
    expect(parsePeriod(new Date(Date.UTC(2026, 8, 1)))).toBe('2026-09');
    expect(parsePeriod('2026-13')).toBeUndefined();
    expect(parsePeriod('otoño')).toBeUndefined();
  });

  it('lee Sí y No, y elige opciones del catálogo por su nombre', () => {
    expect(parseYesNo('Sí')).toBe(true);
    expect(parseYesNo('si')).toBe(true);
    expect(parseYesNo('X')).toBe(true);
    expect(parseYesNo('No')).toBe(false);
    expect(parseYesNo(true)).toBe(true);
    expect(parseYesNo('tal vez')).toBeUndefined();
    const opciones = [
      { id: 'bueno', label: 'Bueno' },
      { id: 'regular', label: 'Regular', aliases: ['medio'] },
    ] as const;
    expect(matchOption('BUENO', opciones)).toBe('bueno');
    expect(matchOption(' medio ', opciones)).toBe('regular');
    expect(matchOption('excelente', opciones)).toBeUndefined();
    expect(matchOption('N/D', opciones)).toBeUndefined();
  });
});
