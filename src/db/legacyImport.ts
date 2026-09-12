import type {
  Area,
  Bill,
  Condition,
  DataType,
  EndUseCategory,
  Equipment,
  Measurement,
  Pgee,
  Photo,
  PhotoKind,
  Project,
  Task,
  TaskStatus,
} from '@/domain/types';
import type { PontiaDb } from './schema';

/** Clave con la que PONTIA 1.6 guardaba todo en el navegador. */
export const LEGACY_STORAGE_KEY = 'pontia_v1_offline';

/** Forma de los datos de PONTIA 1.6 (index.html de la versión anterior). */
export interface LegacyData {
  project?: { name?: string; institution?: string; city?: string; area?: number; users?: number; hours?: string };
  areas?: { n?: string; m?: number; p?: number; h?: number; o?: string }[];
  equipment?: { n?: string; p?: number; c?: number; h?: number; days?: number; s?: string }[];
  measurements?: { v?: number; a?: number; k?: number; f?: number; date?: string; type?: string }[];
  bills?: { m?: string; k?: number; c?: number; r?: number }[];
  pgee?: { goal?: string; target?: number; action?: string; owner?: string; date?: string; state?: string }[];
  photos?: { equipmentIndex?: number; code?: string; area?: string; type?: string; caption?: string; data?: string; date?: string }[];
}

export interface ImportedProject {
  project: Project;
  areas: Area[];
  equipment: Equipment[];
  measurements: Measurement[];
  bills: Bill[];
  tasks: Task[];
  pgee: Pgee;
  photos: Photo[];
  /** Situaciones que el auditor debe revisar después de importar. */
  warnings: string[];
}

const CATEGORY_KEYWORDS: [EndUseCategory, RegExp][] = [
  ['climatizacion', /aire|split|climatiz|ventilador|chiller|fan ?coil/i],
  ['iluminacion', /l[aá]mpara|luminaria|bombillo|foco|tubo|reflector|panel led|\bled\b|fluorescente/i],
  ['refrigeracion', /nevera|refrigerador|congelador|enfriador|dispensador|vitrina/i],
  ['cocina', /estufa|horno|greca|cafetera|microondas|freidora|parrilla/i],
  ['ti', /computador|\bpc\b|port[aá]til|impresora|proyector|servidor|monitor|televisor|fotocopiadora|router/i],
  ['motores', /bomba|motor|compresor|ascensor|extractor/i],
];

/** Sugiere el uso final a partir del nombre del equipo; el auditor puede corregirlo. */
export function guessCategory(name: string): EndUseCategory {
  for (const [category, pattern] of CATEGORY_KEYWORDS) if (pattern.test(name)) return category;
  return 'otros';
}

const CONDITION: Record<string, Condition> = { bueno: 'bueno', regular: 'regular', deficiente: 'deficiente' };
const DATA_TYPE: Record<string, DataType> = { medido: 'medido', calculado: 'calculado', estimado: 'estimado', ingresado: 'ingresado' };
const TASK_STATUS: Record<string, TaskStatus> = { pendiente: 'pendiente', 'en ejecución': 'en-ejecucion', implementada: 'implementada' };
const PHOTO_KIND: Record<string, PhotoKind> = {
  'placa de características': 'placa',
  'vista general': 'vista-general',
  instalación: 'instalacion',
  'estado físico': 'estado-fisico',
};
const key = (text: string | undefined): string => (text ?? '').trim().toLowerCase();

/** Convierte una imagen `data:` (como la guardaba la 1.6) en un Blob. */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const [, mime = 'application/octet-stream', isBase64, payload = ''] = match;
  try {
    const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
    return new Blob([Uint8Array.from(binary, (ch) => ch.charCodeAt(0))], { type: mime });
  } catch {
    return null;
  }
}

/** Lee fechas como «5/9/2026, 10:42:13 a. m.» (formato colombiano de la 1.6). */
function parseLegacyDate(text: string | undefined): Date | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?/i.exec(text ?? '');
  if (!m) return null;
  let hour = Number(m[4]);
  if (m[7]) {
    const pm = m[7].toLowerCase() === 'p';
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), hour, Number(m[5]), Number(m[6] ?? 0));
}

export function mapLegacyData(
  data: LegacyData,
  { now = Date.now(), newId = () => crypto.randomUUID() }: { now?: number; newId?: () => string } = {},
): ImportedProject {
  const warnings: string[] = [];
  const projectId = newId();
  const stamp = () => ({ id: newId(), projectId, createdAt: now, updatedAt: now });

  const bills: Bill[] = (data.bills ?? [])
    .filter((b) => b.m)
    .map((b) => ({ ...stamp(), period: String(b.m), kwh: b.k ?? 0, costCop: b.c ?? 0, tariffCopPerKwh: b.r || undefined }));
  const tariffs = bills.filter((b) => b.kwh > 0 && b.costCop > 0).map((b) => b.costCop / b.kwh);

  const p = data.project ?? {};
  const project: Project = {
    id: projectId,
    createdAt: now,
    updatedAt: now,
    name: p.name?.trim() || 'Proyecto importado de PONTIA 1.6',
    client: p.institution?.trim() || undefined,
    city: p.city?.trim() || undefined,
    areaM2: p.area || undefined,
    users: p.users || undefined,
    operatingHours: p.hours?.trim() || undefined,
    calendar: { daysPerWeek: 5, holidays: [], vacationDaysPerYear: 0 },
    economics: {
      tariffCopPerKwh: tariffs.length ? tariffs.reduce((a, b) => a + b, 0) / tariffs.length : 0,
      discountRate: 0.12,
      tariffEscalation: 0,
      horizonYears: 10,
      emissionFactorKgPerKwh: 0,
    },
  };

  const areas: Area[] = (data.areas ?? []).map((a) => ({
    ...stamp(),
    name: a.n?.trim() || 'Área sin nombre',
    areaM2: a.m || undefined,
    occupants: a.p || undefined,
    hoursPerDay: a.h || undefined,
    notes: a.o?.trim() || undefined,
  }));

  const equipment: Equipment[] = (data.equipment ?? []).map((e) => {
    const name = e.n?.trim() || 'Equipo sin nombre';
    return {
      ...stamp(),
      name,
      category: guessCategory(name),
      powerKw: e.p ?? 0,
      quantity: e.c || 1,
      hoursPerDay: e.h ?? 0,
      operatingDaysPerMonth: e.days || 22,
      useFactor: 1,
      condition: CONDITION[key(e.s)] ?? 'bueno',
    };
  });

  const measurements: Measurement[] = (data.measurements ?? []).map((m) => ({
    ...stamp(),
    takenAt: m.date || new Date(now).toISOString().slice(0, 16),
    pointType: 'general',
    voltageV: m.v ? [m.v] : undefined,
    currentA: m.a ? [m.a] : undefined,
    kw: m.k || undefined,
    pf: m.f || undefined,
    dataType: DATA_TYPE[key(m.type)] ?? 'ingresado',
  }));

  const objectives = new Map<string, number | undefined>();
  const tasks: Task[] = (data.pgee ?? [])
    .filter((g) => g.action?.trim())
    .map((g) => {
      if (g.goal?.trim()) objectives.set(g.goal.trim(), g.target || undefined);
      const status = TASK_STATUS[key(g.state)] ?? 'pendiente';
      return {
        ...stamp(),
        name: String(g.action).trim(),
        phase: 'corto',
        responsible: g.owner?.trim() || undefined,
        end: g.date || undefined,
        status,
        progress: status === 'implementada' ? 100 : 0,
      };
    });
  const pgee: Pgee = {
    ...stamp(),
    team: [],
    objectives: [...objectives].map(([description, targetPercent]) => ({ description, targetPercent })),
  };

  const photos: Photo[] = [];
  (data.photos ?? []).forEach((photo, i) => {
    const blob = photo.data ? dataUrlToBlob(photo.data) : null;
    if (!blob) {
      warnings.push(`La foto ${i + 1} no tiene una imagen válida y no se importó.`);
      return;
    }
    const owner = photo.equipmentIndex === undefined ? undefined : equipment[photo.equipmentIndex];
    if (!owner) warnings.push(`La foto ${i + 1} apuntaba a un equipo que ya no existe; quedó asociada al proyecto.`);
    photos.push({
      ...stamp(),
      entityType: owner ? 'equipo' : 'proyecto',
      entityId: owner?.id,
      kind: PHOTO_KIND[key(photo.type)] ?? 'otra',
      code: photo.code?.trim() || undefined,
      caption: [photo.caption?.trim(), photo.area?.trim()].filter(Boolean).join(' · ') || undefined,
      takenAt: (parseLegacyDate(photo.date) ?? new Date(now)).toISOString(),
      blob,
    });
  });

  return { project, areas, equipment, measurements, bills, tasks, pgee, photos, warnings };
}

/** Lee lo que PONTIA 1.6 dejó guardado en el navegador, si existe. */
export function readLegacyLocalStorage(storage: Pick<Storage, 'getItem'>): LegacyData | null {
  const raw = storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LegacyData) : null;
  } catch {
    return null;
  }
}

/** Importa los datos de la 1.6 como un proyecto nuevo, en una sola transacción. */
export async function importLegacyIntoDb(db: PontiaDb, data: LegacyData): Promise<ImportedProject> {
  const imported = mapLegacyData(data);
  await db.transaction('rw', [db.projects, db.areas, db.equipment, db.measurements, db.bills, db.tasks, db.pgee, db.photos], async () => {
    await db.projects.add(imported.project);
    await db.areas.bulkAdd(imported.areas);
    await db.equipment.bulkAdd(imported.equipment);
    await db.measurements.bulkAdd(imported.measurements);
    await db.bills.bulkAdd(imported.bills);
    await db.tasks.bulkAdd(imported.tasks);
    await db.pgee.add(imported.pgee);
    await db.photos.bulkAdd(imported.photos);
  });
  return imported;
}
