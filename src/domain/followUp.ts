import { sum } from './calc/stats';
import type { Bill } from './types';
import type { UpmeBaseline } from './upmeBaseline';

/**
 * Seguimiento del ahorro real: el consumo facturado después de la auditoría frente al del año anterior (la referencia de la meta legal del
 * 15 %, Ley 1715 art. 30) y frente a la línea base de la Res. UPME 016. Es un cálculo con el consumo facturado (kWh), sin corregir por clima,
 * ocupación ni cambios de la operación; los ajustes de la línea base se documentan en su propio paso (§7.6). Verifica lo que ocurre, no lo explica.
 */

export interface FollowUpMonth {
  /** AAAA-MM del año de seguimiento. */
  period: string;
  month: number;
  actualKwh: number;
  /** Consumo facturado del mismo mes del año anterior; `null` si no hay factura de ese mes. */
  previousKwh: number | null;
  /** Consumo del mes normalizado a 30 días (con los días de la factura) y la LBEn del mes, para compararlos. */
  actual30Kwh: number | null;
  baselineKwh: number | null;
}

export type FollowUpStatus = 'sin-datos' | 'sin-comparacion' | 'sin-meta' | 'en-ruta' | 'atrasado' | 'cumplida' | 'no-alcanzada';

export interface FollowUp {
  year: number;
  /** Meses del año con factura, en orden. */
  months: FollowUpMonth[];
  covered: number;
  /** Los doce meses del año tienen factura. */
  complete: boolean;
  /** Meses que tienen factura en el año y en el anterior: son los que se comparan. */
  comparedMonths: number;
  actualKwh: number;
  previousKwh: number;
  savingKwh: number;
  /** Ahorro frente al año anterior como fracción (0,12 = 12 %); `null` sin meses comparables. */
  savingPct: number | null;
  /** Meses con LBEn y el ahorro frente a ella. */
  baselineMonths: number;
  baselineSavingPct: number | null;
  /** Meta del año (% del consumo del año anterior) y su valor anual en kWh. */
  targetPct: number | null;
  targetKwh: number | null;
  status: FollowUpStatus;
  /** Lo que falta ahorrar para la meta anual con los meses que faltan (kWh) y qué % de su consumo del año anterior sería. */
  remainingKwh: number | null;
  requiredPct: number | null;
}

/** Años con al menos una factura desde el primero de la ruta, del más reciente al más antiguo. */
export function followUpYears(bills: readonly Pick<Bill, 'period'>[], firstYear: number): number[] {
  const years = new Set(bills.map((b) => Number(b.period.slice(0, 4))).filter((y) => Number.isFinite(y) && y >= firstYear));
  return [...years].sort((a, b) => b - a);
}

/** LBEn de cada mes del año (1 a 12) según el modelo: valor absoluto o cociente. El estadístico depende de las variables de cada mes y no se proyecta. */
export function baselineByMonth(baseline: UpmeBaseline | null | undefined): (number | null)[] {
  if (!baseline) return Array.from({ length: 12 }, () => null);
  if (baseline.kind === 'valor-absoluto' && baseline.monthly) return baseline.monthly.months.map((m) => m.baseline);
  if (baseline.kind === 'cociente' && baseline.ratio) return baseline.ratio.baselineKwh;
  return Array.from({ length: 12 }, () => null);
}

const normalized = (bill: Pick<Bill, 'kwh' | 'days'>) => (bill.days && bill.days > 0 ? (bill.kwh / bill.days) * 30 : null);

export function followUp(input: {
  bills: readonly Bill[];
  year: number;
  /** Meta del año en porcentaje (15 = 15 %): la de la ruta o, el primer año, el mínimo legal. */
  targetPct: number | null;
  /** Consumo del año anterior en kWh, para la meta anual cuando el año anterior no tiene los doce meses. */
  referenceKwh: number | null;
  baseline?: UpmeBaseline | null;
}): FollowUp {
  const byPeriod = new Map(input.bills.map((b) => [b.period, b]));
  const baselines = baselineByMonth(input.baseline);
  const months: FollowUpMonth[] = [];
  for (let month = 1; month <= 12; month++) {
    const period = `${input.year}-${String(month).padStart(2, '0')}`;
    const bill = byPeriod.get(period);
    if (!bill) continue;
    const previous = byPeriod.get(`${input.year - 1}-${String(month).padStart(2, '0')}`);
    months.push({ period, month, actualKwh: bill.kwh, previousKwh: previous ? previous.kwh : null, actual30Kwh: normalized(bill), baselineKwh: baselines[month - 1] });
  }

  const compared = months.filter((m) => m.previousKwh !== null);
  const actualKwh = sum(compared.map((m) => m.actualKwh));
  const previousKwh = sum(compared.map((m) => m.previousKwh ?? 0));
  const savingKwh = previousKwh - actualKwh;
  const savingPct = previousKwh > 0 ? savingKwh / previousKwh : null;

  const withBaseline = months.filter((m) => m.baselineKwh !== null && m.baselineKwh > 0 && m.actual30Kwh !== null);
  const baselineTotal = sum(withBaseline.map((m) => m.baselineKwh ?? 0));
  const baselineActual = sum(withBaseline.map((m) => m.actual30Kwh ?? 0));
  const baselineSavingPct = baselineTotal > 0 ? (baselineTotal - baselineActual) / baselineTotal : null;

  // Consumo del año anterior completo (la base de la meta anual): los doce meses si están; si no, el consumo de referencia
  const previousYearBills = Array.from({ length: 12 }, (_, i) => byPeriod.get(`${input.year - 1}-${String(i + 1).padStart(2, '0')}`));
  const previousYearTotal = previousYearBills.every(Boolean) ? sum(previousYearBills.map((b) => b?.kwh ?? 0)) : input.referenceKwh;
  const targetKwh = input.targetPct !== null && previousYearTotal ? (previousYearTotal * input.targetPct) / 100 : null;

  // Lo que falta: la meta anual menos lo ahorrado, repartido sobre lo que consumió el año anterior en los meses que aún no tienen factura
  const coveredMonths = new Set(months.map((m) => m.month));
  const remainingBase = sum(previousYearBills.map((b, i) => (b && !coveredMonths.has(i + 1) ? b.kwh : 0)));
  const remainingKwh = targetKwh !== null ? Math.max(0, targetKwh - Math.max(0, savingKwh)) : null;
  const requiredPct = remainingKwh !== null && remainingBase > 0 ? remainingKwh / remainingBase : null;

  const target = input.targetPct !== null ? input.targetPct / 100 : null;
  let status: FollowUpStatus;
  if (!months.length) status = 'sin-datos';
  else if (savingPct === null) status = 'sin-comparacion';
  else if (target === null) status = 'sin-meta';
  else if (savingPct + 1e-9 >= target) status = months.length === 12 ? 'cumplida' : 'en-ruta';
  else status = months.length === 12 ? 'no-alcanzada' : 'atrasado';

  return {
    year: input.year,
    months,
    covered: months.length,
    complete: months.length === 12,
    comparedMonths: compared.length,
    actualKwh,
    previousKwh,
    savingKwh,
    savingPct,
    baselineMonths: withBaseline.length,
    baselineSavingPct,
    targetPct: input.targetPct,
    targetKwh,
    status,
    remainingKwh,
    requiredPct,
  };
}
