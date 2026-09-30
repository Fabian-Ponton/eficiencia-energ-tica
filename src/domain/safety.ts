import type { Area, ElectricalNode, Equipment, EntityType, RetieRiskFactor, RiskLevelNumber, SafetyFinding } from './types';

/**
 * Seguridad eléctrica: el análisis de riesgos de origen eléctrico del RETIE (Res. MME 40284 de 2026, art. 1.5.1).
 * Los 12 factores de riesgo y sus causas y medidas son la Tabla 1.5.1.3.a (texto verificado en la resolución). La matriz de riesgos y
 * la tabla de decisiones son la Tabla 1.5.1.4.1.a y b, que la resolución dice «adoptada de la Resolución 90708 de 2013»; se transcribieron de
 * las Tablas 9.3 y 9.4 del Anexo General de esa resolución (página 44 del PDF, comprobadas contra la imagen). Los hallazgos de seguridad van
 * aparte de los energéticos y nunca entran en los ahorros.
 */

// ——— Factores de riesgo (RETIE 1.5.1.3, Tabla a) ———

export interface RiskFactorInfo {
  id: RetieRiskFactor;
  label: string;
  causes: string;
  protections: string;
}

export const RISK_FACTORS: readonly RiskFactorInfo[] = [
  {
    id: 'arcos',
    label: 'Arcos eléctricos',
    causes:
      'Malos contactos, cortocircuitos, aperturas de interruptores con carga, apertura o cierre de transformadores con carga, apertura de transformadores de corriente, apertura de transformadores de potencia con carga sin utilizar equipo extintor de arco, apertura de transformadores de corriente en secundarios con carga, manipulación indebida de equipos de medida, materiales o herramientas olvidadas en gabinetes, acumulación de óxido o partículas conductoras, descuidos en los trabajos de mantenimiento.',
    protections: 'Utilizar materiales envolventes resistentes a los arcos, mantener una distancia de seguridad, usar prendas acordes con el riesgo y gafas de protección contra los rayos ultravioletas.',
  },
  {
    id: 'ausencia-electricidad',
    label: 'Ausencia de electricidad (en determinados casos)',
    causes:
      'Apagón o corte del servicio, no disponer de un sistema ininterrumpido de potencia (UPS), no tener plantas de emergencia, no tener transferencia. Por ejemplo, lugares donde se exijan plantas de emergencia como hospitales y aeropuertos.',
    protections: 'Disponer de sistemas ininterrumpidos de potencia y de plantas de emergencia con transferencia automática.',
  },
  {
    id: 'campos-electromagneticos',
    label: 'Campos electromagnéticos',
    causes: 'Falla en el diseño, violación de anchos de zonas de servidumbre, mediciones con equipo no calibrado.',
    protections: 'Respetar los anchos de zonas de servidumbre y los valores de límites de exposición a campos electromagnéticos.',
  },
  {
    id: 'contacto-directo',
    label: 'Contacto directo',
    causes: 'Negligencia de técnicos o impericia de no técnicos, violación de las distancias mínimas de seguridad.',
    protections:
      'Establecer distancias de seguridad, interposición de obstáculos, aislamiento o recubrimiento de partes activas, utilización de interruptores diferenciales, elementos de protección personal, puesta a tierra, probar ausencia de tensión, doble aislamiento.',
  },
  {
    id: 'contacto-indirecto',
    label: 'Contacto indirecto',
    causes: 'Fallas de aislamiento, mal mantenimiento, falta de conductor de puesta a tierra.',
    protections:
      'Separación de circuitos, uso de muy baja tensión, distancias de seguridad, conexiones equipotenciales, sistemas de puesta a tierra, interruptores diferenciales, mantenimiento preventivo y correctivo.',
  },
  {
    id: 'cortocircuito',
    label: 'Cortocircuito',
    causes: 'Fallas de aislamiento, impericia de los técnicos, accidentes externos, vientos fuertes, humedades, equipos defectuosos.',
    protections: 'Interruptores automáticos con dispositivos de disparo de máxima corriente o cortacircuitos fusibles.',
  },
  {
    id: 'electricidad-estatica',
    label: 'Electricidad estática',
    causes: 'Unión y separación constante de materiales como aislantes, conductores, sólidos o gases con la presencia de un aislante.',
    protections: 'Sistemas de puesta a tierra, conexiones equipotenciales, aumento de la humedad relativa, ionización del ambiente, eliminadores eléctricos y radiactivos, pisos conductivos.',
  },
  {
    id: 'equipo-defectuoso',
    label: 'Equipo defectuoso',
    causes: 'Mal mantenimiento, mala instalación, mala utilización, tiempo de uso, transporte inadecuado.',
    protections: 'Mantenimiento predictivo y preventivo, construcción de instalaciones siguiendo las normas técnicas, caracterización del entorno electromagnético.',
  },
  {
    id: 'rayos',
    label: 'Rayos',
    causes: 'Fallas en el diseño, construcción, operación y mantenimiento del sistema de protección.',
    protections: 'Pararrayos, bajantes, puestas a tierra, equipotencialización, apantallamientos, topología de cableados. Además, suspender actividades de alto riesgo cuando se tenga personal al aire libre.',
  },
  {
    id: 'sobrecarga',
    label: 'Sobrecarga',
    causes: 'Superar los límites nominales de los equipos o de los conductores, instalaciones que no cumplen las normas técnicas, conexiones flojas, armónicos, no controlar el factor de potencia.',
    protections:
      'Uso de interruptores automáticos con relés de sobrecarga, interruptores automáticos asociados con cortacircuitos, cortacircuitos, fusibles bien dimensionados, dimensionamiento técnico de conductores y equipos, compensación de energía reactiva con banco de condensadores.',
  },
  {
    id: 'tension-contacto',
    label: 'Tensión de contacto',
    causes: 'Rayos, fallas a tierra, fallas de aislamiento, violación de distancias de seguridad.',
    protections: 'Puestas a tierra de baja resistencia, restricción de accesos, alta resistividad del piso, equipotencializar.',
  },
  {
    id: 'tension-paso',
    label: 'Tensión de paso',
    causes: 'Rayos, fallas a tierra, fallas de aislamiento, violación de áreas restringidas, retardo en el despeje de la falla.',
    protections: 'Puestas a tierra de baja resistencia, restricción de accesos, alta resistividad del piso, equipotencializar.',
  },
];

export const riskFactorInfo = (id: RetieRiskFactor): RiskFactorInfo => RISK_FACTORS.find((f) => f.id === id) ?? RISK_FACTORS[0];

// ——— Matriz de riesgos (RETIE 1.5.1.4.1, Tabla a) ———

export type RiskClass = 'personas' | 'economicas' | 'ambientales' | 'imagen';
export type Frequency = 'a' | 'b' | 'c' | 'd' | 'e';

/** Lo que significa cada nivel de consecuencia (1 a 5) para cada clase de pérdida: se elige la más grave de las cuatro. */
export const CONSEQUENCE_CLASSES: readonly { id: RiskClass; label: string; levels: Record<RiskLevelNumber, string> }[] = [
  {
    id: 'personas',
    label: 'En personas',
    levels: { 5: 'Una o más muertes', 4: 'Incapacidad parcial permanente', 3: 'Incapacidad temporal (más de 1 día)', 2: 'Lesión menor (sin incapacidad)', 1: 'Molestia funcional (afecta el rendimiento laboral)' },
  },
  {
    id: 'economicas',
    label: 'Económicas',
    levels: {
      5: 'Daño grave en infraestructura. Interrupción regional',
      4: 'Daños mayores, salida de subestación',
      3: 'Daños severos. Interrupción temporal',
      2: 'Daños importantes. Interrupción breve',
      1: 'Daños leves, no interrumpe',
    },
  },
  {
    id: 'ambientales',
    label: 'Ambientales',
    levels: { 5: 'Contaminación irreparable', 4: 'Contaminación mayor', 3: 'Contaminación localizada', 2: 'Efecto menor', 1: 'Sin efecto' },
  },
  {
    id: 'imagen',
    label: 'En la imagen de la empresa',
    levels: { 5: 'Internacional', 4: 'Nacional', 3: 'Regional', 2: 'Local', 1: 'Interna' },
  },
];

/** Frecuencia: las letras de la matriz (A es la más frecuente). */
export const FREQUENCIES: readonly { id: Frequency; label: string }[] = [
  { id: 'a', label: 'Sucede varias veces al mes en la empresa' },
  { id: 'b', label: 'Sucede varias veces al año en la empresa' },
  { id: 'c', label: 'Ha ocurrido en la empresa' },
  { id: 'd', label: 'Ha ocurrido en el sector' },
  { id: 'e', label: 'No ha ocurrido en el sector' },
];

export type RiskLevel = 'muy-bajo' | 'bajo' | 'medio' | 'alto' | 'muy-alto';

/** Cruce de la consecuencia (filas 5 a 1) con la frecuencia (columnas a a e). */
export const RISK_MATRIX: Record<RiskLevelNumber, Record<Frequency, RiskLevel>> = {
  5: { e: 'medio', d: 'alto', c: 'alto', b: 'alto', a: 'muy-alto' },
  4: { e: 'medio', d: 'medio', c: 'medio', b: 'alto', a: 'alto' },
  3: { e: 'bajo', d: 'medio', c: 'medio', b: 'medio', a: 'alto' },
  2: { e: 'bajo', d: 'bajo', c: 'medio', b: 'medio', a: 'medio' },
  1: { e: 'muy-bajo', d: 'bajo', c: 'bajo', b: 'bajo', a: 'medio' },
};

/** Decisiones y acciones para controlar el riesgo (Tabla 1.5.1.4.1.b), con lo que se exige para ejecutar los trabajos. */
export const RISK_LEVELS: Record<RiskLevel, { label: string; rank: number; decision: string; permit: string; execution: string }> = {
  'muy-alto': {
    label: 'Muy alto',
    rank: 4,
    decision: 'Inadmisible para trabajar. Hay que eliminar fuentes potenciales, hacer reingeniería o minimizarlo y volver a valorarlo en grupo, hasta reducirlo.',
    permit: 'Requiere permiso especial de trabajo.',
    execution:
      'Buscar procedimientos alternativos si se decide hacer el trabajo. La alta dirección participa y aprueba el Análisis de Trabajo Seguro (ATS) y autoriza su realización, mediante un Permiso Especial de Trabajo (PES).',
  },
  alto: {
    label: 'Alto',
    rank: 3,
    decision: 'Minimizarlo. Buscar alternativas que presenten menor riesgo. Demostrar cómo se va a controlar el riesgo, aislar con barreras o distancia, usar EPP.',
    permit: 'Requiere permiso especial de trabajo.',
    execution: 'El jefe o supervisor del área involucrada aprueba el Análisis de Trabajo Seguro (ATS) y el Permiso de Trabajo (PT) presentados por el líder a cargo del trabajo.',
  },
  medio: {
    label: 'Medio',
    rank: 2,
    decision: 'Aceptarlo. Aplicar los sistemas de control (minimizar, aislar, suministrar EPP, procedimientos, protocolos, lista de verificación, usar EPP).',
    permit: 'Requiere permiso de trabajo.',
    execution: 'El líder del grupo de trabajo diligencia el Análisis de Trabajo Seguro (ATS) y el jefe de área aprueba el Permiso de Trabajo (PT) según el procedimiento establecido.',
  },
  bajo: {
    label: 'Bajo',
    rank: 1,
    decision: 'Asumirlo. Hacer control administrativo rutinario. Seguir los procedimientos establecidos. Utilizar EPP.',
    permit: 'No requiere permiso especial de trabajo.',
    execution: 'El líder del trabajo debe verificar: ¿qué puede salir mal o fallar?, ¿qué puede causar que algo salga mal o falle?, ¿qué podemos hacer para evitar que algo salga mal o falle?',
  },
  'muy-bajo': { label: 'Muy bajo', rank: 0, decision: 'Vigilar posibles cambios.', permit: '', execution: 'No afecta la secuencia de las actividades.' },
};

export const riskLevel = (consequence: RiskLevelNumber, frequency: Frequency): RiskLevel => RISK_MATRIX[consequence][frequency];

/** La consecuencia que se cruza con la frecuencia es la más grave de las clases valoradas (el RETIE toma el caso más crítico de las cuatro). */
export function worstConsequence(levels: SafetyFinding['consequences']): RiskLevelNumber | undefined {
  const values = Object.values(levels ?? {}).filter((v): v is RiskLevelNumber => typeof v === 'number');
  return values.length ? (Math.max(...values) as RiskLevelNumber) : undefined;
}

/** Nivel de riesgo de un hallazgo; `null` mientras falte la consecuencia o la frecuencia. */
export const levelOf = (f: Pick<SafetyFinding, 'consequence' | 'frequency'>): RiskLevel | null => (f.consequence && f.frequency ? riskLevel(f.consequence, f.frequency) : null);

// ——— Alto riesgo y peligro inminente (RETIE 1.5.1.4.2 y 1.5.1.4.3) ———

/** Los criterios con los que una persona competente en electrotecnia determina el alto riesgo. */
export const HIGH_RISK_CRITERIA: readonly { id: 'a' | 'b' | 'c' | 'd'; text: string }[] = [
  {
    id: 'a',
    text:
      'Existen condiciones peligrosas plenamente identificables: carencia de medidas preventivas contra los factores de riesgo eléctrico; equipos, productos o conexiones defectuosas; insuficiente capacidad para la carga de la instalación; violación de distancias de seguridad; materiales combustibles o explosivos donde pueda presentarse un arco eléctrico; lluvia, tormentas eléctricas y contaminación.',
  },
  {
    id: 'b',
    text: 'El peligro tiene carácter inminente: hay indicios racionales de que la exposición al factor de riesgo lleve a que se produzca el accidente, es decir, que una muerte, una lesión grave, un incendio o una explosión pueda ocurrir antes de estudiar el problema a fondo.',
  },
  {
    id: 'c',
    text: 'La gravedad es máxima: hay gran probabilidad de muerte, lesión física grave, incendio o explosión, o de que se inutilice de forma permanente una parte del cuerpo o se destruyan bienes importantes de la instalación o de su entorno.',
  },
  { id: 'd', text: 'Existen antecedentes comparables: quien evalúa el riesgo debe referenciar al menos un antecedente ocurrido con condiciones similares.' },
];

/** Qué hacer cuando se evidencia alto riesgo o peligro inminente para las personas (1.5.1.4.3). */
export const HIGH_RISK_ACTION =
  'Si se evidencia alto riesgo o peligro inminente para las personas, se debe interrumpir el funcionamiento de la instalación eléctrica, salvo en aeropuertos, áreas críticas de centros de atención médica o cuando la interrupción conlleve un riesgo mayor: en ese caso se toman otras medidas de seguridad que lo minimicen. La persona competente que lo conozca debe informarlo y solicitar a la autoridad competente medidas provisionales, con el apoyo técnico que esté a su alcance.';

/** Jerarquía de controles del hallazgo, de la más a la menos eficaz. */
export const CONTROL_HIERARCHY: readonly { id: NonNullable<SafetyFinding['control']>; label: string }[] = [
  { id: 'eliminacion', label: 'Eliminación' },
  { id: 'sustitucion', label: 'Sustitución' },
  { id: 'ingenieria', label: 'Control de ingeniería' },
  { id: 'administrativo', label: 'Control administrativo' },
  { id: 'epp', label: 'Elementos de protección personal' },
];

export const SAFETY_STATUS_LABEL: Record<SafetyFinding['status'], string> = { abierto: 'Abierto', 'en-control': 'En control', cerrado: 'Cerrado' };

// ——— Resumen y orden ———

/** Un hallazgo pide atención inmediata si está abierto y es de alto riesgo, de peligro inminente o de nivel alto en la matriz. */
export function needsAttention(f: Pick<SafetyFinding, 'status' | 'highRisk' | 'imminent' | 'consequence' | 'frequency'>): boolean {
  if (f.status === 'cerrado') return false;
  const level = levelOf(f);
  return f.imminent || f.highRisk || level === 'alto' || level === 'muy-alto';
}

/** Orden de las listas: peligro inminente, alto riesgo, nivel de la matriz; lo que falta valorar va después de los niveles medio y alto y antes de los bajos. */
export function urgencyOf(f: Pick<SafetyFinding, 'status' | 'highRisk' | 'imminent' | 'consequence' | 'frequency'>): number {
  if (f.status === 'cerrado') return -1;
  const level = levelOf(f);
  return (f.imminent ? 100 : 0) + (f.highRisk ? 50 : 0) + (level ? RISK_LEVELS[level].rank * 10 : 15);
}

export interface SafetySummary {
  total: number;
  open: number;
  closed: number;
  imminent: number;
  highRisk: number;
  /** Abiertos con nivel alto o muy alto en la matriz. */
  highLevel: number;
  /** Abiertos que piden atención inmediata (cualquiera de los tres anteriores). */
  attention: number;
  /** Abiertos sin consecuencia o sin frecuencia: falta valorarlos. */
  unevaluated: number;
  byLevel: Record<RiskLevel, number>;
}

export function summarizeSafety(findings: readonly SafetyFinding[]): SafetySummary {
  const live = findings.filter((f) => !f.deletedAt);
  const open = live.filter((f) => f.status !== 'cerrado');
  const byLevel: Record<RiskLevel, number> = { 'muy-bajo': 0, bajo: 0, medio: 0, alto: 0, 'muy-alto': 0 };
  for (const f of open) {
    const level = levelOf(f);
    if (level) byLevel[level] += 1;
  }
  return {
    total: live.length,
    open: open.length,
    closed: live.length - open.length,
    imminent: open.filter((f) => f.imminent).length,
    highRisk: open.filter((f) => f.highRisk).length,
    highLevel: byLevel.alto + byLevel['muy-alto'],
    attention: open.filter(needsAttention).length,
    unevaluated: open.filter((f) => !levelOf(f)).length,
    byLevel,
  };
}

/** Código corto del hallazgo para la matriz y el informe: S1, S2… en el orden en que se registraron. */
export function safetyCodes(findings: readonly Pick<SafetyFinding, 'id' | 'createdAt'>[]): Map<string, string> {
  return new Map([...findings].sort((a, b) => a.createdAt - b.createdAt).map((f, i) => [f.id, `S${i + 1}`]));
}

/** Cuántos hallazgos abiertos hay en cada celda de la matriz (consecuencia × frecuencia). */
export function matrixCounts(findings: readonly SafetyFinding[]): Map<string, SafetyFinding[]> {
  const cells = new Map<string, SafetyFinding[]>();
  for (const f of findings) {
    if (f.deletedAt || f.status === 'cerrado' || !f.consequence || !f.frequency) continue;
    const key = `${f.consequence}${f.frequency}`;
    cells.set(key, [...(cells.get(key) ?? []), f]);
  }
  return cells;
}

// ——— Sugerencias a partir de los datos del proyecto ———

export interface SafetySuggestion {
  /** Identificador estable, para no ofrecer dos veces lo que ya se adoptó. */
  ruleId: string;
  riskFactor: RetieRiskFactor;
  title: string;
  description: string;
  entityType?: EntityType;
  entityId?: string;
  /** Por qué se sugiere: de dónde salió el dato. */
  basis: string;
}

export interface SafetySuggestionInput {
  checks: readonly { node: Pick<ElectricalNode, 'id' | 'name' | 'kind'>; level: 'normal' | 'alta' | 'critica'; ratio: number; load: number; capacity: number; unit: string }[];
  imbalance: readonly { measurement: { id: string; pointType?: string; pointId?: string }; point: string; level: 'normal' | 'alto' | 'critico'; imbalance: number; currents: readonly number[] }[];
  equipment: readonly Pick<Equipment, 'id' | 'name' | 'quantity' | 'condition' | 'areaId'>[];
  areas: readonly Pick<Area, 'id' | 'name'>[];
}

const pct = (value: number, decimals = 0) => `${(value * 100).toFixed(decimals).replace('.', ',')} %`;
const num = (value: number, decimals = 1) => value.toFixed(decimals).replace('.', ',');

/**
 * Situaciones de los datos que el RETIE trata como factor de riesgo: elementos del sistema eléctrico cargados por encima de su capacidad
 * (sobrecarga), desbalance entre fases (sobrecarga) y equipos en estado deficiente (equipo defectuoso). PONTIA las sugiere; el auditor las adopta,
 * las valora con la matriz y decide el control. No se crean solas.
 */
export function safetySuggestions(input: SafetySuggestionInput): SafetySuggestion[] {
  const out: SafetySuggestion[] = [];
  for (const check of input.checks) {
    if (check.level === 'normal') continue;
    const critical = check.level === 'critica';
    out.push({
      ruleId: `carga-${check.node.id}`,
      riskFactor: 'sobrecarga',
      title: `${check.node.name}: carga ${critical ? 'crítica' : 'alta'}`,
      description: `Trabaja al ${pct(check.ratio)} de su capacidad (${num(check.load)} de ${num(check.capacity)} ${check.unit}). ${critical ? 'No admite cargas nuevas y una sobrecarga sostenida puede dañar conductores y protecciones.' : 'Queda poco margen para cargas nuevas.'}`,
      entityType: 'electrico',
      entityId: check.node.id,
      basis: 'Análisis de capacidad del sistema eléctrico',
    });
  }
  for (const row of input.imbalance) {
    if (row.level === 'normal') continue;
    out.push({
      ruleId: `desbalance-${row.measurement.id}`,
      riskFactor: 'sobrecarga',
      title: `Desbalance de fases en ${row.point}`,
      description: `Las corrientes por fase se apartan hasta un ${pct(row.imbalance, 1)} del promedio (${row.currents.map((c) => num(c, 0)).join(' / ')} A): una fase puede sobrecargarse aunque el total esté dentro de la capacidad.`,
      entityType: row.measurement.pointType === 'tablero' ? 'electrico' : undefined,
      entityId: row.measurement.pointType === 'tablero' ? row.measurement.pointId : undefined,
      basis: 'Mediciones por fase',
    });
  }
  const areaName = new Map(input.areas.map((a) => [a.id, a.name]));
  const byArea = new Map<string, Pick<Equipment, 'id' | 'name' | 'quantity' | 'condition' | 'areaId'>[]>();
  for (const e of input.equipment) if (e.condition === 'deficiente') byArea.set(e.areaId ?? '', [...(byArea.get(e.areaId ?? '') ?? []), e]);
  for (const [areaId, items] of byArea) {
    const units = items.reduce((total, e) => total + e.quantity, 0);
    const names = [...new Set(items.map((e) => e.name))];
    out.push({
      ruleId: `equipos-deficientes-${areaId || 'sin-espacio'}`,
      riskFactor: 'equipo-defectuoso',
      title: `Equipos en estado deficiente${areaId ? ` en ${areaName.get(areaId) ?? 'un espacio'}` : ''}`,
      description: `${units} ${units === 1 ? 'equipo está' : 'equipos están'} en estado deficiente en el inventario: ${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''}. Un equipo defectuoso puede producir cortocircuitos, arcos o contactos indirectos.`,
      entityType: areaId ? 'area' : undefined,
      entityId: areaId || undefined,
      basis: 'Estado de los equipos del inventario',
    });
  }
  return out;
}

/** Las sugerencias que aún no se adoptaron como hallazgo de seguridad. */
export const pendingSafetySuggestions = (suggestions: readonly SafetySuggestion[], findings: readonly Pick<SafetyFinding, 'ruleId' | 'deletedAt'>[]): SafetySuggestion[] => {
  const adopted = new Set(findings.filter((f) => !f.deletedAt).map((f) => f.ruleId).filter(Boolean));
  return suggestions.filter((s) => !adopted.has(s.ruleId));
};

/** Borrador de hallazgo a partir de una sugerencia: sin valorar, para que el auditor complete la consecuencia y la frecuencia. */
export function safetyFindingFromSuggestion(s: SafetySuggestion, projectId: string, today: string): Omit<SafetyFinding, 'createdAt' | 'updatedAt' | 'deletedAt'> {
  return {
    id: crypto.randomUUID(),
    projectId,
    foundAt: today,
    entityType: s.entityType,
    entityId: s.entityId,
    riskFactor: s.riskFactor,
    real: false,
    highRisk: false,
    imminent: false,
    description: `${s.title}. ${s.description}`,
    status: 'abierto',
    auto: true,
    ruleId: s.ruleId,
  };
}
