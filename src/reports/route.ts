import { planRoute, type RoutePlan } from '@/domain/route';
import type { Measure, Pgee, Task } from '@/domain/types';
import type { AuditModel } from './model';

/**
 * Meta legal y ruta anual del PGEE para los documentos y las exportaciones: el mismo cálculo de la pantalla del PGEE y del inicio del
 * proyecto, con el consumo de referencia del modelo del informe.
 */
export function reportRoute(m: AuditModel, input: { pgee?: Pgee; measures: readonly Measure[]; tasks?: readonly Task[] }): RoutePlan {
  return planRoute({
    stored: input.pgee,
    auditDate: m.data.project.audit?.date,
    lastPeriod: m.data.bills.at(-1)?.period,
    today: m.data.generatedAt,
    measures: input.measures,
    tasks: input.tasks ?? [],
    referenceKwh: m.referenceKwh,
  });
}
