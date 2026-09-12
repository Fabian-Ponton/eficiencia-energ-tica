import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { detectDecimal, detectLayout, layoutToMapping } from '@/domain/importers/detect';
import { excelToText } from '@/domain/importers/excel';
import { parseIntervalCsv } from '@/domain/importers/intervalCsv';

describe('detección automática del formato del archivo', () => {
  it('encuentra encabezado, columnas, orden de la fecha y coma decimal de un analizador', () => {
    const archivo = [
      'Equipo: analizador trifásico;;',
      'Sitio: Bloque 6;;',
      'Fecha;Hora;P total (kW)',
      '12/03/2026;10:00:00;48,9',
      '13/03/2026;10:15:00;49,6',
      '13/03/2026;10:30:00;50,1',
    ].join('\r\n');
    const d = detectLayout(archivo);
    expect(d).toMatchObject({ skipRows: 2, hasHeader: true, timestampColumn: 0, timeColumn: 1, valueColumn: 2, decimal: ',', dateOrder: 'DMY', valueKind: 'potencia', unit: 'kW' });
    expect(d?.headers).toEqual(['Fecha', 'Hora', 'P total (kW)']);
    expect(parseIntervalCsv(archivo, layoutToMapping(d!)).readings).toHaveLength(3);
  });

  it('reconoce archivos del operador con energía por intervalo y punto decimal', () => {
    const d = detectLayout('timestamp,energy_kwh\n2026-03-12T10:00:00,12.5\n2026-03-12T10:15:00,13.0\n');
    expect(d).toMatchObject({ skipRows: 0, hasHeader: true, timestampColumn: 0, valueColumn: 1, decimal: '.', dateOrder: 'YMD', valueKind: 'energia-intervalo', unit: 'kWh' });
    expect(d?.timeColumn).toBeUndefined();
  });

  it('elige la columna de potencia total aunque haya otras numéricas', () => {
    const d = detectLayout('Fecha y hora;V L1;I L1;P total (kW)\n05/09/2026 10:00;208,4;150,2;48,9\n05/09/2026 10:15;209,1;151,0;49,6\n');
    expect(d?.valueColumn).toBe(3);
  });

  it('distingue la coma y el punto decimal sin confundir los miles', () => {
    expect(detectDecimal([['1.234,5', '48,9']])).toBe(',');
    expect(detectDecimal([['1,234.5', '48.9']])).toBe('.');
    expect(detectDecimal([['1.234']])).toBe('.');
  });

  it('devuelve null si el archivo no tiene fechas y valores', () => {
    expect(detectLayout('hola\nmundo\n')).toBeNull();
  });
});

describe('archivos de Excel', () => {
  it('convierte la primera hoja en texto con fechas locales y punto decimal', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Datos');
    sheet.addRow(['Fecha', 'P total (kW)']);
    sheet.addRow([new Date(Date.UTC(2026, 2, 12, 10, 0, 0)), 48.9]);
    sheet.addRow([new Date(Date.UTC(2026, 2, 12, 10, 15, 0)), 49.6]);
    const buffer = await workbook.xlsx.writeBuffer();
    const { text, sheet: name } = await excelToText(buffer as unknown as ArrayBuffer);
    expect(name).toBe('Datos');
    expect(text.split('\n')).toEqual(['Fecha;P total (kW)', '2026-03-12 10:00:00;48.9', '2026-03-12 10:15:00;49.6']);
    expect(detectLayout(text)).toMatchObject({ timestampColumn: 0, valueColumn: 1, decimal: '.', dateOrder: 'YMD' });
  });
});
