import { Document, Paragraph, TableOfContents, type FileChild } from 'docx';
import { BASELINE_VARIABLES } from '@/domain/analysis';
import { MODEL_LABEL } from '@/domain/calc/lben';
import { sum } from '@/domain/calc/stats';
import { endUseOf } from '@/domain/catalogs';
import { chosenFinancing } from '@/domain/financing';
import { budgetBySource, scheduleSummary } from '@/domain/implementation';
import { measureEconomics } from '@/domain/measures';
import { LEGAL_GOAL_PCT, MEASURE_CLASSES, measureClassOf, type MeasureClass, type RouteRow } from '@/domain/route';
import { tenureScope, tenureStatement } from '@/domain/tenure';
import type { EndUseCategory, Finding, Measure, Pgee, Task } from '@/domain/types';
import { formatDate, periodLabel } from '@/utils/dates';
import { formatCop, formatMillionsCop, formatNumber, formatPercent } from '@/utils/format';
import type { ReportFigure } from '../figures';
import type { AuditModel } from '../model';
import { reportRoute } from '../route';
import type { AuditAssets } from './audit';
import {
  blankFooter,
  blankHeader,
  bullet,
  COLOR,
  coverPage,
  dataTable,
  DOC_STYLES,
  figure,
  FONT,
  heading,
  kpiGrid,
  note,
  NUMBERING,
  PAGE,
  pageBreak,
  pageFooter,
  pageHeader,
  para,
  tableCaption,
  text,
  type Cell,
} from './theme';

/**
 * Plan de gestión eficiente de la energía (PGEE) con las siete etapas de la guía de la UPME para entidades públicas (2020): decisión y
 * marco legal, diagnóstico energético, formulación (meta legal, objetivos y ruta anual), selección de proyectos, modelo financiero y
 * contractual, implementación, y monitoreo, reporte y verificación. Incluye los elementos de la ISO 50001 (política, equipo, revisión
 * energética, IDEn, objetivos y planes de acción) y lo que pide la Res. MME 40412 de 2024 (art. 4, par. 3): ruta de cumplimiento anual y
 * responsable del seguimiento. Cuando el auditor no ha escrito un apartado, va un texto propuesto marcado para aprobación.
 */

export interface PgeeInput {
  pgee?: Pgee;
  /** Todas las medidas del proyecto: entran al plan las marcadas como incluidas. */
  measures: readonly Measure[];
  findings: readonly Finding[];
  /** Tareas del plan de implementación: dan el año en que entra en operación cada medida y el cronograma. */
  tasks?: readonly Task[];
}

const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 } as const;
const PRIORITY_TEXT = { alta: 'Alta', media: 'Media', baja: 'Baja' } as const;
const PHASE_BY_PRIORITY = { alta: 'Corto plazo (0–6 meses)', media: 'Mediano plazo (6–18 meses)', baja: 'Largo plazo (más de 18 meses)' } as const;
const payback = (years: number) => (Number.isFinite(years) ? `${formatNumber(years, 1)} años` : '—');
const useLabel = (category: string) => endUseOf(category as EndUseCategory).label;
const pct = (value: number | null, decimals = 1) => (value === null ? '—' : formatPercent(value / 100, decimals));

const ROUTE_STATUS_CELL = (row: RouteRow): Cell =>
  row.status === 'cumple' ? { text: 'Cumple', color: COLOR.good, bold: true } : row.status === 'no-cumple' ? { text: `Faltan ${formatNumber(row.gapKwh)} kWh/año`, color: COLOR.critical, bold: true } : '—';

export function buildPgeeDocument(m: AuditModel, input: PgeeInput, figures: readonly ReportFigure[], assets: Pick<AuditAssets, 'figures'>): Document {
  const { project, generatedAt } = m.data;
  const pgee = input.pgee;
  const economics = project.economics;
  const plan = input.measures
    .filter((x) => x.selected)
    .sort((a, b) => PRIORITY_ORDER[a.priority ?? 'baja'] - PRIORITY_ORDER[b.priority ?? 'baja'] || a.code.localeCompare(b.code, 'es', { numeric: true }));
  const rows = plan.map((x) => ({ m: x, e: measureEconomics(x, economics) }));
  const totals = {
    kwh: sum(plan.map((x) => x.savingsKwhYear)),
    cop: sum(plan.map((x) => x.savingsCopYear)),
    investment: sum(plan.map((x) => x.investmentCop)),
    cost: sum(plan.map((x) => x.annualCostCop)),
    co2: sum(rows.map((r) => r.e.co2TonnesYear ?? 0)),
  };
  const netSavings = totals.cop - totals.cost;
  const share = m.referenceKwh ? totals.kwh / m.referenceKwh : null;
  const findingTitle = new Map(input.findings.map((f) => [f.id, f.title]));
  const tasks = input.tasks ?? [];
  const route = reportRoute(m, input);
  const first = route.rows.find((r) => r.legalMinimum);

  let figureNumber = 0;
  let tableNumber = 0;
  const table = (caption: string, t: ReturnType<typeof dataTable>): FileChild[] => {
    tableNumber += 1;
    return [tableCaption(tableNumber, caption), t, new Paragraph({ spacing: { after: 120 }, children: [] })];
  };
  const fig = (id: string): FileChild[] => {
    const spec = figures.find((f) => f.id === id);
    const image = assets.figures.get(id);
    if (!spec || !image) return [];
    figureNumber += 1;
    return figure(image.data, image, figureNumber, spec.title, spec.source);
  };
  /** Texto del auditor o, si falta, el propuesto con la marca de aprobación. */
  const section = (written: string | undefined, proposal: string): FileChild[] =>
    written?.trim()
      ? written
          .trim()
          .split(/\n{2,}/)
          .map((p) => para(p))
      : [para(proposal), note('Texto propuesto por PONTIA: la dirección debe revisarlo y aprobarlo.')];

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const body: FileChild[] = [
    ...coverPage({
      kicker: 'PLAN DE GESTIÓN EFICIENTE DE LA ENERGÍA',
      title: project.name,
      subtitle: [project.client, project.site?.name, project.city].filter(Boolean).join(' · ') || 'Instalación auditada',
      facts: [
        ['Fecha', formatDate(iso(generatedAt))],
        ['Código del proyecto', project.code ?? '—'],
        ['Gestor energético', pgee?.energyManager?.name ?? '—'],
        ['Responsable de la auditoría', project.auditor ?? '—'],
        ['Referencia', 'Guía UPME de PGEE · ISO 50001 · ISO 50006 · IPMVP'],
      ],
      footer: 'Elaborado con PONTIA · plataforma de auditoría y eficiencia energética',
    }),
    pageBreak(),
    para([text('Contenido', { font: FONT.heading, size: 36, color: COLOR.navy })], { spacing: { after: 200 } }),
    new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-2' }),
    note('Si el índice aparece vacío, en Word haz clic derecho sobre él y elige «Actualizar campos».'),
    pageBreak(),
  ];

  // Resumen
  body.push(
    heading('Resumen del plan'),
    para(
      `El plan reúne ${plan.length} ${plan.length === 1 ? 'medida' : 'medidas'} que ahorran ${formatNumber(totals.kwh)} kWh al año` +
        (share !== null ? ` (${formatPercent(share, 1)} del consumo anual)` : '') +
        ` y ${formatCop(totals.cop)} por año, con una inversión de ${formatCop(totals.investment)}.` +
        (first && first.status !== 'sin-meta'
          ? ` Con la ruta anual, el primer año (${first.year}) prevé un ahorro de ${pct(first.plannedPct)}: ${first.status === 'cumple' ? 'alcanza' : 'no alcanza'} el mínimo legal del ${formatNumber(route.legal.pct, 0)} %.`
          : ''),
    ),
    kpiGrid([
      { label: 'Ahorro de energía', value: formatNumber(totals.kwh), unit: 'kWh/año', note: share !== null ? `${formatPercent(share, 1)} del consumo` : undefined },
      { label: 'Ahorro económico', value: formatMillionsCop(totals.cop), unit: 'COP/año' },
      { label: 'Inversión', value: formatMillionsCop(totals.investment), unit: 'COP' },
      { label: 'Retorno del plan', value: netSavings > 0 ? formatNumber(totals.investment / netSavings, 1) : '—', unit: 'años' },
      { label: 'Emisiones evitadas', value: economics.emissionFactorKgPerKwh > 0 ? formatNumber(totals.co2, 1) : '—', unit: 't CO₂e/año' },
      { label: first ? `Ahorro previsto en ${first.year}` : 'Ahorro del primer año', value: first?.plannedPct !== null && first?.plannedPct !== undefined ? pct(first.plannedPct) : '—', note: `mínimo legal ${formatNumber(route.legal.pct, 0)} %` },
    ]),
  );

  // 1. Decisión y marco legal
  const organization = project.client ?? project.name;
  const tenure = tenureStatement(project.building?.tenure, project.entity?.kind);
  const legalRows: Cell[][] = [
    [
      'Ley 1715 de 2014, art. 30 (modificado por la Ley 2294 de 2023, art. 237)',
      'Auditoría energética cada cuatro años. En el año siguiente, estrategias que permitan un ahorro de mínimo 15 % respecto del consumo del año anterior y, desde el segundo año, metas sostenibles definidas por la auditoría. Los ahorros pueden pagar las inversiones. Reporte anual a la UPME.',
      '3.1, 3.3, 5.2 y 7.4',
    ],
    ['Res. MME 40412 de 2024, art. 4, parágrafo 3', 'El PGEE incluye una ruta de cumplimiento anual de ahorro energético y define un responsable para su seguimiento y evaluación.', '1.4 y 3.3'],
    ['Res. MME 40412 de 2024, art. 5', 'Reporte a la UPME del informe de la auditoría y de los resultados de las medidas, con el procedimiento, plazo, contenido y formatos que la UPME determine por circular.', '7.4'],
    ['Res. UPME 016 de 2024', 'Metodología para calcular la línea base de consumo y el ahorro estimado.', '2.2'],
    ['Guía UPME de PGEE para entidades públicas (diciembre de 2020)', 'Proceso de siete etapas: decisión, diagnóstico, formulación, selección de proyectos, modelo financiero y contractual, implementación, y monitoreo y verificación.', 'Estructura de este documento'],
  ];
  if (tenure && tenureScope(project.building?.tenure, project.entity?.kind) !== 'todas') legalRows.splice(2, 0, ['Res. MME 40412 de 2024, art. 3, parágrafo 3', tenure, '4']);

  body.push(
    heading('1. Decisión y marco legal'),
    para('Primera etapa del proceso: la entidad decide emprender el plan, fija su política, su alcance y designa a quien lo lidera. Esta es la norma que lo sustenta.'),
    heading('1.1 Marco legal', 2),
    ...table(
      'Normas que sustentan el plan y dónde se atiende cada una.',
      dataTable(
        [
          { header: 'Norma', width: 0.3 },
          { header: 'Qué establece', width: 0.5 },
          { header: 'Sección', width: 0.2 },
        ],
        legalRows,
      ),
    ),
    note('La ley fija las metas sostenibles «a más tardar en el año 2026». Este documento no interpreta ese plazo: conviene consultarlo con la UPME.'),
    heading('1.2 Política energética', 2),
    ...section(
      pgee?.policy,
      `${organization} se compromete a mejorar de forma continua su desempeño energético: a usar la energía de manera eficiente en todas sus instalaciones, ` +
        'a asegurar la información y los recursos necesarios para alcanzar los objetivos y metas energéticas, a cumplir los requisitos legales aplicables ' +
        'y a preferir productos, servicios y diseños eficientes en el uso de la energía.',
    ),
    heading('1.3 Alcance y límites', 2),
    ...section(
      pgee?.scope,
      `El plan cubre ${project.name}${project.areaM2 ? ` (${formatNumber(project.areaM2)} m²` : ''}${project.users ? `${project.areaM2 ? ', ' : ' ('}${formatNumber(project.users)} usuarios)` : project.areaM2 ? ')' : ''} ` +
        'y todos los usos de energía eléctrica registrados en la auditoría energética.',
    ),
    heading('1.4 Gestor energético', 2),
  );
  const manager = pgee?.energyManager;
  if (manager?.name.trim()) {
    body.push(
      para(
        `El gestor energético del plan es ${manager.name}${manager.role ? ` (${manager.role})` : ''}. Lidera la estructuración y la implementación del plan y responde por su seguimiento y evaluación, como lo pide el parágrafo 3 del artículo 4 de la Resolución 40412 de 2024.`,
      ),
      ...table(
        'Designación del gestor energético.',
        dataTable(
          [
            { header: 'Dato', width: 0.35 },
            { header: 'Registro', width: 0.65 },
          ],
          [
            ['Gestor energético', manager.name],
            ['Rol en el plan', manager.role ?? '—'],
            ['Acto de designación', manager.appointmentDoc ?? '—'],
            ['Fecha del acto', manager.appointmentDate ? formatDate(manager.appointmentDate) : '—'],
          ],
        ),
      ),
      ...(manager.appointmentDoc && manager.appointmentDate ? [] : [note('Falta registrar el acto y la fecha con que se designó al gestor.')]),
    );
  } else {
    body.push(
      para(
        'La entidad debe definir un responsable del seguimiento y la evaluación del plan (Resolución 40412 de 2024, art. 4, par. 3). Se propone designar un gestor energético con conocimientos básicos sobre el uso de la energía en la institución y con interés en el proceso, mediante un acto administrativo que quede registrado en este plan.',
      ),
      note('Texto propuesto por PONTIA: la dirección debe designar al gestor y registrar el acto en PONTIA.'),
    );
  }
  body.push(heading('1.5 Equipo de gestión de la energía', 2));
  if (pgee?.team.length) {
    body.push(
      ...table(
        'Integrantes del equipo de gestión de la energía.',
        dataTable(
          [
            { header: 'Rol', width: 0.28 },
            { header: 'Nombre', width: 0.27 },
            { header: 'Responsabilidades', width: 0.45 },
          ],
          pgee.team.map((t) => [t.role, t.name, t.responsibilities ?? '—']),
        ),
      ),
    );
  } else {
    body.push(
      para('Se propone conformar el equipo con estos roles:'),
      bullet([text('Representante de la dirección: ', { bold: true }), text('aprueba la política, asigna recursos y revisa los resultados.')]),
      bullet([text('Líder de gestión de la energía: ', { bold: true }), text('coordina el plan, hace el seguimiento de los indicadores y reporta los avances.')]),
      bullet([text('Mantenimiento e infraestructura: ', { bold: true }), text('ejecuta las medidas y mantiene los equipos.')]),
      note('Registra los integrantes del equipo en PONTIA para que aparezcan con su nombre.'),
    );
  }

  // 2. Diagnóstico energético
  body.push(
    heading('2. Diagnóstico energético'),
    para('Segunda etapa: la caracterización del uso de la energía. El detalle está en el informe de la auditoría; aquí se resume lo que fundamenta el plan.'),
    heading('2.1 Usos significativos de energía', 2),
  );
  if (m.significant.length) {
    body.push(
      para(
        `${m.significant.length === 1 ? 'El uso significativo concentra' : 'Los usos significativos concentran'} el ${formatPercent(m.significant[m.significant.length - 1].cumulativeShare, 0)} del consumo estimado ` +
          `y ${m.significant.length === 1 ? 'es' : 'son'} la prioridad del plan.`,
      ),
      ...table(
        'Usos significativos de energía (Pareto del 80 %).',
        dataTable(
          [
            { header: 'Uso final', width: 0.4 },
            { header: 'kWh/año', width: 0.22, align: 'right' },
            { header: 'Participación', width: 0.19, align: 'right' },
            { header: 'Acumulado', width: 0.19, align: 'right' },
          ],
          m.significant.map((s) => [useLabel(s.category), formatNumber(s.kwh), formatPercent(s.share, 1), formatPercent(s.cumulativeShare, 0)]),
        ),
      ),
    );
  } else {
    body.push(para('El censo de carga aún no tiene equipos: los usos significativos quedan pendientes.'));
  }
  body.push(heading('2.2 Línea base energética', 2));
  if (m.upme) {
    const u = m.upme;
    body.push(
      para(
        `Línea base de consumo energético (LBEn) con el método de la Res. UPME 016 de 2024: ${MODEL_LABEL[u.kind].toLowerCase()}, ${u.months} meses de facturas (${periodLabel(u.from)} a ${periodLabel(u.to)}), consumo normalizado a 30 días.` +
          (u.headline.baselineKwhYear !== null ? ` LBEn anual: ${formatNumber(u.headline.baselineKwhYear)} kWh.` : '') +
          (u.headline.savingPct !== null ? ` Potencial de ahorro por mejor desempeño: ${formatPercent(u.headline.savingPct, 1)}${u.headline.savingKwhYear !== null ? ` (${formatNumber(u.headline.savingKwhYear)} kWh/año)` : ''}.` : ''),
      ),
    );
  }
  if (m.baseline) {
    const b = m.baseline;
    const [b0, ...rest] = b.model.coefficients;
    const labelOf = (id: string) => BASELINE_VARIABLES.find((v) => v.id === id)?.label.toLowerCase() ?? id;
    body.push(
      para([
        text('Modelo: ', { bold: true }),
        text(`kWh/mes = ${formatNumber(b0)} ${rest.map((c, k) => `${c < 0 ? '−' : '+'} ${formatNumber(Math.abs(c), 1)} × ${labelOf(b.variables[k])}`).join(' ')}`.trim(), { font: FONT.mono, size: 19 }),
      ]),
      para(
        `Periodo base: ${b.model.observations} meses. R² ${formatNumber(b.model.r2, 2)}, CV(RMSE) ${formatPercent(b.model.cvRmse, 1)} y NMBE ${formatPercent(b.model.nmbe, 2)}` +
          (b.quality.cvRmse && b.quality.nmbe ? ': cumple los criterios de ASHRAE Guideline 14.' : ': conviene mejorar el modelo con más variables antes de verificar ahorros.'),
      ),
    );
  } else {
    body.push(para('Se necesitan al menos 4 facturas con sus variables para ajustar la línea base.'));
  }
  const i = m.indicators;
  body.push(
    heading('2.3 Indicadores de desempeño energético', 2),
    ...table(
      'Indicadores de desempeño energético (IDEn) del año base.',
      dataTable(
        [
          { header: 'Indicador', width: 0.5 },
          { header: 'Valor base', width: 0.25, align: 'right' },
          { header: 'Unidad', width: 0.25 },
        ],
        [
          ['Consumo por área construida', i.kwhPerM2Year === null ? '—' : formatNumber(i.kwhPerM2Year, 1), 'kWh/m²·año'],
          ['Consumo por usuario', i.kwhPerUserYear === null ? '—' : formatNumber(i.kwhPerUserYear), 'kWh/usuario·año'],
          ['Consumo diario promedio', i.kwhPerDay === null ? '—' : formatNumber(i.kwhPerDay), 'kWh/día'],
        ],
      ),
    ),
  );

  // 3. Formulación del plan
  const legal = route.legal;
  const source = m.annual.last12Kwh !== null ? 'últimos 12 meses facturados' : m.annual.annualizedKwh !== null ? 'consumo anualizado con las facturas disponibles' : 'consumo estimado con el censo de carga';
  body.push(
    heading('3. Formulación del plan'),
    para('Tercera etapa: las metas, con la ruta año por año que permite verificar el cumplimiento.'),
    heading('3.1 Meta legal del primer año', 2),
    para(
      `La ley exige que en el año siguiente a la auditoría (${legal.firstYear}) la entidad implemente estrategias que permitan un ahorro de mínimo ${formatNumber(LEGAL_GOAL_PCT, 0)} % respecto del consumo del año anterior.` +
        (legal.pct > LEGAL_GOAL_PCT ? ` La entidad fijó una meta más exigente: ${formatNumber(legal.pct, 0)} %.` : ''),
    ),
    ...table(
      'Meta legal del primer año frente a lo que prevé el plan.',
      dataTable(
        [
          { header: 'Concepto', width: 0.4 },
          { header: 'Valor', width: 0.6 },
        ],
        [
          ['Año de referencia (el año anterior)', String(legal.baseYear)],
          ['Consumo de referencia', legal.referenceKwh !== null ? `${formatNumber(legal.referenceKwh)} kWh/año (${legal.overridden ? 'registrado por el auditor' : source})` : 'Sin dato: registra las facturas'],
          ['Meta mínima', legal.targetKwh !== null ? `${formatNumber(legal.pct, 0)} % · ${formatNumber(legal.targetKwh)} kWh/año` : `${formatNumber(legal.pct, 0)} %`],
          [`Ahorro previsto en ${legal.firstYear}`, first ? `${formatNumber(first.plannedKwh)} kWh/año · ${pct(first.plannedPct)}` : '—'],
          ['Resultado', first ? ROUTE_STATUS_CELL(first) : '—'],
        ],
      ),
    ),
  );
  for (const notice of route.notices.filter((n) => n.tone !== 'info')) {
    body.push(para([text('Atención. ', { bold: true, color: notice.tone === 'critical' ? COLOR.critical : COLOR.warning }), text(notice.text)]));
  }

  body.push(heading('3.2 Objetivos y metas energéticas', 2));
  if (pgee?.objectives.length) {
    body.push(
      ...table(
        'Objetivos y metas del plan.',
        dataTable(
          [
            { header: 'Objetivo', width: 0.46 },
            { header: 'Meta', width: 0.14, align: 'right' },
            { header: 'Ahorro equivalente', width: 0.2, align: 'right' },
            { header: 'Plazo', width: 0.2 },
          ],
          pgee.objectives.map((o) => [
            o.description,
            o.targetPercent !== undefined ? `${formatNumber(o.targetPercent, 1)} %` : '—',
            o.targetPercent !== undefined && m.referenceKwh ? `${formatNumber((o.targetPercent / 100) * m.referenceKwh)} kWh/año` : '—',
            o.deadline ? formatDate(o.deadline) : '—',
          ]),
        ),
      ),
    );
  } else {
    body.push(
      para(
        share !== null
          ? `Se propone como meta reducir el consumo anual en un ${formatPercent(share, 1)} (${formatNumber(totals.kwh)} kWh/año) frente a la línea base, con la implementación completa del plan.`
          : 'Se propone fijar una meta de reducción del consumo frente a la línea base con las medidas del plan.',
      ),
      note('Registra los objetivos y metas en PONTIA para que aparezcan con su plazo.'),
    );
  }

  body.push(heading('3.3 Ruta de cumplimiento anual', 2));
  if (route.rows.length) {
    body.push(
      para(
        'La ruta muestra, año por año, las medidas que entran en operación, el ahorro anual acumulado que prevén (descontando el solapamiento entre medidas), la meta del año y el presupuesto. ' +
          'La ley pide el mínimo del primer año; desde el segundo, las metas las define la auditoría.',
      ),
      ...table(
        'Ruta de cumplimiento anual de ahorro energético.',
        dataTable(
          [
            { header: 'Año', width: 0.1 },
            { header: 'Medidas que entran', width: 0.2 },
            { header: 'Ahorro previsto (kWh/año)', width: 0.15, align: 'right' },
            { header: 'Del consumo', width: 0.1, align: 'right' },
            { header: 'Meta', width: 0.1, align: 'right' },
            { header: 'Presupuesto (COP)', width: 0.16, align: 'right' },
            { header: 'Estado', width: 0.19 },
          ],
          route.rows.map((r): Cell[] => [
            `${r.year}${r.legalMinimum ? ' *' : ''}`,
            r.measureCodes.join(', ') || '—',
            formatNumber(r.plannedKwh),
            pct(r.plannedPct),
            r.targetPct !== null ? pct(r.targetPct) : '—',
            r.budgetCop ? formatCop(r.budgetCop) : '—',
            ROUTE_STATUS_CELL(r),
          ]),
          ['Total', '', '', '', '', formatCop(sum(route.rows.map((r) => r.budgetCop))), ''],
        ),
      ),
      note(`* Primer año después de la auditoría: la meta no puede ser menor que el ${formatNumber(legal.pct, 0)} % de la ley.`),
      ...fig('ruta-anual'),
    );
    for (const r of route.rows.filter((x) => x.note)) body.push(bullet([text(`${r.year}: `, { bold: true }), text(r.note ?? '')]));
    if (route.route.proposed) body.push(note('Ruta propuesta por PONTIA con las fechas de las tareas y la prioridad de las medidas: el equipo de gestión debe revisarla y aprobarla.'));
  } else {
    body.push(para('La ruta se arma con las medidas incluidas en el plan; aún no hay ninguna.'));
  }

  // 4. Selección de proyectos
  const classOfRow = (paybackYears: number): MeasureClass => measureClassOf(paybackYears);
  // Victoria temprana (guía UPME): la medida de retorno más corto (tipo A y, si no hay, B) y, entre ellas, la de mayor ahorro
  const CLASS_RANK: Record<MeasureClass, number> = { A: 0, B: 1, C: 2 };
  const early = rows
    .filter((r) => classOfRow(r.e.paybackYears) !== 'C')
    .sort((a, b) => CLASS_RANK[classOfRow(a.e.paybackYears)] - CLASS_RANK[classOfRow(b.e.paybackYears)] || b.m.savingsKwhYear - a.m.savingsKwhYear)[0];
  body.push(
    heading('4. Selección de proyectos'),
    para('Cuarta etapa: las medidas del diagnóstico que entran al plan, priorizadas por su retorno. La selección se repite cada vez que se revisa el plan, según los tiempos de implementación y de financiación.'),
  );
  if (rows.length) {
    body.push(
      para(
        `Las medidas se ordenan por prioridad; la prioridad alta corresponde a las de menor retorno o sin inversión. Además se clasifican por lo que tarda en recuperarse la inversión, como propone la guía de la UPME: ` +
          `${MEASURE_CLASSES.A.label} (${MEASURE_CLASSES.A.range}: ${MEASURE_CLASSES.A.examples}), ${MEASURE_CLASSES.B.label} (${MEASURE_CLASSES.B.range}: ${MEASURE_CLASSES.B.examples}) y ${MEASURE_CLASSES.C.label} (${MEASURE_CLASSES.C.range}: ${MEASURE_CLASSES.C.examples}).`,
      ),
      ...table(
        'Medidas del plan con su evaluación económica.',
        dataTable(
          [
            { header: 'Medida', width: 0.27 },
            { header: 'Ahorro (kWh/año)', width: 0.12, align: 'right' },
            { header: 'Ahorro (COP/año)', width: 0.14, align: 'right' },
            { header: 'Inversión (COP)', width: 0.14, align: 'right' },
            { header: 'Retorno', width: 0.1, align: 'right' },
            { header: 'Tipo', width: 0.08 },
            { header: 'Prioridad', width: 0.15 },
          ],
          rows.map(({ m: x, e }): Cell[] => [
            `${x.code} · ${x.title}`,
            formatNumber(x.savingsKwhYear),
            formatCop(x.savingsCopYear),
            formatCop(x.investmentCop),
            payback(e.paybackYears),
            classOfRow(e.paybackYears),
            x.priority ? { text: PRIORITY_TEXT[x.priority], bold: x.priority === 'alta', color: x.priority === 'alta' ? COLOR.serious : undefined } : '—',
          ]),
          ['Total del plan', formatNumber(totals.kwh), formatCop(totals.cop), formatCop(totals.investment), netSavings > 0 ? payback(totals.investment / netSavings) : '—', '', ''],
        ),
      ),
      ...(early
        ? [
            para([
              text('Victoria temprana. ', { bold: true }),
              text(
                'La guía recomienda escoger una medida o un paquete que opere en menos de dos años, sea viable técnica y económicamente, financieramente factible, medible, de gran impacto en el consumo y que alcance a la mayoría de los usuarios. ' +
                  `Con los datos del plan, la candidata es ${early.m.code} · ${early.m.title} (${MEASURE_CLASSES[classOfRow(early.e.paybackYears)].label}, ${formatNumber(early.m.savingsKwhYear)} kWh/año); el equipo de gestión debe confirmarla.`,
              ),
            ]),
          ]
        : []),
      ...fig('matriz-priorizacion'),
    );
    for (const { m: x, e } of rows) {
      const addressed = x.findingIds.map((id) => findingTitle.get(id)).filter((t): t is string => Boolean(t));
      body.push(
        heading(`${x.code} · ${x.title}`, 2),
        ...(x.description ? [para(x.description)] : []),
        bullet([text('Uso final: ', { bold: true }), text(useLabel(x.category))]),
        bullet([text('Plazo sugerido: ', { bold: true }), text(PHASE_BY_PRIORITY[x.priority ?? 'baja'])]),
        bullet([
          text('Evaluación: ', { bold: true }),
          text(
            `VPN de ${formatCop(e.npvCop)} a ${e.years} años${e.irr !== null ? `, TIR del ${formatPercent(e.irr, 1)}` : ''}${e.co2TonnesYear !== null ? ` y ${formatNumber(e.co2TonnesYear, 2)} t CO₂e evitadas por año` : ''}.`,
          ),
        ]),
        ...(addressed.length ? [bullet([text('Atiende: ', { bold: true }), text(addressed.join('; '))])] : []),
        ...(x.notes ? [note(x.notes)] : []),
      );
    }
  } else {
    body.push(para('Aún no hay medidas incluidas en el plan. Márcalas en la pantalla de oportunidades.'));
  }

  // 5. Modelo financiero y contractual
  const financing = chosenFinancing(pgee?.financing?.models);
  const bySource = budgetBySource(tasks);
  body.push(
    heading('5. Modelo financiero y contractual'),
    para('Quinta etapa: cómo se pagan y se contratan las medidas seleccionadas.'),
    heading('5.1 Recursos y evaluación económica', 2),
    para(
      `El plan requiere una inversión de ${formatCop(totals.investment)} y costos de operación de ${formatCop(totals.cost)} por año. ` +
        (netSavings > 0 ? `Con un ahorro neto de ${formatCop(netSavings)} por año, el plan completo se recupera en ${formatNumber(totals.investment / netSavings, 1)} años.` : ''),
    ),
    para(
      `La evaluación usa una tasa de descuento del ${formatPercent(economics.discountRate, 1)}, un incremento anual de la tarifa del ${formatPercent(economics.tariffEscalation, 1)} ` +
        `y una tarifa de ${formatCop(economics.tariffCopPerKwh)} por kWh.`,
    ),
    heading('5.2 Modelos de financiación y contratación', 2),
  );
  if (financing.length || pgee?.financing?.note?.trim()) {
    if (financing.length) {
      body.push(para('La entidad considera estos caminos para pagar las medidas:'), ...financing.map((f) => bullet([text(`${f.label}: `, { bold: true }), text(f.description)])));
    }
    if (pgee?.financing?.note?.trim()) {
      body.push(...pgee.financing.note.trim().split(/\n{2,}/).map((p) => para(p)));
    }
    body.push(note('El instrumento jurídico de cada medida lo define la entidad con su oficina jurídica y de presupuesto.'));
  } else {
    body.push(
      para(
        'El modelo financiero y contractual de cada medida lo define la entidad con su oficina jurídica y de presupuesto. La guía de la UPME presenta estos caminos: financiar con recursos de la entidad (gastos de funcionamiento o un proyecto de inversión), ' +
          'con operaciones de crédito (leasing o crédito de proveedor), con contratos de servicios (renting o alianzas público-privadas) y con contratos por desempeño energético, en los que los ahorros pagan la inversión. ' +
          'La Ley 1715 permite además reinvertir los ahorros y el FENOGE financia inversiones en eficiencia energética.',
      ),
      note('Texto propuesto por PONTIA: elige en PONTIA los caminos que la entidad considera para que aparezcan aquí.'),
    );
  }
  if (bySource.length) {
    body.push(
      ...table(
        'Presupuesto de las tareas del plan de implementación por fuente de financiación.',
        dataTable(
          [
            { header: 'Fuente', width: 0.5 },
            { header: 'Tareas', width: 0.15, align: 'right' },
            { header: 'Presupuesto (COP)', width: 0.35, align: 'right' },
          ],
          bySource.map((s) => [s.source, String(s.count), formatCop(s.budget)]),
          ['Total', String(sum(bySource.map((s) => s.count))), formatCop(sum(bySource.map((s) => s.budget)))],
        ),
      ),
    );
  }

  // 6. Implementación
  const schedule = scheduleSummary(tasks, iso(generatedAt));
  body.push(
    heading('6. Implementación'),
    para('Sexta etapa: la ejecución de los proyectos seleccionados, con la comunicación y la formación que sostienen el cambio de hábitos.'),
    heading('6.1 Cronograma y avance', 2),
  );
  if (schedule.count) {
    body.push(
      para(
        `El plan de implementación programa ${schedule.count} ${schedule.count === 1 ? 'tarea' : 'tareas'}` +
          (schedule.start && schedule.end ? ` entre ${formatDate(schedule.start)} y ${formatDate(schedule.end)}` : '') +
          `, con un presupuesto de ${formatCop(schedule.budgetCop)}. Avance ponderado: ${formatPercent(schedule.progress, 0)}; ${schedule.done} implementadas, ${schedule.running} en ejecución y ${schedule.pending} pendientes` +
          (schedule.overdue ? `, ${schedule.overdue} con la fecha vencida` : '') +
          '. El cronograma completo, el presupuesto por mes y el flujo de caja están en el documento «Plan de implementación».',
      ),
    );
  } else {
    body.push(para('Aún no hay tareas programadas: el paso de implementación las propone a partir de las medidas del plan.'));
  }
  body.push(
    heading('6.2 Comunicación', 2),
    ...section(
      pgee?.communication,
      'Los resultados del plan se comunican cada trimestre a la dirección y a los usuarios de la instalación: consumo frente a la meta, medidas implementadas y ahorros verificados.',
    ),
    heading('6.3 Formación', 2),
    ...section(
      pgee?.training,
      'El personal de mantenimiento y los usuarios reciben formación sobre el uso eficiente de los equipos, los horarios de operación y el reporte de fallas que desperdician energía.',
    ),
  );

  // 7. Monitoreo, reporte y verificación
  body.push(
    heading('7. Monitoreo, reporte y verificación'),
    para('Séptima etapa: el seguimiento que mantiene vigente el plan y da cuenta de sus resultados.'),
    heading('7.1 Medición y verificación de los ahorros', 2),
    ...section(
      pgee?.monitoring,
      'Cada mes se compara el consumo facturado con el que predice la línea base para las condiciones del periodo (días hábiles, ocupación y temperatura); la diferencia es el ahorro. ' +
        'Los ahorros de cada medida se verifican con el protocolo IPMVP: opción A o B para medidas aisladas (iluminación, aires) con mediciones del equipo intervenido, y opción C para el plan completo con las facturas.',
    ),
    heading('7.2 Revisión del plan', 2),
    para([text('Revisión con la dirección: ', { bold: true }), text(pgee?.reviewFrequency?.trim() || 'semestral, con la dirección.')]),
    para(
      'La guía de la UPME propone que el gestor energético documente cada mes sus observaciones sobre el desarrollo del plan y que la dirección de la entidad se reúna cada año con él para revisar su estructura y decidir los ajustes. De la reunión anual quedan como mínimo:',
    ),
    bullet('el acta de la reunión, con fecha, participantes y decisiones;'),
    bullet('la evaluación de la matriz de planificación elaborada al formular el plan (aspectos, alcance, cumplimiento y observaciones);'),
    bullet('el informe de la evolución de los indicadores de seguimiento;'),
    bullet('el plan actualizado con las oportunidades de mejora que se identifiquen;'),
    bullet('el informe de seguimiento que se presenta a la UPME.'),
    heading('7.3 Indicadores de seguimiento', 2),
    ...table(
      'Indicadores de seguimiento del plan (matriz de reporte de la guía de la UPME).',
      dataTable(
        [
          { header: 'Indicador', width: 0.32 },
          { header: 'Cómo se mide', width: 0.42 },
          { header: 'Valor base o meta', width: 0.26, align: 'right' },
        ],
        [
          ['Efectividad de las medidas', '(ahorro real alcanzado × 100) ÷ ahorro estimado', 'meta: 100 %'],
          ['Consumo de energía por área construida', 'kWh/m²·año', i.kwhPerM2Year === null ? '—' : formatNumber(i.kwhPerM2Year, 1)],
          ['Consumo de energía por usuario', 'kWh/usuario·año', i.kwhPerUserYear === null ? '—' : formatNumber(i.kwhPerUserYear)],
          ['Emisiones de GEI evitadas por las medidas', 't CO₂e/año', economics.emissionFactorKgPerKwh > 0 ? formatNumber(totals.co2, 1) : '—'],
          ['Cumplimiento de la normativa vigente', 'requisitos cumplidos frente a los aplicables', '—'],
          ['Financiación del plan', 'presupuesto ejecutado frente al programado', '—'],
        ],
      ),
    ),
    heading('7.4 Reporte a la UPME', 2),
    para(
      'La Ley 1715 (art. 30) obliga a cada entidad a reportar a la UPME, cada año, los resultados de la implementación de las medidas de eficiencia energética. La Resolución 40412 de 2024 (art. 5) establece que el reporte se hace ' +
        'con el procedimiento, el plazo, el contenido y los formatos que la UPME determine por circular. La guía de la UPME pide incluir el formato de evaluación de seguimiento del plan y la matriz de reporte de la evolución de los indicadores.',
    ),
    note('Los formatos y plazos vigentes los fija la UPME: confírmalos en su circular más reciente antes de reportar.'),
  );

  return new Document({
    creator: 'PONTIA',
    title: `Plan de gestión eficiente de la energía · ${project.name}`,
    description: 'Plan de gestión eficiente de la energía (guía UPME · ISO 50001)',
    features: { updateFields: true },
    styles: DOC_STYLES,
    numbering: NUMBERING,
    sections: [
      {
        properties: {
          titlePage: true,
          page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin } },
        },
        headers: { default: pageHeader(project.name, 'Plan de gestión de la energía'), first: blankHeader() },
        footers: { default: pageFooter(), first: blankFooter() },
        children: body,
      },
    ],
  });
}
