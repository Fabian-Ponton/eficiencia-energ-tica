import type { FileChild } from 'docx';
import { endUseOf } from '@/domain/catalogs';
import { measureEconomics, potentialByType, savingsTypeInfo, savingsTypeOf, suggestedPriority } from '@/domain/measures';
import { measureAllowance, tenureScope, tenureStatement } from '@/domain/tenure';
import type { EndUseCategory, Measure } from '@/domain/types';
import { formatCop, formatNumber, formatPercent } from '@/utils/format';
import type { AuditModel } from '../model';
import { bullet, COLOR, dataTable, heading, note, para, text, type Cell } from './theme';
import type { SectionTools } from './upmeBaselineSection';

const PRIORITY_TEXT = { alta: 'Alta', media: 'Media', baja: 'Baja' } as const;
const years = (value: number) => (Number.isFinite(value) ? `${formatNumber(value, 1)} años` : '—');
const list = (items: readonly string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : (items[0] ?? ''));

/** Por qué una medida tiene la prioridad que tiene: el criterio del retorno simple o lo que fijó el auditor. */
function priorityReason(measure: Measure, paybackYears: number): string {
  const suggested = suggestedPriority({ paybackYears }, measure.investmentCop);
  const base = measure.investmentCop <= 0 ? 'no requiere inversión' : Number.isFinite(paybackYears) ? `retorno de ${years(paybackYears)}` : 'sin ahorro neto que recupere la inversión';
  if (!measure.priority) return `Sin asignar; por el retorno se sugiere ${PRIORITY_TEXT[suggested].toLowerCase()} (${base})`;
  return measure.priority === suggested ? `Por el retorno: ${base}` : `Fijada por el auditor; por el retorno se sugiere ${PRIORITY_TEXT[suggested].toLowerCase()} (${base})`;
}

/**
 * Oportunidades de ahorro del informe de auditoría (art. 4, aspectos (d), (e) y (g), de la Res. 40412 de 2024): potencial por clase, potencial
 * de FNCER, alcance según la tenencia, evaluación económica con VPN y TIR, y priorización con sus criterios.
 */
export function opportunitiesSection(m: AuditModel, { fig, table, title }: SectionTools & { title: string }): FileChild[] {
  const measures = m.data.measures;
  const project = m.data.project;
  const economics = project.economics;
  const rows = measures.map((x) => ({ x, e: measureEconomics(x, economics) }));
  const plan = m.plan;
  const annual = m.billedAnnualKwh ?? m.referenceKwh;
  const share = (kwh: number) => (annual ? ` (${formatPercent(kwh / annual, 1)} del consumo anual)` : '');
  const out: FileChild[] = [heading(title)];

  out.push(
    para(
      rows.length
        ? `Se evaluaron ${rows.length} ${rows.length === 1 ? 'medida' : 'medidas'} con una tasa de descuento del ${formatPercent(economics.discountRate, 1)}, un incremento anual de la tarifa del ${formatPercent(economics.tariffEscalation, 1)} ` +
            `y una tarifa de ${formatCop(economics.tariffCopPerKwh)} por kWh. ` +
            (plan.count
              ? `${plan.count === rows.length ? 'Todas están incluidas' : `${plan.count} están incluidas`} en el plan: ahorran ${formatNumber(plan.kwh)} kWh/año${share(plan.kwh)} con una inversión de ${formatCop(plan.investment)}.`
              : 'Aún no hay medidas incluidas en el plan.')
        : 'Aún no se han evaluado medidas de ahorro.',
    ),
    heading('Potencial de FNCER', 2),
    para(m.fnce.text),
  );
  if (!rows.length) return out;

  // Alcance según la tenencia del edificio
  const scope = tenureScope(project.building?.tenure, project.entity?.kind);
  const blocked = rows.filter(({ x }) => measureAllowance(scope, savingsTypeOf(x)) === 'no-permitida');
  const statement = tenureStatement(project.building?.tenure, project.entity?.kind);
  if (scope !== 'todas' && statement) {
    out.push(para(statement));
    if (blocked.length) out.push(para(`Por eso no pueden entrar al plan y se reportan solo como potencial: ${list(blocked.map(({ x }) => x.code))}.`));
  }

  // Potencial por clase (art. 4d) y, aparte, el mejor desempeño de la línea base de la UPME
  const byType = potentialByType(measures);
  const best = m.upme?.headline;
  out.push(
    ...table(
      'Potencial de ahorro por clase (art. 4, aspecto (d), de la Resolución 40412 de 2024).',
      dataTable(
        [
          { header: 'Clase de potencial', width: 0.34 },
          { header: 'Medidas', width: 0.12, align: 'right' },
          { header: 'Ahorro potencial (kWh/año)', width: 0.22, align: 'right' },
          { header: 'En el plan (kWh/año)', width: 0.2, align: 'right' },
          { header: 'Inversión (COP)', width: 0.12, align: 'right' },
        ],
        [
          ...byType.map((t): Cell[] => [savingsTypeInfo(t.type).label, String(t.count), formatNumber(t.kwh), t.planCount ? formatNumber(t.planKwh) : '—', formatCop(t.investment)]),
          ...(best?.savingKwhYear ? [['Mejor desempeño energético (línea base UPME)', '—', formatNumber(best.savingKwhYear), '—', '—'] as Cell[]] : []),
        ],
      ),
    ),
  );
  if (best?.savingKwhYear) {
    out.push(note('El mejor desempeño energético es el ahorro que se logra repitiendo el mejor mes del periodo base; la Res. UPME 016 lo suma a los de las medidas, por lo que no está incluido en los totales de esta sección.'));
  }

  out.push(
    ...table(
      'Medidas de ahorro evaluadas.',
      dataTable(
        [
          { header: 'Medida', width: 0.34 },
          { header: 'Clase', width: 0.14 },
          { header: 'Ahorro (kWh/año)', width: 0.13, align: 'right' },
          { header: 'Ahorro (COP/año)', width: 0.15, align: 'right' },
          { header: 'Inversión (COP)', width: 0.15, align: 'right' },
          { header: 'En el plan', width: 0.09, align: 'center' },
        ],
        rows.map(({ x }): Cell[] => [
          `${x.code} · ${x.title}`,
          savingsTypeInfo(savingsTypeOf(x)).short,
          formatNumber(x.savingsKwhYear),
          formatCop(x.savingsCopYear),
          formatCop(x.investmentCop),
          x.selected ? { text: 'Sí', bold: true, color: COLOR.accent } : 'No',
        ]),
        plan.count ? ['Total del plan', '', formatNumber(plan.kwh), formatCop(plan.cop), formatCop(plan.investment), ''] : undefined,
      ),
    ),
  );
  if (plan.interaction) {
    const categories = plan.interaction.categories.map((c: EndUseCategory) => endUseOf(c).label.toLowerCase());
    out.push(
      note(
        `Las medidas de ${list(categories)} se solapan: como en el Anexo 5 de la Res. UPME 016, el total del plan es la suma de sus ahorros, que sobrestima el ahorro real.` +
          (plan.interaction.combinedKwh !== null ? ` Aplicadas una tras otra sobre el consumo que queda, ahorrarían unos ${formatNumber(plan.interaction.combinedKwh)} kWh/año frente a los ${formatNumber(plan.kwh)} de la suma simple.` : ''),
      ),
    );
  }

  // Evaluación económica (art. 4e)
  out.push(
    ...table(
      'Evaluación económica de las medidas (retorno simple, valor presente neto y tasa interna de retorno).',
      dataTable(
        [
          { header: 'Medida', width: 0.34 },
          { header: 'Retorno', width: 0.12, align: 'right' },
          { header: 'VPN (COP)', width: 0.2, align: 'right' },
          { header: 'TIR', width: 0.1, align: 'right' },
          { header: 'Vida útil', width: 0.11, align: 'right' },
          { header: 'CO₂ (t/año)', width: 0.13, align: 'right' },
        ],
        rows.map(({ x, e }): Cell[] => [
          `${x.code} · ${x.title}`,
          x.investmentCop <= 0 ? 'Inmediato' : years(e.paybackYears),
          formatCop(e.npvCop),
          e.irr === null ? '—' : formatPercent(e.irr, 1),
          `${e.years} años`,
          e.co2TonnesYear === null ? '—' : formatNumber(e.co2TonnesYear, 2),
        ]),
      ),
    ),
  );

  // Priorización con sus criterios (art. 4g) y el seguimiento del Formato 12
  out.push(
    para('La prioridad se sugiere por el retorno simple: alta si se recupera en dos años o menos o si no requiere inversión, media hasta cinco años y baja después. El auditor la ajusta según el riesgo, el alcance y el plazo.'),
    ...table(
      'Priorización de las medidas, con su responsable y plazo.',
      dataTable(
        [
          { header: 'Medida', width: 0.28 },
          { header: 'Prioridad', width: 0.11 },
          { header: 'Criterio', width: 0.3 },
          { header: 'Responsable', width: 0.17 },
          { header: 'Plazo', width: 0.14 },
        ],
        [...rows]
          .sort((a, b) => ['alta', 'media', 'baja', undefined].indexOf(a.x.priority) - ['alta', 'media', 'baja', undefined].indexOf(b.x.priority))
          .map(({ x, e }): Cell[] => [
            `${x.code} · ${x.title}`,
            x.priority ? { text: PRIORITY_TEXT[x.priority], bold: x.priority === 'alta' } : '—',
            priorityReason(x, e.paybackYears),
            x.responsible ?? '—',
            x.deadline ?? '—',
          ]),
      ),
    ),
  );
  const withItems = measures.filter((x) => x.items?.length);
  if (withItems.length) {
    out.push(para([text('Ítems de las medidas', { bold: true })], { spacing: { after: 60 } }));
    for (const x of withItems) out.push(bullet(`${x.code}: ${(x.items ?? []).map((i) => `${i.action || i.element || 'ítem'}${i.quantity ? ` (${formatNumber(i.quantity)} ${i.unit ?? 'un'})` : ''}`).join('; ')}.`));
  }

  out.push(...fig('matriz-priorizacion'), note('El plan de gestión de la energía (PGEE) desarrolla las medidas del plan con su ficha técnica, plazos, responsables y verificación de los ahorros.'));
  return out;
}
