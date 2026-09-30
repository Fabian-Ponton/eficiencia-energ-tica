import type { FormatId } from '@/reports/formats';
import type { Area, Bill, CollectionItem, ElectricalNode, Equipment, Finding, MaintenanceRecord, Measure, Measurement, OccupancyRecord, Project } from '@/domain/types';
import { generatedEquipmentCode } from '@/domain/codes';
import { norm } from './formatsCells';

/**
 * Plan de la carga de los formatos de Excel: qué se crearía y qué se actualizaría, con los avisos de cada fila. Nada se
 * escribe en la base hasta que el auditor revisa el plan y lo aplica.
 */

export interface Issue {
  /** Fila de la hoja de Excel. */
  row: number;
  text: string;
}

export type PlanTable = 'areas' | 'equipment' | 'occupancy' | 'measurements' | 'bills' | 'maintenance' | 'findings' | 'measures' | 'collection';

export type PlanRecord = { id: string; projectId: string; createdAt?: number } & Record<string, unknown>;

export type Op = { kind: 'project'; changes: Partial<Project> } | { kind: 'record'; table: PlanTable; action: 'crear' | 'actualizar'; record: PlanRecord };

export interface SheetPlan {
  id: FormatId;
  name: string;
  /** El libro trae esta hoja. */
  found: boolean;
  /** Filas con datos que se leyeron. */
  rows: number;
  creates: number;
  updates: number;
  /** Filas que ya estaban igual en la app. */
  unchanged: number;
  /** Filas que no se pudieron cargar (ver `errors`) o que solo traían «N/D». */
  skipped: number;
  /** Celdas con «N/D». */
  nd: number;
  warnings: Issue[];
  errors: Issue[];
  ops: Op[];
}

export const emptySheetPlan = (id: FormatId, name: string, found = false): SheetPlan => ({ id, name, found, rows: 0, creates: 0, updates: 0, unchanged: 0, skipped: 0, nd: 0, warnings: [], errors: [], ops: [] });

/** Lo que ya hay en el proyecto, más lo que el mismo libro va creando: las hojas posteriores enlazan con lo de las anteriores. */
export interface Working {
  project: Project;
  areas: Area[];
  equipment: Equipment[];
  nodes: ElectricalNode[];
  bills: Bill[];
  occupancy: OccupancyRecord[];
  measurements: Measurement[];
  maintenance: MaintenanceRecord[];
  findings: Finding[];
  measures: Measure[];
  collection: CollectionItem[];
  /** Identificadores de lo que ya existía antes de la carga: solo esos se reconocen por el nombre. */
  existingIds: Set<string>;
  /** Lo que el libro no toca pero cuenta para el estado automático del control: lecturas y series del medidor, y fotos. */
  fixedCounts: { measurementRecords: number; photos: number };
  term: string;
  /** Días de operación al mes por omisión de los equipos nuevos. */
  daysPerMonth: number;
}

const same = (a: unknown, b: unknown): boolean => (a === b ? true : typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));

/** Quita los campos sin valor: una celda vacía o «N/D» nunca borra lo que la app ya tiene. */
export function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const words = (text: string) => norm(text).replace(/[^a-z0-9]+/g, ' ').trim();

/** Busca por código o por nombre, sin distinguir tildes ni mayúsculas. También entiende «Piso 2 / Laboratorio de química». */
function findByKey<T>(list: readonly T[], text: string | undefined, keys: (item: T) => (string | undefined)[]): T | undefined {
  const wanted = norm(text);
  if (!wanted) return undefined;
  const exact = list.find((item) => keys(item).some((k) => norm(k) === wanted));
  if (exact) return exact;
  const parts = String(text).split(/\s*[/·|]\s*|\s+-\s+/).map(norm).filter(Boolean);
  const last = parts[parts.length - 1];
  if (parts.length > 1 && last) return list.find((item) => keys(item).some((k) => norm(k) === last));
  const compact = words(String(text));
  const loose = list.filter((item) => keys(item).some((k) => k && words(k) === compact));
  return loose.length === 1 ? loose[0] : undefined;
}

export const findArea = (work: Working, text: string | undefined) => findByKey(work.areas, text, (a) => [a.code, a.name]);
export const findNode = (work: Working, text: string | undefined) => findByKey(work.nodes, text, (n) => [n.name]);

/** Un equipo por su código; también sirve el que PONTIA generó al exportar (EQ- y seis caracteres del identificador interno). */
export function findEquipmentByCode(work: Working, code: string | undefined): Equipment | undefined {
  const c = norm(code);
  if (!c) return undefined;
  const byCode = work.equipment.find((e) => norm(e.code) === c);
  if (byCode) return byCode;
  const generated = /^eq-([0-9a-f]{6})$/.exec(c);
  return generated ? work.equipment.find((e) => e.id.toLowerCase().startsWith(generated[1])) : undefined;
}

/** Un equipo por su nombre, si hay uno solo con ese nombre (y en ese espacio, si se da). */
export function findEquipmentByName(work: Working, name: string | undefined, areaId?: string, only?: (e: Equipment) => boolean): Equipment | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const same = work.equipment.filter((e) => norm(e.name) === n && (areaId === undefined || e.areaId === areaId) && (!only || only(e)));
  return same.length === 1 ? same[0] : undefined;
}

/**
 * El equipo que corresponde a una fila de inventario. Con código, solo se reconoce por él: un código nuevo es un equipo nuevo.
 * Sin código, por el nombre y el espacio, pero solo entre los que ya existían y si es uno solo: así dos filas iguales no se funden.
 */
export function findEquipment(work: Working, code: string | undefined, name?: string, areaId?: string): Equipment | undefined {
  if (norm(code)) return findEquipmentByCode(work, code);
  return findEquipmentByName(work, name, areaId, (e) => work.existingIds.has(e.id));
}

/**
 * Equipo nombrado por su código o, si no coincide, por su nombre (mantenimiento, mediciones y hallazgos). También entiende
 * «CÓDIGO · Nombre», que es como PONTIA rotula el equipo medido: el código distingue a los que comparten nombre.
 */
export function findEquipmentByAnyKey(work: Working, key: string | undefined, areaId?: string): Equipment | undefined {
  const whole = findEquipmentByCode(work, key) ?? findEquipmentByName(work, key, areaId) ?? findEquipmentByName(work, key);
  if (whole) return whole;
  const [code, ...rest] = String(key ?? '').split(' · ');
  if (!rest.length) return undefined;
  const name = rest.join(' · ');
  return findEquipmentByCode(work, code) ?? findEquipmentByName(work, name, areaId) ?? findEquipmentByName(work, name);
}

export { generatedEquipmentCode };

/** Ayuda para armar el plan de una hoja: cuenta lo que se crea, se actualiza o se avisa. */
export class SheetBuilder {
  constructor(
    readonly plan: SheetPlan,
    readonly work: Working,
  ) {}

  warn(row: number, text: string) {
    this.plan.warnings.push({ row, text });
  }

  error(row: number, text: string) {
    this.plan.errors.push({ row, text });
    this.plan.skipped++;
  }

  /**
   * Crea o actualiza un registro. Solo se cambian los campos con valor. Devuelve el registro resultante para poder
   * enlazar con él las filas siguientes.
   */
  upsert<T extends { id: string }>(table: PlanTable, list: T[], existing: T | undefined, patch: Partial<T>, create: () => T): T {
    const values = definedOnly(patch);
    if (existing) {
      if (Object.entries(values).every(([k, v]) => same((existing as Record<string, unknown>)[k], v))) {
        this.plan.unchanged++;
        return existing;
      }
      const record = { ...existing, ...values } as T;
      list[list.indexOf(existing)] = record;
      this.plan.ops.push({ kind: 'record', table, action: 'actualizar', record: record as unknown as PlanRecord });
      this.plan.updates++;
      return record;
    }
    const record = { ...create(), ...values } as T;
    list.push(record);
    this.plan.ops.push({ kind: 'record', table, action: 'crear', record: record as unknown as PlanRecord });
    this.plan.creates++;
    return record;
  }

  project(changes: Partial<Project>) {
    if (!Object.keys(changes).length) return;
    Object.assign(this.work.project, changes);
    this.plan.ops.push({ kind: 'project', changes });
    this.plan.updates++;
  }
}
