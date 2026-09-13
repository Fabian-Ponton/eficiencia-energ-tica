import { Document, Paragraph, TableOfContents, type FileChild } from 'docx';
import { budgetByPhase, budgetBySource, isOverdue, PHASE_ORDER, planCashFlow, scheduleSummary, TASK_PHASES, TASK_STATUS_LABEL, upcomingTasks } from '@/domain/implementation';
import type { Measure, Task } from '@/domain/types';
import { formatDate, periodLabel, periodLabelLong, toLocalDate } from '@/utils/dates';
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
 * Plan de implementación del PGEE: alcance, cronograma por plazo (Gantt), presupuesto y financiación,
 * flujo de caja de la inversión frente al ahorro, responsables con sus indicadores y seguimiento.
 */

export interface ImplementationInput {
  tasks: readonly Task[];
  measures: readonly Measure[];
}

const STATUS_COLOR = { pendiente: COLOR.muted, 'en-ejecucion': COLOR.info, implementada: COLOR.good } as const;

export function buildImplementationDocument(m: AuditModel, input: ImplementationInput, figures: readonly ReportFigure[], assets: Pick<AuditAssets, 'figures'>): Document {
  const { project, generatedAt } = m.data;
  const today = toLocalDate(generatedAt);
  const measureById = new Map(input.measures.map((x) => [x.id, x]));
  const tasks = [...input.tasks].sort(
    (a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || (a.start ?? '9999').localeCompare(b.start ?? '9999') || a.name.localeCompare(b.name, 'es'),
  );
  const summary = scheduleSummary(tasks, today);
  const flow = planCashFlow(input.measures, tasks, project.economics);
  const plan = input.measures.filter((x) => x.selected);
  const scheduled = plan.filter((x) => tasks.some((t) => t.measureId === x.id));
  const savedKwh = scheduled.reduce((total, x) => total + x.savingsKwhYear, 0);

  const taskLabel = (t: Task) => {
    const x = t.measureId ? measureById.get(t.measureId) : undefined;
    return x ? `${x.code} · ${t.name}` : t.name;
  };
  const status = (t: Task): Cell =>
    isOverdue(t, today) ? { text: 'Atrasada', bold: true, color: COLOR.serious } : { text: TASK_STATUS_LABEL[t.status], color: STATUS_COLOR[t.status], bold: t.status === 'implementada' };

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

  const body: FileChild[] = [
    ...coverPage({
      kicker: 'PLAN DE IMPLEMENTACIÓN',
      title: project.name,
      subtitle: [project.client, project.city].filter(Boolean).join(' · ') || 'Instalación auditada',
      facts: [
        ['Fecha', formatDate(today)],
        ['Código del proyecto', project.code ?? '—'],
        ['Responsable', project.auditor ?? '—'],
        ['Referencia', 'ISO 50001 · ISO 50006 · IPMVP'],
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
  const coverage = scheduled.length === plan.length ? `las ${plan.length} medidas del PGEE` : `${scheduled.length} de las ${plan.length} medidas del PGEE`;
  body.push(
    heading('Resumen del plan'),
    para(
      `El plan programa ${tasks.length} ${tasks.length === 1 ? 'tarea' : 'tareas'} para ${coverage}` +
        (summary.start && summary.end ? `, entre el ${formatDate(summary.start)} y el ${formatDate(summary.end)}` : '') +
        `, con un presupuesto de ${formatCop(summary.budgetCop)}.`,
    ),
    kpiGrid([
      { label: 'Tareas', value: String(summary.count), note: `${summary.done} implementadas · ${summary.running} en ejecución` },
      { label: 'Presupuesto', value: formatMillionsCop(summary.budgetCop), unit: 'COP' },
      { label: 'Duración', value: summary.months !== null ? String(summary.months) : '—', unit: 'meses', note: summary.start && summary.end ? `${formatDate(summary.start)} – ${formatDate(summary.end)}` : undefined },
      { label: 'Avance', value: formatPercent(summary.progress, 0), note: summary.overdue ? `${summary.overdue} ${summary.overdue === 1 ? 'tarea atrasada' : 'tareas atrasadas'}` : 'sin atrasos' },
      { label: 'Recuperación', value: flow.breakEven ? periodLabel(flow.breakEven) : '—', note: 'el ahorro acumulado cubre la inversión' },
      { label: 'Ahorro al terminar', value: formatNumber(savedKwh), unit: 'kWh/año' },
    ]),
  );

  // 1. Alcance
  body.push(
    heading('1. Alcance del plan'),
    para(
      'Cada medida del PGEE se ejecuta en el plazo que le da su prioridad: corto plazo (0 a 6 meses) para las de retorno rápido o sin inversión, mediano plazo (6 a 18 meses) y largo plazo (más de 18 meses).',
    ),
  );
  if (plan.length) {
    body.push(
      ...table(
        'Medidas del plan y sus tareas.',
        dataTable(
          [
            { header: 'Medida', width: 0.4 },
            { header: 'Tareas', width: 0.1, align: 'right' },
            { header: 'Inversión (COP)', width: 0.18, align: 'right' },
            { header: 'Ahorro (kWh/año)', width: 0.16, align: 'right' },
            { header: 'Termina', width: 0.16 },
          ],
          plan.map((x): Cell[] => {
            const own = tasks.filter((t) => t.measureId === x.id);
            const ends = own.map((t) => t.end).filter((e): e is string => Boolean(e)).sort();
            return [
              `${x.code} · ${x.title}`,
              String(own.length),
              formatCop(x.investmentCop),
              formatNumber(x.savingsKwhYear),
              ends.length ? formatDate(ends[ends.length - 1]) : { text: 'Sin programar', color: COLOR.serious },
            ];
          }),
        ),
      ),
    );
  } else {
    body.push(para('El PGEE aún no tiene medidas incluidas en el plan.'));
  }

  // 2. Cronograma
  body.push(heading('2. Cronograma'), ...fig('cronograma'));
  let sub = 0;
  for (const phase of TASK_PHASES) {
    const list = tasks.filter((t) => t.phase === phase.id);
    if (!list.length) continue;
    sub += 1;
    body.push(
      heading(`2.${sub} ${phase.label} (${phase.range})`, 2),
      ...table(
        `Tareas de ${phase.label.toLowerCase()}.`,
        dataTable(
          [
            { header: 'Tarea', width: 0.3 },
            { header: 'Responsable', width: 0.18 },
            { header: 'Inicio', width: 0.12 },
            { header: 'Fin', width: 0.12 },
            { header: 'Presupuesto', width: 0.15, align: 'right' },
            { header: 'Estado', width: 0.13 },
          ],
          list.map((t): Cell[] => [taskLabel(t), t.responsible ?? '—', formatDate(t.start), formatDate(t.end), t.budgetCop ? formatCop(t.budgetCop) : '—', status(t)]),
        ),
      ),
    );
  }
  if (!tasks.length) body.push(para('Aún no hay tareas programadas.'));

  // 3. Presupuesto y financiación
  const phases = budgetByPhase(tasks).filter((p) => p.count > 0);
  const sources = budgetBySource(tasks);
  const investment = plan.reduce((total, x) => total + x.investmentCop, 0);
  body.push(heading('3. Presupuesto y financiación'));
  if (phases.length) {
    body.push(
      ...table(
        'Presupuesto por plazo.',
        dataTable(
          [
            { header: 'Plazo', width: 0.4 },
            { header: 'Tareas', width: 0.15, align: 'right' },
            { header: 'Presupuesto (COP)', width: 0.25, align: 'right' },
            { header: 'Participación', width: 0.2, align: 'right' },
          ],
          phases.map((p) => [`${p.label} (${p.range})`, String(p.count), formatCop(p.budget), formatPercent(p.share, 0)]),
          ['Total', String(tasks.length), formatCop(summary.budgetCop), summary.budgetCop ? '100 %' : '—'],
        ),
      ),
    );
  }
  if (sources.length) {
    body.push(
      ...table(
        'Fuentes de financiación.',
        dataTable(
          [
            { header: 'Fuente', width: 0.55 },
            { header: 'Tareas', width: 0.15, align: 'right' },
            { header: 'Presupuesto (COP)', width: 0.3, align: 'right' },
          ],
          sources.map((s) => [s.source, String(s.count), formatCop(s.budget)]),
        ),
      ),
    );
  }
  if (Math.abs(investment - summary.budgetCop) > 1) {
    body.push(note(`La inversión estimada de las medidas del plan es de ${formatCop(investment)}; el presupuesto de las tareas suma ${formatCop(summary.budgetCop)}.`));
  }
  if (sources.some((s) => s.source.includes('1715'))) {
    body.push(
      note('Los incentivos tributarios de la Ley 1715 de 2014 (modificada por la Ley 2099 de 2021) se solicitan antes de comprar los equipos; conviene confirmar los requisitos vigentes con la UPME.'),
    );
  }

  // 4. Flujo de caja
  body.push(heading('4. Flujo de caja'));
  if (flow.periods.length) {
    const total = flow.investment[flow.investment.length - 1];
    body.push(
      para(
        flow.breakEven
          ? `Con el cronograma actual, el ahorro neto acumulado alcanza la inversión de ${formatCop(total)} en ${periodLabelLong(flow.breakEven)}.`
          : `En el horizonte evaluado el ahorro neto acumulado no alcanza la inversión de ${formatCop(total)}.`,
      ),
      ...fig('flujo-de-caja'),
    );
    if (flow.unscheduled) {
      body.push(note(`${flow.unscheduled} ${flow.unscheduled === 1 ? 'medida del plan no tiene' : 'medidas del plan no tienen'} tareas con fechas y no ${flow.unscheduled === 1 ? 'entra' : 'entran'} al flujo de caja.`));
    }
  } else {
    body.push(para('El flujo de caja se calcula cuando las tareas tienen fechas de inicio y de fin.'));
  }

  // 5. Responsables e indicadores
  body.push(heading('5. Responsables e indicadores'));
  if (tasks.length) {
    body.push(
      ...table(
        'Responsable, indicador y verificación de cada tarea.',
        dataTable(
          [
            { header: 'Tarea', width: 0.3 },
            { header: 'Responsable', width: 0.2 },
            { header: 'Indicador', width: 0.24 },
            { header: 'Verificación', width: 0.26 },
          ],
          tasks.map((t) => [taskLabel(t), t.responsible ?? '—', t.kpi ?? '—', t.verification ?? '—']),
        ),
      ),
    );
    const withoutOwner = tasks.filter((t) => !t.responsible).length;
    if (withoutOwner) body.push(note(`${withoutOwner} ${withoutOwner === 1 ? 'tarea no tiene' : 'tareas no tienen'} responsable asignado.`));
  } else {
    body.push(para('Aún no hay tareas con responsable.'));
  }

  // 6. Seguimiento
  const overdue = tasks.filter((t) => isOverdue(t, today));
  const next = upcomingTasks(tasks, today)
    .filter((t) => !isOverdue(t, today))
    .slice(0, 8);
  body.push(
    heading('6. Seguimiento'),
    para(
      `Al ${formatDate(today)} el plan lleva un avance del ${formatPercent(summary.progress, 0)}, ponderado por la duración de las tareas: ` +
        `${summary.done} ${summary.done === 1 ? 'implementada' : 'implementadas'}, ${summary.running} en ejecución y ${summary.pending} ${summary.pending === 1 ? 'pendiente' : 'pendientes'}.`,
    ),
  );
  if (overdue.length) {
    body.push(
      heading('Tareas atrasadas', 2),
      ...overdue.map((t) => bullet([text(`${taskLabel(t)}: `, { bold: true }), text(`debía terminar el ${formatDate(t.end)}; avance del ${t.progress} %${t.responsible ? ` · ${t.responsible}` : ''}.`)])),
    );
  }
  if (next.length) {
    body.push(
      heading('Próximas tareas', 2),
      ...next.map((t) =>
        bullet([
          text(`${taskLabel(t)}: `, { bold: true }),
          text(`${t.status === 'en-ejecucion' ? `en ejecución, avance del ${t.progress} %` : `empieza el ${formatDate(t.start)}`}${t.responsible ? ` · ${t.responsible}` : ''}.`),
        ]),
      ),
    );
  }
  body.push(
    para('El avance se actualiza en PONTIA con la evidencia fotográfica de cada tarea; los ahorros se verifican con el protocolo IPMVP frente a la línea base del PGEE.'),
  );

  return new Document({
    creator: 'PONTIA',
    title: `Plan de implementación · ${project.name}`,
    description: 'Plan de implementación del plan de gestión eficiente de la energía',
    features: { updateFields: true },
    styles: DOC_STYLES,
    numbering: NUMBERING,
    sections: [
      {
        properties: {
          titlePage: true,
          page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin } },
        },
        headers: { default: pageHeader(project.name, 'Plan de implementación'), first: blankHeader() },
        footers: { default: pageFooter(), first: blankFooter() },
        children: body,
      },
    ],
  });
}
