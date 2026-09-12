import { sum } from './stats';

export interface BillRecord {
  /** Periodo facturado en formato AAAA-MM. */
  period: string;
  kwh: number;
  costCop: number;
  /** Días facturados, si la factura los indica. */
  days?: number;
  kvarh?: number;
}

export interface BillSummary {
  months: number;
  totalKwh: number;
  totalCostCop: number;
  averageMonthlyKwh: number;
  effectiveTariffCopPerKwh: number;
  peak: BillRecord;
  lowest: BillRecord;
}

const byPeriod = (bills: readonly BillRecord[]): BillRecord[] =>
  [...bills].sort((a, b) => a.period.localeCompare(b.period));

export function summarizeBills(bills: readonly BillRecord[]): BillSummary | null {
  if (bills.length === 0) return null;
  const totalKwh = sum(bills.map((b) => b.kwh));
  const totalCostCop = sum(bills.map((b) => b.costCop));
  const byKwh = [...bills].sort((a, b) => a.kwh - b.kwh);
  return {
    months: bills.length,
    totalKwh,
    totalCostCop,
    averageMonthlyKwh: totalKwh / bills.length,
    effectiveTariffCopPerKwh: totalKwh > 0 ? totalCostCop / totalKwh : 0,
    peak: byKwh[byKwh.length - 1],
    lowest: byKwh[0],
  };
}

/** Consumo diario promedio del periodo, para comparar facturas de distinta duración. */
export const kwhPerDay = (bill: BillRecord): number | null => (bill.days ? bill.kwh / bill.days : null);

/** Suma móvil de 12 meses. Supone meses consecutivos; devuelve un valor desde el duodécimo mes. */
export function rollingTwelveMonths(bills: readonly BillRecord[]): { period: string; kwh: number }[] {
  const ordered = byPeriod(bills);
  const result: { period: string; kwh: number }[] = [];
  for (let i = 11; i < ordered.length; i++) {
    result.push({ period: ordered[i].period, kwh: sum(ordered.slice(i - 11, i + 1).map((b) => b.kwh)) });
  }
  return result;
}

export function totalsByYear(bills: readonly BillRecord[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const bill of bills) {
    const year = Number(bill.period.slice(0, 4));
    totals.set(year, (totals.get(year) ?? 0) + bill.kwh);
  }
  return totals;
}

/** Variación relativa entre dos valores: −0,042 significa 4,2 % menos. */
export const relativeChange = (current: number, previous: number): number =>
  previous === 0 ? NaN : (current - previous) / previous;

/** Factor de potencia promedio a partir de la energía activa y reactiva facturadas. */
export function powerFactorFromEnergy(kwh: number, kvarh: number): number {
  const apparent = Math.hypot(kwh, kvarh);
  return apparent === 0 ? 1 : kwh / apparent;
}
