import type { FileChild, Table } from 'docx';
import { MODEL_LABEL, upmeVariable } from '@/domain/calc/lben';
import { MONTHS_LONG, formatDate, periodLabel } from '@/utils/dates';
import { formatNumber, formatPercent } from '@/utils/format';
import type { AuditModel } from '../model';
import { bullet, dataTable, heading, note, para, text, type Cell } from './theme';

/** Herramientas del documento que numera las figuras y las tablas. */
export interface SectionTools {
  fig: (id: string) => FileChild[];
  table: (caption: string, t: Table) => FileChild[];
}

const list = (items: readonly string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : (items[0] ?? ''));
const num = (value: number | null | undefined, decimals = 0) => (value === null || value === undefined || !Number.isFinite(value) ? '—' : formatNumber(value, decimals));
const pText = (p: number) => (p < 0.0001 ? '< 0,0001' : formatNumber(p, 4));

const KIND_LABEL = { rutinario: 'Rutinario', 'no-rutinario': 'No rutinario', actualizacion: 'Actualización' } as const;

/**
 * Línea base de consumo energético con el método de la Res. UPME 016 de 2024: modelo elegido, periodo base, tabla mensual con la banda de
 * ±10 % y el potencial por mejor desempeño, ajustes y la información que se reporta a la UPME (Paso 7 de los anexos).
 */
export function upmeBaselineSection(m: AuditModel, { fig, table }: SectionTools): FileChild[] {
  const b = m.upme;
  if (!b) return [];
  const out: FileChild[] = [heading('Línea base de consumo energético (Res. UPME 016 de 2024)', 2)];
  const ratio = b.ratio;
  const s = b.statistical;
  const monthly = b.monthly;

  const why =
    b.kind === 'valor-absoluto'
      ? 'Solo se dispone del consumo mensual facturado, por lo que la LBEn de cada mes es el promedio del consumo de ese mes en los años del periodo base (numerales 7.4.1 y 7.5.1).'
      : b.kind === 'cociente'
        ? `Además del consumo se cuenta con «${upmeVariable(b.ratioVariable ?? 'personas').label.toLowerCase()}»: la LBEn de cada mes es el promedio del cociente kWh por unidad de esa variable (${ratio?.ratioUnit}) en los años del periodo base (numerales 7.4.2 y 7.5.2).`
        : `El consumo se modela como función lineal de ${list((s?.candidates ?? []).map((v) => upmeVariable(v).label.toLowerCase()))}, y se descartan las variables cuya probabilidad supera 0,05 (numerales 7.4.3 y 7.5.3).`;
  out.push(
    para(
      `El consumo facturado de electricidad se normalizó a periodos de 30 días con (kWh facturados ÷ días facturados) × 30. Modelo seleccionado: ${MODEL_LABEL[b.kind].toLowerCase()}. ` +
        `Periodo base: ${b.months} meses, de ${periodLabel(b.from)} a ${periodLabel(b.to)}. ${why}`,
    ),
  );

  if (monthly && !s) {
    out.push(
      para(
        `Cada dato se verificó contra el intervalo de ±10 % del promedio de su mes (ecuaciones 3 y 7)${(() => { const n = monthly.months.filter((x) => x.band === 'desviacion').length; return n ? `; en los ${n} ${n === 1 ? 'mes' : 'meses'} con 10 o más datos, contra dos desviaciones estándar (ecuaciones 4 y 5)` : ''; })()}: de ${monthly.initialCount} datos iniciales quedaron ${monthly.finalCount} datos finales para calcular la LBEn.`,
      ),
    );
  }
  out.push(...fig('linea-base-upme'));

  if (monthly && !s) {
    const decimals = ratio ? 2 : 0;
    const unit = ratio ? ratio.ratioUnit : 'kWh/mes';
    out.push(
      ...table(
        `Línea base mensual (${unit}) y potencial de ahorro por mejor desempeño.`,
        dataTable(
          [
            { header: 'Mes', width: 0.16 },
            { header: 'LBEn', width: 0.12, align: 'right' },
            { header: 'Límite inferior', width: 0.12, align: 'right' },
            { header: 'Límite superior', width: 0.12, align: 'right' },
            { header: 'Desv. est.', width: 0.11, align: 'right' },
            { header: 'Mínimo', width: 0.12, align: 'right' },
            { header: 'Ahorro', width: 0.12, align: 'right' },
            { header: 'Ahorro %', width: 0.13, align: 'right' },
          ],
          monthly.months.map((row, i): Cell[] => [
            MONTHS_LONG[i].charAt(0).toUpperCase() + MONTHS_LONG[i].slice(1),
            num(row.baseline, decimals),
            num(row.lower, decimals),
            num(row.upper, decimals),
            num(row.stdDev, decimals),
            num(row.minimum, decimals),
            num(row.saving, decimals),
            row.savingPct === null ? '—' : formatPercent(row.savingPct, 1),
          ]),
          ['Promedio', num(monthly.meanBaseline, decimals), '', '', '', num(monthly.meanMinimum, decimals), num(monthly.meanSaving, decimals), monthly.savingPct === null ? '—' : formatPercent(monthly.savingPct, 1)],
        ),
      ),
    );
    if (ratio) out.push(note(`El ahorro por mejor desempeño equivale a ${num(ratio.annualSavingKwh)} kWh al año (${b.headline.savingPct !== null ? formatPercent(b.headline.savingPct, 1) : '—'} de la LBEn), al multiplicar la diferencia de cada mes por el valor promedio de la variable en ese mes.`));
  }

  if (s) {
    const rows = s.model.coefficients.map((coefficient, i): Cell[] => [
      i === 0 ? 'Intercepción' : upmeVariable(s.variables[i - 1]).label,
      formatNumber(coefficient, 3),
      formatNumber(s.model.standardErrors[i], 3),
      formatNumber(s.model.tValues[i], 2),
      pText(s.model.pValues[i]),
    ]);
    out.push(
      ...table(
        'Resultado de la regresión de la línea base (nivel de confianza del 95 %).',
        dataTable(
          [
            { header: 'Término', width: 0.34 },
            { header: 'Coeficiente', width: 0.17, align: 'right' },
            { header: 'Error típico', width: 0.17, align: 'right' },
            { header: 'Estadístico t', width: 0.16, align: 'right' },
            { header: 'Probabilidad', width: 0.16, align: 'right' },
          ],
          rows,
        ),
      ),
      para(
        `R² = ${formatNumber(s.model.r2, 3)} (ajustado ${formatNumber(s.model.adjustedR2, 3)}), ${s.model.observations} observaciones y error medio de ${formatPercent(s.meanErrorPct, 1)}. ` +
          `Consumo mensual del periodo base: máximo ${formatNumber(s.consumption.maximum)}, mínimo ${formatNumber(s.consumption.minimum)}, promedio ${formatNumber(s.consumption.average)} kWh y desviación estándar ${num(s.consumption.stdDev)} kWh. ` +
          (s.potentialPct !== null
            ? `El potencial de ahorro por mejor desempeño, con la línea meta construida con los ${s.target?.bestPeriods.length ?? 0} meses que consumieron menos que la LBEn, es de ${formatPercent(s.potentialPct, 2)}.`
            : 'No se pudo construir la línea meta con los datos disponibles.'),
      ),
    );
  }

  const concerns = b.warnings.filter((w) => w.tone !== 'info' || w.text.startsWith('Ajuste no rutinario') || w.text.startsWith('Periodo base'));
  if (concerns.length) {
    out.push(para([text('Consideraciones sobre la línea base', { bold: true })], { spacing: { after: 60 } }), ...concerns.map((w) => bullet(w.text)));
  }

  if (m.data.baselineAdjustments.length) {
    out.push(
      ...table(
        'Ajustes y actualizaciones de la línea base.',
        dataTable(
          [
            { header: 'Fecha', width: 0.14 },
            { header: 'Tipo', width: 0.16 },
            { header: 'Causa', width: 0.4 },
            { header: 'Meses', width: 0.16, align: 'right' },
            { header: 'Corrige', width: 0.14, align: 'center' },
          ],
          m.data.baselineAdjustments.map((a): Cell[] => [formatDate(a.date), KIND_LABEL[a.kind], a.cause, String(a.months?.length ?? 0), a.kind === 'no-rutinario' ? (a.applied ? 'Sí' : 'No') : '—']),
        ),
      ),
    );
  }

  out.push(
    ...table(
      'Información de la línea base para reportar a la UPME.',
      dataTable(
        [
          { header: 'Atributo', width: 0.32 },
          { header: 'Descripción', width: 0.42 },
          { header: 'Observaciones', width: 0.26 },
        ],
        b.attributes.map((row): Cell[] => [row.attribute, row.description, row.note ?? '']),
      ),
    ),
  );
  return out;
}
