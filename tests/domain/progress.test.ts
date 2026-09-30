import { describe, expect, it } from 'vitest';
import { computeProgress, currentStage, type ProjectCounts } from '@/domain/progress';

const vacio: ProjectCounts = {
  hasGeneralData: false,
  areas: 0,
  areasWithDimensions: 0,
  equipment: 0,
  electrical: 0,
  measurements: 0,
  bills: 0,
  intervalSeries: 0,
  findings: 0,
  measures: 0,
  pgeeObjectives: 0,
  tasks: 0,
  reports: 0,
  collectionResolved: false,
  safetyDone: false,
};

describe('avance de la auditoría', () => {
  it('un proyecto nuevo empieza en el levantamiento', () => {
    const avance = computeProgress(vacio);
    expect(avance.map((s) => s.done)).toEqual([0, 0, 0, 0]);
    expect(currentStage(avance)?.id).toBe('campo');
  });

  it('cuenta los pasos cumplidos de cada etapa', () => {
    const avance = computeProgress({ ...vacio, hasGeneralData: true, areas: 7, areasWithDimensions: 7, equipment: 14, measurements: 3, bills: 24 });
    const [campo, analisis] = avance;
    expect(campo.done).toBe(5);
    expect(campo.total).toBe(7);
    expect(campo.ratio).toBeCloseTo(5 / 7, 10);
    expect(campo.steps.find((s) => s.id === 'electrico')?.done).toBe(false);
    expect(analisis.done).toBe(3);
    expect(currentStage(avance)?.id).toBe('campo');
  });

  it('el control de recolección cuenta cuando todos los renglones están obtenidos o declarados no disponibles', () => {
    const paso = (resuelto: boolean) => computeProgress({ ...vacio, collectionResolved: resuelto })[0].steps.find((s) => s.id === 'control')?.done;
    expect(paso(false)).toBe(false);
    expect(paso(true)).toBe(true);
  });

  it('la seguridad eléctrica cuenta con hallazgos registrados o con la revisión sin hallazgos', () => {
    const paso = (hecho: boolean) => computeProgress({ ...vacio, safetyDone: hecho })[2].steps.find((s) => s.id === 'seguridad')?.done;
    expect(paso(false)).toBe(false);
    expect(paso(true)).toBe(true);
    expect(computeProgress(vacio)[2].total).toBe(5);
  });

  it('la facturación cuenta cuando hay al menos un año de facturas', () => {
    expect(computeProgress({ ...vacio, bills: 11 })[0].steps.find((s) => s.id === 'facturacion')?.done).toBe(false);
    expect(computeProgress({ ...vacio, bills: 12 })[0].steps.find((s) => s.id === 'facturacion')?.done).toBe(true);
  });
});
