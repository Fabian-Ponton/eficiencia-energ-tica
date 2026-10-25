import 'fake-indexeddb/auto';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { createSampleProject } from '@/db/sampleProject';
import { createDb } from '@/db/schema';
import { FORMAT_DEFS, FORMAT_ORDER, GENERAL_FIELDS, GENERAL_SHEET, HEADER_ROW, LISTS_SHEET, buildFormatsWorkbook, formatLists, formatRows, formatsFileName, generalRows, powerText } from '@/reports/formats';
import { loadReportData } from '@/reports/data';

async function load(blob: Blob) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return workbook;
}

const AHORA = new Date(2026, 8, 29, 10, 0);
async function datosDelEjemplo(nombre: string) {
  const db = createDb(nombre);
  const ejemplo = await createSampleProject(db);
  const datos = await loadReportData(db, ejemplo.id, new Date(2026, 8, 12));
  return { db, datos };
}

describe('formatos de recolección en Excel', () => {
  it('tienen las hojas y los encabezados del libro del auditor, en su orden', async () => {
    const { db, datos } = await datosDelEjemplo('pontia-formatos-estructura');
    const libro = await load(await buildFormatsWorkbook(datos, { filled: false, created: AHORA }));
    expect(libro.worksheets.map((s) => s.name)).toEqual([
      '00_Guia',
      '01_General',
      '02_Areas',
      '03_Equipos',
      '04_Aires',
      '05_Iluminacion',
      '06_Uso_Ocupacion',
      '07_Mediciones',
      '08_Facturacion',
      '08b_Gas_Otros',
      '09_Mantenimiento',
      '10_Evidencia',
      '11_Hallazgos',
      '12_Oportunidades',
      '13_Control',
      '_Listas',
    ]);
    expect(libro.getWorksheet('_Listas')?.state).toBe('hidden');
    // Los títulos y los encabezados son exactamente los del libro del auditor (filas 1 y 4)
    expect(libro.getWorksheet('03_Equipos')!.getCell('A1').value).toBe('FORMATO 3 – INVENTARIO Y CARACTERIZACIÓN DE EQUIPOS ELÉCTRICOS');
    const encabezados = (nombre: string) => (libro.getWorksheet(nombre)!.getRow(HEADER_ROW).values as unknown[]).slice(1);
    expect(encabezados('02_Areas')).toEqual(['ID Área', 'Piso', 'Área/espacio', 'Tipo de uso', 'Área aprox. (m²)', 'Ocupación habitual', 'Horario de uso', 'Observaciones']);
    expect(encabezados('03_Equipos').slice(0, 14)).toEqual(['ID', 'Piso/Área', 'Equipo', 'Marca', 'Modelo', 'Cantidad', 'Potencia (W/kW)', 'Voltaje (V)', 'Corriente (A)', 'Horas/día', 'Días/mes', 'Estado', 'Modo de uso', 'Observaciones']);
    // Lo que PONTIA agrega va al final, para no mover ninguna columna del libro original
    expect(encabezados('03_Equipos').slice(14)).toEqual(['Uso final', 'Factor de uso (%)']);
    expect(encabezados('04_Aires').slice(-3)).toEqual(['Cantidad', 'Factor de uso (%)', 'Nombre del equipo']);
    expect(encabezados('05_Iluminacion').slice(-2)).toEqual(['Factor de uso (%)', 'Nombre del equipo']);
    expect(encabezados('06_Uso_Ocupacion')).toEqual(['ID Área', 'Piso/Área', 'Actividad', 'Día', 'Hora inicio', 'Hora fin', 'Horas de uso', 'Ocupación promedio', 'Aire usado (Sí/No)', 'Iluminación usada (Sí/No)', 'Observaciones']);
    expect(encabezados('07_Mediciones')).toEqual(['ID', 'Fecha', 'Hora', 'Punto de medición', 'Equipo/circuito', 'Instrumento', 'V (V)', 'I (A)', 'P (kW)', 'FP', 'Frecuencia (Hz)', 'Energía (kWh)', 'Condición', 'Responsable', 'Observaciones']);
    expect(encabezados('13_Control')).toEqual(['Información requerida', 'Responsable', 'Fecha objetivo', 'Fecha obtenida', 'Estado', 'Evidencia/archivo', 'Observaciones']);
    expect(encabezados('01_General')).toEqual(['Campo', 'Información']);
    for (const id of FORMAT_ORDER) expect(encabezados(FORMAT_DEFS[id].name)).toEqual(FORMAT_DEFS[id].columns.map((c) => c.header));
    // Las columnas de ampliación están marcadas: un libro que no las trae no es un libro incompleto
    expect(FORMAT_DEFS.equipos.columns.filter((c) => c.extension).map((c) => c.header)).toEqual(['Uso final', 'Factor de uso (%)']);
    db.close();
  });

  it('el libro en blanco no trae filas de datos, pero sí las listas desplegables', async () => {
    const { db, datos } = await datosDelEjemplo('pontia-formatos-blanco');
    const libro = await load(await buildFormatsWorkbook(datos, { filled: false, created: AHORA }));
    expect(libro.getWorksheet('03_Equipos')!.getCell('C5').value).toBeNull();
    expect(libro.getWorksheet('02_Areas')!.getCell('C5').value).toBeNull();
    // «Estado» (columna L) de los equipos: Bueno, Regular, Deficiente
    const validacion = libro.getWorksheet('03_Equipos')!.getCell('L5').dataValidation;
    expect(validacion).toMatchObject({ type: 'list', allowBlank: true, errorStyle: 'warning' });
    expect(String(validacion.formulae?.[0])).toContain('_Listas!');
    // Las listas se leen de la hoja oculta
    const listas = libro.getWorksheet(LISTS_SHEET)!;
    const columnas = (listas.getRow(1).values as string[]).slice(1);
    const estado = columnas.indexOf('estado') + 1;
    expect([2, 3, 4].map((r) => listas.getCell(r, estado).value)).toEqual(['Bueno', 'Regular', 'Deficiente']);
    // Los espacios del proyecto salen como opciones de «Piso/Área»
    const areas = columnas.indexOf('areas') + 1;
    expect(listas.getCell(2, areas).value).toBeTruthy();
    // Cien filas con validación en blanco
    expect(libro.getWorksheet('03_Equipos')!.getCell('L104').dataValidation.type).toBe('list');
    db.close();
  });

  it('con lo registrado, cada hoja trae los datos del proyecto con sus unidades', async () => {
    const { db, datos } = await datosDelEjemplo('pontia-formatos-lleno');
    const libro = await load(await buildFormatsWorkbook(datos, { filled: true, created: AHORA }));
    const filas = (nombre: string) => Array.from({ length: libro.getWorksheet(nombre)!.rowCount - HEADER_ROW }, (_, i) => libro.getWorksheet(nombre)!.getRow(HEADER_ROW + 1 + i)).filter((r) => r.hasValues).length;
    expect(filas('02_Areas')).toBe(7);
    expect(filas('08_Facturacion')).toBe(24);
    expect(filas('11_Hallazgos')).toBe(datos.findings.length);
    expect(filas('12_Oportunidades')).toBe(datos.measures.length);
    expect(filas('13_Control')).toBe(12);
    // Los equipos se reparten entre las hojas 03, 04 y 05 según su uso final, sin repetirse ni perderse
    const total = filas('03_Equipos') + filas('04_Aires') + filas('05_Iluminacion');
    expect(total).toBe(datos.equipment.length);
    // La potencia va siempre con unidad y cada equipo con un ID que la app entiende al volver a cargar el libro
    const primero = libro.getWorksheet('03_Equipos')!.getRow(HEADER_ROW + 1);
    expect(String(primero.getCell(7).value)).toMatch(/\d\s?(W|kW)$/);
    expect(String(primero.getCell(1).value)).toMatch(/^EQ-[0-9A-F]{6}$|^\S+$/);
    // Las facturas traen el mes como fecha y los kWh como número
    const factura = libro.getWorksheet('08_Facturacion')!.getRow(HEADER_ROW + 1);
    expect(factura.getCell(1).value).toBeInstanceOf(Date);
    expect(typeof factura.getCell(4).value).toBe('number');
    // El control refleja el estado que calculan los datos
    const control = libro.getWorksheet('13_Control')!;
    const estados = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(control.getCell(HEADER_ROW + 1 + i, 1).value), control.getCell(HEADER_ROW + 1 + i, 5).value]));
    expect(estados['Facturas/consumo histórico']).toBe('Obtenido');
    expect(estados['Planos/distribución']).toBe('Pendiente');
    db.close();
  });

  it('la hoja general trae los trece campos del formato más los datos del art. 4(a)', async () => {
    const { db, datos } = await datosDelEjemplo('pontia-formatos-general');
    expect(GENERAL_FIELDS.slice(0, 13).map((f) => f.label)).toEqual([
      'Fecha de levantamiento',
      'Responsable',
      'Bloque',
      'Sede',
      'Ubicación',
      'Número de pisos',
      'Área construida aproximada (m²)',
      'Horario general',
      'Días de operación/semana',
      'Estudiantes aproximados',
      'Funcionarios aproximados',
      'Responsable institucional',
      'Observaciones',
    ]);
    expect(GENERAL_FIELDS.slice(13).map((f) => f.label)).toEqual(['Entidad', 'Tipo de entidad', 'Año de construcción', 'Proceso o actividad', 'Entorno', 'Tenencia del edificio']);
    const valores = Object.fromEntries(generalRows(datos));
    expect(valores['Bloque']).toBe('Bloque 6 · Aulas y laboratorios (ejemplo)');
    expect(valores['Entidad']).toBe('Universidad de La Guajira');
    expect(valores['Horario general']).toBe('06:00 – 22:00');
    expect(valores['Días de operación/semana']).toBe(5);
    const libro = await load(await buildFormatsWorkbook(datos, { filled: true, created: AHORA }));
    expect(libro.getWorksheet(GENERAL_SHEET.name)!.getCell(HEADER_ROW + 3, 2).value).toBe('Bloque 6 · Aulas y laboratorios (ejemplo)');
    db.close();
  });

  it('cada hoja sale marcada con el aviso de propiedad, también al imprimirla', async () => {
    const { db, datos } = await datosDelEjemplo('pontia-formatos-marca');
    const libro = await load(await buildFormatsWorkbook(datos, { filled: true, created: AHORA }));
    // La guía cierra con el aviso largo
    const guia = libro.getWorksheet('00_Guia')!;
    const textoGuia = guia
      .getColumn(1)
      .values.filter((v): v is string => typeof v === 'string')
      .join(' ');
    expect(textoGuia).toContain('Todos los derechos reservados');
    expect(textoGuia).toContain('Ley 23 de 1982');
    // Y todas las hojas llevan el aviso en el pie de impresión
    for (const hoja of libro.worksheets) {
      expect(hoja.headerFooter?.oddFooter).toContain('© 2026');
      expect(hoja.headerFooter?.oddFooter).toContain('PONTIA');
    }

    // Con un titular propio, el aviso cambia en todas partes
    await db.settings.put({ id: 'app', csvFormat: 'es-CO', theme: 'sistema', copyrightHolder: 'Energética del Caribe S.A.S.' });
    const otros = await loadReportData(db, datos.project.id, new Date(2026, 8, 12));
    const libro2 = await load(await buildFormatsWorkbook(otros, { filled: true, created: AHORA }));
    expect(libro2.worksheets[0].headerFooter?.oddFooter).toContain('Energética del Caribe S.A.S.');
    db.close();
  });

  it('escribe la potencia siempre con unidad y le da nombre al archivo', () => {
    expect(powerText(0.25)).toBe('250 W');
    expect(powerText(0.036)).toBe('36 W');
    expect(powerText(1.5)).toBe('1,5 kW');
    expect(powerText(5.5)).toBe('5,5 kW');
    expect(powerText(0)).toBeNull();
    expect(formatsFileName('LAB-01', 'Laboratorios', true, new Date(2026, 8, 29))).toBe('PONTIA_Formatos-recoleccion_LAB-01_2026-09-29.xlsx');
    expect(formatsFileName(undefined, 'Laboratorios · Sede Riohacha', false, new Date(2026, 8, 29))).toBe('PONTIA_Formatos-recoleccion-en-blanco_Laboratorios-Sede-Riohacha_2026-09-29.xlsx');
  });

  it('las listas de opciones salen de los catálogos de la app', async () => {
    const { db, datos } = await datosDelEjemplo('pontia-formatos-listas');
    const listas = formatLists(datos);
    expect(listas.tipoUso).toContain('Laboratorio de química');
    expect(listas.dias).toEqual(expect.arrayContaining(['L-V', 'X']));
    expect(listas.estadoControl).toEqual(['Pendiente', 'En curso', 'Obtenido', 'No disponible']);
    expect(listas.areas).toContain('Aula 601');
    expect(formatRows('areas', datos)).toHaveLength(7);
    db.close();
  });
});
