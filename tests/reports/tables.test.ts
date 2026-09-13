import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createSampleProject } from '@/db/sampleProject';
import { createDb } from '@/db/schema';
import { toCsv } from '@/reports/csv';
import { loadReportData } from '@/reports/data';
import { buildAuditModel } from '@/reports/model';
import { exportTables } from '@/reports/tables';
import { buildWorkbook } from '@/reports/xlsx';

async function sampleTables(name: string) {
  const db = createDb(name);
  const ejemplo = await createSampleProject(db);
  const tables = exportTables(buildAuditModel(await loadReportData(db, ejemplo.id)));
  db.close();
  return tables;
}

describe('tablas para CSV y Excel', () => {
  it('exporta los registros del levantamiento y los resultados del análisis', async () => {
    const tables = await sampleTables('pontia-prueba-tablas');
    expect(Object.fromEntries(tables.map((t) => [t.id, t.rows.length]))).toEqual({
      inventario: 34,
      facturas: 24,
      espacios: 7,
      'sistema-electrico': 14,
      mediciones: 3,
      lecturas: 9,
      climatizacion: 7,
      iluminacion: 7,
      capacidad: 9,
    });

    const facturas = tables.find((t) => t.id === 'facturas');
    expect(facturas).toBeDefined();
    const [header, first] = toCsv(facturas!.rows as never[], facturas!.columns).replace('﻿', '').split('\r\n');
    expect(header.startsWith('Periodo;Desde;Hasta;Días facturados;Energía (kWh);Reactiva (kvarh);Demanda (kW)')).toBe(true);
    // Octubre de 2024: 31 días, 17.900 kWh, reactiva del 35 % y demanda con coma decimal
    expect(first.startsWith('2024-10;;;31;17900;6265;109,4;')).toBe(true);
  });

  it('arma un libro de Excel con una hoja por tabla', async () => {
    const tables = await sampleTables('pontia-prueba-excel');
    const blob = await buildWorkbook(tables, { title: 'Prueba' });
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());

    expect(workbook.worksheets.map((s) => s.name)).toEqual(tables.map((t) => t.title));
    const inventario = workbook.getWorksheet('Inventario');
    expect(inventario?.getRow(1).getCell(1).value).toBe('Código');
    expect(inventario?.rowCount).toBe(35);
    expect(workbook.getWorksheet('Facturas')?.getRow(2).getCell(5).value).toBe(17900);
    // ExcelJS es pesado: cargarlo, escribir y releer nueve hojas pasa de los 5 s por defecto
  }, 60_000);
});
