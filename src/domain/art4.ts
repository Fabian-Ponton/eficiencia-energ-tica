import { groupStatus, lowerFirst, type ChecklistGroup } from './compliance';

/**
 * Verificación de la auditoría contra los aspectos mínimos de la Res. MME 40412 de 2024, art. 4, y sus parágrafos 2 y 3, más el art. 6.
 * La resolución enumera los siete aspectos sin letras: PONTIA los identifica de (a) a (g) en el orden del texto. Cada fila dice si lo
 * registrado en el proyecto lo cubre, qué hay y qué falta. No certifica nada: es una ayuda para que el informe no salga con huecos.
 */

export type Art4Status = 'cumple' | 'parcial' | 'pendiente';

export const ART4_STATUS_LABEL: Record<Art4Status, string> = { cumple: 'Cumple', parcial: 'Parcial', pendiente: 'Pendiente' };

export type Art4Id = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'par2' | 'par3' | 'art6';

/** Parte del informe de auditoría (o del PGEE, o un anexo) donde queda cada aspecto. */
export type ReportPart = 'alcance' | 'caracterizacion' | 'energia' | 'balance' | 'linea-base' | 'sistemas' | 'oportunidades' | 'pgee' | 'anexo-auditor';

export interface Art4Row {
  id: Art4Id;
  /** Cómo se cita en el informe, por ejemplo «Art. 4, aspecto (a)». */
  reference: string;
  title: string;
  /** Lo que pide la resolución, resumido. */
  requirement: string;
  status: Art4Status;
  /** Lo que hay registrado. */
  evidence: string;
  /** Lo que falta para cumplirlo; vacío si cumple. */
  missing: string[];
  parts: ReportPart[];
}

export interface Art4Input {
  /** Lista de la caracterización de la entidad (aspecto a). */
  characterization: ChecklistGroup;
  /** Usos significativos que salen del censo de carga. */
  significantUses: number;
  /** Facturas de electricidad y cuántas traen el costo. */
  billMonths: number;
  billsWithCost: number;
  /** Meses del periodo base de la línea base de la UPME; `null` si no se pudo calcular. */
  baselineMonths: number | null;
  equipmentCount: number;
  /** Desviación del censo frente al consumo facturado (fracción); `null` si no hay con qué comparar. */
  censusDeviation: number | null;
  /** Medidas evaluadas: cuántas hay, cuántas traen ahorro e inversión, y cuántas tienen la prioridad fijada por el auditor. */
  measures: { total: number; evaluated: number; prioritized: number };
  /** FNCER: excluidas con justificación o con su potencial cuantificado. */
  fnce: { excluded: boolean; quantified: boolean };
  /** Hay al menos un indicador de desempeño calculado. */
  indicators: boolean;
  /** El PGEE nombra al responsable del seguimiento. */
  hasManager: boolean;
  /** Lista del PGEE (art. 4, par. 3) y del auditor (art. 6). */
  pgee: ChecklistGroup;
  auditor: ChecklistGroup;
}

const statusOf = (done: number, total: number): Art4Status => (total > 0 && done >= total ? 'cumple' : done > 0 ? 'parcial' : 'pendiente');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const pct = (fraction: number) => `${(Math.abs(fraction) * 100).toFixed(1).replace('.', ',')} %`;

/** Estado de un grupo de la lista de verificación: completo, con algo, o vacío. */
function fromGroup(group: ChecklistGroup): { status: Art4Status; evidence: string; missing: string[] } {
  const s = groupStatus(group);
  return { status: statusOf(s.done, s.total), evidence: `${s.done} de ${s.total} datos obligatorios registrados`, missing: s.missing.map((item) => lowerFirst(item.label)) };
}

export function verifyArt4(input: Art4Input): Art4Row[] {
  const rows: Art4Row[] = [];

  // (a) Caracterización de la administración pública
  const a = fromGroup(input.characterization);
  rows.push({
    id: 'a',
    reference: 'Art. 4, aspecto (a)',
    title: 'Caracterización de la administración pública',
    requirement: 'Ubicación y entorno, edad de la edificación, proceso o actividad, horario de funcionamiento y tenencia (propia, alquiler, comodato u otra).',
    ...a,
    parts: ['caracterizacion'],
  });

  // (b) Caracterización del uso de la energía
  const usesOk = input.significantUses > 0;
  const historyOk = input.billMonths >= 12;
  const costsOk = input.billMonths > 0 && input.billsWithCost >= input.billMonths;
  const baselineOk = input.baselineMonths !== null && input.baselineMonths >= 12;
  const bMissing: string[] = [];
  if (!usesOk) bMissing.push('usos significativos: falta el censo de carga');
  if (!historyOk) bMissing.push(input.billMonths ? `históricos de consumo: hay ${plural(input.billMonths, 'factura', 'facturas')} y se necesitan 12 meses` : 'históricos de consumo: no hay facturas');
  if (!costsOk && input.billMonths) bMissing.push(`costos asociados: ${plural(input.billMonths - input.billsWithCost, 'factura sin el valor', 'facturas sin el valor')}`);
  if (!baselineOk) bMissing.push(input.baselineMonths ? `línea base: el periodo base tiene ${input.baselineMonths} meses y se necesitan 12` : 'línea base: se calcula con 12 meses de facturas');
  rows.push({
    id: 'b',
    reference: 'Art. 4, aspecto (b)',
    title: 'Caracterización del uso de la energía',
    requirement: 'Usos de la energía que ocasionan un consumo sustancial, históricos de consumo, costos asociados y definición de la línea base.',
    status: statusOf([usesOk, historyOk, costsOk, baselineOk].filter(Boolean).length, 4),
    evidence: [usesOk ? `${plural(input.significantUses, 'uso significativo', 'usos significativos')}` : '', input.billMonths ? `${plural(input.billMonths, 'factura', 'facturas')}` : '', baselineOk ? 'línea base calculada' : ''].filter(Boolean).join(' · ') || 'Sin datos registrados',
    missing: bMissing,
    parts: ['energia', 'balance', 'linea-base'],
  });

  // (c) Sistemas y equipos de consumo final
  const cMissing: string[] = [];
  if (!input.equipmentCount) cMissing.push('el censo de carga con los equipos de consumo final');
  else if (input.censusDeviation !== null && Math.abs(input.censusDeviation) > 0.1) cMissing.push(`el censo difiere ${pct(input.censusDeviation)} del consumo facturado: revisar horas de uso, factores de uso y equipos sin registrar`);
  rows.push({
    id: 'c',
    reference: 'Art. 4, aspecto (c)',
    title: 'Caracterización de los sistemas y equipos de consumo final',
    requirement: 'Sistemas y equipos que consumen la energía, con su potencia, cantidad y uso.',
    status: !input.equipmentCount ? 'pendiente' : cMissing.length ? 'parcial' : 'cumple',
    evidence: input.equipmentCount ? `${plural(input.equipmentCount, 'equipo registrado', 'equipos registrados')}${input.censusDeviation !== null ? `; el censo difiere ${pct(input.censusDeviation)} del consumo facturado` : ''}` : 'Sin equipos registrados',
    missing: cMissing,
    parts: ['sistemas'],
  });

  // (d) Potencial de ahorro
  const fnceAddressed = input.fnce.excluded || input.fnce.quantified;
  const dMissing: string[] = [];
  if (!input.measures.total) dMissing.push('medidas de buenas prácticas, cambio tecnológico o sustitución de energéticos');
  if (!fnceAddressed) dMissing.push('FNCER: falta el área de cubierta o las horas solares pico para el potencial, o excluirlas con una justificación');
  rows.push({
    id: 'd',
    reference: 'Art. 4, aspecto (d)',
    title: 'Potencial de ahorro en el uso de la energía',
    requirement: 'Potencial derivado de buenas prácticas de operación, cambio tecnológico, sustitución de energéticos y uso de fuentes no convencionales de energía.',
    status: statusOf([input.measures.total > 0, fnceAddressed].filter(Boolean).length, 2),
    evidence: `${input.measures.total ? plural(input.measures.total, 'medida evaluada', 'medidas evaluadas') : 'Sin medidas'}; FNCER ${input.fnce.excluded ? 'excluidas con justificación' : input.fnce.quantified ? 'con su potencial de referencia' : 'sin decidir'}`,
    missing: dMissing,
    parts: ['alcance', 'oportunidades'],
  });

  // (e) Evaluación de las oportunidades de mejora
  const eMissing = input.measures.total && input.measures.evaluated < input.measures.total ? [`${plural(input.measures.total - input.measures.evaluated, 'medida sin', 'medidas sin')} ahorro o inversión para evaluarla`] : [];
  rows.push({
    id: 'e',
    reference: 'Art. 4, aspecto (e)',
    title: 'Evaluación de las oportunidades de mejora en eficiencia energética',
    requirement: 'Evaluación económica de cada medida: ahorro, inversión, retorno, valor presente neto y tasa interna de retorno.',
    status: !input.measures.total ? 'pendiente' : eMissing.length ? 'parcial' : 'cumple',
    evidence: input.measures.total ? `${input.measures.evaluated} de ${input.measures.total} medidas con ahorro e inversión` : 'Sin medidas',
    missing: input.measures.total ? eMissing : ['las medidas de ahorro con su evaluación económica'],
    parts: ['oportunidades'],
  });

  // (f) Indicadores de desempeño y propuesta de seguimiento
  const fMissing: string[] = [];
  if (!input.indicators) fMissing.push('indicadores: necesitan el consumo de 12 meses y el área construida o los usuarios');
  if (!input.hasManager) fMissing.push('quién hace el seguimiento: el gestor energético del PGEE');
  rows.push({
    id: 'f',
    reference: 'Art. 4, aspecto (f)',
    title: 'Indicadores de desempeño energético y propuesta de seguimiento',
    requirement: 'Definición de los indicadores de desempeño energético y propuesta de evaluación y seguimiento.',
    status: statusOf([input.indicators, input.hasManager].filter(Boolean).length, 2),
    evidence: `${input.indicators ? 'Indicadores calculados' : 'Sin indicadores'}; ${input.hasManager ? 'responsable del seguimiento designado' : 'sin responsable del seguimiento'}`,
    missing: fMissing,
    parts: ['linea-base'],
  });

  // (g) Priorización de las medidas
  const gMissing = input.measures.total && input.measures.prioritized < input.measures.total ? [`${plural(input.measures.total - input.measures.prioritized, 'medida sin', 'medidas sin')} prioridad fijada por el auditor (el informe sugiere una por el retorno)`] : [];
  rows.push({
    id: 'g',
    reference: 'Art. 4, aspecto (g)',
    title: 'Priorización de medidas de mejora en eficiencia energética',
    requirement: 'Orden de las medidas con criterios explícitos: ahorro, inversión, retorno, riesgo y alcance.',
    status: !input.measures.total ? 'pendiente' : gMissing.length ? 'parcial' : 'cumple',
    evidence: input.measures.total ? `${input.measures.prioritized} de ${input.measures.total} medidas con prioridad fijada` : 'Sin medidas',
    missing: input.measures.total ? gMissing : ['las medidas de ahorro para priorizarlas'],
    parts: ['oportunidades'],
  });

  // Parágrafo 2: línea base y ahorro con la Res. UPME 016 de 2024
  const months = input.baselineMonths;
  rows.push({
    id: 'par2',
    reference: 'Art. 4, parágrafo 2',
    title: 'Línea base y ahorro estimado con la metodología de la Res. UPME 016 de 2024',
    requirement: 'La línea base de consumo y el ahorro estimado se determinan con la metodología de la UPME.',
    status: months === null ? 'pendiente' : months >= 12 ? 'cumple' : 'parcial',
    evidence: months === null ? 'Sin línea base' : `Periodo base de ${months} meses${months >= 12 && months < 36 ? '; la resolución recomienda tres años o justificar el periodo' : ''}`,
    missing: months === null ? ['la línea base: se calcula con 12 meses de facturas'] : months < 12 ? [`el periodo base tiene ${months} meses y se necesitan 12`] : [],
    parts: ['linea-base'],
  });

  // Parágrafo 3: PGEE con ruta anual y responsable
  rows.push({
    id: 'par3',
    reference: 'Art. 4, parágrafo 3',
    title: 'PGEE con ruta de cumplimiento anual y responsable del seguimiento',
    requirement: 'A partir de la auditoría, la entidad define un PGEE con una ruta anual de ahorro y un responsable de su seguimiento y evaluación.',
    ...fromGroup(input.pgee),
    parts: ['pgee'],
  });

  // Art. 6: el auditor
  rows.push({
    id: 'art6',
    reference: 'Art. 6',
    title: 'Auditor con formación y experiencia',
    requirement: 'Diploma o certificación en gestión de la energía o auditorías y experiencia en al menos una auditoría certificada por un tercero.',
    ...fromGroup(input.auditor),
    parts: ['anexo-auditor'],
  });

  return rows;
}

export interface Art4Counts {
  cumple: number;
  parcial: number;
  pendiente: number;
  total: number;
}

export function art4Counts(rows: readonly Art4Row[]): Art4Counts {
  const counts: Art4Counts = { cumple: 0, parcial: 0, pendiente: 0, total: rows.length };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}
