import { BorderStyle, Document, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, WidthType, type FileChild } from 'docx';
import { BASELINE_VARIABLES } from '@/domain/analysis';
import { art4Counts, verifyArt4, type ReportPart } from '@/domain/art4';
import { hasAuditorData } from '@/domain/auditor';
import { sum } from '@/domain/calc/stats';
import { carrierInfo, summarizeCarriers, totalEnergy, unitLabel } from '@/domain/carriers';
import { endUseOf, spaceTypeOf } from '@/domain/catalogs';
import { FINDING_STATUS_LABEL, findingTopicLabel, ruleIdOf, SEVERITY_LABEL } from '@/domain/diagnosis';
import { derivePower } from '@/domain/measurements';
import type { EndUseCategory, Finding, Photo, Severity } from '@/domain/types';
import { formatDate, formatDateTime, periodLabel, periodLabelLong } from '@/utils/dates';
import { formatCop, formatMillionsCop, formatNumber, formatPercent } from '@/utils/format';
import { characterizationFacts, characterizationNotes } from '../characterization';
import { art4Input, labInventory, regimeSummary } from '../auditParts';
import type { ReportFigure } from '../figures';
import { billedDailyKwh, measuredWeekdayKwh, type AuditModel, type AutoFinding, type FindingTone } from '../model';
import { reportRoute } from '../route';
import { activityIndicatorRows, art4Annex, art4Summary, followBlock, labBalance, labCharacterization, labIndicators, labInventoryAnnex, regimeBlock, safetyCards, scopeBlocks } from './auditBlocks';
import { auditorSection } from './auditorSection';
import { opportunitiesSection } from './opportunitiesSection';
import { safetySection } from './safetySection';
import { upmeBaselineSection } from './upmeBaselineSection';
import {
  blankFooter,
  blankHeader,
  bullet,
  COLOR,
  CONTENT_TWIPS,
  dataTable,
  DOC_STYLES,
  figure,
  FONT,
  heading,
  kpiGrid,
  note,
  NUMBERING,
  ownershipBlock,
  PAGE,
  pageBreak,
  pageFooter,
  pageHeader,
  para,
  photo,
  tableCaption,
  text,
  type Cell,
} from './theme';

/** Imágenes ya dibujadas: PNG de cada figura (por su id) y fotos JPEG del anexo. */
export interface AuditAssets {
  figures: Map<string, { data: Uint8Array; width: number; height: number }>;
  photos: { photo: Photo; data: Uint8Array; width: number; height: number; type?: 'jpg' | 'png'; caption: string }[];
}

export interface AuditOptions {
  /** Fotos del anexo: grandes (dos por página) o pequeñas (tres por página). */
  photoSize?: 'grande' | 'pequena';
}

const TONE: Record<FindingTone, { label: string; color: string }> = {
  critical: { label: 'Crítico', color: COLOR.critical },
  serious: { label: 'Importante', color: COLOR.serious },
  warning: { label: 'A vigilar', color: COLOR.warning },
  info: { label: 'Información', color: COLOR.info },
  good: { label: 'Favorable', color: COLOR.good },
};
const SEVERITY_COLOR: Record<Severity, string> = { critico: COLOR.critical, alto: COLOR.serious, medio: COLOR.warning, bajo: COLOR.info };
const SEVERITY_COUNT: Record<Severity, [string, string]> = { critico: ['crítico', 'críticos'], alto: ['alto', 'altos'], medio: ['medio', 'medios'], bajo: ['bajo', 'bajos'] };

const useLabel = (category: string) => endUseOf(category as EndUseCategory).label;
const signed = (fraction: number) => `${fraction < 0 ? '−' : '+'}${formatPercent(Math.abs(fraction), 1)}`;
const orDash = (value: number | null | undefined, decimals = 0) => (value === null || value === undefined || !Number.isFinite(value) ? '—' : formatNumber(value, decimals));
const years = (value: number) => (Number.isFinite(value) ? `${formatNumber(value, 1)} años` : '—');
const list = (items: readonly string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : (items[0] ?? ''));

/** Secciones del informe, en el orden de los aspectos del art. 4 de la Res. 40412 y de la ISO 50002. Las que no tienen datos no se abren. */
type SectionKey = 'resumen' | 'alcance' | 'caracterizacion' | 'metodologia' | 'energia' | 'balance' | 'linea-base' | 'sistemas' | 'mediciones' | 'diagnostico' | 'seguridad' | 'oportunidades' | 'conclusiones';
const SECTION_ORDER: readonly SectionKey[] = ['resumen', 'alcance', 'caracterizacion', 'metodologia', 'energia', 'balance', 'linea-base', 'sistemas', 'mediciones', 'diagnostico', 'seguridad', 'oportunidades', 'conclusiones'];
type AnnexKey = 'anexo-auditor' | 'anexo-labs' | 'anexo-art4';

/**
 * Informe de auditoría energética con la estructura de la ISO 50002 y los aspectos mínimos del art. 4 de la Res. 40412: resumen ejecutivo
 * con la verificación del artículo, alcance y limitaciones, caracterización, metodología, uso de la energía, usos significativos, línea
 * base e indicadores, sistemas y equipos, mediciones, diagnóstico, seguridad eléctrica, oportunidades y conclusiones, más los anexos.
 * Las secciones, los anexos, las figuras, las tablas y las fotos se numeran solos.
 */
export function buildAuditDocument(m: AuditModel, figures: readonly ReportFigure[], assets: AuditAssets, options: AuditOptions = {}): Document {
  const { project } = m.data;
  const byId = new Map(figures.map((f) => [f.id, f]));
  let figureNumber = 0;
  let tableNumber = 0;
  let photoNumber = 0;

  const fig = (id: string): FileChild[] => {
    const spec = byId.get(id);
    const image = assets.figures.get(id);
    if (!spec || !image) return [];
    figureNumber += 1;
    return figure(image.data, image, figureNumber, spec.title, spec.source);
  };
  const table = (caption: string, t: Table): FileChild[] => {
    tableNumber += 1;
    return [tableCaption(tableNumber, caption), t, new Paragraph({ spacing: { after: 120 }, children: [] })];
  };
  const numberedPhoto = (p: AuditAssets['photos'][number], width: number): FileChild[] => {
    photoNumber += 1;
    return photo(p.data, p, width, `Foto ${photoNumber}. ${p.caption}`);
  };

  // Numeración de las secciones: solo se numeran las que se abren, así no quedan saltos
  const safetyShown = Boolean(m.data.safetyFindings.length || m.safety.suggestions.length || project.safetyReviewed);
  const present: Record<SectionKey, boolean> = {
    resumen: true,
    alcance: true,
    caracterizacion: true,
    metodologia: true,
    energia: true,
    balance: true,
    'linea-base': true,
    sistemas: true,
    mediciones: m.data.measurements.length > 0,
    diagnostico: m.data.findings.length > 0,
    seguridad: safetyShown,
    oportunidades: Boolean(m.data.measures.length || project.scope),
    conclusiones: true,
  };
  const sectionNo = new Map<SectionKey, number>();
  SECTION_ORDER.filter((key) => present[key]).forEach((key, index) => sectionNo.set(key, index + 1));
  const section = (key: SectionKey, title: string) => heading(`${sectionNo.get(key)}. ${title}`);
  const subCount = new Map<SectionKey, number>();
  /** Título numerado de un apartado de la sección: «5.2 Consumo mensual». */
  const sub = (key: SectionKey, title: string): string => {
    const n = (subCount.get(key) ?? 0) + 1;
    subCount.set(key, n);
    return `${sectionNo.get(key)}.${n} ${title}`;
  };

  // Anexos: A, B, C… solo los que se abren (el fotográfico va al final, cuando se sabe si hace falta)
  const annexKeys = (['anexo-auditor', 'anexo-labs', 'anexo-art4'] as const).filter((key) => (key === 'anexo-auditor' ? hasAuditorData(m.data.auditor) : key === 'anexo-labs' ? labInventory(m).length > 0 : true));
  const annexLetter = new Map<AnnexKey, string>(annexKeys.map((key, index) => [key, String.fromCharCode(65 + index)]));
  const annexTitle = (key: AnnexKey, title: string) => `Anexo ${annexLetter.get(key)}. ${title}`;
  const annexRef = (key: AnnexKey) => `Anexo ${annexLetter.get(key)}`;

  // Verificación del art. 4: cada punto dice en qué sección se atiende
  const route = reportRoute(m, { pgee: m.data.pgee, measures: m.data.measures, tasks: m.data.tasks });
  const art4Rows = verifyArt4(art4Input(m, route));
  const where = (parts: readonly ReportPart[]): string => {
    const numbers = parts.filter((p): p is Exclude<ReportPart, 'pgee' | 'anexo-auditor'> => p !== 'pgee' && p !== 'anexo-auditor').map((p) => sectionNo.get(p)).filter((n): n is number => n !== undefined);
    const others = parts.flatMap((p) => (p === 'pgee' ? ['PGEE (documento aparte)'] : p === 'anexo-auditor' ? [annexLetter.has('anexo-auditor') ? annexRef('anexo-auditor') : 'Perfil del auditor (Ajustes)'] : []));
    return [...(numbers.length ? [`${numbers.length === 1 ? 'Sección' : 'Secciones'} ${list(numbers.map(String))}`] : []), ...others].join(' · ') || '—';
  };

  const body: FileChild[] = [
    ...cover(m),
    pageBreak(),
    para([text('Contenido', { font: FONT.heading, size: 36, color: COLOR.navy })], { spacing: { after: 200 } }),
    new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-2' }),
    note('Si el índice aparece vacío, en Word haz clic derecho sobre él y elige «Actualizar campos».'),
    pageBreak(),
  ];

  // 1. Resumen ejecutivo: primero los hallazgos del diagnóstico; después, lo grave que las reglas encontraron y aún no se adoptó
  const recorded = m.data.findings.filter((f) => f.status !== 'cerrado' && (f.severity === 'critico' || f.severity === 'alto'));
  const adopted = new Set(m.data.findings.map((f) => f.ruleId).filter(Boolean));
  const automatic = m.findings.filter(
    (f) => f.tone !== 'good' && f.tone !== 'info' && f.topic !== 'seguridad' && (!recorded.length || f.tone === 'critical' || f.tone === 'serious') && !adopted.has(ruleIdOf(f.title)),
  );
  const main = [...recorded.map(recordedFindingBullet), ...automatic.map(findingBullet)].slice(0, 6);
  const plan = m.data.measures.filter((x) => x.selected);
  const planTotals = {
    kwh: sum(plan.map((x) => x.savingsKwhYear)),
    cop: sum(plan.map((x) => x.savingsCopYear)),
    investment: sum(plan.map((x) => x.investmentCop)),
    net: sum(plan.map((x) => x.savingsCopYear - x.annualCostCop)),
  };
  const planShare = m.referenceKwh && planTotals.kwh ? ` (${formatPercent(planTotals.kwh / m.referenceKwh, 1)} del consumo anual)` : '';
  body.push(
    section('resumen', 'Resumen ejecutivo'),
    para(
      `Este informe presenta la auditoría energética de ${project.name}${project.client ? `, de ${project.client}` : ''}${project.city ? ` (${project.city})` : ''}. ` +
        'Resume la caracterización de la entidad, el uso de la energía y la línea base, los sistemas y equipos, el diagnóstico, la seguridad eléctrica y el potencial de ahorro con su priorización, y verifica los aspectos mínimos que exige la Resolución MME 40412 de 2024.',
    ),
    kpiGrid(m.kpis),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    heading('Hallazgos principales', 2),
    ...(main.length ? main : [para('No se encontraron hallazgos críticos con los datos registrados.')]),
    // La seguridad eléctrica va aparte de los hallazgos energéticos: solo se avisa aquí de lo que pide atención
    ...safetyCards(m),
  );
  if (plan.length) {
    body.push(
      heading('Oportunidades de ahorro', 2),
      para(
        `Las ${plan.length === 1 ? 'medida incluida' : `${plan.length} medidas incluidas`} en el plan ahorran ${formatNumber(planTotals.kwh)} kWh al año${planShare} y ${formatCop(planTotals.cop)} por año, ` +
          `con una inversión de ${formatCop(planTotals.investment)}${planTotals.net > 0 ? ` que se recupera en ${years(planTotals.investment / planTotals.net)}` : ''}.`,
      ),
    );
  }
  body.push(...art4Summary(art4Rows, { table, where, annex: annexRef('anexo-art4') }));

  // 2. Alcance, frontera y limitaciones (Res. 40412, art. 4, par. 1; NTC-ISO 50002)
  body.push(
    section('alcance', 'Alcance, frontera y limitaciones'),
    ...scopeBlocks(m, { annex: annexRef('anexo-art4'), opportunities: sectionNo.has('oportunidades') ? `sección ${sectionNo.get('oportunidades')}` : undefined }),
  );

  // 3. Caracterización de la entidad y del edificio: lo que exige el art. 4, primer aspecto, de la Res. 40412
  const facts: Cell[][] = characterizationFacts(project, new Date(m.data.generatedAt).getFullYear());
  const notes = characterizationNotes(project);
  body.push(
    section('caracterizacion', 'Caracterización de la entidad y del edificio'),
    ...table('Datos generales de la instalación.', dataTable([{ header: 'Dato', width: 0.35 }, { header: 'Valor', width: 0.65 }], facts)),
  );
  if (notes.missing.length) {
    body.push(note(`Borrador: la caracterización de la entidad (art. 4, aspecto (a), de la Resolución 40412 de 2024) está incompleta. Faltan: ${notes.missing.join(', ')}.`));
  }
  if (m.data.areas.length) {
    body.push(
      heading('Espacios evaluados', 2),
      ...table(
        'Espacios registrados en el levantamiento.',
        dataTable(
          [
            { header: 'Espacio', width: 0.36 },
            { header: 'Tipo', width: 0.24 },
            { header: 'Área (m²)', width: 0.14, align: 'right' },
            { header: 'Altura (m)', width: 0.13, align: 'right' },
            { header: 'Personas', width: 0.13, align: 'right' },
          ],
          m.data.areas.map((a) => [
            a.name,
            spaceTypeOf(a.spaceType)?.label ?? '—',
            orDash(a.lengthM && a.widthM ? a.lengthM * a.widthM : a.areaM2, 1),
            orDash(a.heightM, 2),
            orDash(a.occupants),
          ]),
        ),
      ),
    );
  }
  body.push(...labCharacterization(m, { table }));

  // 4. Metodología
  body.push(
    section('metodologia', 'Metodología'),
    para('La auditoría sigue la estructura de la norma ISO 50002 y usa la información recogida en campo:'),
    bullet(`Facturas del operador de red (${m.data.bills.length} ${m.data.bills.length === 1 ? 'periodo' : 'periodos'}) para el comportamiento mensual, anual y la línea base.`),
    ...(m.data.otherBills.length
      ? [bullet(`Facturas de ${list([...new Set(m.data.otherBills.map((b) => carrierInfo(b.carrier).label.toLowerCase()))])} (${m.data.otherBills.length}) para el balance de todos los energéticos, en kWh equivalentes.`)]
      : []),
    bullet(`Censo de carga con ${formatNumber(m.data.equipment.reduce((t, e) => t + e.quantity, 0))} equipos, su potencia, horario, régimen de uso y factor de uso.`),
    ...(m.data.mainSeries ? [bullet(`Registro de ${m.data.mainSeries.series.name} cada ${m.data.mainSeries.series.intervalMinutes} minutos para la curva de carga diaria.`)] : []),
    ...(m.data.measurements.length ? [bullet(`${m.data.measurements.length} mediciones puntuales de tensión, corriente y potencia.`)] : []),
    bullet(
      m.upme
        ? 'Línea base de consumo energético con el método de la Res. UPME 016 de 2024 (promedio del mismo mes, banda de ±10 % o de dos desviaciones estándar con diez o más datos del mes, y mejor desempeño); la regresión de la ISO 50006 con los criterios de ASHRAE Guideline 14 queda como complemento. Los ahorros se verificarán con el protocolo IPMVP.'
        : 'Línea base por regresión con variables relevantes (ISO 50006) y criterios de ASHRAE Guideline 14; los ahorros se verificarán con el protocolo IPMVP.',
    ),
    bullet('Carga térmica simplificada y método de los lúmenes para verificar la climatización y la iluminación de cada espacio.'),
    ...(m.data.measures.length ? [bullet('Evaluación económica de cada medida de ahorro: retorno simple, valor presente neto y tasa interna de retorno.')] : []),
    para('Referentes normativos:', { spacing: { before: 120, after: 60 } }),
    bullet(`Resolución MME 40412 de 2024: aspectos mínimos de la auditoría (artículo 4) y del auditor (artículo 6); su verificación está en el ${annexRef('anexo-art4')}.`),
    bullet('NTC-ISO 50002 como referente de la auditoría (artículo 4, parágrafo 1).'),
    bullet('Resolución UPME 016 de 2024: línea base de consumo y ahorro estimado (artículo 4, parágrafo 2).'),
    note('Las iluminancias de aulas y laboratorios y el VEEI de aulas, laboratorios y oficinas salen del RETILAP (Resolución 40286 de 2026); la seguridad eléctrica se valora con el RETIE (Resolución 40284 de 2026). Los demás parámetros de referencia (carga de envolvente, otros tipos de espacio y umbrales) son orientativos y se validan con el RETILAP, el RETIE y el criterio del auditor.'),
  );

  // 5. Uso de la energía: históricos por energético y comportamiento
  body.push(section('energia', 'Uso de la energía: históricos y comportamiento'));
  // Otros energéticos: se suman a la electricidad solo en kWh equivalentes; todo lo demás del informe es eléctrico
  if (m.data.otherBills.length) {
    const carriers = summarizeCarriers([...m.data.bills, ...m.data.otherBills]);
    const total = totalEnergy(carriers);
    const others = carriers.filter((c) => c.carrier !== 'electricidad');
    body.push(
      heading(sub('energia', 'Energéticos utilizados'), 2),
      para(
        `Además de la electricidad, la instalación usa ${list(others.map((c) => c.info.label.toLowerCase()))}. Los energéticos se suman solo en kWh equivalentes, con el factor de conversión de cada factura; el balance por uso final, los indicadores y la línea base de este informe son eléctricos.`,
      ),
      ...table(
        'Energía de los últimos 12 periodos por energético.',
        dataTable(
          [
            { header: 'Energético', width: 0.24 },
            { header: 'Facturado', width: 0.2, align: 'right' },
            { header: 'kWh equivalentes', width: 0.18, align: 'right' },
            { header: 'Parte', width: 0.12, align: 'right' },
            { header: 'Costo (COP)', width: 0.14, align: 'right' },
            { header: 'COP/kWh', width: 0.12, align: 'right' },
          ],
          [
            ...carriers.map((c): Cell[] => [
              c.info.label,
              `${formatNumber(c.quantity)} ${unitLabel(c.unit)}`,
              formatNumber(c.kwh),
              formatPercent(c.share, 1),
              formatCop(c.costCop),
              c.copPerKwh === null ? '—' : formatNumber(c.copPerKwh, 1),
            ]),
            [
              { text: 'Total', bold: true },
              '',
              { text: formatNumber(total.kwh), bold: true },
              total.kwh > 0 ? '100 %' : '—',
              { text: formatCop(total.costCop), bold: true },
              total.kwh > 0 && total.missingFactor === 0 ? formatNumber(total.costCop / total.kwh, 1) : '—',
            ],
          ],
        ),
      ),
    );
    if (total.missingFactor) {
      body.push(note(`${total.missingFactor} ${total.missingFactor === 1 ? 'factura no tiene' : 'facturas no tienen'} factor de conversión y no se incluye en los kWh: el total está incompleto.`));
    }
  }
  if (m.months.length) {
    const last12 = m.months.slice(-12);
    body.push(
      heading(sub('energia', 'Consumo mensual de electricidad'), 2),
      para(
        m.annual.last12Kwh !== null
          ? `En los últimos 12 meses la instalación consumió ${formatNumber(m.annual.last12Kwh)} kWh${m.annual.last12CostCop !== null ? ` con un costo de ${formatMillionsCop(m.annual.last12CostCop)} de pesos` : ''}${m.annual.change !== null ? `, ${signed(m.annual.change)} frente a los 12 meses anteriores` : ''}.`
          : `Con ${m.annual.months} ${m.annual.months === 1 ? 'factura' : 'facturas'} el consumo anual se estima en ${orDash(m.annual.annualizedKwh)} kWh.`,
      ),
      ...fig('consumo-mensual'),
      ...table(
        'Consumo facturado de los últimos 12 meses.',
        dataTable(
          [
            { header: 'Periodo', width: 0.22 },
            { header: 'Energía (kWh)', width: 0.17, align: 'right' },
            { header: 'Días', width: 0.1, align: 'right' },
            { header: 'kWh/día', width: 0.14, align: 'right' },
            { header: 'Costo (COP)', width: 0.2, align: 'right' },
            { header: 'Variación', width: 0.17, align: 'right' },
          ],
          last12.map((r) => [
            capitalize(periodLabelLong(r.period)),
            formatNumber(r.kwh),
            orDash(r.days),
            orDash(r.kwhPerDay),
            formatCop(r.costCop),
            r.change === null ? '—' : { text: signed(r.change), color: r.change > 0.05 ? COLOR.serious : r.change < -0.05 ? COLOR.good : undefined },
          ]),
          ['Total', formatNumber(last12.reduce((t, r) => t + r.kwh, 0)), '', '', formatCop(last12.reduce((t, r) => t + r.costCop, 0)), ''],
        ),
      ),
    );
    if (m.annual.rolling.length >= 2) body.push(heading(sub('energia', 'Tendencia anual'), 2), ...fig('tendencia-anual'));
  } else {
    body.push(para('No hay facturas registradas: el comportamiento mensual y anual queda pendiente.'));
  }
  body.push(heading(sub('energia', 'Curva de carga diaria'), 2), ...fig('curva-de-carga'));
  if (m.daily) {
    const d = m.daily;
    const weekday = measuredWeekdayKwh(d);
    const billed = billedDailyKwh(m.data.bills);
    body.push(
      bullet(`Demanda máxima de ${formatNumber(d.peak?.kw ?? 0, 1)} kW${d.peak ? ` el ${formatDateTime(isoLocal(d.peak.start))}` : ''}; carga base de ${formatNumber(d.baseLoadKw, 1)} kW.`),
      bullet(`Factor de carga del ${formatPercent(d.loadFactor, 0)} y energía diaria promedio de ${formatNumber(d.averageDailyKwh)} kWh.`),
      ...(weekday && billed ? [bullet(`Un día laborable medido consume ${formatNumber(weekday)} kWh; el promedio facturado es de ${formatNumber(billed)} kWh por día.`)] : []),
      ...fig('mapa-de-calor'),
    );
  }

  // 6. Usos significativos y balance energético
  body.push(section('balance', 'Usos significativos y balance energético'));
  if (m.shares.length) {
    const last = m.significant[m.significant.length - 1];
    body.push(
      para(
        `El censo de carga estima ${formatNumber(m.estimatedAnnualKwh)} kWh al año. ${list(m.significant.map((s) => useLabel(s.category)))} ${m.significant.length === 1 ? 'concentra' : 'concentran'} el ${formatPercent(last?.cumulativeShare ?? 0, 0)} del consumo: ${m.significant.length === 1 ? 'es el uso significativo' : 'son los usos significativos'} de energía (ISO 50001).`,
      ),
      ...fig('pareto-usos'),
      ...table(
        'Consumo anual estimado por uso final.',
        dataTable(
          [
            { header: 'Uso final', width: 0.34 },
            { header: 'kWh/año', width: 0.2, align: 'right' },
            { header: 'Participación', width: 0.16, align: 'right' },
            { header: 'Acumulado', width: 0.16, align: 'right' },
            { header: 'Significativo', width: 0.14, align: 'center' },
          ],
          m.shares.map((s) => [
            useLabel(s.category),
            formatNumber(s.kwh),
            formatPercent(s.share, 1),
            formatPercent(s.cumulativeShare, 0),
            m.significant.includes(s) ? { text: 'Sí', bold: true, color: COLOR.accent } : 'No',
          ]),
        ),
      ),
      ...fig('flujo-energia'),
    );
    if (m.deviation !== null && Number.isFinite(m.deviation)) {
      body.push(
        para(
          `Conciliación: el censo estima ${formatNumber(m.estimatedAnnualKwh)} kWh/año frente a ${formatNumber(m.billedAnnualKwh ?? 0)} kWh facturados (${signed(m.deviation)}). ` +
            (Math.abs(m.deviation) <= 0.1 ? 'La diferencia está dentro del ±10 %: el inventario representa bien el consumo real.' : 'La diferencia supera el ±10 %: conviene revisar horas de uso, factores de uso y equipos sin registrar.'),
        ),
      );
    }
    body.push(...labBalance(m, { fig, table }));
  } else {
    body.push(para('No hay equipos en el censo de carga: el balance por uso final queda pendiente.'));
  }

  // 7. Línea base (Res. UPME 016) e indicadores de desempeño
  const i = m.indicators;
  body.push(section('linea-base', 'Línea base e indicadores de desempeño'));
  body.push(...upmeBaselineSection(m, { fig, table }));
  if (m.baseline) {
    const b = m.baseline;
    const [b0, ...rest] = b.model.coefficients;
    const labelOf = (id: string) => BASELINE_VARIABLES.find((v) => v.id === id)?.label.toLowerCase() ?? id;
    const equation = `kWh/mes = ${formatNumber(b0)} ${rest.map((c, k) => `${c < 0 ? '−' : '+'} ${formatNumber(Math.abs(c), 1)} × ${labelOf(b.variables[k])}`).join(' ')}`.trim();
    body.push(
      heading(m.upme ? 'Regresión de la línea base (ISO 50006), complemento' : 'Línea base energética', 2),
      para([text('Modelo: ', { bold: true }), text(equation, { font: FONT.mono, size: 19 })]),
      ...fig('linea-base'),
      ...table(
        'Calidad estadística del modelo (ASHRAE Guideline 14, datos mensuales).',
        dataTable(
          [
            { header: 'Criterio', width: 0.34 },
            { header: 'Valor', width: 0.22, align: 'right' },
            { header: 'Referencia', width: 0.24 },
            { header: 'Cumple', width: 0.2, align: 'center' },
          ],
          [
            ['R²', formatNumber(b.model.r2, 2), '≥ 0,75', yesNo(b.quality.r2)],
            ['CV(RMSE)', formatPercent(b.model.cvRmse, 1), '≤ 15 %', yesNo(b.quality.cvRmse)],
            ['NMBE', formatPercent(b.model.nmbe, 2), 'entre −5 % y 5 %', yesNo(b.quality.nmbe)],
            ['Meses del periodo base', String(b.model.observations), '12', yesNo(b.model.observations >= 12)],
          ],
        ),
      ),
    );
  }
  if (!m.upme && !m.baseline) body.push(para('La línea base necesita las facturas de 12 meses: queda pendiente.'));
  body.push(
    heading('Indicadores de desempeño energético', 2),
    ...table(
      'Indicadores de desempeño energético (IDEn), base anual.',
      dataTable(
        [
          { header: 'Indicador', width: 0.5 },
          { header: 'Valor', width: 0.25, align: 'right' },
          { header: 'Unidad', width: 0.25 },
        ],
        [
          ['Consumo por área construida', orDash(i.kwhPerM2Year, 1), 'kWh/m²·año'],
          ['Consumo por usuario', orDash(i.kwhPerUserYear), 'kWh/usuario·año'],
          ['Consumo diario promedio', orDash(i.kwhPerDay), 'kWh/día'],
          ['Costo por área construida', orDash(i.copPerM2Year), 'COP/m²·año'],
          ...activityIndicatorRows(m),
        ],
      ),
    ),
    ...labIndicators(m, { table }),
    ...followBlock(m, { table }),
  );

  // 8. Sistemas y equipos de consumo final
  body.push(section('sistemas', 'Sistemas y equipos de consumo final'));
  const systemsStart = body.length;
  if (m.cooling.length) {
    body.push(
      heading(sub('sistemas', 'Climatización'), 2),
      para(`Carga térmica simplificada de cada espacio (envolvente, personas, ventanas, iluminación y equipos, con ${formatPercent(m.params.safetyFactor, 0)} de seguridad) frente a la capacidad de los aires asignados.`),
      ...fig('climatizacion'),
      ...table(
        'Carga térmica requerida frente a la capacidad instalada.',
        dataTable(
          [
            { header: 'Espacio', width: 0.3 },
            { header: 'Requerida (BTU/h)', width: 0.19, align: 'right' },
            { header: 'Instalada (BTU/h)', width: 0.19, align: 'right' },
            { header: 'Cobertura', width: 0.13, align: 'right' },
            { header: 'Estado', width: 0.19 },
          ],
          m.cooling.map((c) => [
            c.area.name,
            formatNumber(c.requiredBtuH),
            c.installedBtuH ? formatNumber(c.installedBtuH) : '—',
            c.ratio === null ? '—' : formatPercent(c.ratio, 0),
            COOLING_TEXT[c.status],
          ]),
        ),
      ),
    );
  }
  if (m.lighting.length) {
    body.push(
      heading(sub('sistemas', 'Iluminación'), 2),
      para('Iluminancia medida (o calculada con el método de los lúmenes) frente a la requerida para cada tipo de espacio, densidad de potencia y valor de eficiencia energética de la instalación (VEEI).'),
      ...fig('iluminacion'),
      ...table(
        'Verificación de la iluminación por espacio.',
        dataTable(
          [
            { header: 'Espacio', width: 0.27 },
            { header: 'Iluminancia (lx)', width: 0.15, align: 'right' },
            { header: 'Requerida (lx)', width: 0.14, align: 'right' },
            { header: 'Luminarias', width: 0.15, align: 'right' },
            { header: 'W/m²', width: 0.1, align: 'right' },
            { header: 'VEEI', width: 0.19, align: 'right' },
          ],
          m.lighting.map((l) => [
            l.area.name,
            l.lux === null ? '—' : `${formatNumber(l.lux)}${l.basis === 'calculado' ? ' (calc.)' : ''}`,
            formatNumber(l.requiredLux),
            `${formatNumber(l.installed.count)} de ${formatNumber(l.required.count)}`,
            orDash(l.lpd, 1),
            l.veei === null ? '—' : { text: `${formatNumber(l.veei, 2)} / ${formatNumber(l.veeiLimit, 1)}`, color: l.veeiOk === false ? COLOR.serious : undefined },
          ]),
        ),
      ),
    );
  }
  const f = m.capacity.facility;
  if (m.data.electrical.length) {
    body.push(heading(sub('sistemas', 'Capacidad del sistema eléctrico'), 2));
    if (f) {
      body.push(
        para(
          `La demanda máxima registrada es de ${formatNumber(f.kw, 1)} kW (${DEMAND_TEXT[f.basis]}${f.basis === 'factura' ? ` de ${periodLabel(f.source)}` : f.basis === 'instalado' ? '' : `: ${f.source}`}); con un factor de potencia de ${formatNumber(f.pf, 2)} equivale a ${formatNumber(f.kva, 1)} kVA. La carga instalada del censo es de ${formatNumber(f.installedKw, 1)} kW.`,
        ),
      );
    }
    body.push(...fig('unifilar'));
    if (m.capacity.checks.length) {
      body.push(
        ...table(
          'Carga de cada elemento frente a su capacidad nominal.',
          dataTable(
            [
              { header: 'Elemento', width: 0.33 },
              { header: 'Capacidad', width: 0.15, align: 'right' },
              { header: 'Carga', width: 0.15, align: 'right' },
              { header: 'Uso', width: 0.11, align: 'right' },
              { header: 'Estado', width: 0.12 },
              { header: 'Base', width: 0.14 },
            ],
            m.capacity.checks.map((c) => [
              c.node.name,
              `${formatNumber(c.capacity, 1)} ${c.unit}`,
              `${formatNumber(c.load, 1)} ${c.unit}`,
              formatPercent(c.ratio, 0),
              { text: LOADING_TEXT[c.level], color: c.level === 'critica' ? COLOR.critical : c.level === 'alta' ? COLOR.warning : COLOR.good, bold: c.level !== 'normal' },
              BASIS_SHORT[c.basis],
            ]),
          ),
        ),
      );
    }
    if (m.capacity.imbalance.length) {
      body.push(
        ...table(
          'Desbalance de corriente entre fases (medición más reciente de cada punto).',
          dataTable(
            [
              { header: 'Punto', width: 0.34 },
              { header: 'L1 (A)', width: 0.13, align: 'right' },
              { header: 'L2 (A)', width: 0.13, align: 'right' },
              { header: 'L3 (A)', width: 0.13, align: 'right' },
              { header: 'Desbalance', width: 0.14, align: 'right' },
              { header: 'Estado', width: 0.13 },
            ],
            m.capacity.imbalance.map((r) => [
              r.point,
              ...r.currents.map((c) => formatNumber(c, 1)),
              formatPercent(r.imbalance, 1),
              { text: IMBALANCE_TEXT[r.level], color: r.level === 'normal' ? COLOR.good : COLOR.warning },
            ]),
          ),
        ),
      );
    }
  }
  const regimeTitle = regimeSummary(m.data.equipment).rows.length ? sub('sistemas', 'Regímenes de uso y cargas continuas') : '';
  body.push(...regimeBlock(m, { table, title: regimeTitle }));
  if (annexLetter.has('anexo-labs')) body.push(para(`El inventario de cada laboratorio, equipo por equipo, está en el ${annexRef('anexo-labs')}.`));
  if (body.length === systemsStart) body.push(para('No hay espacios ni equipos registrados: el dimensionamiento de los sistemas queda pendiente.'));

  // 9. Mediciones puntuales
  if (present.mediciones) {
    const points = new Map([...m.data.electrical.map((n) => [n.id, n.name] as const), ...m.data.areas.map((a) => [a.id, a.name] as const), ...m.data.equipment.map((e) => [e.id, e.name] as const)]);
    body.push(
      section('mediciones', 'Mediciones puntuales'),
      ...table(
        'Mediciones de campo con el instrumento indicado.',
        dataTable(
          [
            { header: 'Fecha', width: 0.2 },
            { header: 'Punto', width: 0.3 },
            { header: 'Tensión (V)', width: 0.14, align: 'right' },
            { header: 'Corriente (A)', width: 0.14, align: 'right' },
            { header: 'kW', width: 0.1, align: 'right' },
            { header: 'FP', width: 0.12, align: 'right' },
          ],
          m.data.measurements.map((me) => {
            const power = derivePower(me);
            const values = (list?: (number | null)[]) =>
              (list ?? [])
                .filter((v): v is number => typeof v === 'number')
                .map((v) => formatNumber(v, 0))
                .join(' / ') || '—';
            return [formatDate(me.takenAt), me.pointType === 'general' ? 'General' : (points.get(me.pointId ?? '') ?? '—'), values(me.voltageV), values(me.currentA), orDash(power.kw, 1), orDash(power.pf, 2)];
          }),
        ),
      ),
    );
  }

  // 10. Diagnóstico energético: los hallazgos del auditor, cada uno con sus fotos (que ya no se repiten en el anexo)
  const shown = new Set<AuditAssets['photos'][number]>();
  const findings = m.data.findings;
  if (present.diagnostico) {
    const counts = (['critico', 'alto', 'medio', 'bajo'] as const)
      .map((s) => ({ s, n: findings.filter((x) => x.severity === s).length }))
      .filter(({ n }) => n > 0)
      .map(({ s, n }) => `${n} ${SEVERITY_COUNT[s][n === 1 ? 0 : 1]}`);
    body.push(
      section('diagnostico', 'Diagnóstico energético'),
      para(
        `El diagnóstico reúne ${findings.length} ${findings.length === 1 ? 'hallazgo' : 'hallazgos'} (${list(counts)}) con su gravedad, el tema al que pertenecen, su estado y la evidencia fotográfica tomada en campo.`,
      ),
      ...table(
        'Hallazgos del diagnóstico, del más grave al más leve.',
        dataTable(
          [
            { header: 'Hallazgo', width: 0.44 },
            { header: 'Gravedad', width: 0.14 },
            { header: 'Tema', width: 0.22 },
            { header: 'Estado', width: 0.2 },
          ],
          findings.map((x) => [
            x.title,
            { text: SEVERITY_LABEL[x.severity], bold: x.severity === 'critico' || x.severity === 'alto', color: SEVERITY_COLOR[x.severity] },
            findingTopicLabel(x.category) || '—',
            FINDING_STATUS_LABEL[x.status],
          ]),
        ),
      ),
    );
    for (const x of findings) {
      body.push(para([text(`${SEVERITY_LABEL[x.severity]} · `, { bold: true, color: SEVERITY_COLOR[x.severity] }), text(x.title, { bold: true })], { spacing: { before: 200, after: 60 } }));
      if (x.description) body.push(para(x.description));
      // Formato 11: fecha, posible causa, impacto energético y acción sugerida
      const details: [string, string | undefined][] = [
        ['Fecha', x.foundAt ? formatDate(x.foundAt) : undefined],
        ['Posible causa', x.cause],
        ['Impacto energético observado', x.energyImpact],
        ['Acción sugerida', x.suggestedAction],
      ];
      for (const [label, value] of details) if (value) body.push(para([text(`${label}: `, { bold: true }), text(value)], { spacing: { after: 40 } }));
      for (const p of assets.photos) {
        if (p.photo.entityType !== 'hallazgo' || p.photo.entityId !== x.id) continue;
        shown.add(p);
        body.push(...numberedPhoto(p, 320));
      }
    }
  }

  // 11. Seguridad eléctrica y SST: capítulo propio, aparte de los ahorros
  if (present.seguridad) body.push(...safetySection(m, { fig, table, title: `${sectionNo.get('seguridad')}. Seguridad eléctrica y SST` }));

  // 12. Potencial de ahorro y oportunidades (art. 4, aspectos d, e y g): potencial por clase, FNCER, tenencia, VPN y TIR, y priorización con criterios
  if (present.oportunidades) body.push(...opportunitiesSection(m, { fig, table, title: `${sectionNo.get('oportunidades')}. Potencial de ahorro y oportunidades` }));

  // 13. Conclusiones
  body.push(section('conclusiones', 'Conclusiones y recomendaciones'));
  const concluding = m.findings.filter((x) => x.tone !== 'info' && x.topic !== 'seguridad');
  body.push(...(concluding.length ? concluding.map(findingBullet) : [para('Los datos registrados no muestran desviaciones importantes.')]));
  const recommendations = recommend(m);
  if (recommendations.length) body.push(heading('Recomendaciones', 2), ...recommendations.map((r) => bullet(r)));
  const counts = art4Counts(art4Rows);
  const unmet = art4Rows.filter((r) => r.status !== 'cumple');
  body.push(
    para(
      plan.length
        ? 'El plan de gestión de la energía (PGEE) desarrolla las medidas incluidas en el plan con sus metas sobre la línea base, los responsables y el seguimiento de los ahorros.'
        : 'El siguiente paso es el plan de gestión de la energía (PGEE): priorizar las medidas con su evaluación económica, fijar metas sobre la línea base y programar su implementación y seguimiento.',
    ),
    para(
      unmet.length
        ? `Verificación de la Resolución 40412: ${counts.cumple} de ${counts.total} puntos se cumplen con lo registrado. Falta completar: ${unmet.map((r) => r.reference.replace('Art. ', 'art. ')).join('; ')}. El detalle está en el ${annexRef('anexo-art4')}.`
        : `Verificación de la Resolución 40412: los ${counts.total} puntos se cumplen con lo registrado (${annexRef('anexo-art4')}).`,
    ),
  );

  // Anexos: datos del auditor (art. 6 de la Res. 40412), inventario por laboratorio, verificación del art. 4 y fotografías
  if (annexLetter.has('anexo-auditor')) body.push(pageBreak(), ...auditorSection(m, { table, title: annexTitle('anexo-auditor', 'Datos del auditor') }));
  if (annexLetter.has('anexo-labs')) body.push(pageBreak(), ...labInventoryAnnex(m, { table, title: annexTitle('anexo-labs', 'Inventario por laboratorio') }));
  body.push(pageBreak(), ...art4Annex(art4Rows, { table, title: annexTitle('anexo-art4', 'Verificación del artículo 4 de la Resolución 40412') }));

  // Registro fotográfico: las fotos que no se mostraron con su hallazgo
  const annex = assets.photos.filter((p) => !shown.has(p));
  if (annex.length) {
    const width = options.photoSize === 'pequena' ? 380 : 520;
    body.push(pageBreak(), heading(`Anexo ${String.fromCharCode(65 + annexKeys.length)}. Registro fotográfico`));
    for (const p of annex) body.push(...numberedPhoto(p, width));
  }

  return new Document({
    creator: 'PONTIA',
    title: `Informe de auditoría energética · ${project.name}`,
    description: 'Informe de auditoría energética (ISO 50002 · Res. MME 40412 de 2024)',
    features: { updateFields: true },
    styles: DOC_STYLES,
    numbering: NUMBERING,
    sections: [
      {
        properties: {
          titlePage: true,
          page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin } },
        },
        // La portada (primera página) no lleva encabezado ni número de página
        headers: { default: pageHeader(project.name), first: blankHeader() },
        footers: { default: pageFooter(m.data.copyrightHolder), first: blankFooter() },
        children: body,
      },
    ],
  });
}

function cover(m: AuditModel): FileChild[] {
  const { project, generatedAt } = m.data;
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
  const band = new Table({
    width: { size: CONTENT_TWIPS, type: WidthType.DXA },
    columnWidths: [CONTENT_TWIPS],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: COLOR.navy },
            margins: { top: 480, bottom: 480, left: 360, right: 360 },
            children: [
              para([text('INFORME DE AUDITORÍA ENERGÉTICA', { color: 'CFE3FF', size: 18, bold: true })], { spacing: { after: 160 } }),
              para([text(project.name, { font: FONT.heading, size: 52, color: 'FFFFFF' })], { spacing: { after: 120 } }),
              para([text([project.client, project.site?.name, project.city].filter(Boolean).join(' · ') || 'Instalación auditada', { size: 24, color: 'E8EEF8' })], { spacing: { after: 0 } }),
            ],
          }),
        ],
      }),
    ],
  });
  const facts: [string, string][] = [
    ['Fecha del informe', formatDate(isoLocal(generatedAt))],
    ['Código del proyecto', project.code ?? '—'],
    ['Auditor', project.auditor ?? '—'],
    ['Referencia', 'Res. MME 40412/2024 · NTC-ISO 50002 · Res. UPME 016/2024 · IPMVP'],
    ...(characterizationNotes(project).missing.length ? ([['Estado', 'Borrador · faltan datos de la caracterización de la entidad']] as [string, string][]) : []),
  ];
  return [
    new Paragraph({ spacing: { before: 1800 }, children: [] }),
    band,
    new Paragraph({ spacing: { after: 360 }, children: [] }),
    ...facts.map(([label, value]) =>
      para([text(`${label.toUpperCase()}   `, { size: 16, color: COLOR.muted, bold: true }), text(value, { size: 22 })], {
        spacing: { after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule, space: 4 } },
      }),
    ),
    ...ownershipBlock(m.data.copyrightHolder),
  ];
}

function findingBullet(f: AutoFinding): Paragraph {
  const tone = TONE[f.tone];
  return bullet([text(`${tone.label} · `, { bold: true, color: tone.color }), text(`${f.title}. `, { bold: true }), text(f.detail)]);
}

/** Hallazgo del diagnóstico en el resumen: gravedad, título y descripción. */
function recordedFindingBullet(f: Finding): Paragraph {
  return bullet([
    text(`${SEVERITY_LABEL[f.severity]} · `, { bold: true, color: SEVERITY_COLOR[f.severity] }),
    text(`${f.title}${f.description ? '. ' : ''}`, { bold: true }),
    ...(f.description ? [text(f.description)] : []),
  ]);
}

/** Recomendaciones que se desprenden de los hallazgos (se detallan y evalúan en el PGEE). */
function recommend(m: AuditModel): string[] {
  const out: string[] = [];
  const f = m.capacity.facility;
  if (f && f.pf < 0.9) out.push('Instalar un banco de condensadores para llevar el factor de potencia por encima de 0,95 y eliminar el cobro de reactiva.');
  if (m.capacity.checks.some((c) => c.level === 'critica')) out.push('Reducir la demanda en las horas pico o ampliar la capacidad de los elementos con carga crítica antes de conectar cargas nuevas.');
  if (m.capacity.imbalance.some((r) => r.level !== 'normal')) out.push('Redistribuir las cargas monofásicas entre fases en los tableros con desbalance.');
  if (m.cooling.some((c) => c.status === 'subdimensionado')) out.push('Completar la capacidad de climatización en los espacios con carga insuficiente, con equipos inverter de alta eficiencia.');
  if (m.cooling.some((c) => c.status === 'sobredimensionado')) out.push('Al reponer los aires sobredimensionados, elegir la capacidad comercial que cubre la carga calculada.');
  if (m.lighting.some((l) => l.status === 'insuficiente' || l.veeiOk === false)) out.push('Cambiar la iluminación fluorescente por LED con la distribución del método de los lúmenes: más iluminancia con menos potencia.');
  if (m.daily?.peak && m.daily.baseLoadKw / m.daily.peak.kw > 0.25) out.push('Apagar los equipos que quedan encendidos fuera del horario (programadores o control por horario).');
  if (m.deviation !== null && Math.abs(m.deviation) > 0.1) out.push('Completar el censo de carga para que el balance explique el consumo facturado.');
  return out;
}

const COOLING_TEXT = { adecuado: 'Adecuada', subdimensionado: 'Insuficiente', sobredimensionado: 'Sobredimensionada', 'sin-aire': 'Sin aire' } as const;
const LOADING_TEXT = { normal: 'Normal', alta: 'Alta', critica: 'Crítica' } as const;
const IMBALANCE_TEXT = { normal: 'Normal', alto: 'Alto', critico: 'Crítico' } as const;
const BASIS_SHORT = { analizador: 'Analizador', factura: 'Factura', medido: 'Medido', instalado: 'Estimado' } as const;
const DEMAND_TEXT = { analizador: 'demanda máxima del analizador', factura: 'demanda máxima facturada', medido: 'medición puntual', instalado: 'estimada con la carga instalada' } as const;

const yesNo = (ok: boolean): Cell => (ok ? { text: 'Sí', color: COLOR.good, bold: true } : { text: 'No', color: COLOR.serious, bold: true });
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const pad = (n: number) => String(n).padStart(2, '0');
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
