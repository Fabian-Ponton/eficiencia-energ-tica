/**
 * Distribuciones para los p-valores de la regresión (Res. UPME 016 de 2024, §7.5.3: una variable con probabilidad mayor
 * a 0,05 no produce cambios significativos en el consumo). Se calculan con la beta incompleta regularizada, sin librerías.
 */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(x), aproximación de Lanczos (error relativo cercano a 1e-15). */
export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  const z = x - 1;
  const t = z + 7.5;
  let a = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i++) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Fracción continua de la beta incompleta (método de Lentz). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let term = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + term * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + term / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    term = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + term * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + term / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-14) break;
  }
  return h;
}

/** Beta incompleta regularizada I_x(a, b). */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (front * betaContinuedFraction(a, b, x)) / a : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** P(|T| ≥ |t|) para una t de Student con `df` grados de libertad: es la «Probabilidad» de cada coeficiente en la regresión de Excel. */
export function studentTwoTailedP(t: number, df: number): number {
  if (Number.isNaN(t) || !(df > 0)) return NaN;
  if (!Number.isFinite(t)) return 0;
  return regularizedIncompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** P(F ≥ f) para una F de Fisher con (d1, d2) grados de libertad: la «Valor crítico de F» de la regresión de Excel. */
export function fisherUpperP(f: number, d1: number, d2: number): number {
  if (Number.isNaN(f) || !(d1 > 0) || !(d2 > 0)) return NaN;
  if (f <= 0) return 1;
  if (!Number.isFinite(f)) return 0;
  return regularizedIncompleteBeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
}
