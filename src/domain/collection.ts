import { characterization, groupStatus } from './compliance';
import type { Area, CollectionItem, CollectionStatus, Equipment, MaintenanceRecord, OccupancyRecord, Project } from './types';

/**
 * Control de recolección de la información (Formato 13): qué falta obtener para poder auditar. Cada renglón tiene un
 * estado automático que sale de los datos ya registrados y, si el auditor quiere, un estado manual: «obtenido» (los
 * planos, que PONTIA no guarda) o «no disponible» (la entidad no tiene el dato). Vale el más avanzado, salvo «no disponible».
 */

export interface CollectionDef {
  key: string;
  /** Como aparece en el Formato 13. */
  label: string;
  /** Qué se espera tener para darlo por obtenido. */
  hint: string;
  /** Pantalla donde se registra; sin ella, el renglón solo se marca a mano. */
  step?: string;
  /** Pestaña de esa pantalla, si la hay. */
  tab?: string;
}

/** Los doce renglones del Formato 13, en su orden. */
export const COLLECTION_ITEMS: readonly CollectionDef[] = [
  { key: 'general', label: 'Información general', hint: 'Los datos de la entidad y del edificio que pide el art. 4(a).', step: 'datos' },
  { key: 'planos', label: 'Planos/distribución', hint: 'Planos de planta o croquis de distribución. PONTIA no los guarda: marca el renglón cuando los tengas.' },
  { key: 'areas', label: 'Áreas por piso', hint: 'Todos los espacios con sus dimensiones.', step: 'areas' },
  { key: 'inventario', label: 'Inventario de equipos', hint: 'El censo de carga de los equipos.', step: 'inventario' },
  { key: 'aires', label: 'Caracterización de aires', hint: 'Cada aire con su capacidad (BTU/h).', step: 'inventario' },
  { key: 'iluminacion', label: 'Caracterización de iluminación', hint: 'Cada luminaria con su tecnología.', step: 'inventario' },
  { key: 'horarios', label: 'Horarios y ocupación', hint: 'El horario de uso de cada espacio.', step: 'areas', tab: 'ocupacion' },
  { key: 'mediciones', label: 'Mediciones eléctricas', hint: 'Mediciones puntuales, lecturas del medidor o archivos del analizador.', step: 'mediciones' },
  { key: 'facturas', label: 'Facturas/consumo histórico', hint: 'Doce meses de facturas de electricidad.', step: 'facturacion' },
  { key: 'mantenimiento', label: 'Mantenimiento', hint: 'El mantenimiento de cada equipo.', step: 'inventario', tab: 'mantenimiento' },
  { key: 'fotos', label: 'Registro fotográfico', hint: 'Fotos de espacios, placas y hallazgos, con autorización.' },
  { key: 'hallazgos', label: 'Hallazgos iniciales', hint: 'Los hallazgos de la primera visita.', step: 'diagnostico' },
];

export interface CollectionInput {
  project: Project;
  areas: readonly Area[];
  /** Equipos de todos los energéticos. */
  equipment: readonly Equipment[];
  occupancy: readonly OccupancyRecord[];
  maintenance: readonly MaintenanceRecord[];
  /** Facturas eléctricas vigentes. */
  electricBills: number;
  /** Mediciones puntuales, lecturas del medidor y series del analizador. */
  measurementRecords: number;
  photos: number;
  findings: number;
  /** Lo que el auditor anotó en cada renglón (responsable, fechas, estado manual…). */
  stored: readonly CollectionItem[];
}

export interface CollectionRow {
  key: string;
  label: string;
  hint: string;
  step?: string;
  tab?: string;
  /** Lo que dicen los datos. */
  auto: CollectionStatus;
  /** Lo que vale: el estado automático o el manual, el más avanzado; «no disponible» siempre gana. */
  status: CollectionStatus;
  /** Por qué: «12 de 12 facturas». */
  detail: string;
  stored?: CollectionItem;
  /** Renglón que agregó el auditor. */
  custom: boolean;
}

const ORDER: Record<CollectionStatus, number> = { pendiente: 0, 'en-curso': 1, obtenido: 2, 'no-disponible': 2 };

export const STATUS_LABEL: Record<CollectionStatus, string> = {
  pendiente: 'Pendiente',
  'en-curso': 'En curso',
  obtenido: 'Obtenido',
  'no-disponible': 'No disponible',
};

/** Obtenido o declarado no disponible: el renglón ya no espera nada. */
export const isResolved = (status: CollectionStatus): boolean => status === 'obtenido' || status === 'no-disponible';

const ratio = (done: number, total: number, unit: string, all: string): { status: CollectionStatus; detail: string } => {
  if (total === 0) return { status: 'pendiente', detail: `Sin ${unit} registrados` };
  if (done >= total) return { status: 'obtenido', detail: all };
  return { status: 'en-curso', detail: `${done} de ${total} ${unit}` };
};

/** Estado automático de un renglón, con la razón en una frase. */
export function autoStatus(key: string, input: CollectionInput): { status: CollectionStatus; detail: string } {
  const equipment = input.equipment;
  switch (key) {
    case 'general': {
      const group = groupStatus(characterization(input.project));
      if (group.complete) return { status: 'obtenido', detail: 'Datos del art. 4(a) completos' };
      return { status: group.done > 0 ? 'en-curso' : 'pendiente', detail: `${group.done} de ${group.total} datos del art. 4(a)` };
    }
    case 'areas': {
      const withDimensions = input.areas.filter((a) => (a.lengthM && a.widthM) || a.areaM2).length;
      return input.areas.length ? ratio(withDimensions, input.areas.length, 'espacios con dimensiones', `${input.areas.length} espacios con dimensiones`) : { status: 'pendiente', detail: 'Sin espacios registrados' };
    }
    case 'inventario':
      return equipment.length ? { status: 'obtenido', detail: `${equipment.length} ${equipment.length === 1 ? 'registro' : 'registros'} de equipos` } : { status: 'pendiente', detail: 'Sin equipos registrados' };
    case 'aires': {
      const aires = equipment.filter((e) => e.category === 'climatizacion');
      return aires.length ? ratio(aires.filter((e) => e.capacityBtuH).length, aires.length, 'aires con capacidad', `${aires.length} con capacidad`) : { status: 'pendiente', detail: 'Sin equipos de climatización' };
    }
    case 'iluminacion': {
      const luminarias = equipment.filter((e) => e.category === 'iluminacion');
      return luminarias.length
        ? ratio(luminarias.filter((e) => e.lampType || e.fixtureType).length, luminarias.length, 'luminarias con tecnología', `${luminarias.length} con tecnología`)
        : { status: 'pendiente', detail: 'Sin luminarias registradas' };
    }
    case 'horarios': {
      const covered = new Set(input.occupancy.filter((o) => !o.deletedAt).map((o) => o.areaId));
      const withSchedule = input.areas.filter((a) => covered.has(a.id)).length;
      return input.areas.length ? ratio(withSchedule, input.areas.length, 'espacios con horario', `${input.areas.length} espacios con horario`) : { status: 'pendiente', detail: 'Sin espacios registrados' };
    }
    case 'mediciones':
      return input.measurementRecords > 0 ? { status: 'obtenido', detail: `${input.measurementRecords} ${input.measurementRecords === 1 ? 'registro' : 'registros'}` } : { status: 'pendiente', detail: 'Sin mediciones ni lecturas' };
    case 'facturas': {
      if (input.electricBills >= 12) return { status: 'obtenido', detail: `${input.electricBills} facturas` };
      return input.electricBills > 0 ? { status: 'en-curso', detail: `${input.electricBills} de 12 facturas` } : { status: 'pendiente', detail: 'Sin facturas' };
    }
    case 'mantenimiento': {
      const registros = new Set(input.maintenance.filter((m) => !m.deletedAt).map((m) => m.equipmentId));
      const covered = equipment.filter((e) => registros.has(e.id)).length;
      return equipment.length ? ratio(covered, equipment.length, 'equipos con mantenimiento', `${equipment.length} equipos con mantenimiento`) : { status: 'pendiente', detail: 'Sin equipos registrados' };
    }
    case 'fotos':
      return input.photos > 0 ? { status: 'obtenido', detail: `${input.photos} ${input.photos === 1 ? 'foto' : 'fotos'}` } : { status: 'pendiente', detail: 'Sin fotos' };
    case 'hallazgos':
      return input.findings > 0 ? { status: 'obtenido', detail: `${input.findings} ${input.findings === 1 ? 'hallazgo' : 'hallazgos'}` } : { status: 'pendiente', detail: 'Sin hallazgos' };
    default:
      return { status: 'pendiente', detail: 'Se marca a mano' };
  }
}

/** Estado que vale: «no disponible» gana siempre; si no, el más avanzado entre lo automático y lo manual. */
export function effectiveStatus(auto: CollectionStatus, stored?: Pick<CollectionItem, 'status'>): CollectionStatus {
  if (stored?.status === 'no-disponible') return 'no-disponible';
  const manual = stored?.status ?? 'pendiente';
  return ORDER[auto] >= ORDER[manual] ? auto : manual;
}

/** Los doce renglones del Formato 13 más los que agregó el auditor. */
export function buildCollection(input: CollectionInput): CollectionRow[] {
  const stored = input.stored.filter((s) => !s.deletedAt);
  const byKey = new Map(stored.map((s) => [s.key, s]));
  const standard = COLLECTION_ITEMS.map((def): CollectionRow => {
    const { status: auto, detail } = autoStatus(def.key, input);
    const own = byKey.get(def.key);
    return { ...def, auto, status: effectiveStatus(auto, own), detail, stored: own, custom: false };
  });
  const custom = stored
    .filter((s) => !COLLECTION_ITEMS.some((d) => d.key === s.key))
    .map((s): CollectionRow => ({ key: s.key, label: s.label, hint: 'Renglón agregado por el auditor.', auto: 'pendiente', status: effectiveStatus('pendiente', s), detail: 'Se marca a mano', stored: s, custom: true }));
  return [...standard, ...custom];
}

/** La recolección está completa cuando cada renglón del Formato 13 está obtenido o declarado no disponible. */
export const collectionResolved = (rows: readonly CollectionRow[]): boolean => rows.filter((r) => !r.custom).every((r) => isResolved(r.status));

export interface CollectionSummary {
  resolved: number;
  total: number;
  unavailable: number;
  pending: CollectionRow[];
}

export function summarizeCollection(rows: readonly CollectionRow[]): CollectionSummary {
  const standard = rows.filter((r) => !r.custom);
  return {
    resolved: standard.filter((r) => isResolved(r.status)).length,
    total: standard.length,
    unavailable: standard.filter((r) => r.status === 'no-disponible').length,
    pending: standard.filter((r) => !isResolved(r.status)),
  };
}
