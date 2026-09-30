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

/** Filas del CSV sin la marca BOM del inicio. */
const csvLines = (table: { rows: unknown[]; columns: unknown[] }) => toCsv(table.rows as never[], table.columns as never[]).replace('﻿', '').split('\r\n');

describe('tablas para CSV y Excel', () => {
  it('exporta los registros del levantamiento, los resultados del análisis y el plan', async () => {
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
      hallazgos: 5,
      medidas: 5,
      'ruta-anual': 2,
      tareas: 8,
    });

    const [header, first] = csvLines(tables.find((t) => t.id === 'facturas')!);
    expect(header.startsWith('Periodo;Desde;Hasta;Días facturados;Energía (kWh);Reactiva (kvarh);Demanda (kW)')).toBe(true);
    // Octubre de 2024: 31 días, 17.900 kWh, reactiva del 35 % y demanda con coma decimal
    expect(first.startsWith('2024-10;;;31;17900;6265;109,4;')).toBe(true);

    // Medidas: código, título, uso final y tipo como texto; la columna del plan dice «Sí» o «No»
    const [measuresHeader, m1] = csvLines(tables.find((t) => t.id === 'medidas')!);
    expect(measuresHeader.startsWith('Código;Medida;Uso final;Tipo;Ahorro (kWh/año)')).toBe(true);
    expect(m1.startsWith('M1;Cambio a iluminación LED (206 luminarias);Iluminación;Baja inversión;')).toBe(true);
    expect(m1).toContain(';Sí;');
    const [findingsHeader] = csvLines(tables.find((t) => t.id === 'hallazgos')!);
    expect(findingsHeader).toBe('Hallazgo;Gravedad;Tema;Estado;Origen;Descripción;Fecha;Posible causa;Impacto energético;Acción sugerida');
    // Las columnas nuevas de las medidas van después de las que ya existían
    expect(measuresHeader).toContain('Prioridad;Clase de potencial;Consumo actual del sistema (kWh/año);Hallazgos que atiende;Evidencia;Responsable;Plazo;Indicador de seguimiento');
  });

  it('las tareas exportan quién ejecuta, su registro y la verificación del RETIE al final de las columnas de siempre', async () => {
    const tables = await sampleTables('pontia-prueba-tablas-retie');
    const tareas = tables.find((t) => t.id === 'tareas')!;
    const [header, ...filas] = csvLines(tareas);
    expect(header).toContain('Observaciones;Ejecuta;Tipo de ejecutor;Rol del ejecutor;Registro profesional;Intervención eléctrica;Inicio de la obra;Régimen del RETIE;Estado del RETIE;Documentos del RETIE;Verificó (RETIE);Fecha de verificación (RETIE);Justificación (RETIE)');
    const iluminacion = filas.find((f) => f.includes('Contratista de iluminación (ejemplo)'))!;
    expect(iluminacion).toContain(';Contratista de iluminación (ejemplo);empresa;Constructor;CONTE · TE-1;Remodelación;2027-03-31;RETIE de 2026;RETIE pendiente;');
    const solar = filas.find((f) => f.includes('Contratista de energía solar (ejemplo)'))!;
    expect(solar).toContain(';Diseñador y constructor;COPNIA · Ingeniero electricista;Instalación nueva;2027-05-31;RETIE de 2026;RETIE en revisión;Declaración de cumplimiento del diseño DD-ejemplo (cumple);');
    // Las tareas sin obra eléctrica no traen nada de RETIE
    const campana = filas.find((f) => f.startsWith('Preparación de la campaña'))!;
    expect(campana.endsWith(';;;;;;;;;;;;')).toBe(true);
  });

  it('la ruta anual sale con la meta, el ahorro previsto y su estado, y dice si es propuesta o está confirmada', async () => {
    const tables = await sampleTables('pontia-prueba-tablas-ruta');
    const ruta = tables.find((t) => t.id === 'ruta-anual')!;
    const [header, y2027, y2028] = csvLines(ruta);
    expect(header).toBe('Año;Medidas que entran;Ahorro previsto acumulado (kWh/año);Ahorro previsto (% del consumo);Meta (%);Meta (kWh/año);Presupuesto (COP);Estado;Mínimo legal;Origen de la ruta;Nota');
    // 2027: M1, M3 y M4 ahorran 38.941 kWh (20,9 %) frente a la meta del 20,8 %; es el primer año, con el mínimo legal
    expect(y2027.startsWith('2027;M1, M3, M4;38941;20,9;20,8;38771;78600000;Cumple;Sí;Confirmada por el auditor;')).toBe(true);
    expect(y2028.startsWith('2028;M2;40265;21,6;21,6;40262;22400000;Cumple;No;Confirmada por el auditor;')).toBe(true);
  });

  it('los hallazgos de seguridad eléctrica salen en su propia tabla, del más urgente al menos urgente, con la valoración del RETIE', async () => {
    const db = createDb('pontia-prueba-tablas-seguridad');
    const ejemplo = await createSampleProject(db);
    const base = { projectId: ejemplo.id, foundAt: '2026-09-10', real: false, highRisk: false, imminent: false, auto: false, createdAt: 1, updatedAt: 1 } as const;
    const data = await loadReportData(db, ejemplo.id);
    const sinValorar = { ...base, id: 'a', riskFactor: 'sobrecarga', description: 'Circuito de tomas sobrecargado', status: 'abierto' } as const;
    const inminente = {
      ...base,
      id: 'b',
      riskFactor: 'contacto-directo',
      description: 'Conductores desnudos al alcance de los estudiantes',
      status: 'abierto',
      imminent: true,
      real: true,
      consequence: 5,
      frequency: 'b',
      immediateAction: 'Desenergizar el circuito',
      responsible: 'Mantenimiento',
      dueDate: '2026-09-15',
      normRef: 'RETIE 1.5.1',
    } as const;
    const cerrado = { ...base, id: 'c', riskFactor: 'cortocircuito', description: 'Protección reemplazada', status: 'cerrado', consequence: 2, frequency: 'd' } as const;
    const tables = exportTables(buildAuditModel({ ...data, safetyFindings: [inminente, sinValorar, cerrado] }));
    const seguridad = tables.find((t) => t.id === 'seguridad')!;
    expect(seguridad.title).toBe('Seguridad eléctrica');
    expect(seguridad.rows).toHaveLength(3);

    const [header, first, second, third] = csvLines(seguridad);
    expect(header.startsWith('Código;Factor de riesgo;Riesgo;Ubicación;Descripción;Consecuencia (1 a 5);Frecuencia;Nivel de riesgo;Alto riesgo;Peligro inminente;Estado;')).toBe(true);
    // Las filas siguen el orden del informe (el más urgente primero); el peligro inminente y el nivel alto van arriba
    expect(first).toContain('Contacto directo;Real;;Conductores desnudos al alcance de los estudiantes;5;B;Alto;No;Sí;Abierto;');
    expect(first).toContain('Desenergizar el circuito');
    expect(first).toContain('Mantenimiento;2026-09-15;RETIE 1.5.1;Auditor');
    expect(second).toContain('Sobrecarga;Potencial;;Circuito de tomas sobrecargado;;;Por valorar;No;No;Abierto');
    expect(third).toContain('Cortocircuito;Potencial;;Protección reemplazada;2;D;Bajo;No;No;Cerrado');
    db.close();
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
    // ExcelJS es pesado: cargarlo, escribir y releer once hojas pasa de los 5 s por defecto
  }, 60_000);
});
