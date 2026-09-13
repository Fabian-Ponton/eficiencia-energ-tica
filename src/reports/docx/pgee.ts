import { Document, Paragraph, TableOfContents, type FileChild } from 'docx';
import { BASELINE_VARIABLES } from '@/domain/analysis';
import { sum } from '@/domain/calc/stats';
import { endUseOf } from '@/domain/catalogs';
import { measureEconomics } from '@/domain/measures';
import type { EndUseCategory, Finding, Measure, Pgee } from '@/domain/types';
import { formatDate } from '@/utils/dates';
import { formatCop, formatMillionsCop, formatNumber, formatPercent } from '@/utils/format';
import type { ReportFigure } from '../figures';
import type { AuditModel } from '../model';
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
 * Plan de gestión eficiente de la energía (PGEE) con la estructura de la ISO 50001: política, alcance,
 * equipo, revisión energética (usos significativos, línea base, IDEn), objetivos y metas, planes de acción
 * con las medidas del plan, recursos, comunicación y formación, y seguimiento con M&V (IPMVP).
 * Cuando el auditor no ha escrito un apartado, va un texto propuesto marcado para aprobación.
 */

export interface PgeeInput {
  pgee?: Pgee;
  /** Todas las medidas del proyecto: entran al plan las marcadas como incluidas. */
  measures: readonly Measure[];
  findings: readonly Finding[];
}

const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 } as const;
const PRIORITY_TEXT = { alta: 'Alta', media: 'Media', baja: 'Baja' } as const;
const PHASE_BY_PRIORITY = { alta: 'Corto plazo (0–6 meses)', media: 'Mediano plazo (6–18 meses)', baja: 'Largo plazo (más de 18 meses)' } as const;
const payback = (years: number) => (Number.isFinite(years) ? `${formatNumber(years, 1)} años` : '—');
const useLabel = (category: string) => endUseOf(category as EndUseCategory).label;

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
      subtitle: [project.client, project.city].filter(Boolean).join(' · ') || 'Instalación auditada',
      facts: [
        ['Fecha', formatDate(iso(generatedAt))],
        ['Código del proyecto', project.code ?? '—'],
        ['Responsable', project.auditor ?? '—'],
        ['Referencia', 'ISO 50001 · ISO 50006 · ISO 50015 · IPMVP'],
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
        ` y ${formatCop(totals.cop)} por año, con una inversión de ${formatCop(totals.investment)}.`,
    ),
    kpiGrid([
      { label: 'Ahorro de energía', value: formatNumber(totals.kwh), unit: 'kWh/año', note: share !== null ? `${formatPercent(share, 1)} del consumo` : undefined },
      { label: 'Ahorro económico', value: formatMillionsCop(totals.cop), unit: 'COP/año' },
      { label: 'Inversión', value: formatMillionsCop(totals.investment), unit: 'COP' },
      { label: 'Retorno del plan', value: netSavings > 0 ? formatNumber(totals.investment / netSavings, 1) : '—', unit: 'años' },
      { label: 'Emisiones evitadas', value: economics.emissionFactorKgPerKwh > 0 ? formatNumber(totals.co2, 1) : '—', unit: 't CO₂e/año' },
      { label: 'Medidas', value: String(plan.length), note: `${input.measures.length} evaluadas` },
    ]),
  );

  // 1–3: política, alcance y equipo
  const organization = project.client ?? project.name;
  body.push(
    heading('1. Política energética'),
    ...section(
      pgee?.policy,
      `${organization} se compromete a mejorar de forma continua su desempeño energético: a usar la energía de manera eficiente en todas sus instalaciones, ` +
        'a asegurar la información y los recursos necesarios para alcanzar los objetivos y metas energéticas, a cumplir los requisitos legales aplicables ' +
        'y a preferir productos, servicios y diseños eficientes en el uso de la energía.',
    ),
    heading('2. Alcance y límites'),
    ...section(
      pgee?.scope,
      `El plan cubre ${project.name}${project.areaM2 ? ` (${formatNumber(project.areaM2)} m²` : ''}${project.users ? `${project.areaM2 ? ', ' : ' ('}${formatNumber(project.users)} usuarios)` : project.areaM2 ? ')' : ''} ` +
        'y todos los usos de energía eléctrica registrados en la auditoría energética.',
    ),
    heading('3. Equipo de gestión de la energía'),
  );
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

  // 4. Revisión energética
  body.push(heading('4. Revisión energética'), heading('4.1 Usos significativos de energía', 2));
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
  body.push(heading('4.2 Línea base energética', 2));
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
    heading('4.3 Indicadores de desempeño energético', 2),
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

  // 5. Objetivos y metas
  body.push(heading('5. Objetivos y metas energéticas'));
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

  // 6. Planes de acción
  body.push(heading('6. Planes de acción'));
  if (rows.length) {
    body.push(
      para('Las medidas se ordenan por prioridad; la prioridad alta corresponde a las de menor retorno o sin inversión.'),
      ...table(
        'Medidas del plan con su evaluación económica.',
        dataTable(
          [
            { header: 'Medida', width: 0.3 },
            { header: 'Ahorro (kWh/año)', width: 0.13, align: 'right' },
            { header: 'Ahorro (COP/año)', width: 0.15, align: 'right' },
            { header: 'Inversión (COP)', width: 0.15, align: 'right' },
            { header: 'Retorno', width: 0.12, align: 'right' },
            { header: 'Prioridad', width: 0.15 },
          ],
          rows.map(({ m: x, e }): Cell[] => [
            `${x.code} · ${x.title}`,
            formatNumber(x.savingsKwhYear),
            formatCop(x.savingsCopYear),
            formatCop(x.investmentCop),
            payback(e.paybackYears),
            x.priority ? { text: PRIORITY_TEXT[x.priority], bold: x.priority === 'alta', color: x.priority === 'alta' ? COLOR.serious : undefined } : '—',
          ]),
          ['Total del plan', formatNumber(totals.kwh), formatCop(totals.cop), formatCop(totals.investment), netSavings > 0 ? payback(totals.investment / netSavings) : '—', ''],
        ),
      ),
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

  // 7. Recursos
  body.push(
    heading('7. Recursos'),
    para(
      `El plan requiere una inversión de ${formatCop(totals.investment)} y costos de operación de ${formatCop(totals.cost)} por año. ` +
        (netSavings > 0 ? `Con un ahorro neto de ${formatCop(netSavings)} por año, el plan completo se recupera en ${formatNumber(totals.investment / netSavings, 1)} años.` : ''),
    ),
    para(
      `La evaluación usa una tasa de descuento del ${formatPercent(economics.discountRate, 1)}, un incremento anual de la tarifa del ${formatPercent(economics.tariffEscalation, 1)} ` +
        `y una tarifa de ${formatCop(economics.tariffCopPerKwh)} por kWh.`,
    ),
  );

  // 8. Comunicación y formación
  body.push(
    heading('8. Comunicación y formación'),
    heading('Comunicación', 2),
    ...section(
      pgee?.communication,
      'Los resultados del plan se comunican cada trimestre a la dirección y a los usuarios de la instalación: consumo frente a la meta, medidas implementadas y ahorros verificados.',
    ),
    heading('Formación', 2),
    ...section(
      pgee?.training,
      'El personal de mantenimiento y los usuarios reciben formación sobre el uso eficiente de los equipos, los horarios de operación y el reporte de fallas que desperdician energía.',
    ),
  );

  // 9. Seguimiento, medición y verificación
  body.push(
    heading('9. Seguimiento, medición y verificación'),
    ...section(
      pgee?.monitoring,
      'Cada mes se compara el consumo facturado con el que predice la línea base para las condiciones del periodo (días hábiles, ocupación y temperatura); la diferencia es el ahorro. ' +
        'Los ahorros de cada medida se verifican con el protocolo IPMVP: opción A o B para medidas aisladas (iluminación, aires) con mediciones del equipo intervenido, y opción C para el plan completo con las facturas.',
    ),
    para([text('Revisión del plan: ', { bold: true }), text(pgee?.reviewFrequency?.trim() || 'semestral, con la dirección.')]),
  );

  return new Document({
    creator: 'PONTIA',
    title: `Plan de gestión eficiente de la energía · ${project.name}`,
    description: 'Plan de gestión eficiente de la energía (ISO 50001)',
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
