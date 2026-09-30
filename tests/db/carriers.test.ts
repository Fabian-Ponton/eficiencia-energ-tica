import 'fake-indexeddb/auto';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { summarizeProject } from '@/db/projects';
import { saveRecord } from '@/db/records';
import { createSampleProject } from '@/db/sampleProject';
import { createDb, type PontiaDb } from '@/db/schema';
import { summarizeCarriers, totalEnergy } from '@/domain/carriers';
import { loadReportData } from '@/reports/data';
import { buildAuditDocument } from '@/reports/docx/audit';
import { buildAuditModel } from '@/reports/model';
import { exportTables } from '@/reports/tables';

/** Doce facturas de gas natural y un quemador: lo que cargaría el auditor de un laboratorio con gas. */
async function addNaturalGas(db: PontiaDb, projectId: string) {
  for (let month = 1; month <= 12; month++) {
    await saveRecord(db, 'bills', {
      id: `gas-${month}`,
      projectId,
      carrier: 'gas-natural',
      period: `2026-${String(month).padStart(2, '0')}`,
      quantity: 100 + month,
      unit: 'm3',
      kwhPerUnit: 10.5,
      kwh: (100 + month) * 10.5,
      costCop: 380_000 + month * 1_000,
    });
  }
  await saveRecord(db, 'equipment', {
    id: 'quemador',
    projectId,
    name: 'Quemador Bunsen',
    category: 'laboratorio',
    carrier: 'gas-natural',
    powerKw: 1.2,
    quantity: 10,
    hoursPerDay: 3,
    operatingDaysPerMonth: 22,
    useFactor: 0.5,
    condition: 'bueno',
  });
}

const cifrasElectricas = async (db: PontiaDb, projectId: string) => {
  const project = (await db.projects.get(projectId))!;
  const resumen = await summarizeProject(db, project);
  const modelo = buildAuditModel(await loadReportData(db, projectId, new Date(2026, 8, 12)));
  return {
    equipos: resumen.equipmentCount,
    estimado: resumen.estimatedAnnualKwh,
    facturado: resumen.billedAnnualKwh,
    avance: resumen.progress.map((s) => s.done),
    censoKwh: modelo.estimatedAnnualKwh,
    facturadoInforme: modelo.billedAnnualKwh,
    desviacion: modelo.deviation,
    usos: modelo.shares.map((s) => [s.category, Math.round(s.kwh)]),
    kpis: modelo.kpis.map((k) => [k.label, k.value]),
    hallazgos: modelo.findings.map((f) => f.title),
  };
};

describe('gas natural junto a la electricidad', () => {
  it('cargar facturas y equipos de gas no cambia ninguna cifra eléctrica', async () => {
    const db = createDb('pontia-prueba-gas-aislado');
    const ejemplo = await createSampleProject(db);
    const antes = await cifrasElectricas(db, ejemplo.id);
    await addNaturalGas(db, ejemplo.id);
    const despues = await cifrasElectricas(db, ejemplo.id);
    expect(despues).toEqual(antes);
    db.close();
  });

  it('el informe separa lo eléctrico de lo demás y suma los energéticos solo en kWh equivalentes', async () => {
    const db = createDb('pontia-prueba-gas-datos');
    const ejemplo = await createSampleProject(db);
    await addNaturalGas(db, ejemplo.id);
    const datos = await loadReportData(db, ejemplo.id, new Date(2026, 8, 12));
    expect(datos.bills).toHaveLength(24);
    expect(datos.otherBills).toHaveLength(12);
    expect(datos.equipment.every((e) => !e.carrier)).toBe(true);
    expect(datos.otherEquipment.map((e) => e.name)).toEqual(['Quemador Bunsen']);

    const resumen = summarizeCarriers([...datos.bills, ...datos.otherBills]);
    const [electricidad, gas] = resumen;
    expect(electricidad.kwh).toBe(186_400);
    // 12 facturas de (100 + mes) m³ × 10,5 kWh/m³
    expect(gas.quantity).toBe(1_278);
    expect(gas.kwh).toBeCloseTo(1_278 * 10.5, 6);
    expect(totalEnergy(resumen).kwh).toBeCloseTo(186_400 + 1_278 * 10.5, 6);
    expect(electricidad.share + gas.share).toBeCloseTo(1, 9);
    db.close();
  });

  it('el Word trae la tabla de todos los energéticos solo cuando hay otros energéticos', async () => {
    const db = createDb('pontia-prueba-gas-informe');
    const ejemplo = await createSampleProject(db);
    const texto = async () => {
      const modelo = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
      const buffer = await Packer.toBuffer(buildAuditDocument(modelo, [], { figures: new Map(), photos: [] }));
      const xml = (await (await JSZip.loadAsync(buffer)).file('word/document.xml')?.async('string')) ?? '';
      return xml.replace(/<[^>]+>/g, '');
    };
    expect(await texto()).not.toContain('5.1 Energéticos utilizados');

    await addNaturalGas(db, ejemplo.id);
    const conGas = await texto();
    expect(conGas).toContain('5.1 Energéticos utilizados');
    // El alcance declara los energéticos incluidos y la limitación de que los indicadores son eléctricos
    expect(conGas).toContain('Energéticos incluidos: electricidad y gas natural.');
    expect(conGas).toContain('El balance por uso final, los indicadores y la línea base son eléctricos');
    expect(conGas).toContain('Gas natural');
    expect(conGas).toContain('1.278 m³');
    expect(conGas).toContain('kWh equivalentes');
    // El resto del informe sigue siendo eléctrico
    expect(conGas).toContain('186.400');
    db.close();
  });

  it('una factura de gas sin factor de conversión se avisa y no suma kWh', async () => {
    const db = createDb('pontia-prueba-gas-sin-factor');
    const ejemplo = await createSampleProject(db);
    await saveRecord(db, 'bills', { id: 'g1', projectId: ejemplo.id, carrier: 'gas-natural', period: '2026-08', quantity: 90, unit: 'm3', kwh: 0, costCop: 300_000 });
    const datos = await loadReportData(db, ejemplo.id, new Date(2026, 8, 12));
    const resumen = summarizeCarriers([...datos.bills, ...datos.otherBills]);
    expect(resumen[1]).toMatchObject({ carrier: 'gas-natural', kwh: 0, missingFactor: 1, copPerKwh: null });
    expect(totalEnergy(resumen).missingFactor).toBe(1);
    db.close();
  });

  it('las exportaciones incluyen el energético, la cantidad y el factor', async () => {
    const db = createDb('pontia-prueba-gas-exportar');
    const ejemplo = await createSampleProject(db);
    await addNaturalGas(db, ejemplo.id);
    const tablas = exportTables(buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12))));
    const facturas = tablas.find((t) => t.id === 'facturas')!;
    expect(facturas.rows).toHaveLength(36);
    expect(facturas.columns.map((c) => c.header)).toEqual(expect.arrayContaining(['Energético', 'Cantidad facturada', 'Unidad', 'Factor (kWh por unidad)']));
    expect(tablas.find((t) => t.id === 'inventario')!.rows).toHaveLength(35);
    db.close();
  });
});
