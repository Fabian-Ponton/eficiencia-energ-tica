/** Datos del proyecto que definen si un paso de la auditoría está cumplido. */
export interface ProjectCounts {
  hasGeneralData: boolean;
  areas: number;
  areasWithDimensions: number;
  equipment: number;
  electrical: number;
  measurements: number;
  bills: number;
  intervalSeries: number;
  findings: number;
  measures: number;
  pgeeObjectives: number;
  tasks: number;
  reports: number;
}

export type StageId = 'campo' | 'analisis' | 'plan' | 'informes';

export interface StageProgress {
  id: StageId;
  done: number;
  total: number;
  ratio: number;
  steps: { id: string; done: boolean }[];
}

const stage = (id: StageId, steps: [string, boolean][]): StageProgress => {
  const done = steps.filter(([, ok]) => ok).length;
  return { id, done, total: steps.length, ratio: done / steps.length, steps: steps.map(([step, ok]) => ({ id: step, done: ok })) };
};

/** Avance real de cada etapa según los datos que ya tiene el proyecto. */
export function computeProgress(c: ProjectCounts): StageProgress[] {
  return [
    stage('campo', [
      ['datos', c.hasGeneralData],
      ['areas', c.areas > 0],
      ['inventario', c.equipment > 0],
      ['electrico', c.electrical > 0],
      ['mediciones', c.measurements > 0],
      ['facturacion', c.bills >= 12],
    ]),
    stage('analisis', [
      ['comportamiento', c.bills >= 12 || c.intervalSeries > 0],
      ['balance', c.equipment > 0 && c.bills > 0],
      ['dimensionamiento', c.areasWithDimensions > 0],
    ]),
    stage('plan', [
      ['diagnostico', c.findings > 0],
      ['oportunidades', c.measures > 0],
      ['pgee', c.pgeeObjectives > 0],
      ['implementacion', c.tasks > 0],
    ]),
    stage('informes', [['informes', c.reports > 0]]),
  ];
}

/** Etapa en curso: la primera que no está completa. */
export const currentStage = (progress: readonly StageProgress[]): StageProgress | undefined =>
  progress.find((s) => s.done < s.total);
