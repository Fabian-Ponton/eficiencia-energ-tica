import { baselinePoints, type BaselinePoint } from '@/domain/calc/lben';
import type { Bill } from '@/domain/types';

/**
 * Datos de los Anexos 1 a 4 de la Res. UPME 016 de 2024 (alcaldía con 2.458 m², tres años de datos mensuales).
 * El año 1 del anexo es 2023, el 2 es 2024 y el 3 es 2025.
 */
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Consumo de energía normalizado [kWh/mes] (Anexos 1 y 3). */
export const CONSUMO: Record<1 | 2 | 3, number[]> = {
  1: [10204, 11112, 11318, 11242, 11277, 11715, 12219, 11146, 10300, 11348, 11434, 11374],
  2: [11264, 10886, 11496, 11883, 12486, 11009, 11719, 11637, 12028, 10383, 11435, 11662],
  3: [11635, 11158, 11810, 11306, 11839, 11870, 11891, 11784, 11765, 10783, 10639, 10927],
};

/** Cantidad de personas por mes (Anexo 3). */
export const PERSONAS: Record<1 | 2 | 3, number[]> = {
  1: [911, 969, 890, 1041, 993, 968, 1045, 984, 916, 964, 1048, 1039],
  2: [925, 1008, 930, 1019, 1061, 984, 987, 940, 1049, 919, 1016, 1018],
  3: [1050, 870, 1020, 1110, 870, 900, 1080, 930, 1050, 870, 840, 810],
};

/** Grados-día de enfriamiento por mes (Anexo 3). */
export const GDE: Record<1 | 2 | 3, number[]> = {
  1: [271, 275, 287, 290, 289, 284, 284, 287, 290, 285, 273, 262],
  2: [277, 287, 296, 286, 283, 282, 287, 293, 290, 271, 257, 259],
  3: [314, 288, 287, 284, 278, 285, 297, 296, 276, 242, 253, 281],
};

/** Año 2 del Anexo 4: de mayo a septiembre las unidades de aire acondicionado estuvieron fuera de servicio (−25 % de la energía). */
export const CONSUMO_ANEXO4_AÑO2 = [11264, 10886, 11496, 11883, 9365, 8257, 8789, 8728, 9021, 10383, 11435, 11662];

export const AÑO: Record<1 | 2 | 3, number> = { 1: 2023, 2: 2024, 3: 2025 };
export const periodo = (year: 1 | 2 | 3, month: number) => `${AÑO[year]}-${String(month).padStart(2, '0')}`;

interface Options {
  consumo?: Record<1 | 2 | 3, number[]>;
  personas?: boolean;
  gde?: boolean;
}

/** Las facturas del ejemplo, con 30 días cada una para que la normalización no cambie los valores publicados. */
export function facturasAnexo({ consumo = CONSUMO, personas = false, gde = false }: Options = {}): Bill[] {
  const bills: Bill[] = [];
  for (const year of [1, 2, 3] as const) {
    consumo[year].forEach((kwh, i) => {
      bills.push({
        id: `b-${year}-${i}`,
        projectId: 'anexo',
        createdAt: 0,
        updatedAt: 0,
        period: periodo(year, i + 1),
        kwh,
        costCop: kwh * 700,
        days: 30,
        populationServed: personas ? PERSONAS[year][i] : undefined,
        coolingDegreeDays: gde ? GDE[year][i] : undefined,
      } as Bill);
    });
  }
  return bills;
}

export const puntosAnexo = (options?: Options): BaselinePoint[] => baselinePoints(facturasAnexo(options));

/** Índices de consumo publicados en el Anexo 2 [kWh/persona], por mes: año 1, año 2 y año 3. */
export const RAZON_ANEXO2: number[][] = [
  [11.2, 12.2, 11.1],
  [11.5, 10.8, 12.8],
  [12.7, 12.4, 11.6],
  [10.8, 11.7, 10.2],
  [11.4, 11.8, 13.2],
  [12.1, 11.2, 13.2],
  [11.7, 11.9, 11.0],
  [11.3, 12.4, 12.7],
  [11.2, 11.5, 11.2],
  [11.8, 11.3, 12.4],
  [10.9, 11.3, 12.7],
  [10.9, 11.5, 12.7],
];

/** Los mismos índices como entradas del modelo mensual. */
export const entradasAnexo2 = () =>
  RAZON_ANEXO2.flatMap((valores, m) => valores.map((value, y) => ({ period: periodo((y + 1) as 1 | 2 | 3, m + 1), value })));
