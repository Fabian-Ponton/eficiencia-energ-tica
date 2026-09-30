import 'fake-indexeddb/auto';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { applyFormatsImport, planFormatsImport } from '@/db/formatsImport';
import { addProject } from '@/db/projects';
import { saveRecord } from '@/db/records';
import { createSampleProject } from '@/db/sampleProject';
import { createDb, type PontiaDb } from '@/db/schema';
import { annualEnergyKwh, installedPowerKw } from '@/domain/calc/equipment';
import { loadReportData } from '@/reports/data';
import { FORMAT_DEFS, HEADER_ROW, buildFormatsWorkbook } from '@/reports/formats';

const sheetOf = (plan: Awaited<ReturnType<typeof planFormatsImport>>, id: string) => plan.sheets.find((s) => s.id === id)!;

/** Libro escrito a mano como lo diligencia un técnico: títulos en la fila 1, encabezados en la 4 y datos desde la 5. */
async function manualWorkbook(sheets: Record<string, { headers: string[]; rows: unknown[][] }>): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  for (const [name, { headers, rows }] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(name);
    sheet.getCell('A1').value = `FORMATO – ${name}`;
    sheet.getRow(4).values = headers;
    rows.forEach((row, i) => sheet.getRow(5 + i).values = row as ExcelJS.CellValue[]);
  }
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

const headersOf = (id: keyof typeof FORMAT_DEFS) => FORMAT_DEFS[id].columns.map((c) => c.header);
/** Una fila con solo las columnas dadas; el resto en blanco. */
const rowOf = (id: keyof typeof FORMAT_DEFS, values: Record<string, unknown>) => headersOf(id).map((h) => values[h] ?? null);

async function proyectoVacio(db: PontiaDb) {
  const project = await addProject(db, { name: 'Laboratorios (destino)' });
  return project;
}

describe('carga de los formatos de Excel', () => {
  it('lo que se exporta se puede volver a cargar en otro proyecto sin perder nada de lo que viaja en el libro', async () => {
    const db = createDb('pontia-formatos-ida-y-vuelta');
    const origen = await createSampleProject(db);
    const datosOrigen = await loadReportData(db, origen.id, new Date(2026, 8, 12));
    const libro = await buildFormatsWorkbook(datosOrigen, { filled: true, created: new Date(2026, 8, 29) });

    const destino = await proyectoVacio(db);
    const plan = await planFormatsImport(libro, await loadReportData(db, destino.id), { now: new Date(2026, 8, 29).getTime() });
    expect(plan.totals.errors).toBe(0);
    await applyFormatsImport(db, destino.id, plan);
    const nuevo = await loadReportData(db, destino.id);

    expect(nuevo.areas.map((a) => a.name).sort()).toEqual(datosOrigen.areas.map((a) => a.name).sort());
    // Cada espacio conserva su tipo, su área y su ocupación
    for (const a of datosOrigen.areas) {
      const copia = nuevo.areas.find((x) => x.name === a.name)!;
      expect(copia.spaceType).toBe(a.spaceType);
      expect(copia.occupants).toBe(a.occupants);
    }
    // Los equipos se reparten en las hojas 03, 04 y 05 y vuelven completos: mismo número, misma potencia y mismo consumo
    expect(nuevo.equipment).toHaveLength(datosOrigen.equipment.length);
    const potencia = (lista: typeof nuevo.equipment) => lista.reduce((t, e) => t + installedPowerKw(e), 0);
    const energia = (lista: typeof nuevo.equipment) => lista.reduce((t, e) => t + annualEnergyKwh(e, e.operatingDaysPerMonth), 0);
    expect(potencia(nuevo.equipment)).toBeCloseTo(potencia(datosOrigen.equipment), 3);
    expect(energia(nuevo.equipment)).toBeCloseTo(energia(datosOrigen.equipment), 0);
    // Un equipo se reconoce con su espacio
    const aire = datosOrigen.equipment.find((e) => e.category === 'climatizacion' && e.areaId)!;
    const nombreEspacio = datosOrigen.areas.find((a) => a.id === aire.areaId)!.name;
    const copiaAire = nuevo.equipment.find((e) => e.name === aire.name && nuevo.areas.find((a) => a.id === e.areaId)?.name === nombreEspacio);
    expect(copiaAire?.capacityBtuH).toBe(aire.capacityBtuH);

    expect(nuevo.bills).toHaveLength(24);
    expect(nuevo.bills.reduce((t, b) => t + b.kwh, 0)).toBe(datosOrigen.bills.reduce((t, b) => t + b.kwh, 0));
    expect(nuevo.bills.reduce((t, b) => t + b.costCop, 0)).toBe(datosOrigen.bills.reduce((t, b) => t + b.costCop, 0));
    expect(nuevo.measurements).toHaveLength(datosOrigen.measurements.length);
    expect(nuevo.findings.map((f) => f.title).sort()).toEqual(datosOrigen.findings.map((f) => f.title).sort());
    expect(nuevo.measures.map((m) => m.title).sort()).toEqual(datosOrigen.measures.map((m) => m.title).sort());
    expect(nuevo.measures.reduce((t, m) => t + m.savingsKwhYear, 0)).toBe(datosOrigen.measures.reduce((t, m) => t + m.savingsKwhYear, 0));
    // El control conserva lo que solo el auditor sabe; lo que los datos cargados ya explican no queda fijado como si lo hubiera marcado él
    expect(nuevo.collection.map((c) => c.key).sort()).toEqual(datosOrigen.collection.map((c) => c.key).sort());
    // Los datos generales viajan a la hoja 01
    expect(nuevo.project.operatingHours).toBe(datosOrigen.project.operatingHours);
    expect(nuevo.project.client).toBe(datosOrigen.project.client);
    db.close();
  });

  it('volver a cargar en el mismo proyecto el libro que se acaba de descargar no cambia nada', async () => {
    const db = createDb('pontia-formatos-mismo-proyecto');
    const proyecto = await createSampleProject(db);
    const datos = await loadReportData(db, proyecto.id, new Date(2026, 8, 12));
    const libro = await buildFormatsWorkbook(datos, { filled: true, created: new Date(2026, 8, 29) });
    const codigosAntes = (await db.equipment.toArray()).filter((e) => e.code).length;

    const plan = await planFormatsImport(libro, await loadReportData(db, proyecto.id, new Date(2026, 8, 12)));
    expect(plan.totals).toMatchObject({ creates: 0, updates: 0, errors: 0, warnings: 0 });
    // Ni los códigos que PONTIA genera se quedan escritos en los equipos, ni un hallazgo de un equipo pasa a ser del espacio
    await applyFormatsImport(db, proyecto.id, plan);
    expect((await db.equipment.toArray()).filter((e) => e.code)).toHaveLength(codigosAntes);
    expect((await db.findings.toArray()).filter((f) => f.entityType === 'equipo').length).toBe(datos.findings.filter((f) => f.entityType === 'equipo').length);
    // Los renglones del control que la app calcula sola no se guardan como si los hubiera marcado el auditor
    expect(await db.collection.where('projectId').equals(proyecto.id).count()).toBe(datos.collection.length);
    db.close();
  });

  it('cargar dos veces el mismo libro no duplica nada', async () => {
    const db = createDb('pontia-formatos-idempotente');
    const origen = await createSampleProject(db);
    const libro = await buildFormatsWorkbook(await loadReportData(db, origen.id, new Date(2026, 8, 12)), { filled: true, created: new Date(2026, 8, 29) });
    const destino = await proyectoVacio(db);
    const primera = await planFormatsImport(libro, await loadReportData(db, destino.id));
    await applyFormatsImport(db, destino.id, primera);
    const cuentaEquipos = (await db.equipment.where('projectId').equals(destino.id).toArray()).length;

    const segunda = await planFormatsImport(libro, await loadReportData(db, destino.id));
    // Los equipos sin código quedan identificados por el código que generó la exportación: la segunda vez solo se lo asignan
    const registros = segunda.sheets.flatMap((s) => s.ops.filter((o) => o.kind === 'record'));
    expect(registros.filter((o) => o.kind === 'record' && o.action === 'crear')).toHaveLength(0);
    await applyFormatsImport(db, destino.id, segunda);
    expect((await db.equipment.where('projectId').equals(destino.id).toArray()).length).toBe(cuentaEquipos);

    const tercera = await planFormatsImport(libro, await loadReportData(db, destino.id));
    expect(tercera.totals.creates).toBe(0);
    expect(tercera.totals.updates).toBe(0);
    expect(tercera.totals.unchanged).toBeGreaterThan(50);
    db.close();
  });

  it('una fila con un valor distinto actualiza ese registro y solo ese', async () => {
    const db = createDb('pontia-formatos-actualiza');
    const origen = await createSampleProject(db);
    const datos = await loadReportData(db, origen.id, new Date(2026, 8, 12));
    const libro = await buildFormatsWorkbook(datos, { filled: true, created: new Date(2026, 8, 29) });
    // Primero se asignan los códigos generados, para que la comparación parta de lo ya cargado
    const inicial = await planFormatsImport(libro, datos);
    await applyFormatsImport(db, origen.id, inicial);

    const editado = new ExcelJS.Workbook();
    await editado.xlsx.load(await libro.arrayBuffer());
    const hoja = editado.getWorksheet('08_Facturacion')!;
    hoja.getCell(HEADER_ROW + 1, 4).value = 12_345;
    const plan = await planFormatsImport((await editado.xlsx.writeBuffer()) as ArrayBuffer, await loadReportData(db, origen.id));
    expect(plan.totals.creates).toBe(0);
    expect(plan.totals.updates).toBe(1);
    expect(sheetOf(plan, 'facturacion').updates).toBe(1);
    await applyFormatsImport(db, origen.id, plan);
    const primera = (await db.bills.where('projectId').equals(origen.id).sortBy('period'))[0];
    expect(primera.kwh).toBe(12_345);
    db.close();
  });

  it('lee un libro escrito a mano, avisa lo que no entiende y no se detiene por una fila mala', async () => {
    const db = createDb('pontia-formatos-manual');
    const destino = await proyectoVacio(db);
    const libro = await manualWorkbook({
      '02_Areas': {
        headers: headersOf('areas'),
        rows: [
          rowOf('areas', { 'ID Área': 'LQ-01', Piso: 2, 'Área/espacio': 'Laboratorio de química 1', 'Tipo de uso': 'Laboratorio de química', 'Área aprox. (m²)': '48,5', 'Ocupación habitual': 20, 'Horario de uso': 'L-V 07:00–18:00 (10 h/día)' }),
          rowOf('areas', { 'ID Área': 'LF-01', Piso: 'Sótano', 'Área/espacio': 'Laboratorio de física', 'Tipo de uso': 'Cancha de fútbol', 'Área aprox. (m²)': 'N/D' }),
          rowOf('areas', { Piso: 1 }),
        ],
      },
      '03_Equipos': {
        headers: headersOf('equipos'),
        rows: [
          rowOf('equipos', { ID: 'EQ-01', 'Piso/Área': 'Laboratorio de química 1', Equipo: 'Mufla', Cantidad: 2, 'Potencia (W/kW)': '3,5 kW', 'Horas/día': 4, 'Días/mes': 22, Estado: 'bueno' }),
          rowOf('equipos', { ID: 'EQ-02', 'Piso/Área': 'LF-01', Equipo: 'Nevera de muestras', Cantidad: 1, 'Potencia (W/kW)': '300', 'Horas/día': 24, 'Días/mes': 30, Estado: 'Regular' }),
          rowOf('equipos', { ID: 'EQ-03', 'Piso/Área': 'Bodega inexistente', Equipo: 'Agitador magnético', Cantidad: 3, 'Potencia (W/kW)': '150 W', 'Horas/día': 30, 'Días/mes': 20 }),
          rowOf('equipos', { Cantidad: 1 }),
        ],
      },
      '08_Facturacion': {
        headers: headersOf('facturacion'),
        rows: [
          rowOf('facturacion', { 'Mes/Año': 'sep-2026', Días: 30, 'Consumo (kWh)': '17.100', 'Total factura (COP)': '$ 14.535.000', 'Tarifa ($/kWh)': 850, 'Factor de potencia': 0.92 }),
          rowOf('facturacion', { 'Mes/Año': 'agosto de 2026', 'Consumo (kWh)': 'N/D', 'Total factura (COP)': 100 }),
          rowOf('facturacion', { 'Mes/Año': 'no sé', 'Consumo (kWh)': 5000 }),
        ],
      },
    });

    const plan = await planFormatsImport(libro, await loadReportData(db, destino.id), { now: new Date(2026, 8, 29).getTime() });
    const areas = sheetOf(plan, 'areas');
    expect(areas).toMatchObject({ found: true, creates: 2, skipped: 1 });
    expect(areas.errors.map((e) => e.row)).toEqual([7]);
    expect(areas.warnings.map((w) => w.text).join(' ')).toContain('Cancha de fútbol');
    expect(areas.nd).toBe(1);

    const equipos = sheetOf(plan, 'equipos');
    expect(equipos.creates).toBe(3);
    const texto = equipos.warnings.map((w) => `${w.row}: ${w.text}`).join('\n');
    // La potencia sin unidad, el espacio inexistente y las horas imposibles se avisan; la fila sin nombre es un error
    expect(texto).toMatch(/6: Potencia «300» sin unidad/);
    expect(texto).toMatch(/7: El espacio «Bodega inexistente»/);
    expect(texto).toMatch(/7: «Horas\/día» = 30/);
    expect(equipos.errors).toHaveLength(1);

    const facturas = sheetOf(plan, 'facturacion');
    expect(facturas.creates).toBe(1);
    expect(facturas.errors.map((e) => e.row)).toEqual([6, 7]);

    await applyFormatsImport(db, destino.id, plan);
    const nuevo = await loadReportData(db, destino.id);
    const quimica = nuevo.areas.find((a) => a.code === 'LQ-01')!;
    expect(quimica).toMatchObject({ name: 'Laboratorio de química 1', floor: '2', spaceType: 'lab-quimica', areaM2: 48.5, occupants: 20, hoursPerDay: 10 });
    const fisica = nuevo.areas.find((a) => a.code === 'LF-01')!;
    expect(fisica.spaceType).toBeUndefined();
    expect(fisica.areaM2).toBeUndefined();

    const mufla = nuevo.equipment.find((e) => e.name === 'Mufla')!;
    expect(mufla).toMatchObject({ powerKw: 3.5, quantity: 2, hoursPerDay: 4, operatingDaysPerMonth: 22, condition: 'bueno', areaId: quimica.id, category: 'laboratorio' });
    // Sin unidad no se inventa la potencia: el equipo entra con 0 kW y un aviso
    const nevera = nuevo.equipment.find((e) => e.name === 'Nevera de muestras')!;
    expect(nevera.powerKw).toBe(0);
    expect(nevera.areaId).toBe(fisica.id);
    expect(nevera.category).toBe('refrigeracion');
    const agitador = nuevo.equipment.find((e) => e.name === 'Agitador magnético')!;
    expect(agitador).toMatchObject({ powerKw: 0.15, hoursPerDay: 0 });
    expect(agitador.areaId).toBeUndefined();

    // La factura se lee con el mes escrito, los miles a la colombiana y el factor de potencia como energía reactiva
    expect(nuevo.bills).toHaveLength(1);
    expect(nuevo.bills[0]).toMatchObject({ period: '2026-09', kwh: 17_100, costCop: 14_535_000, days: 30, tariffCopPerKwh: 850 });
    expect(nuevo.bills[0].kvarh).toBeCloseTo(17_100 * Math.sqrt(1 / 0.92 ** 2 - 1), 0);
    db.close();
  });

  it('una celda vacía o N/D nunca borra lo que la app ya tiene', async () => {
    const db = createDb('pontia-formatos-nd');
    const proyecto = await proyectoVacio(db);
    await saveRecord(db, 'areas', { id: 'a1', projectId: proyecto.id, name: 'Aula 601', code: 'A-601', spaceType: 'aula', occupants: 35, lengthM: 8, widthM: 6 });
    const libro = await manualWorkbook({
      '02_Areas': { headers: headersOf('areas'), rows: [rowOf('areas', { 'ID Área': 'A-601', 'Área/espacio': 'Aula 601', 'Tipo de uso': 'N/D', 'Área aprox. (m²)': 999, 'Ocupación habitual': 'N/D', 'Horario de uso': null })] },
    });
    const plan = await planFormatsImport(libro, await loadReportData(db, proyecto.id));
    expect(sheetOf(plan, 'areas')).toMatchObject({ creates: 0, updates: 0, unchanged: 1, nd: 2 });
    await applyFormatsImport(db, proyecto.id, plan);
    const area = (await db.areas.get('a1'))!;
    // El área a mano no reemplaza a las dimensiones que ya tiene el espacio
    expect(area).toMatchObject({ spaceType: 'aula', occupants: 35, lengthM: 8, widthM: 6 });
    expect(area.areaM2).toBeUndefined();
    db.close();
  });

  it('carga horarios con el periodo, mantenimiento con el equipo y facturas de gas con su factor', async () => {
    const db = createDb('pontia-formatos-otras-hojas');
    const proyecto = await proyectoVacio(db);
    await saveRecord(db, 'areas', { id: 'a1', projectId: proyecto.id, name: 'Laboratorio de química 1', code: 'LQ-01' });
    await saveRecord(db, 'equipment', { id: 'e1', projectId: proyecto.id, name: 'Autoclave', code: 'AU-01', category: 'laboratorio', areaId: 'a1', powerKw: 2, quantity: 1, hoursPerDay: 3, operatingDaysPerMonth: 22, useFactor: 1, condition: 'bueno' });
    const libro = await manualWorkbook({
      '06_Uso_Ocupacion': {
        headers: headersOf('ocupacion'),
        rows: [
          rowOf('ocupacion', { 'ID Área': 'LQ-01', Actividad: 'Práctica de química', Día: 'lunes a viernes', 'Hora inicio': '7:00 a. m.', 'Hora fin': '11:00 a. m.', 'Ocupación promedio': 20, 'Aire usado (Sí/No)': 'sí', 'Iluminación usada (Sí/No)': 'No' }),
          rowOf('ocupacion', { 'ID Área': 'XX-99', Actividad: 'Fantasma', 'Hora inicio': '07:00', 'Hora fin': '08:00' }),
          rowOf('ocupacion', { 'ID Área': 'LQ-01', Actividad: 'Sin horas', Día: 'L' }),
        ],
      },
      '09_Mantenimiento': {
        headers: headersOf('mantenimiento'),
        rows: [rowOf('mantenimiento', { 'ID Equipo': 'AU-01', Tipo: 'Preventivo', 'Último mantenimiento': '15/03/2026', Frecuencia: 'semestral', 'Actividades realizadas': 'Cambio de sellos', 'Condición actual': 'Regular' })],
      },
      '08b_Gas_Otros': {
        headers: headersOf('gas'),
        rows: [rowOf('gas', { 'Mes/Año': '2026-08', Energético: 'Gas natural', Cantidad: '120', Unidad: 'm³', 'Factor (kWh/unidad)': '10,5', 'Total factura (COP)': 450_000 }), rowOf('gas', { 'Mes/Año': '2026-09', Energético: 'Gas natural', Cantidad: 90, 'Total factura (COP)': 380_000 })],
      },
    });
    const plan = await planFormatsImport(libro, await loadReportData(db, proyecto.id), { term: '2026-2' });
    expect(plan.term).toBe('2026-2');
    expect(sheetOf(plan, 'ocupacion')).toMatchObject({ creates: 1, skipped: 2 });
    expect(sheetOf(plan, 'ocupacion').errors.map((e) => e.text).join(' ')).toContain('XX-99');
    expect(sheetOf(plan, 'gas').warnings.map((w) => w.text).join(' ')).toContain('Sin factor de conversión');
    await applyFormatsImport(db, proyecto.id, plan);

    const horario = (await db.occupancy.where('projectId').equals(proyecto.id).toArray())[0];
    expect(horario).toMatchObject({ areaId: 'a1', term: '2026-2', day: 'L-V', start: '07:00', end: '11:00', hours: 4, avgOccupants: 20, usesAc: true, usesLighting: false });
    const mto = (await db.maintenance.where('projectId').equals(proyecto.id).toArray())[0];
    expect(mto).toMatchObject({ equipmentId: 'e1', type: 'preventivo', lastAt: '2026-03-15', frequency: 'semestral', condition: 'regular' });
    const gas = await db.bills.where('projectId').equals(proyecto.id).sortBy('period');
    expect(gas.map((b) => [b.period, b.carrier, b.quantity, b.unit, b.kwhPerUnit, b.kwh])).toEqual([
      ['2026-08', 'gas-natural', 120, 'm3', 10.5, 1260],
      ['2026-09', 'gas-natural', 90, 'm3', undefined, 0],
    ]);
    db.close();
  });

  it('una medición se enlaza con el equipo correcto aunque varios se llamen igual', async () => {
    const db = createDb('pontia-formatos-mismo-nombre');
    const origen = await proyectoVacio(db);
    const base = { projectId: origen.id, name: 'Aire mini-split 18.000 BTU/h', category: 'climatizacion' as const, powerKw: 1.5, quantity: 1, hoursPerDay: 8, operatingDaysPerMonth: 22, useFactor: 1, condition: 'bueno' as const };
    await saveRecord(db, 'equipment', { ...base, id: 'aabbcc11-0000-4000-8000-000000000001', code: 'AC-01' });
    await saveRecord(db, 'equipment', { ...base, id: 'ddeeff22-0000-4000-8000-000000000002' });
    await saveRecord(db, 'measurements', { id: 'm1', projectId: origen.id, takenAt: '2026-03-15T09:30', pointType: 'equipo', pointId: 'ddeeff22-0000-4000-8000-000000000002', kw: 1.2, dataType: 'medido' });

    const libro = await buildFormatsWorkbook(await loadReportData(db, origen.id), { filled: true, created: new Date(2026, 8, 29) });
    const destino = await proyectoVacio(db);
    const plan = await planFormatsImport(libro, await loadReportData(db, destino.id));
    expect(sheetOf(plan, 'mediciones').warnings).toEqual([]);
    await applyFormatsImport(db, destino.id, plan);

    const equipos = await db.equipment.where('projectId').equals(destino.id).toArray();
    const sinCodigo = equipos.find((e) => e.code !== 'AC-01')!;
    expect(sinCodigo.code).toBe('EQ-DDEEFF');
    const medicion = (await db.measurements.where('projectId').equals(destino.id).toArray())[0];
    expect(medicion).toMatchObject({ pointType: 'equipo', pointId: sinCodigo.id, kw: 1.2 });
    db.close();
  });

  it('el control conserva lo que la app calcula sola y guarda lo que solo el auditor sabe', async () => {
    const db = createDb('pontia-formatos-control');
    const proyecto = await proyectoVacio(db);
    const libro = await manualWorkbook({
      '13_Control': {
        headers: headersOf('control'),
        rows: [
          rowOf('control', { 'Información requerida': 'Planos/distribución', Responsable: 'Oficina de planeación', 'Fecha objetivo': '30/10/2026', Estado: 'Obtenido', 'Evidencia/archivo': 'planos.pdf' }),
          rowOf('control', { 'Información requerida': 'Mantenimiento', Estado: 'N/D', Observaciones: 'No hay hoja de vida' }),
          rowOf('control', { 'Información requerida': 'Facturas/consumo histórico', Estado: 'Obtenido' }),
          rowOf('control', { 'Información requerida': 'Contrato de suministro', Estado: 'En curso' }),
        ],
      },
    });
    const plan = await planFormatsImport(libro, await loadReportData(db, proyecto.id));
    await applyFormatsImport(db, proyecto.id, plan);
    const guardado = await db.collection.where('projectId').equals(proyecto.id).toArray();
    const porClave = Object.fromEntries(guardado.map((c) => [c.key, c]));
    expect(porClave['planos']).toMatchObject({ status: 'obtenido', responsible: 'Oficina de planeación', targetDate: '2026-10-30', evidence: 'planos.pdf' });
    expect(porClave['mantenimiento']).toMatchObject({ status: 'no-disponible', notes: 'No hay hoja de vida' });
    // «Facturas» dice Obtenido, pero los datos no lo respaldan: como no hay nada automático que lo contradiga, sí se guarda como manual
    expect(porClave['facturas'].status).toBe('obtenido');
    expect(porClave['otro-contrato-de-suministro']).toMatchObject({ label: 'Contrato de suministro', status: 'en-curso' });
    db.close();
  });

  it('avisa cuando el libro no trae las hojas o las trae sin encabezados', async () => {
    const db = createDb('pontia-formatos-vacio');
    const proyecto = await proyectoVacio(db);
    const libro = await manualWorkbook({ Notas: { headers: ['Nota'], rows: [['hola']] }, '03_Equipos': { headers: ['A', 'B', 'C'], rows: [['x', 'y', 'z']] } });
    const plan = await planFormatsImport(libro, await loadReportData(db, proyecto.id));
    expect(plan.totals.creates + plan.totals.updates).toBe(0);
    expect(sheetOf(plan, 'equipos').found).toBe(true);
    expect(sheetOf(plan, 'equipos').errors[0].text).toContain('encabezados');
    expect(sheetOf(plan, 'areas').found).toBe(false);
    db.close();
  });
});
