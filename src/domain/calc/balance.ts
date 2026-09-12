export interface EndUseEnergy {
  category: string;
  kwh: number;
}

export interface EndUseShare extends EndUseEnergy {
  share: number;
  cumulativeShare: number;
}

/** Balance energético por uso final, ordenado de mayor a menor consumo. */
export function endUseBalance(items: readonly EndUseEnergy[]): EndUseShare[] {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.category, (totals.get(item.category) ?? 0) + item.kwh);
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  let cumulative = 0;
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, kwh]) => {
      const share = total > 0 ? kwh / total : 0;
      cumulative += share;
      return { category, kwh, share, cumulativeShare: cumulative };
    });
}

/** Usos significativos de energía (ISO 50001) por Pareto: los usos que acumulan hasta el umbral. */
export function significantEnergyUses(balance: readonly EndUseShare[], threshold = 0.8): EndUseShare[] {
  const result: EndUseShare[] = [];
  for (const use of balance) {
    result.push(use);
    if (use.cumulativeShare >= threshold - 1e-9) break;
  }
  return result;
}

/** Desviación del consumo estimado con el censo frente al facturado: 0,08 significa 8 % por encima. */
export const reconciliationDeviation = (estimatedKwh: number, billedKwh: number): number =>
  billedKwh > 0 ? (estimatedKwh - billedKwh) / billedKwh : NaN;
