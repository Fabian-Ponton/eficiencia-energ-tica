import { describe, expect, it } from 'vitest';
import {
  absoluteModel,
  applyNonRoutine,
  baselinePoints,
  completeVariables,
  monthlyModel,
  nonRoutineProportion,
  normalizeTo30Days,
  populationStdDev,
  ratioModel,
  recommendModel,
  savingsWithAdjustments,
  statisticalModel,
  upmeAttributes,
  withinPeriod,
} from '@/domain/calc/lben';
import type { Bill } from '@/domain/types';
import { AÑO, CONSUMO, CONSUMO_ANEXO4_AÑO2, entradasAnexo2, facturasAnexo, periodo, puntosAnexo } from './fixtures/upme016';

const round = (value: number | null | undefined) => Math.round(value ?? Number.NaN);

describe('normalización a 30 días (ecuación 1)', () => {
  it('divide entre los días del periodo y multiplica por 30', () => {
    expect(normalizeTo30Days(31_000, 31)).toBe(30_000);
    expect(normalizeTo30Days(28_000, 28)).toBe(30_000);
    expect(normalizeTo30Days(10_000, 30)).toBe(10_000);
  });

  it('la serie usa los días de cada factura y deja sin normalizar la que no los trae', () => {
    const bills = [
      { period: '2025-02', kwh: 28_000, days: 28 },
      { period: '2025-01', kwh: 31_000, days: 31 },
      { period: '2025-03', kwh: 9_000 },
    ] as Bill[];
    const points = baselinePoints(bills);
    expect(points.map((p) => p.period)).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(points.map((p) => p.kwh)).toEqual([30_000, 30_000, 9_000]);
    expect(points.map((p) => p.normalized)).toEqual([true, true, false]);
    expect(baselinePoints(bills, { normalize: false }).map((p) => p.kwh)).toEqual([31_000, 28_000, 9_000]);
  });

  it('recorta el periodo base y reconoce las variables que tienen dato en todos los meses', () => {
    const points = puntosAnexo({ personas: true });
    expect(withinPeriod(points, '2024-01', '2024-12')).toHaveLength(12);
    expect(withinPeriod(points, '2025-01')).toHaveLength(12);
    expect(completeVariables(points)).toEqual(['personas']);
    const incompletas = points.map((p, i) => (i === 3 ? { ...p, variables: {} } : p));
    expect(completeVariables(incompletas)).toEqual([]);
    expect(completeVariables([])).toEqual([]);
  });
});

describe('Anexo 1 · modelo de valor absoluto', () => {
  const modelo = absoluteModel(puntosAnexo());

  it('reproduce las tablas del anexo mes por mes', () => {
    // Promedio del mes, límite superior (110 %), inferior (90 %), mínimo y ahorro, como los publica el anexo
    const publicado = [
      [11034, 12138, 9931, 10204, 830, 0.075],
      [11052, 12157, 9947, 10886, 166, 0.015],
      [11541, 12696, 10387, 11318, 223, 0.019],
      [11477, 12625, 10329, 11242, 235, 0.02],
      [11867, 13054, 10681, 11277, 590, 0.05],
      [11531, 12685, 10378, 11009, 522, 0.045],
      [11943, 13137, 10749, 11719, 224, 0.019],
      [11522, 12675, 10370, 11146, 376, 0.033],
      [11364, 12501, 10228, 10300, 1064, 0.094],
      [10838, 11922, 9754, 10383, 455, 0.042],
      [11169, 12286, 10052, 10639, 530, 0.047],
      [11321, 12453, 10189, 10927, 394, 0.035],
    ];
    publicado.forEach(([lben, superior, inferior, minimo, ahorro, pct], i) => {
      const m = modelo.months[i];
      expect(round(m.baseline), `LBEn del mes ${i + 1}`).toBe(lben);
      // El anexo redondea cada cifra a mano: los límites pueden diferir en 1 kWh
      expect(Math.abs(round(m.upper) - superior), `límite superior del mes ${i + 1}`).toBeLessThanOrEqual(1);
      expect(Math.abs(round(m.lower) - inferior), `límite inferior del mes ${i + 1}`).toBeLessThanOrEqual(1);
      expect(m.minimum, `mínimo del mes ${i + 1}`).toBe(minimo);
      expect(round(m.saving), `ahorro del mes ${i + 1}`).toBe(ahorro);
      expect(m.savingPct as number, `porcentaje del mes ${i + 1}`).toBeCloseTo(pct, 3);
    });
  });

  it('reproduce el resumen: 36 datos, promedio 11.388 kWh, mínimo 10.921 y ahorro de 468 kWh (4,1 %)', () => {
    expect(modelo.initialCount).toBe(36);
    expect(modelo.finalCount).toBe(36);
    expect(modelo.complete).toBe(true);
    expect(round(modelo.meanBaseline)).toBe(11_388);
    expect(round(modelo.meanMinimum)).toBe(10_921);
    expect(modelo.meanSaving as number).toBeCloseTo(468, 0);
    expect(modelo.savingPct as number).toBeCloseTo(0.041, 3);
    // Ningún dato quedó fuera de la banda de ±10 %
    expect(modelo.months.every((m) => m.data.every((d) => !d.removed))).toBe(true);
  });

  it('los datos por fuera de la banda se eliminan y se recalcula la LBEn con los que quedan', () => {
    const entradas = [
      { period: '2023-03', value: 100 },
      { period: '2024-03', value: 102 },
      { period: '2025-03', value: 130 },
    ];
    const [, , marzo] = monthlyModel(entradas).months;
    // Promedio inicial 110,67: la banda es 99,6–121,7 y el 130 queda afuera
    expect(marzo.initialAverage).toBeCloseTo(110.667, 3);
    expect(marzo.data.find((d) => d.value === 130)?.removed).toBe(true);
    expect(marzo.initialCount).toBe(3);
    expect(marzo.finalCount).toBe(2);
    expect(marzo.baseline).toBe(101);
    expect(marzo.minimum).toBe(100);
    // Conservándolos solo se marcan
    const conservado = monthlyModel(entradas, { removeOutliers: false }).months[2];
    expect(conservado.finalCount).toBe(3);
    expect(conservado.baseline as number).toBeCloseTo(110.667, 3);
  });

  it('si todos los datos del mes quedan afuera se usa el promedio inicial y se avisa', () => {
    const [enero] = monthlyModel([
      { period: '2024-01', value: 100 },
      { period: '2025-01', value: 300 },
    ]).months;
    expect(enero.allRemoved).toBe(true);
    expect(enero.baseline).toBe(200);
    expect(enero.finalCount).toBe(0);
  });

  it('un mes sin datos queda vacío y las cifras anuales dicen que están incompletas', () => {
    const parcial = monthlyModel([
      { period: '2025-01', value: 10 },
      { period: '2025-02', value: 20 },
    ]);
    expect(parcial.months[5].baseline).toBeNull();
    expect(parcial.monthsCovered).toBe(2);
    expect(parcial.complete).toBe(false);
    expect(parcial.meanBaseline).toBe(15);
    expect(monthlyModel([]).meanBaseline).toBeNull();
  });
});

describe('Anexo 2 · modelo de cociente de valores medido', () => {
  it('reproduce los promedios y el mínimo del anexo con sus índices publicados', () => {
    const modelo = monthlyModel(entradasAnexo2());
    // Los tres puntos de cada mes están dentro de ±10 %
    expect(modelo.initialCount).toBe(36);
    expect(modelo.finalCount).toBe(36);
    const promedios = modelo.months.map((m) => Math.round((m.baseline as number) * 10) / 10);
    expect(promedios).toEqual([11.5, 11.7, 12.2, 10.9, 12.1, 12.2, 11.5, 12.1, 11.3, 11.8, 11.6, 11.7]);
    expect(modelo.months.map((m) => m.minimum)).toEqual([11.1, 10.8, 11.6, 10.2, 11.4, 11.2, 11.0, 11.3, 11.2, 11.3, 10.9, 10.9]);
    // Promedio de los meses 11,72 y del mínimo 11,07 (el anexo redondea a un decimal cada mes)
    expect(modelo.meanBaseline as number).toBeCloseTo(11.72, 1);
    expect(modelo.meanMinimum as number).toBeCloseTo(11.07, 1);
    // Ahorro por mejor desempeño: 5,5 %
    expect(modelo.savingPct as number).toBeCloseTo(0.055, 2);
  });

  it('calcula el cociente con los datos de cada mes, salta los meses sin la variable y pasa el ahorro a kWh', () => {
    const puntos = puntosAnexo({ personas: true });
    const modelo = ratioModel(puntos, 'personas');
    expect(modelo.ratioUnit).toBe('kWh/persona');
    expect(modelo.skipped).toBe(0);
    // Enero: 10.204/911 = 11,20; 11.264/925 = 12,18; 11.635/1.050 = 11,08
    expect(modelo.months[0].data.map((d) => Math.round(d.value * 100) / 100)).toEqual([11.2, 12.18, 11.08]);
    expect(modelo.months[0].minimum as number).toBeCloseTo(11.08, 2);
    // Ahorro del mes en kWh = (LBEn − mínimo) × personas promedio del mes
    const enero = modelo.months[0];
    const personasEnero = (911 + 925 + 1050) / 3;
    expect(modelo.activity[0]).toBeCloseTo(personasEnero, 6);
    expect(modelo.savingKwh[0] as number).toBeCloseTo((enero.saving as number) * personasEnero, 6);
    expect(modelo.annualSavingKwh as number).toBeGreaterThan(0);
    // Un mes sin la variable no entra
    const sinDato = puntos.map((p, i) => (i === 0 ? { ...p, variables: {} } : p));
    expect(ratioModel(sinDato, 'personas').skipped).toBe(1);
    expect(ratioModel(sinDato, 'personas').initialCount).toBe(35);
  });
});

describe('Anexo 3 · modelo estadístico', () => {
  const puntos = puntosAnexo({ personas: true, gde: true });
  const modelo = statisticalModel(puntos, ['personas', 'gde']);

  it('con las dos variables, los grados-día no son significativos y se descartan', () => {
    const primero = modelo.steps[0];
    expect(primero.variables).toEqual(['personas', 'gde']);
    // El anexo publica 0,13016; con sus mismos 36 datos la regresión da 0,1313 (diferencia de redondeo del anexo)
    expect(primero.model.pValues[2]).toBeCloseTo(0.13, 2);
    expect(primero.model.pValues[1]).toBeLessThan(0.05);
    expect(primero.dropped?.variable).toBe('gde');
    expect(modelo.steps).toHaveLength(2);
    expect(modelo.variables).toEqual(['personas']);
  });

  it('con una variable reproduce el anexo: probabilidad 0,001938, R² 0,2492 y error medio de 3,2 %', () => {
    expect(modelo.model.pValues[1]).toBeCloseTo(0.001938, 4);
    expect(modelo.model.r2).toBeCloseTo(0.2492, 3);
    expect(modelo.model.coefficients[0]).toBeCloseTo(7959.31, 1);
    expect(modelo.model.coefficients[1]).toBeCloseTo(3.5247, 3);
    expect(modelo.model.observations).toBe(36);
    expect(modelo.meanErrorPct).toBeCloseTo(0.032, 3);
    // El anexo cuenta 4 observaciones con error mayor a 5 %; con |real − estimado| ÷ real salen 8: no se prueba ese conteo
    expect(modelo.errorsOver5Pct).toBeGreaterThan(0);
  });

  it('la línea meta se arma con los meses que consumieron menos que la LBEn y da un potencial de 3,44 %', () => {
    expect(modelo.target).not.toBeNull();
    expect(modelo.target?.bestPeriods).toHaveLength(modelo.rows.filter((r) => r.actual < r.predicted).length);
    expect(modelo.potentialPct as number).toBeCloseTo(0.0344, 3);
    // La línea meta queda por debajo de la LBEn en todos los meses del periodo base
    expect(modelo.target?.rows.every((r) => r.saving > 0)).toBe(true);
  });

  it('si ninguna variable es significativa, la línea base es el promedio', () => {
    // Consumo sin relación con la variable: 12 meses con una variable aleatoria fija
    const azar = [5, 1, 4, 2, 5, 3, 1, 4, 2, 5, 3, 1].map((v) => v * 7);
    const bills = facturasAnexo({ consumo: { 1: CONSUMO[1], 2: CONSUMO[1], 3: CONSUMO[1] } }).slice(0, 12);
    const sinRelacion = baselinePoints(bills.map((b, i) => ({ ...b, workingDays: azar[i] }) as Bill));
    const resultado = statisticalModel(sinRelacion, ['diasHabiles']);
    expect(resultado.variables).toEqual([]);
    expect(resultado.model.coefficients).toHaveLength(1);
    expect(resultado.target).toBeNull();
    expect(resultado.potentialPct).toBeNull();
  });
});

describe('Anexo 4 · ajuste no rutinario en el periodo base', () => {
  const consumo = { 1: CONSUMO[1], 2: CONSUMO_ANEXO4_AÑO2, 3: CONSUMO[3] };
  const entradas = puntosAnexo({ consumo }).map((p) => ({ period: p.period, value: p.kwh }));
  const mayoASeptiembre = [5, 6, 7, 8, 9].map((m) => periodo(2, m));

  it('calcula la proporción con los meses normales y los anómalos del año 2', () => {
    const ajuste = nonRoutineProportion(entradas, mayoASeptiembre);
    expect(ajuste?.year).toBe(AÑO[2]);
    expect(ajuste?.anomalousMonths).toEqual([5, 6, 7, 8, 9]);
    expect(ajuste?.normalMonths).toEqual([1, 2, 3, 4, 10, 11, 12]);
    expect(ajuste?.normalAverage).toBe(11_287);
    expect(ajuste?.anomalousAverage).toBe(8_832);
    expect(ajuste?.difference).toBe(2_455);
    expect(ajuste?.proportion as number).toBeCloseTo(0.2175, 4);
  });

  it('sin ajuste el potencial se sobreestima y los datos anómalos quedan fuera de la banda', () => {
    const conservados = monthlyModel(entradas, { removeOutliers: false });
    // El anexo publica 9,35 %; con estos datos sale 9,1 % (9,3 % promediando los porcentajes de cada mes)
    expect(conservados.savingPct as number).toBeGreaterThan(0.09);
    expect(conservados.savingPct as number).toBeLessThan(0.1);
    const depurado = monthlyModel(entradas);
    expect(depurado.initialCount - depurado.finalCount).toBeGreaterThanOrEqual(5);
    // Los cinco meses anómalos del año 2 son de los que salen de la banda
    const anomalos = depurado.months.filter((m) => m.month >= 5 && m.month <= 9).map((m) => m.data.find((d) => d.year === AÑO[2]));
    expect(anomalos.every((d) => d?.removed)).toBe(true);
  });

  it('con el ajuste el potencial baja a 4,2 % y los 36 datos quedan dentro de la banda', () => {
    const ajuste = nonRoutineProportion(entradas, mayoASeptiembre)!;
    const ajustadas = applyNonRoutine(entradas, (e) => e.value, (e, value) => ({ ...e, value }), ajuste);
    // Solo cambian los mismos meses de los años 1 y 3
    expect(ajustadas.filter((e, i) => e.value !== entradas[i].value)).toHaveLength(10);
    const modelo = monthlyModel(ajustadas);
    expect(modelo.finalCount).toBe(36);
    expect(modelo.savingPct as number).toBeGreaterThan(0.04);
    expect(modelo.savingPct as number).toBeLessThan(0.044);
  });

  it('no hay ajuste si los meses anómalos son de años distintos o el año no tiene meses normales', () => {
    expect(nonRoutineProportion(entradas, [periodo(1, 5), periodo(2, 5)])).toBeNull();
    expect(nonRoutineProportion(entradas, [])).toBeNull();
    expect(nonRoutineProportion([{ period: '2024-05', value: 1 }], ['2024-05'])).toBeNull();
  });

  it('los ahorros con ajustes suman los rutinarios y los no rutinarios al consumo de la LBEn', () => {
    expect(savingsWithAdjustments(1000, 900)).toBe(100);
    expect(savingsWithAdjustments(1000, 900, 20, -10)).toBe(110);
  });
});

describe('elección del modelo (§7.5)', () => {
  it('solo consumo: valor absoluto; una variable: cociente; dos o más: estadístico', () => {
    expect(recommendModel(puntosAnexo())).toEqual({ model: 'valor-absoluto', variables: [] });
    expect(recommendModel(puntosAnexo({ personas: true }))).toEqual({ model: 'cociente', variables: ['personas'] });
    expect(recommendModel(puntosAnexo({ personas: true, gde: true }))).toEqual({ model: 'estadistico', variables: ['personas', 'gde'] });
  });
});

describe('información que se reporta a la UPME (Paso 7)', () => {
  it('reproduce la tabla del Anexo 1', () => {
    const modelo = absoluteModel(puntosAnexo());
    const filas = upmeAttributes({
      usage: 'Alcaldía municipal',
      areaM2: 2458,
      floors: 5,
      carriers: ['Energía eléctrica'],
      kind: 'valor-absoluto',
      variables: [],
      months: 36,
      initialCount: modelo.initialCount,
      finalCount: modelo.finalCount,
      savingPct: modelo.savingPct,
      savingKwhMonth: modelo.meanSaving,
    });
    const fila = (atributo: string) => filas.find((f) => f.attribute === atributo);
    expect(fila('Uso/destino del edificio')?.description).toBe('Alcaldía municipal');
    expect(fila('Área útil')?.description).toContain('2');
    expect(fila('Área útil')?.description).toContain('458 m²');
    expect(fila('Energéticos utilizados')?.description).toBe('Energía eléctrica');
    expect(fila('Modelo de LBEn seleccionado')?.description).toBe('Valor absoluto de energía');
    expect(fila('Periodo base')?.description).toBe('3 años');
    expect(fila('Cantidad de datos iniciales')?.description).toBe('36');
    expect(fila('Cantidad de datos finales')?.description).toBe('36');
    expect(fila('Ahorro estimado')?.description).toContain('4,1 %');
    expect(fila('Variable relevante')).toBeUndefined();
  });

  it('con un modelo de cociente agrega la variable relevante', () => {
    const filas = upmeAttributes({ carriers: [], kind: 'cociente', variables: ['personas'], months: 24, initialCount: 24, finalCount: 22 });
    expect(filas.find((f) => f.attribute === 'Variable relevante')?.description).toBe('Personas atendidas por mes');
    expect(filas.find((f) => f.attribute === 'Periodo base')?.description).toBe('2 años');
    expect(filas.find((f) => f.attribute === 'Ahorro estimado')).toBeUndefined();
  });
});

describe('banda de dos desviaciones estándar con diez o más datos (ecuaciones 4 y 5)', () => {
  /** Enero de diez años: promedio 100 y desviación estándar de la población de √285 ≈ 16,88. */
  const enero = [100, 120, 80, 105, 95, 130, 70, 110, 90, 100];
  const serie = (values: readonly number[]) => values.map((value, i) => ({ period: `${2010 + i}-01`, value }));

  it('la desviación estándar de la ecuación 5 divide entre N, no entre N − 1', () => {
    expect(populationStdDev(enero)).toBeCloseTo(Math.sqrt(285), 10);
    expect(populationStdDev([5])).toBe(0);
    expect(populationStdDev([])).toBeNull();
  });

  it('con diez datos del mes la banda es el promedio ± 2 desviaciones y conserva datos que la banda de ±10 % eliminaría', () => {
    const mes = monthlyModel(serie(enero)).months[0];
    expect(mes.band).toBe('desviacion');
    expect(mes.initialAverage).toBeCloseTo(100, 10);
    expect(mes.upper).toBeCloseTo(100 + 2 * Math.sqrt(285), 8);
    expect(mes.lower).toBeCloseTo(100 - 2 * Math.sqrt(285), 8);
    // Ninguno sale de la banda: 70 y 130 quedarían por fuera de ±10 %, pero están a menos de dos desviaciones
    expect(mes.data.some((d) => d.outside)).toBe(false);
    expect(mes.finalCount).toBe(10);
    expect(mes.baseline).toBeCloseTo(100, 10);
    // Los demás meses no tienen datos
    expect(monthlyModel(serie(enero)).months[1].band).toBeNull();
  });

  it('un dato a más de dos desviaciones sale de la banda y se depura', () => {
    const mes = monthlyModel(serie([...enero, 200])).months[0];
    expect(mes.band).toBe('desviacion');
    expect(mes.data.find((d) => d.value === 200)?.outside).toBe(true);
    expect(mes.data.filter((d) => d.outside)).toHaveLength(1);
    expect(mes.finalCount).toBe(10);
    // Sin el dato atípico, la LBEn del mes vuelve al promedio de los diez
    expect(mes.baseline).toBeCloseTo(100, 10);
    // Conservarlo solo lo marca
    const conservado = monthlyModel(serie([...enero, 200]), { removeOutliers: false }).months[0];
    expect(conservado.finalCount).toBe(11);
    expect(conservado.data.find((d) => d.value === 200)).toMatchObject({ outside: true, removed: false });
  });

  it('con nueve datos se mantiene la banda de ±10 %', () => {
    const mes = monthlyModel(serie(enero.slice(0, 9))).months[0];
    expect(mes.band).toBe('porcentaje');
    // Promedio de los nueve: 100; con ±10 % quedan fuera 120, 80, 130 y 70
    expect(mes.upper).toBeCloseTo(110, 10);
    expect(mes.lower).toBeCloseTo(90, 10);
    expect(mes.data.filter((d) => d.outside).map((d) => d.value).sort((a, b) => a - b)).toEqual([70, 80, 120, 130]);
  });

  it('se puede pedir siempre la banda de ±10 %', () => {
    const mes = monthlyModel(serie(enero), { deviationBand: false }).months[0];
    expect(mes.band).toBe('porcentaje');
    expect(mes.data.filter((d) => d.outside).length).toBeGreaterThan(0);
  });

  it('el modelo de cociente usa la misma regla con los cocientes de cada mes', () => {
    const puntos = enero.map((value, i) => ({ period: `${2010 + i}-01`, year: 2010 + i, month: 1, kwh: value * 10, billedKwh: value * 10, normalized: true, variables: { personas: 10 } }));
    const modelo = ratioModel(puntos, 'personas');
    expect(modelo.months[0].band).toBe('desviacion');
    expect(modelo.months[0].initialAverage).toBeCloseTo(100, 10);
  });
});
