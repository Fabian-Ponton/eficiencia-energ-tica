/** Potencia reactiva del banco de condensadores: Qc = P × (tan φ1 − tan φ2), en kvar. */
export function capacitorBankKvar(activePowerKw: number, currentPowerFactor: number, targetPowerFactor: number): number {
  if (currentPowerFactor >= targetPowerFactor) return 0;
  const tan = (pf: number): number => Math.tan(Math.acos(pf));
  return activePowerKw * (tan(currentPowerFactor) - tan(targetPowerFactor));
}
