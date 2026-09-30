import type { Workbook, Worksheet } from 'exceljs';
import { hoursBetween, minutesOf, parseDays } from '@/domain/occupancy';
import { CARRIERS, carrierInfo, isElectric } from '@/domain/carriers';
import { AC_TYPES, CONDITIONS, END_USES, LAMP_TYPES, LIGHT_CONTROLS, SPACE_TYPES, daysPerMonth } from '@/domain/catalogs';
import { buildCollection, COLLECTION_ITEMS, STATUS_LABEL } from '@/domain/collection';
import { FREQUENCIES, MAINTENANCE_TYPES } from '@/domain/maintenance';
import { TENURES } from '@/domain/tenure';
import type { Area, Bill, CollectionItem, CollectionStatus, EndUseCategory, Equipment, Finding, MaintenanceRecord, Measure, Measurement, OccupancyRecord, Project, Severity } from '@/domain/types';
import { FORMAT_DEFS, FORMAT_ORDER, GENERAL_SHEET, HEADER_ROW, type FormatDef, type FormatId } from '@/reports/formats';
import type { ReportData } from '@/reports/model';
import { guessCategory } from './legacyImport';
import { cellText, isND, matchOption, norm, normHeader, parseDate, parseNumber, parsePeriod, parsePower, parseTime, parseYesNo, plainCell, type CellValue, type Option } from './formatsCells';
import { definedOnly, emptySheetPlan, findArea, findEquipment, findEquipmentByAnyKey, findNode, generatedEquipmentCode, SheetBuilder, type SheetPlan, type Working } from './formatsPlanner';
import { toRecord } from './records';
import type { PontiaDb } from './schema';

/**
 * Lectura de los formatos de Excel diligenciados. Primero se arma un plan (qué se crearía, qué se actualizaría y qué avisos
 * tiene cada fila) y solo después, con el visto bueno del auditor, se aplica. Una fila con error no detiene a las demás y una
 * celda vacía o «N/D» nunca borra un dato que la app ya tiene.
 */

export interface ImportPlan {
  sheets: SheetPlan[];
  /** Periodo académico con que se cargan los horarios. */
  term: string;
  totals: { creates: number; updates: number; unchanged: number; warnings: number; errors: number };
}

export interface PlanOptions {
  /** Periodo académico de los horarios; si no se da, se toma del libro o del semestre actual. */
  term?: string;
  now?: number;
}

// ——— Lectura del libro ———

const compact = (text: string) => norm(text).replace(/[^a-z0-9]+/g, '');
const withoutPrefix = (text: string) => compact(text).replace(/^\d{1,2}[a-z]?/, '');

function findSheet(workbook: Workbook, name: string): Worksheet | undefined {
  const exact = workbook.worksheets.find((s) => compact(s.name) === compact(name));
  if (exact) return exact;
  const suffix = withoutPrefix(name);
  return suffix.length > 3 ? workbook.worksheets.find((s) => withoutPrefix(s.name) === suffix) : undefined;
}

interface RowView {
  row: number;
  raw(header: string): CellValue;
  text(header: string): string | undefined;
  number(header: string): number | undefined;
  /** La fila no trae ningún dato, ni siquiera «N/D». */
  empty: boolean;
  /** Todas las celdas con dato dicen «N/D». */
  onlyND: boolean;
  nd: number;
}

function readRows(sheet: Worksheet, def: Pick<FormatDef, 'columns'>): { headerRow: number; rows: RowView[]; missing: string[] } | undefined {
  const expected = def.columns.map((c) => norm(c.header));
  let best = { row: 0, hits: 0, cols: new Map<string, number>(), base: new Map<string, number>() };
  for (let r = 1; r <= Math.min(20, sheet.rowCount); r++) {
    const cols = new Map<string, number>();
    const base = new Map<string, number>();
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => {
      const t = cellText(plainCell(cell.value));
      if (!t) return;
      if (!cols.has(norm(t))) cols.set(norm(t), c);
      if (!base.has(normHeader(t))) base.set(normHeader(t), c);
    });
    const hits = def.columns.filter((c, i) => cols.has(expected[i]) || base.has(normHeader(c.header))).length;
    if (hits > best.hits) best = { row: r, hits, cols, base };
  }
  if (best.hits < Math.max(2, Math.ceil(def.columns.length * 0.4))) return undefined;
  const column = (header: string) => best.cols.get(norm(header)) ?? best.base.get(normHeader(header));
  const missing = def.columns.filter((c) => !c.extension && column(c.header) === undefined).map((c) => c.header);
  const rows: RowView[] = [];
  const last = Math.min(sheet.rowCount, best.row + 5000);
  for (let r = best.row + 1; r <= last; r++) {
    const row = sheet.getRow(r);
    const values = new Map<number, CellValue>();
    let nd = 0;
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const v = plainCell(cell.value);
      if (v === undefined) return;
      values.set(c, v);
      if (isND(v)) nd++;
    });
    const raw = (header: string): CellValue => {
      const c = column(header);
      return c === undefined ? undefined : values.get(c);
    };
    rows.push({
      row: r,
      raw,
      text: (header) => cellText(raw(header)),
      number: (header) => parseNumber(raw(header)),
      empty: values.size === 0,
      onlyND: values.size > 0 && nd === values.size,
      nd,
    });
  }
  return { headerRow: best.row, rows: rows.filter((r) => !r.empty), missing };
}

// ——— Opciones de los catálogos ———

const CONDITION_OPTIONS: Option<Equipment['condition']>[] = CONDITIONS.map((c) => ({ id: c.id, label: c.label, aliases: c.id === 'regular' ? ['medio', 'aceptable'] : c.id === 'deficiente' ? ['malo', 'mal estado'] : c.id === 'bueno' ? ['buen estado'] : [] }));
const SPACE_OPTIONS: Option<string>[] = SPACE_TYPES.map((s) => ({ id: s.id, label: s.label }));
const LAMP_OPTIONS: Option<string>[] = LAMP_TYPES.map((l) => ({ id: l.id, label: l.label }));
const CONTROL_OPTIONS: Option<NonNullable<Equipment['lightControl']>>[] = LIGHT_CONTROLS.map((c) => ({ id: c.id, label: c.label, aliases: c.id === 'manual' ? ['interruptor', 'switch'] : c.id === 'sensor' ? ['presencia', 'sensor de movimiento'] : [] }));
const MAINTENANCE_OPTIONS: Option<MaintenanceRecord['type']>[] = MAINTENANCE_TYPES.map((t) => ({ id: t.id, label: t.label, aliases: t.id === 'ninguno' ? ['ninguno', 'no', 'sin mantenimiento'] : [] }));
const FREQUENCY_OPTIONS: Option<string>[] = FREQUENCIES.map((f) => ({ id: f.id, label: f.label }));
const SYSTEM_OPTIONS: Option<EndUseCategory | 'electrico' | 'envolvente'>[] = [
  ...END_USES.map((u) => ({ id: u.id, label: u.label })),
  { id: 'electrico' as const, label: 'Sistema eléctrico', aliases: ['electrico', 'eléctrico'] },
  { id: 'envolvente' as const, label: 'Envolvente' },
];
const SEVERITY_OPTIONS: Option<Severity>[] = [
  { id: 'critico', label: 'Crítica', aliases: ['critico', 'crítico'] },
  { id: 'alto', label: 'Alta', aliases: ['alto'] },
  { id: 'medio', label: 'Media', aliases: ['medio'] },
  { id: 'bajo', label: 'Baja', aliases: ['bajo'] },
];
const PRIORITY_OPTIONS: Option<NonNullable<Measure['priority']>>[] = [
  { id: 'alta', label: 'Alta', aliases: ['alto', 'critica', 'crítica'] },
  { id: 'media', label: 'Media', aliases: ['medio'] },
  { id: 'baja', label: 'Baja', aliases: ['bajo'] },
];
const CARRIER_OPTIONS: Option<NonNullable<Bill['carrier']>>[] = CARRIERS.filter((c) => c.id !== 'electricidad').map((c) => ({ id: c.id, label: c.label, aliases: c.id === 'gas-natural' ? ['gas', 'gn', 'gas natural'] : c.id === 'glp' ? ['gas licuado', 'propano', 'glp'] : [] }));
const UNIT_OPTIONS: Option<NonNullable<Bill['unit']>>[] = [
  { id: 'm3', label: 'm³', aliases: ['m3', 'metros cubicos', 'metro cubico'] },
  { id: 'kg', label: 'kg', aliases: ['kilos', 'kilogramos'] },
  { id: 'gal', label: 'gal', aliases: ['galon', 'galones', 'gl'] },
];
const STATUS_OPTIONS: Option<CollectionStatus>[] = [
  { id: 'pendiente', label: STATUS_LABEL.pendiente },
  { id: 'en-curso', label: STATUS_LABEL['en-curso'], aliases: ['en proceso', 'parcial'] },
  { id: 'obtenido', label: STATUS_LABEL.obtenido, aliases: ['recibido', 'completo', 'listo'] },
  { id: 'no-disponible', label: STATUS_LABEL['no-disponible'], aliases: ['n/d', 'no existe', 'no hay'] },
];
const TENURE_OPTIONS: Option<NonNullable<NonNullable<Project['building']>['tenure']>>[] = TENURES.map((t) => ({ id: t.id, label: t.label, aliases: t.id === 'propia' ? ['propio'] : t.id === 'arrendada' ? ['arriendo', 'alquiler', 'alquilada'] : t.id === 'comodato' ? ['en comodato'] : [] }));

/** Coincide con el nombre exacto y, si no, con la única opción que contenga el texto o esté contenida en él. */
function matchLoose<T>(value: CellValue, options: readonly Option<T>[]): T | undefined {
  const exact = matchOption(value, options);
  if (exact !== undefined) return exact;
  const text = norm(cellText(value));
  if (text.length < 4) return undefined;
  const partial = options.filter((o) => norm(o.label).includes(text) || text.includes(norm(o.label)));
  return partial.length === 1 ? partial[0].id : undefined;
}

/** «L-V», «lunes a viernes», «l,x»… deja la forma que usan los horarios. */
function normalizeDay(value: CellValue): string | undefined {
  const text = cellText(value);
  if (!text) return undefined;
  const t = norm(text);
  const names: Record<string, string> = { lunes: 'L', martes: 'M', miercoles: 'X', jueves: 'J', viernes: 'V', sabado: 'S', domingo: 'D' };
  const range = /^(\w+)\s*(?:a|-|–)\s*(\w+)$/.exec(t);
  if (range && names[range[1]] && names[range[2]]) return `${names[range[1]]}-${names[range[2]]}`;
  if (names[t]) return names[t];
  return parseDays(text).length ? text.toUpperCase().replace(/\s+/g, '') : undefined;
}

/** «209 / 211 / 208» → [209, 211, 208]; un solo número → [n]. */
function parsePhases(value: CellValue): (number | null)[] | undefined {
  if (value === undefined || isND(value)) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? [value] : undefined;
  if (typeof value !== 'string') return undefined;
  const parts = value.split(/[/;|]/).map((p) => p.trim());
  const values = parts.map((p) => (p === '' || /^[–—-]+$/.test(p) ? null : (parseNumber(p) ?? Number.NaN)));
  return values.some((v) => Number.isNaN(v)) || values.every((v) => v === null) ? undefined : (values as (number | null)[]);
}

// ——— Lectura de cada hoja ———

type Importer = (b: SheetBuilder, rows: RowView[]) => void;
const uuid = () => crypto.randomUUID();
const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

function ranged(b: SheetBuilder, r: RowView, header: string, min: number, max: number, label: string): number | undefined {
  const raw = r.raw(header);
  const value = parseNumber(raw);
  if (value === undefined) {
    if (raw !== undefined && !isND(raw)) b.warn(r.row, `«${label}» no es un número (${String(raw)}): se dejó sin valor.`);
    return undefined;
  }
  if (value < min || value > max) {
    b.warn(r.row, `«${label}» = ${value} está fuera de ${min}–${max}: se dejó sin valor.`);
    return undefined;
  }
  return value;
}

function powerOf(b: SheetBuilder, r: RowView, header: string, unitOfHeader?: 'W' | 'kW'): number | undefined {
  const power = parsePower(r.raw(header), unitOfHeader);
  if (power.problem === 'sin-unidad') b.warn(r.row, `Potencia «${power.raw}» sin unidad: anótala con W, kW o HP (por ejemplo «${power.raw} W»). Se cargó la fila sin potencia.`);
  else if (power.problem) b.warn(r.row, `Potencia «${power.raw}» no se entiende como número con unidad: se cargó la fila sin potencia.`);
  return power.kw;
}

const withArea = (b: SheetBuilder, r: RowView, header: string) => {
  const key = r.text(header);
  if (!key) return { key: undefined, area: undefined };
  const area = findArea(b.work, key);
  if (!area) b.warn(r.row, `El espacio «${key}» no está registrado: la fila quedó sin espacio. Cárgalo primero en la hoja 02_Areas.`);
  return { key, area };
};

const importGeneral = (b: SheetBuilder, sheet: Worksheet) => {
  let start = HEADER_ROW;
  for (let r = 1; r <= Math.min(15, sheet.rowCount); r++) {
    if (norm(cellText(plainCell(sheet.getCell(r, 1).value))) === 'campo') start = r;
  }
  const fields = new Map<string, CellValue>();
  for (let r = start + 1; r <= sheet.rowCount; r++) {
    const label = cellText(plainCell(sheet.getCell(r, 1).value));
    if (!label) continue;
    const value = plainCell(sheet.getCell(r, 2).value);
    if (value !== undefined && isND(value)) b.plan.nd++;
    if (value !== undefined) b.plan.rows++;
    fields.set(norm(label), value);
  }
  const get = (label: string) => fields.get(norm(label));
  const p = b.work.project;
  const changes: Partial<Project> = {};
  const set = <K extends keyof Project>(key: K, value: Project[K] | undefined) => {
    if (value !== undefined && JSON.stringify(p[key]) !== JSON.stringify(value)) changes[key] = value;
  };
  const survey = parseDate(get('Fecha de levantamiento'));
  if (get('Fecha de levantamiento') !== undefined && !isND(get('Fecha de levantamiento')) && !survey) b.warn(start + 1, 'La fecha de levantamiento no se entiende: se dejó como estaba.');
  set('surveyDate', survey);
  set('auditor', cellText(get('Responsable')));
  const block = cellText(get('Bloque'));
  if (block && !p.name.trim()) set('name', block);
  const siteName = cellText(get('Sede'));
  if (siteName) set('site', { ...p.site, name: siteName });
  set('address', cellText(get('Ubicación')));
  const floors = parseNumber(get('Número de pisos'));
  const builtYear = parseNumber(get('Año de construcción'));
  const activity = cellText(get('Proceso o actividad'));
  const surroundings = cellText(get('Entorno'));
  const tenure = matchLoose(get('Tenencia del edificio'), TENURE_OPTIONS);
  if (get('Tenencia del edificio') !== undefined && !isND(get('Tenencia del edificio')) && !tenure) b.warn(start + 1, `La tenencia «${String(get('Tenencia del edificio'))}» no está en la lista: se dejó como estaba.`);
  if (floors !== undefined || builtYear !== undefined || activity || surroundings || tenure) {
    set('building', definedOnly({ ...p.building, floors: floors === undefined ? undefined : Math.round(floors), builtYear: builtYear === undefined ? undefined : Math.round(builtYear), activity, surroundings, tenure }));
  }
  set('areaM2', parseNumber(get('Área construida aproximada (m²)')));
  set('operatingHours', cellText(get('Horario general')));
  const days = parseNumber(get('Días de operación/semana'));
  if (days !== undefined && days >= 1 && days <= 7) set('calendar', { ...p.calendar, daysPerWeek: Math.round(days) });
  const students = parseNumber(get('Estudiantes aproximados'));
  const staff = parseNumber(get('Funcionarios aproximados'));
  if (students !== undefined || staff !== undefined) set('population', definedOnly({ ...p.population, students, staff }));
  const contact = cellText(get('Responsable institucional'));
  if (contact) set('institutionalContact', { ...p.institutionalContact, name: contact });
  set('client', cellText(get('Entidad')));
  const kind = norm(cellText(get('Tipo de entidad')));
  if (kind.startsWith('publi')) set('entity', { ...p.entity, kind: 'publica' });
  else if (kind.startsWith('priv')) set('entity', { ...p.entity, kind: 'privada' });
  if (Object.keys(changes).length) b.project(changes);
  else if (b.plan.rows) b.plan.unchanged++;
};

const importAreas: Importer = (b, rows) => {
  for (const r of rows) {
    const code = r.text('ID Área');
    const name = r.text('Área/espacio');
    if (!code && !name) return b.error(r.row, 'Falta el nombre del espacio (columna «Área/espacio»).');
    const existing = findArea(b.work, code) ?? findArea(b.work, name);
    const typeCell = r.raw('Tipo de uso');
    const spaceType = matchLoose(typeCell, SPACE_OPTIONS);
    if (cellText(typeCell) && !spaceType) b.warn(r.row, `El tipo de uso «${cellText(typeCell)}» no está en la lista: se dejó sin tipo.`);
    const hours = /(\d+(?:[.,]\d+)?)\s*h/i.exec(r.text('Horario de uso') ?? '');
    const schedule = r.text('Horario de uso');
    if (schedule && !hours) b.warn(r.row, `El horario «${schedule}» no dice cuántas horas al día se usa (por ejemplo «10 h/día»): se dejó sin horas.`);
    const flatArea = existing?.lengthM && existing?.widthM ? undefined : r.number('Área aprox. (m²)');
    const occupants = r.number('Ocupación habitual');
    const floor = r.raw('Piso');
    b.upsert<Area>(
      'areas',
      b.work.areas,
      existing,
      {
        code,
        name,
        floor: floor === undefined || isND(floor) ? undefined : String(floor).trim(),
        spaceType,
        areaM2: flatArea,
        occupants: occupants === undefined ? undefined : Math.round(occupants),
        hoursPerDay: hours ? parseNumber(hours[1]) : undefined,
        notes: r.text('Observaciones'),
      },
      () => ({ id: uuid(), projectId: b.work.project.id, createdAt: Date.now(), updatedAt: Date.now(), name: name ?? code ?? 'Espacio' }),
    );
  }
};

type EquipmentKind = 'equipos' | 'aires' | 'iluminacion';

const importEquipment =
  (kind: EquipmentKind): Importer =>
  (b, rows) => {
    for (const r of rows) {
      const code = r.text('ID');
      const { area } = withArea(b, r, 'Piso/Área');
      const rawName = kind === 'equipos' ? r.text('Equipo') : r.text('Nombre del equipo');
      const typeText = kind === 'aires' ? r.text('Tipo') : kind === 'iluminacion' ? r.text('Tipo de luminaria') : undefined;
      const name = rawName ?? (kind === 'aires' ? `Aire acondicionado${typeText ? ` ${typeText.toLowerCase()}` : ''}${code ? ` ${code}` : ''}` : kind === 'iluminacion' ? `Luminaria${typeText ? ` ${typeText.toLowerCase()}` : ''}${code ? ` ${code}` : ''}` : undefined);
      if (!name && !code) {
        b.error(r.row, kind === 'equipos' ? 'Falta el nombre del equipo (columna «Equipo»).' : 'Falta el identificador de la fila (columna «ID»).');
        continue;
      }
      const existing = findEquipment(b.work, code, name, area?.id);
      const quantity = ranged(b, r, 'Cantidad', 1, 100000, 'Cantidad');

      let powerKw: number | undefined;
      if (kind === 'iluminacion') {
        powerKw = powerOf(b, r, 'Potencia/unidad (W)', 'W');
        const total = parsePower(r.raw('Potencia total (W)'), 'W').kw;
        if (powerKw === undefined && total !== undefined) powerKw = round(total / Math.max(1, Math.round(quantity ?? existing?.quantity ?? 1)), 6);
      } else powerKw = powerOf(b, r, 'Potencia (W/kW)');

      const hoursPerDay = ranged(b, r, 'Horas/día', 0, 24, 'Horas/día');
      const days = ranged(b, r, 'Días/mes', 0, 31, 'Días/mes');
      const condText = r.raw('Estado');
      const condition = matchLoose(condText, CONDITION_OPTIONS);
      if (cellText(condText) && !condition) b.warn(r.row, `El estado «${cellText(condText)}» no es Bueno, Regular ni Deficiente: se dejó como estaba.`);

      const patch: Partial<Equipment> = {
        // El código que PONTIA generó al exportar (EQ- y seis caracteres del identificador) no se guarda en un equipo que ya se reconoce por él
        code: existing && !existing.code && code && norm(code) === norm(generatedEquipmentCode(existing)) ? undefined : code,
        name: rawName,
        areaId: area?.id,
        brand: r.text('Marca'),
        model: r.text('Modelo'),
        quantity: quantity === undefined ? undefined : Math.round(quantity),
        powerKw,
        voltageV: kind === 'iluminacion' ? undefined : r.number('Voltaje (V)'),
        currentA: kind === 'equipos' ? r.number('Corriente (A)') : kind === 'aires' ? r.number('Corriente nominal (A)') : undefined,
        hoursPerDay,
        operatingDaysPerMonth: days === undefined ? undefined : Math.round(days),
        condition,
        notes: r.text('Observaciones'),
      };
      if (kind === 'equipos') patch.usageMode = r.text('Modo de uso');
      if (kind === 'aires') {
        patch.category = 'climatizacion';
        patch.acType = matchLoose(r.raw('Tipo'), AC_TYPES.map((t) => ({ id: t, label: t }))) ?? typeText;
        patch.capacityBtuH = r.number('Capacidad (BTU/h)');
        patch.eer = r.number('EER/SEER (si aparece)');
        patch.setpointC = r.number('Temp. configurada (°C)');
      }
      if (kind === 'iluminacion') {
        patch.category = 'iluminacion';
        patch.fixtureType = typeText;
        const tech = r.raw('Tecnología');
        patch.lampType = matchLoose(tech, LAMP_OPTIONS);
        if (cellText(tech) && !patch.lampType) b.warn(r.row, `La tecnología «${cellText(tech)}» no está en la lista: se dejó sin tecnología.`);
        const control = r.raw('Control');
        patch.lightControl = matchLoose(control, CONTROL_OPTIONS);
        if (cellText(control) && !patch.lightControl) b.warn(r.row, `El control «${cellText(control)}» no está en la lista: se dejó sin control.`);
      }
      const factor = ranged(b, r, 'Factor de uso (%)', 0, 100, 'Factor de uso');
      if (factor !== undefined) patch.useFactor = round(factor / 100, 4);
      if (kind === 'equipos') {
        const useCell = r.raw('Uso final');
        const use = matchLoose(useCell, SYSTEM_OPTIONS);
        if (use && use !== 'electrico' && use !== 'envolvente') patch.category = use;
        else if (cellText(useCell)) b.warn(r.row, `El uso final «${cellText(useCell)}» no está en la lista: se ${existing ? 'dejó el que tenía' : 'dedujo del nombre del equipo'}.`);
        if (!patch.category && !existing) patch.category = guessCategory(name ?? '');
      }
      if (!existing) {
        if (powerKw === undefined) b.warn(r.row, 'Equipo nuevo sin potencia: quedó en 0 kW y no suma consumo hasta que la completes.');
        if (hoursPerDay === undefined) b.warn(r.row, 'Equipo nuevo sin horas de uso al día: quedó en 0 h y no suma consumo hasta que las completes.');
      }
      b.upsert<Equipment>('equipment', b.work.equipment, existing, patch, () => ({
        id: uuid(),
        projectId: b.work.project.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        name: name ?? code ?? 'Equipo',
        category: 'otros',
        powerKw: 0,
        quantity: 1,
        hoursPerDay: 0,
        operatingDaysPerMonth: b.work.daysPerMonth,
        useFactor: 1,
        condition: 'bueno',
      }));
    }
  };

const importOccupancy: Importer = (b, rows) => {
  for (const r of rows) {
    const key = r.text('ID Área') ?? r.text('Piso/Área');
    const area = findArea(b.work, r.text('ID Área')) ?? findArea(b.work, r.text('Piso/Área'));
    if (!area) {
      b.error(r.row, `El espacio «${key ?? 'sin nombre'}» no está registrado. Cárgalo primero en la hoja 02_Areas.`);
      continue;
    }
    const dayCell = r.raw('Día');
    const day = normalizeDay(dayCell) ?? 'L-V';
    if (cellText(dayCell) && !normalizeDay(dayCell)) b.warn(r.row, `El día «${cellText(dayCell)}» no se entiende (usa L, M, X, J, V, S, D o L-V): se cargó como L-V.`);
    const start = parseTime(r.raw('Hora inicio'));
    const end = parseTime(r.raw('Hora fin'));
    const hours = r.number('Horas de uso') ?? hoursBetween(start, end);
    if (!start || !end || minutesOf(start) === null) {
      b.error(r.row, 'Faltan la hora de inicio o la de fin, o no se entienden (usa 07:00).');
      continue;
    }
    if (hours === null || hours === undefined || hours <= 0 || hours > 24) {
      b.error(r.row, 'Las horas de uso no se pudieron calcular.');
      continue;
    }
    const activity = r.text('Actividad') ?? 'Uso del espacio';
    const existing = b.work.occupancy.find((o) => o.areaId === area.id && o.term === b.work.term && o.day === day && o.start === start && o.end === end && norm(o.activity) === norm(activity));
    const occupants = r.number('Ocupación promedio');
    b.upsert<OccupancyRecord>(
      'occupancy',
      b.work.occupancy,
      existing,
      {
        activity,
        hours: round(hours, 2),
        avgOccupants: occupants === undefined ? undefined : Math.round(occupants),
        usesAc: parseYesNo(r.raw('Aire usado (Sí/No)')),
        usesLighting: parseYesNo(r.raw('Iluminación usada (Sí/No)')),
        notes: r.text('Observaciones'),
      },
      () => ({ id: uuid(), projectId: b.work.project.id, createdAt: Date.now(), updatedAt: Date.now(), areaId: area.id, term: b.work.term, activity, day, start, end, hours: round(hours, 2) }),
    );
  }
};

const importMeasurements: Importer = (b, rows) => {
  for (const r of rows) {
    const date = parseDate(r.raw('Fecha'));
    if (!date) {
      b.error(r.row, 'Falta la fecha de la medición o no se entiende (usa 15/03/2026).');
      continue;
    }
    const time = parseTime(r.raw('Hora')) ?? '00:00';
    const takenAt = `${date}T${time}`;
    const target = r.text('Equipo/circuito');
    const equipment = findEquipmentByAnyKey(b.work, target);
    const node = equipment ? undefined : findNode(b.work, target);
    const area = equipment || node ? undefined : findArea(b.work, target);
    const typeText = norm(r.text("Punto de medición"));
    const pointType: Measurement['pointType'] = equipment ? 'equipo' : node ? 'tablero' : area ? 'area' : 'general';
    const pointId = equipment?.id ?? node?.id ?? area?.id;
    const notes = [r.text('Observaciones'), target && !pointId ? `Punto: ${target}` : undefined, !target && cellText(r.raw('Punto de medición')) && typeText !== 'general' ? `Punto: ${r.text('Punto de medición')}` : undefined].filter(Boolean).join(' · ') || undefined;
    if (target && !pointId) b.warn(r.row, `«${target}» no coincide con ningún equipo, tablero ni espacio: la medición quedó como general y el nombre en las observaciones.`);
    const voltage = parsePhases(r.raw('V (V)'));
    const current = parsePhases(r.raw('I (A)'));
    const phases = Math.max(voltage?.length ?? 0, current?.length ?? 0);
    const pf = r.number('FP');
    if (pf !== undefined && (pf <= 0 || pf > 1)) b.warn(r.row, `El factor de potencia ${pf} debe estar entre 0 y 1: se dejó sin valor.`);
    const instrument = r.text('Instrumento');
    const existing = b.work.measurements.find((m) => m.takenAt === takenAt && m.pointType === pointType && m.pointId === pointId && (m.instrument ?? '') === (instrument ?? ''));
    b.upsert<Measurement>(
      'measurements',
      b.work.measurements,
      existing,
      {
        voltageV: voltage,
        currentA: current,
        phases: phases >= 3 ? 3 : phases === 2 ? 2 : phases === 1 ? 1 : undefined,
        kw: parsePower(r.raw('P (kW)'), 'kW').kw,
        pf: pf !== undefined && pf > 0 && pf <= 1 ? pf : undefined,
        instrument,
        frequencyHz: r.number('Frecuencia (Hz)'),
        energyKwh: r.number('Energía (kWh)'),
        condition: r.text('Condición'),
        responsible: r.text('Responsable'),
        notes,
      },
      () => ({ id: uuid(), projectId: b.work.project.id, createdAt: Date.now(), updatedAt: Date.now(), takenAt, pointType, pointId, dataType: 'medido' as const }),
    );
  }
};

/** Fechas de inicio y fin de «2026-08-01 a 2026-08-31» o «01/08/2026 al 31/08/2026». */
function parseRange(value: string | undefined): { startDate?: string; endDate?: string } {
  if (!value) return {};
  const parts = value.split(/\s+(?:a|al|-|–|hasta)\s+/i).map((p) => parseDate(p.trim()));
  return parts.length === 2 && parts[0] && parts[1] ? { startDate: parts[0], endDate: parts[1] } : {};
}

const importBills =
  (gas: boolean): Importer =>
  (b, rows) => {
    for (const r of rows) {
      const period = parsePeriod(r.raw('Mes/Año')) ?? parsePeriod(parseRange(r.text('Periodo')).startDate);
      if (!period) {
        b.error(r.row, 'Falta el mes de la factura o no se entiende (usa sep-2026 o 2026-09).');
        continue;
      }
      let carrier: Bill['carrier'];
      if (gas) {
        carrier = matchLoose(r.raw('Energético'), CARRIER_OPTIONS);
        if (!carrier) {
          b.error(r.row, `El energético «${r.text('Energético') ?? ''}» no está en la lista (Gas natural, Gas licuado (GLP), Otro energético).`);
          continue;
        }
      }
      const total = r.number('Total factura (COP)');
      if (total === undefined) b.warn(r.row, 'Falta el total de la factura: quedó en $0.');
      const range = parseRange(r.text('Periodo'));
      const days = ranged(b, r, 'Días', 1, 62, 'Días');
      const common: Partial<Bill> = { days: days === undefined ? undefined : Math.round(days), energyCostCop: r.number('Valor energía (COP)'), costCop: total, ...range, notes: r.text('Observaciones') };
      const existing = b.work.bills.find((x) => x.period === period && (x.carrier ?? 'electricidad') === (carrier ?? 'electricidad'));
      if (gas) {
        const quantity = r.number('Cantidad');
        const factor = r.number('Factor (kWh/unidad)');
        if (quantity === undefined || quantity <= 0) {
          b.error(r.row, 'Falta la cantidad facturada.');
          continue;
        }
        if (factor === undefined) b.warn(r.row, 'Sin factor de conversión a kWh: la factura se cargó pero no suma kWh al balance hasta que lo completes.');
        const unit = matchLoose(r.raw('Unidad'), UNIT_OPTIONS) ?? carrierInfo(carrier).unit;
        b.upsert<Bill>(
          'bills',
          b.work.bills,
          existing,
          { ...common, carrier, quantity, unit, kwhPerUnit: factor, kwh: factor ? round(quantity * factor, 2) : existing?.kwh ?? 0 },
          () => ({ id: uuid(), projectId: b.work.project.id, createdAt: Date.now(), updatedAt: Date.now(), period, kwh: 0, costCop: 0 }),
        );
      } else {
        const kwh = r.number('Consumo (kWh)');
        if (kwh === undefined || kwh <= 0) {
          b.error(r.row, 'Falta el consumo en kWh de la factura.');
          continue;
        }
        const pf = r.number('Factor de potencia');
        // El factor de potencia del mes equivale a una energía reactiva: kvarh = kWh × √(1/FP² − 1)
        const kvarh = pf !== undefined && pf > 0 && pf < 1 && existing?.kvarh === undefined ? round(kwh * Math.sqrt(1 / (pf * pf) - 1), 1) : undefined;
        b.upsert<Bill>(
          'bills',
          b.work.bills,
          existing,
          {
            ...common,
            kwh,
            demandKw: r.number('Demanda (kW)'),
            tariffCopPerKwh: r.number('Tarifa ($/kWh)'),
            kvarh,
            populationServed: r.number('Personas atendidas'),
            practiceHours: r.number('Horas de práctica'),
            coolingDegreeDays: r.number('Grados-día de enfriamiento'),
          },
          () => ({ id: uuid(), projectId: b.work.project.id, createdAt: Date.now(), updatedAt: Date.now(), period, kwh, costCop: 0 }),
        );
      }
    }
  };

const importMaintenance: Importer = (b, rows) => {
  for (const r of rows) {
    const key = r.text('ID Equipo');
    const { area } = withArea(b, r, 'Área');
    const equipment = findEquipmentByAnyKey(b.work, key, area?.id);
    if (!equipment) {
      b.error(r.row, `El equipo «${key ?? 'sin ID'}» no está registrado. Cárgalo primero en las hojas 03, 04 o 05.`);
      continue;
    }
    const lastAt = parseDate(r.raw('Último mantenimiento'));
    if (r.raw('Último mantenimiento') !== undefined && !isND(r.raw('Último mantenimiento')) && !lastAt) b.warn(r.row, 'La fecha del último mantenimiento no se entiende: se dejó sin fecha.');
    const typeCell = r.raw('Tipo');
    const type = matchLoose(typeCell, MAINTENANCE_OPTIONS) ?? (lastAt ? 'preventivo' : 'ninguno');
    if (cellText(typeCell) && !matchLoose(typeCell, MAINTENANCE_OPTIONS)) b.warn(r.row, `El tipo «${cellText(typeCell)}» no está en la lista: se cargó como ${lastAt ? 'preventivo' : 'sin mantenimiento registrado'}.`);
    const freqCell = r.raw('Frecuencia');
    const frequency = matchLoose(freqCell, FREQUENCY_OPTIONS) ?? cellText(freqCell);
    const conditionCell = r.raw('Condición actual');
    const condition = matchLoose(conditionCell, CONDITION_OPTIONS);
    if (cellText(conditionCell) && !condition) b.warn(r.row, `La condición «${cellText(conditionCell)}» no es Bueno, Regular ni Deficiente: se dejó sin condición.`);
    const existing = [...b.work.maintenance].filter((m) => m.equipmentId === equipment.id).sort((x, y) => (y.lastAt ?? '').localeCompare(x.lastAt ?? ''))[0];
    b.upsert<MaintenanceRecord>(
      'maintenance',
      b.work.maintenance,
      existing,
      {
        type,
        lastAt,
        frequency,
        activities: r.text('Actividades realizadas'),
        failures: r.text('Fallas reportadas'),
        condition,
        recommendation: r.text('Recomendación existente'),
        responsible: r.text('Responsable'),
        notes: r.text('Observaciones'),
      },
      () => ({ id: uuid(), projectId: b.work.project.id, createdAt: Date.now(), updatedAt: Date.now(), equipmentId: equipment.id, type }),
    );
  }
};

const importFindings: Importer = (b, rows) => {
  for (const r of rows) {
    const title = r.text('Hallazgo');
    if (!title) {
      b.error(r.row, 'Falta la descripción del hallazgo (columna «Hallazgo»).');
      continue;
    }
    const { area } = withArea(b, r, 'Piso/Área');
    const systemCell = r.raw('Sistema/equipo');
    const equipment = findEquipmentByAnyKey(b.work, cellText(systemCell), area?.id);
    const category = equipment ? equipment.category : matchLoose(systemCell, SYSTEM_OPTIONS);
    const priorityCell = r.raw('Prioridad preliminar');
    const severity = matchLoose(priorityCell, SEVERITY_OPTIONS);
    if (cellText(priorityCell) && !severity) b.warn(r.row, `La prioridad «${cellText(priorityCell)}» no es Crítica, Alta, Media ni Baja: se cargó como Media.`);
    const foundAt = parseDate(r.raw('Fecha'));
    const existing = b.work.findings.find((f) => norm(f.title) === norm(title));
    // El libro solo trae el espacio: un hallazgo que ya apuntaba a un equipo de ese espacio no pierde ese vínculo
    const keepsLink = Boolean(existing?.entityType === 'equipo' && !equipment && area && b.work.equipment.find((e) => e.id === existing.entityId)?.areaId === area.id);
    b.upsert<Finding>(
      'findings',
      b.work.findings,
      existing,
      {
        title,
        foundAt,
        category: category as Finding['category'],
        entityType: keepsLink ? undefined : equipment ? 'equipo' : area ? 'area' : undefined,
        entityId: keepsLink ? undefined : (equipment?.id ?? area?.id),
        cause: r.text('Posible causa'),
        energyImpact: r.text('Impacto energético observado'),
        suggestedAction: r.text('Acción sugerida'),
        severity,
        description: r.text('Observaciones'),
      },
      () => ({ id: uuid(), projectId: b.work.project.id, createdAt: Date.now(), updatedAt: Date.now(), title, severity: severity ?? ('medio' as const), auto: false, status: 'abierto' as const }),
    );
  }
};

const importMeasures: Importer = (b, rows) => {
  for (const r of rows) {
    const title = r.text('Medida propuesta');
    if (!title) {
      b.error(r.row, 'Falta la medida propuesta (columna «Medida propuesta»).');
      continue;
    }
    const code = r.text('ID');
    const existing = b.work.measures.find((m) => (code && norm(m.code) === norm(code)) || norm(m.title) === norm(title));
    const nextCode = `M${b.work.measures.length + 1}`;
    const categoryCell = r.raw('Sistema');
    const category = matchLoose(categoryCell, SYSTEM_OPTIONS);
    const usable = category && category !== 'electrico' && category !== 'envolvente' ? category : undefined;
    if (cellText(categoryCell) && !usable) b.warn(r.row, `El sistema «${cellText(categoryCell)}» no es un uso final de la lista: se cargó como «Otros».`);
    const investment = r.number('Inversión (COP)');
    const priorityCell = r.raw('Prioridad');
    const priority = matchLoose(priorityCell, PRIORITY_OPTIONS);
    const notes = [r.text('Evidencia') ? `Evidencia: ${r.text('Evidencia')}` : undefined, r.text('Observaciones')].filter(Boolean).join(' · ') || undefined;
    b.upsert<Measure>(
      'measures',
      b.work.measures,
      existing,
      {
        title,
        description: r.text('Problema'),
        category: usable,
        currentConsumptionKwhYear: r.number('Consumo actual (kWh/año)'),
        savingsKwhYear: r.number('Ahorro (kWh/año)'),
        savingsCopYear: r.number('Ahorro (COP/año)'),
        investmentCop: investment,
        priority,
        notes,
      },
      () => ({
        id: uuid(),
        projectId: b.work.project.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        code: code ?? nextCode,
        title,
        category: usable ?? ('otros' as const),
        kind: !investment ? ('operativa' as const) : investment < 10_000_000 ? ('baja-inversion' as const) : ('alta-inversion' as const),
        savingsKwhYear: 0,
        savingsCopYear: 0,
        investmentCop: 0,
        annualCostCop: 0,
        lifetimeYears: 10,
        selected: false,
        findingIds: [],
      }),
    );
  }
};

/** Renglón del control por su nombre: «Facturas/consumo histórico» → `facturas`; uno desconocido queda como renglón propio. */
function collectionKey(label: string): string {
  const t = norm(label);
  const found = COLLECTION_ITEMS.find((d) => t.startsWith(norm(d.label)) || norm(d.label).startsWith(t) || (d.key === 'facturas' && t.startsWith('facturas')) || (d.key === 'fotos' && t.includes('fotograf')));
  return found?.key ?? `otro-${t.replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;
}

/** Estado automático de cada renglón con lo que ya hay y lo que este mismo libro va a cargar (la hoja del control se lee al final). */
function autoStatuses(work: Working): Map<string, CollectionStatus> {
  return new Map(
    buildCollection({
      project: work.project,
      areas: work.areas,
      equipment: work.equipment,
      occupancy: work.occupancy,
      maintenance: work.maintenance,
      electricBills: work.bills.filter(isElectric).length,
      measurementRecords: work.measurements.length + work.fixedCounts.measurementRecords,
      photos: work.fixedCounts.photos,
      findings: work.findings.length,
      stored: [],
    }).map((row) => [row.key, row.auto] as const),
  );
}

const importControl: Importer = (b, rows) => {
  const autos = autoStatuses(b.work);
  for (const r of rows) {
    const label = r.text('Información requerida');
    if (!label) {
      b.error(r.row, 'Falta el nombre del renglón (columna «Información requerida»).');
      continue;
    }
    const key = collectionKey(label);
    const def = COLLECTION_ITEMS.find((d) => d.key === key);
    const statusCell = r.raw('Estado');
    let declared: CollectionStatus | undefined = isND(statusCell) ? 'no-disponible' : matchLoose(statusCell, STATUS_OPTIONS);
    if (cellText(statusCell) && !declared && !isND(statusCell)) b.warn(r.row, `El estado «${cellText(statusCell)}» no es Pendiente, En curso, Obtenido ni No disponible.`);
    // Lo que la app ya calcula sola no se fija como «manual»: solo se guarda lo que aporta más que los datos
    const auto = autos.get(key) ?? 'pendiente';
    const rank: Record<CollectionStatus, number> = { pendiente: 0, 'en-curso': 1, obtenido: 2, 'no-disponible': 3 };
    if (declared && declared !== 'no-disponible' && rank[declared] <= rank[auto]) declared = 'pendiente';
    const existing = b.work.collection.find((c) => c.key === key);
    const patch = {
      label: def ? def.label : label,
      status: declared,
      responsible: r.text('Responsable'),
      targetDate: parseDate(r.raw('Fecha objetivo')),
      obtainedDate: parseDate(r.raw('Fecha obtenida')),
      evidence: r.text('Evidencia/archivo'),
      notes: r.text('Observaciones'),
    };
    // Un renglón de los 12 que no trae nada más que lo que la app ya sabe no necesita un registro propio
    const adds = Object.entries(patch).some(([field, value]) => value !== undefined && field !== 'label' && !(field === 'status' && value === 'pendiente'));
    if (!existing && def && !adds) {
      b.plan.unchanged++;
      continue;
    }
    b.upsert<CollectionItem>(
      'collection',
      b.work.collection,
      existing,
      patch,
      () => ({ id: uuid(), projectId: b.work.project.id, createdAt: Date.now(), updatedAt: Date.now(), key, label: def ? def.label : label, status: 'pendiente' as const }),
    );
  }
};

const IMPORTERS: Record<FormatDef['id'], Importer | undefined> = {
  areas: importAreas,
  equipos: importEquipment('equipos'),
  aires: importEquipment('aires'),
  iluminacion: importEquipment('iluminacion'),
  ocupacion: importOccupancy,
  mediciones: importMeasurements,
  facturacion: importBills(false),
  gas: importBills(true),
  mantenimiento: importMaintenance,
  // Las fotos no viajan en el Excel: se respaldan en el .zip del proyecto
  evidencia: undefined,
  hallazgos: importFindings,
  oportunidades: importMeasures,
  control: importControl,
};

// ——— Plan y aplicación ———

const currentTerm = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() < 6 ? 1 : 2}`;
};

function workingOf(data: ReportData, term: string): Working {
  const equipment = [...data.equipment, ...data.otherEquipment].map((e) => ({ ...e }));
  return {
    project: { ...data.project },
    areas: data.areas.map((a) => ({ ...a })),
    equipment,
    nodes: data.electrical,
    existingIds: new Set(equipment.map((e) => e.id)),
    bills: [...data.bills, ...data.otherBills].map((x) => ({ ...x })),
    occupancy: data.occupancy.map((x) => ({ ...x })),
    measurements: data.measurements.map((x) => ({ ...x })),
    maintenance: data.maintenance.map((x) => ({ ...x })),
    findings: data.findings.map((x) => ({ ...x })),
    measures: data.measures.map((x) => ({ ...x })),
    collection: data.collection.map((x) => ({ ...x })),
    fixedCounts: { measurementRecords: data.readings.length + data.series.length, photos: data.photos.length },
    term,
    daysPerMonth: daysPerMonth(data.project.calendar.daysPerWeek),
  };
}

/** Lee un libro de Excel y arma el plan de carga con lo que ya hay en el proyecto. No escribe nada. */
export async function planFormatsImport(file: Blob | ArrayBuffer, data: ReportData, options: PlanOptions = {}): Promise<ImportPlan> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file instanceof Blob ? await file.arrayBuffer() : file);
  const now = options.now ?? Date.now();

  // El periodo de los horarios: el que se pide, el que anota la hoja 06 o el semestre actual
  const occupancySheet = findSheet(workbook, FORMAT_DEFS.ocupacion.name);
  let term = options.term;
  if (!term && occupancySheet) {
    for (let r = 1; r <= 4 && !term; r++) {
      const m = /periodo acad[eé]mico:\s*(\d{4}-\w+)/i.exec(String(plainCell(occupancySheet.getCell(r, 1).value) ?? ''));
      if (m) term = m[1];
    }
  }
  term ??= currentTerm(now);

  const work = workingOf(data, term);
  const sheets: SheetPlan[] = [];

  const generalSheet = findSheet(workbook, GENERAL_SHEET.name);
  const generalPlan = emptySheetPlan('general', GENERAL_SHEET.name, Boolean(generalSheet));
  if (generalSheet) importGeneral(new SheetBuilder(generalPlan, work), generalSheet);
  sheets.push(generalPlan);

  for (const id of FORMAT_ORDER) {
    const def = FORMAT_DEFS[id];
    const sheet = findSheet(workbook, def.name);
    const plan = emptySheetPlan(id, def.name, Boolean(sheet));
    sheets.push(plan);
    const importer = IMPORTERS[id];
    if (!sheet || !importer) continue;
    const read = readRows(sheet, def);
    if (!read) {
      plan.errors.push({ row: HEADER_ROW, text: 'No se encontraron los encabezados de esta hoja. No cambies los nombres de la fila 4.' });
      continue;
    }
    if (read.missing.length) plan.warnings.push({ row: read.headerRow, text: `Faltan las columnas: ${read.missing.join(', ')}. Se cargó lo que la hoja trae.` });
    plan.nd = read.rows.reduce((total, r) => total + r.nd, 0);
    const withData = read.rows.filter((r) => !r.onlyND);
    plan.skipped += read.rows.length - withData.length;
    plan.rows = read.rows.length;
    importer(new SheetBuilder(plan, work), withData);
  }

  const totals = sheets.reduce(
    (t, s) => ({ creates: t.creates + s.creates, updates: t.updates + s.updates, unchanged: t.unchanged + s.unchanged, warnings: t.warnings + s.warnings.length, errors: t.errors + s.errors.length }),
    { creates: 0, updates: 0, unchanged: 0, warnings: 0, errors: 0 },
  );
  return { sheets, term, totals };
}

/** Escribe el plan en la base local, en una sola transacción: o entra todo o no entra nada. */
export async function applyFormatsImport(db: PontiaDb, projectId: string, plan: ImportPlan, only?: ReadonlySet<FormatId>, now = Date.now()): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  await db.transaction('rw', [db.projects, db.areas, db.equipment, db.occupancy, db.measurements, db.bills, db.maintenance, db.findings, db.measures, db.collection], async () => {
    for (const sheet of plan.sheets) {
      if (only && !only.has(sheet.id)) continue;
      for (const op of sheet.ops) {
        if (op.kind === 'project') {
          await db.projects.update(projectId, { ...op.changes, updatedAt: now });
          continue;
        }
        const record = toRecord({ ...op.record, projectId }, now);
        await db.table(op.table).put(record);
        if (op.action === 'crear') created++;
        else updated++;
      }
    }
    await db.projects.update(projectId, { updatedAt: now });
  });
  return { created, updated };
}

