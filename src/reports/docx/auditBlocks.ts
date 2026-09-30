import type { FileChild, Table } from 'docx';
import { ART4_STATUS_LABEL, art4Counts, type Art4Row, type Art4Status, type ReportPart } from '@/domain/art4';
import { annualEnergyKwh } from '@/domain/calc/equipment';
import { sum } from '@/domain/calc/stats';
import { carrierInfo } from '@/domain/carriers';
import { CONDITIONS, regimeOf } from '@/domain/catalogs';
import type { Equipment } from '@/domain/types';
import { periodLabel } from '@/utils/dates';
import { formatNumber, formatPercent } from '@/utils/format';
import { characterizationNotes } from '../characterization';
import { activityRows, dataLimits, followProposal, labIndicatorRows, labInventory, labRows, regimeSummary } from '../auditParts';
import type { AuditModel } from '../model';
import { bullet, COLOR, dataTable, heading, kpiGrid, note, para, text, type Cell } from './theme';
import type { SectionTools } from './upmeBaselineSection';

/**
 * Bloques del informe de auditoría que salen de los datos de la sede y de los laboratorios: el alcance y las limitaciones, las tarjetas de
 * seguridad y la verificación del art. 4 del resumen, las tablas por laboratorio, los regímenes de uso, el seguimiento propuesto y los
 * anexos. La numeración de las secciones la lleva `audit.ts`; aquí solo se dibuja.
 */

const num = (value: number | null | undefined, decimals = 0) => (value === null || value === undefined || !Number.isFinite(value) ? '—' : formatNumber(value, decimals));
const list = (items: readonly string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : (items[0] ?? ''));
const spacer = () => para('', { spacing: { after: 60 } });

const STATUS_COLOR: Record<Art4Status, string> = { cumple: COLOR.good, parcial: COLOR.warning, pendiente: COLOR.serious };
const statusCell = (status: Art4Status): Cell => ({ text: ART4_STATUS_LABEL[status], bold: true, color: STATUS_COLOR[status] });

// ——— Sección 1: resumen ejecutivo ———

/** Seguridad eléctrica en tarjetas aparte de los hallazgos de ahorro: solo cuenta lo que pide atención. Vacío si no hay nada registrado. */
export function safetyCards(m: AuditModel): FileChild[] {
  const { summary, suggestions } = m.safety;
  if (!summary.total && !suggestions.length) return [];
  const unevaluated = summary.unevaluated + suggestions.length;
  return [
    heading('Seguridad eléctrica y SST', 2),
    kpiGrid([
      { label: 'Hallazgos abiertos', value: String(summary.open), note: summary.total ? `de ${summary.total} registrados` : undefined },
      { label: 'Atención inmediata', value: String(summary.attention), note: 'peligro inminente, alto riesgo o nivel alto' },
      { label: 'Por valorar', value: String(unevaluated), note: 'con la matriz de riesgos del RETIE' },
    ]),
    spacer(),
    para(
      summary.attention
        ? `${summary.attention} ${summary.attention === 1 ? 'hallazgo de seguridad eléctrica pide' : 'hallazgos de seguridad eléctrica piden'} atención inmediata (peligro inminente, alto riesgo o nivel alto en la matriz del RETIE). Se tratan en su propio capítulo, sin importar el ahorro.`
        : summary.total
          ? `Se registraron ${summary.total} ${summary.total === 1 ? 'hallazgo' : 'hallazgos'} de seguridad eléctrica, ninguno con alto riesgo o peligro inminente abierto. Se tratan en su propio capítulo.`
          : 'No hay hallazgos de seguridad eléctrica registrados.',
    ),
    ...(suggestions.length ? [para(`${suggestions.length} ${suggestions.length === 1 ? 'situación' : 'situaciones'} de los datos (carga, desbalance o equipos deficientes) está${suggestions.length === 1 ? '' : 'n'} por valorar con la matriz del RETIE.`)] : []),
  ];
}

/** Cumplimiento del artículo 4: cada aspecto con su estado y dónde queda en el informe; el detalle va en el anexo. */
export function art4Summary(rows: readonly Art4Row[], { table, where, annex }: { table: SectionTools['table']; where: (parts: readonly ReportPart[]) => string; annex: string }): FileChild[] {
  const c = art4Counts(rows);
  return [
    heading('Cumplimiento del artículo 4 de la Resolución 40412', 2),
    para(
      `La Resolución MME 40412 de 2024 exige a la auditoría siete aspectos mínimos (artículo 4), dos parágrafos que se aplican a este informe y el artículo 6 sobre el auditor: ${c.total} puntos. ` +
        `Con lo registrado, ${c.cumple} ${c.cumple === 1 ? 'se cumple' : 'se cumplen'}, ${c.parcial} ${c.parcial === 1 ? 'se cumple' : 'se cumplen'} en parte y ${c.pendiente} ${c.pendiente === 1 ? 'está pendiente' : 'están pendientes'}. ` +
        `Lo que falta en cada uno está en el ${annex}.`,
    ),
    ...table(
      'Aspectos mínimos de la auditoría (Resolución 40412 de 2024) y dónde se atienden.',
      dataTable(
        [
          { header: 'Aspecto', width: 0.54 },
          { header: 'Estado', width: 0.14, align: 'center' },
          { header: 'Dónde', width: 0.32 },
        ],
        rows.map((r): Cell[] => [`${r.reference}\n${r.title}`, statusCell(r.status), where(r.parts)]),
      ),
    ),
    note('La resolución enumera los siete aspectos sin letras: aquí se identifican de (a) a (g) en el orden del texto. La verificación se hace con lo registrado en PONTIA y no reemplaza la revisión de la entidad ni de la UPME.'),
  ];
}

// ——— Sección 2: alcance, frontera y limitaciones ———

/** Alcance y frontera de la auditoría, la tenencia y la decisión sobre las FNCER, lo que escribió el auditor y las limitaciones de los datos. */
export function scopeBlocks(m: AuditModel, { annex, opportunities }: { annex: string; opportunities?: string }): FileChild[] {
  const { project } = m.data;
  const notes = characterizationNotes(project);
  const place = [project.site?.name, project.city].filter(Boolean).join(', ');
  const carriers = [...new Set([...(m.data.bills.length ? ['electricidad'] : []), ...m.data.otherBills.map((b) => carrierInfo(b.carrier).label.toLowerCase())])];
  const out: FileChild[] = [
    para(
      `Esta auditoría energética cubre ${project.name}${project.client ? `, de ${project.client}` : ''}${place ? ` (${place})` : ''}${project.areaM2 ? `, con ${formatNumber(project.areaM2)} m² construidos` : ''}. ` +
        `Aplica los aspectos mínimos del artículo 4 de la Resolución MME 40412 de 2024 (su verificación está en el ${annex}) y toma como referente la NTC-ISO 50002; la línea base y el ahorro se determinan con la Resolución UPME 016 de 2024.`,
    ),
  ];
  if (carriers.length) out.push(bullet(`Energéticos incluidos: ${list(carriers)}.`));
  if (m.data.bills.length) out.push(bullet(`Facturación analizada: ${periodLabel(m.data.bills[0].period)} a ${periodLabel(m.data.bills[m.data.bills.length - 1].period)} (${m.data.bills.length} ${m.data.bills.length === 1 ? 'periodo' : 'periodos'}).`));
  if (notes.tenure) out.push(para([text('Tenencia. ', { bold: true }), text(notes.tenure)]));
  for (const block of notes.scope) out.push(heading(block.title, 2), para(block.text));
  out.push(
    heading('Fuentes no convencionales de energía', 2),
    para(
      m.data.project.scope?.fnce === 'excluida'
        ? m.fnce.text
        : `Las fuentes no convencionales de energía renovable se tratan como un potencial de referencia${opportunities ? ` (${opportunities})` : ''}; la auditoría no incluye el diseño de sistemas de generación.`,
    ),
  );
  const limits = dataLimits(m);
  out.push(heading('Limitaciones de los datos', 2), ...(limits.length ? limits.map((l) => bullet(l)) : [para('Con los datos registrados no se identifican limitaciones adicionales.')]));
  return out;
}

// ——— Laboratorios ———

/** Sección 3: los laboratorios y talleres con su equipamiento. Vacío si el proyecto no tiene laboratorios. */
export function labCharacterization(m: AuditModel, { table }: Pick<SectionTools, 'table'>): FileChild[] {
  const labs = labRows(m);
  if (!labs.length) return [];
  return [
    heading('Laboratorios', 2),
    para(`El proyecto tiene ${labs.length} ${labs.length === 1 ? 'laboratorio o taller' : 'laboratorios y talleres'}. Los equipos que funcionan las 24 horas son la carga que no se elimina con horarios.`),
    ...table(
      'Laboratorios evaluados y su equipamiento.',
      dataTable(
        [
          { header: 'Laboratorio', width: 0.24 },
          { header: 'Tipo', width: 0.24 },
          { header: 'Área (m²)', width: 0.1, align: 'right' },
          { header: 'Personas', width: 0.1, align: 'right' },
          { header: 'Equipos', width: 0.1, align: 'right' },
          { header: 'kW', width: 0.1, align: 'right' },
          { header: '24 h', width: 0.12, align: 'right' },
        ],
        labs.map((l): Cell[] => [l.area.name, l.typeLabel, num(l.areaM2, 1), num(l.area.occupants), num(l.units), num(l.installedKw, 1), num(l.continuousUnits)]),
        ['Total', '', num(sum(labs.map((l) => l.areaM2 ?? 0)), 1), '', num(sum(labs.map((l) => l.units))), num(sum(labs.map((l) => l.installedKw)), 1), num(sum(labs.map((l) => l.continuousUnits)))],
      ),
    ),
  ];
}

/** Sección 6: el consumo estimado de cada laboratorio con el censo y, con dos o más, su gráfica. */
export function labBalance(m: AuditModel, { table, fig }: SectionTools): FileChild[] {
  const rows = labIndicatorRows(m);
  if (!rows.length) return [];
  const total = sum(rows.map((r) => r.annualKwh));
  return [
    heading('Consumo por laboratorio', 2),
    para(`El censo de carga asigna ${rows.length === 1 ? 'al laboratorio' : `a los ${rows.length} laboratorios`} ${formatNumber(total)} kWh al año${m.estimatedAnnualKwh ? `, el ${formatPercent(total / m.estimatedAnnualKwh, 1)} del consumo estimado` : ''}.`),
    ...(rows.length > 1 ? fig('consumo-laboratorios') : []),
    ...table(
      'Consumo anual estimado de cada laboratorio.',
      dataTable(
        [
          { header: 'Laboratorio', width: 0.4 },
          { header: 'kWh/año', width: 0.2, align: 'right' },
          { header: 'Parte del censo', width: 0.2, align: 'right' },
          { header: 'kWh/m²·año', width: 0.2, align: 'right' },
        ],
        rows.map((r): Cell[] => [r.name, formatNumber(r.annualKwh), m.estimatedAnnualKwh ? formatPercent(r.annualKwh / m.estimatedAnnualKwh, 1) : '—', num(r.kwhPerM2Year, 1)]),
      ),
    ),
  ];
}

/** Sección 7: indicadores de desempeño por laboratorio (Res. UPME 016, §7.3); las columnas de uso salen si hay horarios registrados. */
export function labIndicators(m: AuditModel, { table }: Pick<SectionTools, 'table'>): FileChild[] {
  const rows = labIndicatorRows(m);
  if (!rows.length) return [];
  const withUse = rows.some((r) => r.weeklyHours !== null);
  const columns = withUse
    ? [
        { header: 'Laboratorio', width: 0.28 },
        { header: 'kWh/m²·año', width: 0.14, align: 'right' as const },
        { header: 'Horas/semana', width: 0.14, align: 'right' as const },
        { header: 'kWh/hora de uso', width: 0.16, align: 'right' as const },
        { header: 'Personas', width: 0.12, align: 'right' as const },
        { header: 'kWh/persona·h', width: 0.16, align: 'right' as const },
      ]
    : [
        { header: 'Laboratorio', width: 0.5 },
        { header: 'kWh/año', width: 0.25, align: 'right' as const },
        { header: 'kWh/m²·año', width: 0.25, align: 'right' as const },
      ];
  return [
    heading('Indicadores por laboratorio', 2),
    ...table(
      'Indicadores de desempeño energético de cada laboratorio.',
      dataTable(
        columns,
        rows.map((r): Cell[] =>
          withUse ? [r.name, num(r.kwhPerM2Year, 1), num(r.weeklyHours, 1), num(r.kwhPerUseHour, 2), num(r.avgOccupants, 1), num(r.kwhPerPersonHour, 3)] : [r.name, formatNumber(r.annualKwh), num(r.kwhPerM2Year, 1)],
        ),
      ),
    ),
    ...(withUse ? [] : [note('Con los horarios de uso de los laboratorios (Formato 6) se calculan también los kWh por hora de uso y por persona.')]),
  ];
}

/** Indicadores de actividad de la facturación (por persona atendida y por hora de práctica), como filas de la tabla de IDEn. */
export function activityIndicatorRows(m: AuditModel): Cell[][] {
  const a = activityRows(m);
  return [
    ...(a.kwhPerPerson !== null ? ([['Consumo por persona atendida', num(a.kwhPerPerson, 1), 'kWh/persona']] as Cell[][]) : []),
    ...(a.kwhPerPracticeHour !== null ? ([['Consumo por hora de práctica', num(a.kwhPerPracticeHour, 1), 'kWh/hora']] as Cell[][]) : []),
  ];
}

/** Sección 7: qué indicadores se siguen, cómo y cada cuánto (art. 4, aspecto f). */
export function followBlock(m: AuditModel, { table }: Pick<SectionTools, 'table'>): FileChild[] {
  const rows = followProposal(m);
  const manager = m.data.pgee?.energyManager?.name?.trim();
  return [
    heading('Propuesta de evaluación y seguimiento', 2),
    para(
      manager
        ? `El gestor energético del PGEE, ${manager}, hace el seguimiento de los indicadores. Se propone evaluar:`
        : 'El seguimiento de los indicadores lo hace el gestor energético que la entidad designe en el PGEE: la designación está pendiente. Se propone evaluar:',
    ),
    ...table(
      'Indicadores propuestos para el seguimiento.',
      dataTable(
        [
          { header: 'Indicador', width: 0.3 },
          { header: 'Cómo se calcula', width: 0.54 },
          { header: 'Frecuencia', width: 0.16 },
        ],
        rows.map((r): Cell[] => [r.indicator, r.how, r.frequency]),
      ),
    ),
  ];
}

// ——— Sección 8: regímenes de uso ———

/** El censo eléctrico por régimen de uso: cuánto funciona las 24 horas y qué no se puede apagar. Vacío sin equipos. */
export function regimeBlock(m: AuditModel, { table, title }: Pick<SectionTools, 'table'> & { title: string }): FileChild[] {
  const summary = regimeSummary(m.data.equipment);
  if (!summary.rows.length) return [];
  const continuous = summary.rows.find((r) => r.regime === 'continuo');
  return [
    heading(title, 2),
    para(
      continuous
        ? `${formatNumber(continuous.units)} ${continuous.units === 1 ? 'equipo funciona' : 'equipos funcionan'} las 24 horas, con ${formatNumber(continuous.kw, 1)} kW instalados: ${formatPercent(continuous.share, 1)} del consumo estimado. Es la carga base que no se elimina con horarios${summary.nonInterruptibleUnits ? `; ${formatNumber(summary.nonInterruptibleUnits)} ${summary.nonInterruptibleUnits === 1 ? 'unidad no puede apagarse' : 'unidades no pueden apagarse'} y se excluyen de las medidas de apagado` : ''}.`
        : `Ningún equipo del censo está marcado como continuo (24 horas).${summary.nonInterruptibleUnits ? ` ${formatNumber(summary.nonInterruptibleUnits)} ${summary.nonInterruptibleUnits === 1 ? 'unidad no puede apagarse' : 'unidades no pueden apagarse'} y se excluyen de las medidas de apagado.` : ''}`,
    ),
    ...table(
      'Equipos eléctricos según su régimen de uso.',
      dataTable(
        [
          { header: 'Régimen', width: 0.3 },
          { header: 'Equipos', width: 0.16, align: 'right' },
          { header: 'kW instalados', width: 0.18, align: 'right' },
          { header: 'kWh/año', width: 0.18, align: 'right' },
          { header: 'Parte', width: 0.18, align: 'right' },
        ],
        summary.rows.map((r): Cell[] => [r.label, formatNumber(r.units), formatNumber(r.kw, 1), formatNumber(r.kwh), formatPercent(r.share, 1)]),
        ['Total', formatNumber(sum(summary.rows.map((r) => r.units))), formatNumber(sum(summary.rows.map((r) => r.kw)), 1), formatNumber(summary.totalKwh), '100 %'],
      ),
    ),
  ];
}

// ——— Anexos ———

/** Anexo: el inventario de cada laboratorio (eléctrico y de otros energéticos), equipo por equipo. Vacío si no hay laboratorios con equipos. */
export function labInventoryAnnex(m: AuditModel, { table, title }: Pick<SectionTools, 'table'> & { title: string }): FileChild[] {
  const labs = labInventory(m);
  if (!labs.length) return [];
  const condition = (e: Equipment) => CONDITIONS.find((c) => c.id === e.condition)?.label ?? '—';
  const out: FileChild[] = [heading(title), para('Equipos de cada laboratorio con su cantidad, potencia, horario y régimen de uso. La energía anual de los equipos de otros energéticos se da en kWh térmicos.')];
  for (const lab of labs) {
    const kwh = (e: Equipment) => annualEnergyKwh(e, e.operatingDaysPerMonth);
    out.push(
      heading(lab.area.name, 2),
      ...table(
        `Inventario de ${lab.area.name}.`,
        dataTable(
          [
            { header: 'Equipo', width: 0.29 },
            { header: 'Cant.', width: 0.07, align: 'right' },
            { header: 'kW', width: 0.08, align: 'right' },
            { header: 'V / A', width: 0.1, align: 'right' },
            { header: 'h/día', width: 0.08, align: 'right' },
            { header: 'Régimen', width: 0.14 },
            { header: 'kWh/año', width: 0.12, align: 'right' },
            { header: 'Estado', width: 0.12 },
          ],
          lab.all.map((e): Cell[] => [
            [e.name, [e.brand, e.model].filter(Boolean).join(' '), e.carrier && e.carrier !== 'electricidad' ? carrierInfo(e.carrier).label : ''].filter(Boolean).join('\n'),
            formatNumber(e.quantity),
            formatNumber(e.powerKw, 2),
            e.voltageV || e.currentA ? `${num(e.voltageV)} / ${num(e.currentA, 1)}` : '—',
            formatNumber(e.hoursPerDay, 1),
            regimeOf(e.regime).label,
            formatNumber(kwh(e)),
            condition(e),
          ]),
          ['Total', formatNumber(sum(lab.all.map((e) => e.quantity))), '', '', '', '', formatNumber(sum(lab.all.map(kwh))), ''],
        ),
      ),
    );
  }
  return out;
}

/** Anexo: la verificación del artículo 4 con lo registrado y lo que falta en cada punto. */
export function art4Annex(rows: readonly Art4Row[], { table, title }: { table: (caption: string, t: Table) => FileChild[]; title: string }): FileChild[] {
  return [
    heading(title),
    para('Verificación de los puntos que la Resolución MME 40412 de 2024 exige a la auditoría (artículo 4, sus parágrafos y el artículo 6) con lo que está registrado en PONTIA.'),
    ...table(
      'Verificación de los aspectos mínimos de la auditoría.',
      dataTable(
        [
          { header: 'Aspecto', width: 0.3 },
          { header: 'Estado', width: 0.12, align: 'center' },
          { header: 'Registrado', width: 0.26 },
          { header: 'Falta', width: 0.32 },
        ],
        rows.map((r): Cell[] => [`${r.reference}\n${r.title}`, statusCell(r.status), r.evidence, r.missing.length ? r.missing.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join('.\n') : '—']),
      ),
    ),
    note('Estado según lo registrado: «Cumple» cuando el dato o el cálculo existe; no certifica la calidad de la información. La entidad verifica la idoneidad del auditor (artículo 6, parágrafo 2).'),
  ];
}
