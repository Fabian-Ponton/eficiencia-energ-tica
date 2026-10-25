import { carrierInfo, unitLabel } from '@/domain/carriers';
import { MODEL_LABEL, upmeVariable } from '@/domain/calc/lben';
import { chosenFinancing } from '@/domain/financing';
import { measureEconomics, savingsTypeInfo, savingsTypeOf } from '@/domain/measures';
import type { RoutePlan } from '@/domain/route';
import { upmeFileName } from '@/domain/upmeReport';
import type { UpmeCycle } from '@/domain/types';
import { tenureInfo } from '@/domain/tenure';
import { formatDate } from '@/utils/dates';
import { buildFormatsWorkbook, generalRows } from '../formats';
import type { AuditModel } from '../model';
import type { ExportTable } from '../tables';
import { ownershipNotice } from '@/domain/ownership';
import { buildWorkbook } from '../xlsx';

/**
 * Paquete de datos para el reporte del artículo 237 de la Ley 2294 de 2023 (SUU, «Módulo de Medidas Art. 237»): hojas equivalentes a los
 * datos de edificación y a las plantillas 1 a 5. Las plantillas oficiales solo están en el SUU, así que las columnas exactas se ajustan
 * cuando se tengan; lo que está aquí es la información con que se diligencian. PONTIA no envía nada.
 */

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const finite = (value: number | null | undefined) => (value === null || value === undefined || !Number.isFinite(value) ? null : value);

function table<T>(id: string, title: string, rows: readonly T[], columns: { header: string; value: (row: T) => string | number | null | undefined; decimals?: number }[]): ExportTable {
  return { id, title, rows: [...rows], columns: columns as unknown as ExportTable['columns'] };
}

/** Las hojas del paquete, en el orden de las secciones del SUU. */
export function upmeTables(m: AuditModel, options: { cycle?: Pick<UpmeCycle, 'year' | 'caseNumber'>; route: RoutePlan }): ExportTable[] {
  const { project, generatedAt } = m.data;
  const site = project.site?.name?.trim() || project.name;
  const cycleYear = options.cycle?.year ?? generatedAt.getFullYear();

  const notes = [
    'Paquete de datos para el reporte del artículo 237 de la Ley 2294 de 2023 en el SUU (Módulo de Medidas Art. 237).',
    `Sede: ${site}${project.site?.upmeCode ? ` · código ${project.site.upmeCode}` : ''}. Entidad: ${project.client ?? '—'}${project.nit ? ` · NIT ${project.nit}` : ''}.`,
    `Ciclo ${cycleYear}${options.cycle?.caseNumber ? ` · caso ${options.cycle.caseNumber}` : ''}. Generado el ${formatDate(generatedAt.toISOString().slice(0, 10))}.`,
    'PONTIA no envía nada al SUU: la entidad diligencia el reporte con su usuario. Un caso por sede.',
    'Las hojas equivalen a los datos de edificación y a las plantillas 1 a 5. Las plantillas oficiales solo están en el SUU: las columnas exactas se ajustan cuando se tengan.',
    'El informe de auditoría en Word y los formatos de recolección van en el archivo de anexos.',
  ];
  const tables: ExportTable[] = [table('leame', 'Léame', notes, [{ header: 'Nota', value: (n) => n }])];

  // Datos de edificación
  const general = generalRows(m.data)
    .filter(([, value]) => value !== null && value !== '')
    .map(([label, value]): [string, string] => [label, value instanceof Date ? value.toISOString().slice(0, 10) : String(value)]);
  general.push(['NIT de la entidad', project.nit ?? '']);
  general.push(['Código único de la sede (UPME)', project.site?.upmeCode ?? '']);
  general.push(['Fecha de la auditoría', project.audit?.date ?? '']);
  general.push(['Tenencia del edificio', tenureInfo(project.building?.tenure)?.label ?? '']);
  tables.push(table('edificacion', 'Datos de edificación', general, [{ header: 'Dato', value: (r) => r[0] }, { header: 'Valor', value: (r) => r[1] }]));

  // Plantilla 1: consumos y costos mensuales por energético
  const bills = [...m.data.bills, ...m.data.otherBills].sort((a, b) => a.period.localeCompare(b.period) || (a.carrier ?? '').localeCompare(b.carrier ?? ''));
  tables.push(
    table('plantilla-1', 'Plantilla 1 Consumos', bills, [
      { header: 'Periodo', value: (b) => b.period },
      { header: 'Energético', value: (b) => carrierInfo(b.carrier).label },
      { header: 'Cantidad facturada', value: (b) => finite(b.carrier && b.carrier !== 'electricidad' ? (b.quantity ?? null) : b.kwh), decimals: 1 },
      { header: 'Unidad', value: (b) => unitLabel(b.carrier && b.carrier !== 'electricidad' ? b.unit : 'kWh') },
      { header: 'Energía (kWh)', value: (b) => finite(b.kwh), decimals: 1 },
      { header: 'Costo (COP)', value: (b) => finite(b.costCop), decimals: 0 },
      { header: 'Días facturados', value: (b) => b.days },
      { header: 'Consumo normalizado a 30 días (kWh)', value: (b) => (b.days && b.days > 0 ? finite((b.kwh / b.days) * 30) : null), decimals: 1 },
    ]),
  );

  // Plantillas 2 a 4: línea base según el modelo
  const u = m.upme;
  if (u?.monthly) {
    tables.push(
      table('plantilla-2', 'Plantilla 2 LBEn valor abs', u.monthly.months, [
        { header: 'Mes', value: (x) => MONTHS[x.month - 1] },
        { header: 'Datos iniciales', value: (x) => x.initialCount },
        { header: 'Datos finales', value: (x) => x.finalCount },
        { header: 'LBEn (kWh/mes, 30 días)', value: (x) => finite(x.baseline), decimals: 1 },
        { header: 'Desviación estándar', value: (x) => finite(x.stdDev), decimals: 1 },
        { header: 'Mínimo (mejor desempeño)', value: (x) => finite(x.minimum), decimals: 1 },
        { header: 'Ahorro estimado (kWh)', value: (x) => finite(x.saving), decimals: 1 },
        { header: 'Ahorro estimado (%)', value: (x) => (x.savingPct === null ? null : x.savingPct * 100), decimals: 2 },
      ]),
    );
  } else if (u?.ratio) {
    const r = u.ratio;
    tables.push(
      table('plantilla-3', 'Plantilla 3 LBEn cociente', r.months, [
        { header: 'Mes', value: (x) => MONTHS[x.month - 1] },
        { header: `LBEn del cociente (${r.ratioUnit})`, value: (x) => finite(x.baseline), decimals: 3 },
        { header: `Nivel de actividad (${upmeVariable(r.variable).unit})`, value: (x) => finite(r.activity[x.month - 1]), decimals: 1 },
        { header: 'LBEn (kWh/mes)', value: (x) => finite(r.baselineKwh[x.month - 1]), decimals: 1 },
        { header: 'Ahorro estimado (kWh)', value: (x) => finite(r.savingKwh[x.month - 1]), decimals: 1 },
        { header: 'Ahorro estimado (%)', value: (x) => (x.savingPct === null ? null : x.savingPct * 100), decimals: 2 },
      ]),
    );
  } else if (u?.statistical) {
    const s = u.statistical;
    const rows: [string, number | string | null][] = [
      ['Periodo base (meses)', s.model.observations],
      ['R²', s.model.r2],
      ['R² ajustado', s.model.adjustedR2],
      ['CV(RMSE)', s.model.cvRmse],
      ['NMBE', s.model.nmbe],
      ['Consumo máximo (kWh/mes)', s.consumption.maximum],
      ['Consumo mínimo (kWh/mes)', s.consumption.minimum],
      ['Consumo promedio (kWh/mes)', s.consumption.average],
      ['Desviación estándar (kWh/mes)', s.consumption.stdDev],
      ['Intercepto', s.model.coefficients[0]],
      ...s.variables.map((v, i): [string, number | string | null] => [`Coeficiente · ${upmeVariable(v).label} (p = ${s.model.pValues[i + 1].toFixed(4)})`, s.model.coefficients[i + 1]]),
      ['Potencial por mejor desempeño (%)', s.potentialPct === null ? null : s.potentialPct * 100],
    ];
    tables.push(table('plantilla-4', 'Plantilla 4 LBEn estadístico', rows, [{ header: 'Concepto', value: (r) => r[0] }, { header: 'Valor', value: (r) => (typeof r[1] === 'number' ? finite(r[1]) : r[1]), decimals: 4 }]));
  }
  if (u) {
    tables.push(
      table('lben-resumen', 'Resumen de la línea base', [MODEL_LABEL[u.kind]], [
        { header: 'Modelo', value: (x) => x },
        { header: 'Periodo base', value: () => `${u.from} a ${u.to}` },
        { header: 'Meses', value: () => u.months },
        { header: 'LBEn anual (kWh)', value: () => finite(u.headline.baselineKwhYear), decimals: 0 },
        { header: 'Ahorro por mejor desempeño (kWh/año)', value: () => finite(u.headline.savingKwhYear), decimals: 0 },
        { header: 'Ahorro por mejor desempeño (%)', value: () => (u.headline.savingPct === null ? null : u.headline.savingPct * 100), decimals: 2 },
      ]),
    );
  }

  // Plantilla 5: acciones de ahorro y sus ítems
  const plan = m.data.measures.filter((x) => x.selected);
  const economics = new Map(plan.map((x) => [x.id, measureEconomics(x, project.economics)]));
  tables.push(
    table('plantilla-5', 'Plantilla 5 Medidas', plan, [
      { header: 'Acción', value: (x) => `${x.code} · ${x.title}` },
      { header: 'Clase de potencial', value: (x) => savingsTypeInfo(savingsTypeOf(x)).label },
      { header: 'Energético', value: () => 'Electricidad' },
      { header: 'Ahorro (kWh/año)', value: (x) => x.savingsKwhYear, decimals: 0 },
      { header: 'Ahorro (COP/año)', value: (x) => x.savingsCopYear, decimals: 0 },
      { header: 'Inversión (COP)', value: (x) => x.investmentCop, decimals: 0 },
      { header: 'Retorno simple (años)', value: (x) => finite(economics.get(x.id)?.paybackYears), decimals: 1 },
      { header: 'Vida útil (años)', value: (x) => x.lifetimeYears },
      { header: 'Descripción técnica', value: (x) => x.description },
      { header: 'Equipo', value: () => '' },
      { header: 'Marca o modelo', value: () => '' },
      { header: 'Referencia', value: () => '' },
      { header: 'Cantidad', value: () => '' },
      { header: 'Unidad', value: () => '' },
      { header: 'Valor unitario (COP)', value: () => '' },
      { header: 'Fabricante', value: () => '' },
      { header: 'Proveedor', value: () => '' },
      { header: 'Función', value: () => '' },
    ]),
  );

  // Metas por año y mecanismo de financiación (parte de la plantilla 5)
  const financing = chosenFinancing(m.data.pgee?.financing?.models).map((f) => f.label).join('; ');
  tables.push(
    table('metas', 'Metas por año', options.route.rows, [
      { header: 'Año', value: (r) => r.year },
      { header: 'Energético', value: () => 'Electricidad' },
      { header: 'Meta de ahorro (%)', value: (r) => finite(r.targetPct), decimals: 1 },
      { header: 'Meta de ahorro (kWh/año)', value: (r) => finite(r.targetKwh), decimals: 0 },
      { header: 'Ahorro previsto (kWh/año)', value: (r) => finite(r.plannedKwh), decimals: 0 },
      { header: 'Medidas que entran', value: (r) => r.measureCodes.join(', ') },
      { header: 'Presupuesto (COP)', value: (r) => finite(r.budgetCop), decimals: 0 },
      { header: 'Mecanismo de financiación', value: () => financing },
    ]),
  );
  return tables;
}

/** Excel del paquete. */
export async function buildUpmePackage(m: AuditModel, options: { cycle?: Pick<UpmeCycle, 'year' | 'caseNumber'>; route: RoutePlan }): Promise<{ blob: Blob; fileName: string }> {
  const year = options.cycle?.year ?? m.data.generatedAt.getFullYear();
  const blob = await buildWorkbook(upmeTables(m, options), { title: `Paquete UPME · ${m.data.project.name}`, created: m.data.generatedAt, holder: m.data.copyrightHolder });
  return { blob, fileName: upmeFileName('paquete', { year, caseNumber: options.cycle?.caseNumber }) };
}

/**
 * Zip de anexos (`ART237_<año>_<caso>_Anexos Auditorías.zip`): el paquete de datos, los formatos de recolección con lo registrado y una nota
 * de qué contiene cada archivo. El informe de auditoría en Word va aparte, con su propio nombre.
 */
export async function buildUpmeAnnexes(m: AuditModel, options: { cycle?: Pick<UpmeCycle, 'year' | 'caseNumber'>; route: RoutePlan }): Promise<{ blob: Blob; fileName: string }> {
  const { default: JSZip } = await import('jszip');
  const year = options.cycle?.year ?? m.data.generatedAt.getFullYear();
  const zip = new JSZip();
  const packageFile = await buildUpmePackage(m, options);
  zip.file(packageFile.fileName, packageFile.blob);
  zip.file(`Formatos de recolección - ${m.data.project.code ?? 'proyecto'}.xlsx`, await buildFormatsWorkbook(m.data, { filled: true, created: m.data.generatedAt }));
  zip.file(
    'LEEME.txt',
    [
      'Anexos del reporte de la auditoría energética (artículo 237 de la Ley 2294 de 2023).',
      '',
      `${packageFile.fileName}: datos de edificación y hojas equivalentes a las plantillas 1 a 5 del SUU.`,
      'Formatos de recolección: los formatos de Excel con la información levantada en campo.',
      '',
      'PONTIA no envía nada al SUU. La entidad diligencia el reporte con su usuario.',
      '',
      ownershipNotice(m.data.copyrightHolder),
    ].join('\r\n'),
  );
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, fileName: upmeFileName('anexos', { year, caseNumber: options.cycle?.caseNumber }) };
}
