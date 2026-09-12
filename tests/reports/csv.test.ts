import { describe, expect, it } from 'vitest';
import { toCsv, type CsvColumn } from '@/reports/csv';

interface Fila {
  mes: string;
  kwh: number;
  tarifa: number;
  nota?: string;
}

const filas: Fila[] = [
  { mes: '2026-05', kwh: 18_300, tarifa: 850.25, nota: 'Pico; revisar' },
  { mes: '2026-06', kwh: 13_200, tarifa: 850, nota: '=HYPERLINK("x")' },
  { mes: '2026-07', kwh: 12_600, tarifa: Number.NaN },
];

const columnas: CsvColumn<Fila>[] = [
  { header: 'Mes', value: (f) => f.mes },
  { header: 'kWh', value: (f) => f.kwh },
  { header: 'Tarifa (COP/kWh)', value: (f) => f.tarifa, decimals: 2 },
  { header: 'Nota', value: (f) => f.nota },
];

describe('exportación CSV', () => {
  it('usa el formato de Excel en Colombia', () => {
    const csv = toCsv(filas, columnas);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Mes;kWh;Tarifa (COP/kWh);Nota',
      '2026-05;18300;850,25;"Pico; revisar"',
      `2026-06;13200;850,00;"'=HYPERLINK(""x"")"`,
      '2026-07;12600;;',
      '',
    ]);
  });

  it('también exporta en formato estándar', () => {
    const csv = toCsv(filas.slice(0, 1), columnas, 'estandar');
    expect(csv).toBe('Mes,kWh,Tarifa (COP/kWh),Nota\r\n2026-05,18300,850.25,Pico; revisar\r\n');
  });
});
