import { fisherUpperP, studentTwoTailedP } from './distributions';
import { mean, sum } from './stats';

/** Modelo de línea base energética (ISO 50006): y = b0 + b1·x1 + … */
export interface LinearModel {
  /** Intercepto seguido de un coeficiente por variable. */
  coefficients: number[];
  /** Error estándar, estadístico t y probabilidad (dos colas) de cada coeficiente, en el mismo orden: lo que entrega la regresión de Excel. */
  standardErrors: number[];
  tValues: number[];
  pValues: number[];
  /** Observaciones menos coeficientes. */
  degreesOfFreedom: number;
  r2: number;
  adjustedR2: number;
  /** Prueba F de toda la regresión y su valor crítico; sin variables valen 0 y 1. */
  fStatistic: number;
  fPValue: number;
  /** Coeficiente de variación del error cuadrático medio, como fracción (ASHRAE Guideline 14). */
  cvRmse: number;
  /** Sesgo medio normalizado, como fracción (ASHRAE Guideline 14). */
  nmbe: number;
  observations: number;
  predict: (variables: readonly number[]) => number;
}

/**
 * Ajuste por mínimos cuadrados. `variables[i]` son las variables relevantes de la observación i
 * (días facturados, ocupación, grados-día…). Sin variables, la línea base es el promedio.
 */
export function fitLinearModel(y: readonly number[], variables: readonly (readonly number[])[] = []): LinearModel {
  const n = y.length;
  const k = variables[0]?.length ?? 0;
  const p = k + 1;
  if (n <= p) throw new Error(`Se necesitan al menos ${p + 1} observaciones para ${k} variable(s).`);
  const rows = y.map((_, i) => [1, ...(variables[i] ?? new Array<number>(k).fill(0))]);

  const xtx = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const xty = new Array<number>(p).fill(0);
  rows.forEach((row, i) => {
    for (let a = 0; a < p; a++) {
      xty[a] += row[a] * y[i];
      for (let b = 0; b < p; b++) xtx[a][b] += row[a] * row[b];
    }
  });
  const coefficients = solveLinearSystem(xtx, xty);
  const inverse = invertMatrix(xtx);

  const fitted = rows.map((row) => row.reduce((total, x, j) => total + x * coefficients[j], 0));
  const residuals = y.map((value, i) => value - fitted[i]);
  const yMean = mean(y);
  const ssRes = sum(residuals.map((r) => r * r));
  const ssTot = sum(y.map((value) => (value - yMean) ** 2));

  const dof = n - p;
  const mse = ssRes / dof;
  const standardErrors = coefficients.map((_, j) => Math.sqrt(Math.max(0, mse * inverse[j][j])));
  const tValues = coefficients.map((b, j) => (standardErrors[j] > 0 ? b / standardErrors[j] : b === 0 ? 0 : Math.sign(b) * Number.POSITIVE_INFINITY));
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const fStatistic = k > 0 && ssRes > 0 ? (r2 / k) / ((1 - r2) / dof) : k > 0 && r2 > 0 ? Number.POSITIVE_INFINITY : 0;

  return {
    coefficients,
    standardErrors,
    tValues,
    pValues: tValues.map((t) => studentTwoTailedP(t, dof)),
    degreesOfFreedom: dof,
    r2,
    adjustedR2: ssTot > 0 ? 1 - ((1 - r2) * (n - 1)) / dof : 0,
    fStatistic,
    fPValue: k > 0 ? fisherUpperP(fStatistic, k, dof) : 1,
    cvRmse: Math.sqrt(ssRes / (n - p)) / yMean,
    nmbe: sum(residuals) / ((n - p) * yMean),
    observations: n,
    predict: (values) => coefficients.reduce((total, c, j) => total + c * (j === 0 ? 1 : (values[j - 1] ?? 0)), 0),
  };
}

/** Inversa por Gauss-Jordan con pivoteo parcial. */
function invertMatrix(matrix: readonly (readonly number[])[]): number[][] {
  const size = matrix.length;
  const a = matrix.map((row, i) => [...row, ...Array.from({ length: size }, (_, j) => (i === j ? 1 : 0))]);
  const scale = Math.max(...matrix.flat().map(Math.abs)) || 1;
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-10 * scale) throw new Error('Las variables son colineales o constantes; revisa los datos de la línea base.');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = 0; j < 2 * size; j++) a[col][j] /= divisor;
    for (let row = 0; row < size; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * size; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row.slice(size));
}

/** Eliminación de Gauss con pivoteo parcial. */
function solveLinearSystem(matrix: readonly (readonly number[])[], vector: readonly number[]): number[] {
  const size = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  const scale = Math.max(...a.flat().map(Math.abs)) || 1;
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-10 * scale) {
      throw new Error('Las variables son colineales o constantes; revisa los datos de la línea base.');
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = col + 1; row < size; row++) {
      const factor = a[row][col] / a[col][col];
      for (let j = col; j <= size; j++) a[row][j] -= factor * a[col][j];
    }
  }
  const x = new Array<number>(size).fill(0);
  for (let row = size - 1; row >= 0; row--) {
    let acc = a[row][size];
    for (let j = row + 1; j < size; j++) acc -= a[row][j] * x[j];
    x[row] = acc / a[row][row];
  }
  return x;
}
