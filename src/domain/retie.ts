import { savingsTypeOf } from './measures';
import type { Measure, RetieDocument, RetieDocumentKind, RetieVerification, Task } from './types';

/**
 * Cumplimiento del RETIE de las intervenciones del plan de implementación. PONTIA registra quién ejecuta, con qué documentos se demuestra
 * la conformidad y cómo va la verificación, y recuerda lo que dice el reglamento; NO decide qué documento aplica a cada instalación ni
 * reemplaza el dictamen de inspección de un organismo acreditado por el ONAC.
 *
 * Fuente: Res. MME 40284 de 2026 (RETIE), Libro 3 (arts. 3.3.1 y 3.3.2) y Libro 4 (título 3, arts. 4.3.1, 4.3.2, 4.3.5 y 4.3.8), verificados
 * en el texto de la resolución el 2026-09-30, y su regla de transición (obras iniciadas antes del 1 de enero de 2026).
 */

/** Las obras iniciadas desde esta fecha se rigen por el RETIE de 2026; las anteriores «podrán» seguir con la Res. 90708 de 2013. */
export const RETIE_2026_START = '2026-01-01';

export type RetieRegime = 'vigente' | 'anterior' | 'por-confirmar';

export const RETIE_REGIMES: Record<RetieRegime, { label: string; text: string }> = {
  vigente: {
    label: 'RETIE de 2026',
    text: 'La obra inicia desde el 1 de enero de 2026: la conformidad se demuestra con la Res. 40284 de 2026 (RETIE); ya no se hacen inspecciones bajo la Res. 90708 de 2013.',
  },
  anterior: {
    label: 'Res. 90708 de 2013',
    text: 'La obra inició antes del 1 de enero de 2026: la conformidad podrá demostrarse bajo la Res. 90708 de 2013, aunque la inspección y el dictamen final sean posteriores. La fecha de inicio debe probarse, como mínimo, con el acta de inicio firmada y/o el contrato de obra donde conste la fecha exacta.',
  },
  'por-confirmar': {
    label: 'Por confirmar',
    text: 'Falta la fecha de inicio de la obra: con ella se sabe si rige el RETIE de 2026 (obras iniciadas desde el 1 de enero de 2026) o la Res. 90708 de 2013 (iniciadas antes).',
  },
};

/** Régimen según la fecha de inicio de la obra (AAAA-MM-DD). Sin fecha o mal escrita, queda por confirmar. */
export function retieRegime(startDate?: string): RetieRegime {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return 'por-confirmar';
  return startDate < RETIE_2026_START ? 'anterior' : 'vigente';
}

export type InterventionType = NonNullable<Task['works']>['interventionType'];
export type StartProof = NonNullable<NonNullable<Task['works']>['startProof']>;

export const INTERVENTIONS: readonly { id: InterventionType; label: string }[] = [
  { id: 'nueva', label: 'Instalación nueva' },
  { id: 'ampliacion', label: 'Ampliación' },
  { id: 'remodelacion', label: 'Remodelación' },
  { id: 'reposicion', label: 'Reposición de equipos' },
  { id: 'mantenimiento', label: 'Mantenimiento' },
];
export const interventionLabel = (id: InterventionType) => INTERVENTIONS.find((i) => i.id === id)?.label ?? id;

export const START_PROOFS: readonly { id: StartProof; label: string }[] = [
  { id: 'acta', label: 'Acta de inicio' },
  { id: 'contrato', label: 'Contrato de obra' },
  { id: 'otro', label: 'Otro' },
];

export interface DocumentKindInfo {
  id: RetieDocumentKind;
  label: string;
  /** Qué debe acompañarlo o quién lo emite, según el reglamento. */
  hint: string;
  ref: string;
}

export const DOCUMENT_KINDS: readonly DocumentKindInfo[] = [
  {
    id: 'declaracion-diseno',
    label: 'Declaración de cumplimiento del diseño',
    hint: 'Va con el análisis de riesgos, los planos de diseño, las memorias de cálculo, la matrícula del diseñador y los referentes normativos.',
    ref: 'art. 4.3.8.1',
  },
  {
    id: 'declaracion-construccion',
    label: 'Declaración de cumplimiento de la construcción',
    hint: 'Va con la declaración del diseño, los planos finales, las memorias, el acta de inicio o el contrato, la matrícula del constructor, los cambios al diseño y los manuales de operación y mantenimiento.',
    ref: 'art. 4.3.8.2',
  },
  {
    id: 'dictamen-inspeccion',
    label: 'Dictamen de inspección',
    hint: 'Lo emite un organismo de inspección acreditado por el ONAC (ISO/IEC 17020) antes de la energización definitiva.',
    ref: 'Libro 4, título 3, y art. 4.3.1',
  },
  {
    id: 'certificado-producto',
    label: 'Certificados de conformidad de los productos',
    hint: 'La referencia del producto instalado debe corresponder con la del producto certificado.',
    ref: 'art. 4.3.1 (n)',
  },
  {
    id: 'esquema-constructivo',
    label: 'Esquema constructivo',
    hint: 'Para instalaciones básicas de baja complejidad que no requieren diseño; lo firma una persona competente y se entrega al propietario y al operador de red.',
    ref: 'arts. 3.3.2 y 3.3.2.1',
  },
  {
    id: 'declaracion-operacion',
    label: 'Declaración de cumplimiento de operación y mantenimiento',
    hint: 'Se valida en la revisión de una instalación que ya fue dictaminada.',
    ref: 'art. 4.3.8.3',
  },
  { id: 'otro', label: 'Otro documento', hint: '', ref: '' },
];
export const documentKindInfo = (id: RetieDocumentKind): DocumentKindInfo => DOCUMENT_KINDS.find((d) => d.id === id) ?? DOCUMENT_KINDS[DOCUMENT_KINDS.length - 1];

export const RETIE_STATUS_LABEL: Record<RetieVerification['status'], string> = {
  pendiente: 'Pendiente',
  'en-revision': 'En revisión',
  cumple: 'Cumple',
  'no-cumple': 'No cumple',
  'no-aplica': 'No aplica',
};

/** Verificación en blanco para una intervención de la instalación eléctrica: el auditor decide después si el RETIE aplica. */
export const emptyRetie = (): RetieVerification => ({ applies: 'por-definir', documents: [], status: 'pendiente' });

/**
 * Datos de obra y verificación con que PONTIA propone una tarea de ejecución. Las medidas operativas (buenas prácticas) no tocan la
 * instalación; la generación con FNCER es una instalación nueva y las demás, una remodelación. El auditor puede cambiarlo.
 */
export function suggestedWorks(m: Pick<Measure, 'kind' | 'savingsType'>): Pick<Task, 'works' | 'retie'> {
  if (m.kind === 'operativa') return {};
  return { works: { interventionType: savingsTypeOf(m) === 'fncer' ? 'nueva' : 'remodelacion' }, retie: emptyRetie() };
}

// ——— Recordatorios del reglamento ———

export interface RetieReminder {
  text: string;
  ref: string;
}

/**
 * Lo que dice el RETIE de 2026 sobre la intervención, con su artículo, para que el auditor decida si aplica y qué documentos se necesitan.
 * Con obras iniciadas antes de 2026 no se detallan los requisitos de la Res. 90708 de 2013: solo se avisa que rige.
 */
export function retieReminders(input: { works?: Task['works']; measure?: Pick<Measure, 'kind' | 'savingsType'> }): RetieReminder[] {
  const { works, measure } = input;
  if (retieRegime(works?.startDate) === 'anterior') {
    return [{ text: 'Con una obra iniciada antes del 1 de enero de 2026 los requisitos por verificar son los de la Res. 90708 de 2013; PONTIA no los detalla.', ref: 'Res. 40284 de 2026, transición' }];
  }
  const out: RetieReminder[] = [];
  if (works && works.interventionType !== 'mantenimiento') {
    out.push({
      text: 'La parte ampliada o remodelada debe demostrar la conformidad con el RETIE mediante las declaraciones de cumplimiento y, en los casos que aplique, el dictamen de inspección. Si la remodelación supera el 80 %, se trata como una instalación nueva.',
      ref: 'art. 4.3.1 (g)',
    });
    if (works.interventionType === 'ampliacion' || works.interventionType === 'remodelacion') {
      out.push({
        text:
          'En instalaciones comerciales, de entidades gubernamentales u oficiales y de instituciones sin ánimo de lucro, la ampliación o remodelación requiere certificación plena (declaraciones de cumplimiento y dictamen) si la potencia instalable es de hasta 100 kVA y la parte intervenida supera 10 kVA; si la instalación existente es de más de 100 kVA, cuando se remodela o amplía más del 30 %; y cuando se adicionan o remodelan instalaciones o equipos especiales. ' +
          'El porcentaje se calcula con el número de salidas o puntos de conexión en cada nivel de tensión.',
        ref: 'arts. 4.3.2.2 (b) y 4.3.2.3',
      });
    }
  }
  if (measure && savingsTypeOf(measure) === 'fncer') {
    out.push({
      text: 'La autogeneración a pequeña escala y la generación con FNCER de 10 kVA o más requieren certificación plena, se conecte o no a la red, y un diseño previo a su construcción.',
      ref: 'arts. 4.3.2.1 (h, i), 4.3.2.2 (f) y 3.3.1 (j)',
    });
  }
  out.push(
    { text: 'Las instituciones de enseñanza y las instalaciones donde se atiende al público deben contar con un diseño eléctrico antes de construirse.', ref: 'art. 3.3.1 (l, m)' },
    { text: 'El dictamen de inspección lo emite un organismo acreditado por el ONAC antes de la energización definitiva; hasta que se cuente con la certificación no se puede usar la instalación.', ref: 'Libro 4, título 3' },
    { text: 'Las excepciones al dictamen no eximen de la declaración de cumplimiento firmada por la persona competente responsable del diseño y de la construcción.', ref: 'art. 4.3.5' },
  );
  return out;
}

// ——— Estado y regla para marcar «Implementada» ———

export type RetieState = 'sin-obra' | 'por-definir' | 'pendiente' | 'en-revision' | 'cumple' | 'no-cumple' | 'no-aplica';

export const RETIE_STATE_LABEL: Record<RetieState, string> = {
  'sin-obra': 'Sin obra eléctrica',
  'por-definir': 'RETIE por definir',
  pendiente: 'RETIE pendiente',
  'en-revision': 'RETIE en revisión',
  cumple: 'RETIE cumple',
  'no-cumple': 'RETIE no cumple',
  'no-aplica': 'RETIE no aplica',
};

const filled = (value: string | undefined) => Boolean(value?.trim());

/** «Cumple» solo vale con evidencia: un documento con resultado «Cumple», quién verificó y cuándo. */
export function hasEvidence(v: Pick<RetieVerification, 'documents' | 'verifiedBy' | 'verifiedAt'>): boolean {
  return v.documents.some((d) => d.result === 'cumple') && filled(v.verifiedBy) && Boolean(v.verifiedAt);
}

/** Lo que falta para dejar la verificación en «Cumple»: vacío si ya se puede. */
export function retieProblems(v: RetieVerification): string[] {
  if (v.status !== 'cumple') return [];
  const problems: string[] = [];
  if (!v.documents.some((d) => d.result === 'cumple')) problems.push('un documento con resultado «Cumple»');
  if (!filled(v.verifiedBy)) problems.push('quién verificó');
  if (!v.verifiedAt) problems.push('la fecha de la verificación');
  return problems;
}

/** Estado de la tarea frente al RETIE. Solo las tareas con obra (`works`) se verifican. */
export function retieState(task: Pick<Task, 'works' | 'retie'>): RetieState {
  if (!task.works) return 'sin-obra';
  const v = task.retie;
  if (!v || v.applies === 'por-definir') return 'por-definir';
  if (v.applies === 'no') return 'no-aplica';
  if (v.status === 'cumple') return hasEvidence(v) ? 'cumple' : 'en-revision';
  if (v.status === 'no-aplica') return 'pendiente';
  return v.status;
}

export interface RetieGate {
  ok: boolean;
  /** Por qué no puede pasar a «Implementada». */
  reason?: string;
  /** Pasa con una justificación, sin la verificación en «Cumple»: el informe lo señala. */
  waived?: boolean;
}

/**
 * ¿Puede la tarea pasar a «Implementada»? Una intervención de la instalación eléctrica necesita que el RETIE esté definido y, si aplica,
 * verificado como «Cumple» con su evidencia; sin eso solo pasa con una justificación escrita (queda en el informe). Si el RETIE no
 * aplica, se explica por qué.
 */
export function retieGate(task: Pick<Task, 'works' | 'retie'>): RetieGate {
  const state = retieState(task);
  const justification = filled(task.retie?.justification);
  switch (state) {
    case 'sin-obra':
    case 'cumple':
      return { ok: true };
    case 'por-definir':
      return { ok: false, reason: 'Define si el RETIE aplica a esta intervención de la instalación eléctrica; si no aplica, explica por qué.' };
    case 'no-aplica':
      return justification ? { ok: true } : { ok: false, reason: 'Explica por qué el RETIE no aplica a esta intervención.' };
    default:
      return justification
        ? { ok: true, waived: true }
        : { ok: false, reason: 'El RETIE aplica y su verificación no está en «Cumple» con su evidencia: regístrala o escribe la justificación de por qué se implementa sin ella.' };
  }
}

/**
 * Lo que impide guardar la tarea: dejar el RETIE en «Cumple» sin evidencia o pasar a «Implementada» (o al 100 %) sin el RETIE resuelto ni
 * una justificación. Sin problema devuelve `undefined`.
 */
export function retieSaveProblem(t: Pick<Task, 'works' | 'retie' | 'status' | 'progress'>): string | undefined {
  const problems = t.works && t.retie ? retieProblems(t.retie) : [];
  if (problems.length) return `Para dejar el RETIE en «Cumple» falta: ${problems.join(', ')}.`;
  const implemented = t.status === 'implementada' || t.progress >= 100;
  return implemented ? retieGate(t).reason : undefined;
}

export interface RetieSummary {
  /** Tareas con obra en la instalación eléctrica. */
  works: number;
  byState: Record<Exclude<RetieState, 'sin-obra'>, number>;
  /** Implementadas sin la verificación en «Cumple», con su justificación. */
  waived: number;
  /** Implementadas que no cumplen la regla (por ejemplo, datos importados o anteriores a este control). */
  breaking: number;
}

export function retieSummary(tasks: readonly Pick<Task, 'works' | 'retie' | 'status'>[]): RetieSummary {
  const byState: RetieSummary['byState'] = { 'por-definir': 0, pendiente: 0, 'en-revision': 0, cumple: 0, 'no-cumple': 0, 'no-aplica': 0 };
  let waived = 0;
  let breaking = 0;
  let works = 0;
  for (const t of tasks) {
    const state = retieState(t);
    if (state === 'sin-obra') continue;
    works += 1;
    byState[state] += 1;
    if (t.status !== 'implementada') continue;
    const gate = retieGate(t);
    if (gate.waived) waived += 1;
    else if (!gate.ok) breaking += 1;
  }
  return { works, byState, waived, breaking };
}

/**
 * Documentos que suelen acompañar la certificación plena y aún no están registrados (art. 4.3.8): diseño, construcción, dictamen y
 * productos. Con un esquema constructivo solo quedan los certificados de los productos. Es un recordatorio, no una lista exigida.
 */
export function missingDocuments(documents: readonly Pick<RetieDocument, 'kind'>[]): RetieDocumentKind[] {
  const have = new Set(documents.map((d) => d.kind));
  const expected: RetieDocumentKind[] = have.has('esquema-constructivo') ? ['certificado-producto'] : ['declaracion-diseno', 'declaracion-construccion', 'dictamen-inspeccion', 'certificado-producto'];
  return expected.filter((kind) => !have.has(kind));
}

const trimmed = (value: string | undefined) => value?.trim() || undefined;

/**
 * Deja limpios los datos de ejecución y de RETIE de una tarea antes de guardarla: sin textos en blanco, sin filas de documentos vacías, sin
 * ejecutor sin nombre y con la verificación en «No aplica» cuando el auditor dijo que el RETIE no aplica. La verificación de una tarea sin
 * obra no se toca (se conserva por si el auditor vuelve a marcar la obra).
 */
export function tidyRetieFields(t: Pick<Task, 'executor' | 'works' | 'retie'>): Pick<Task, 'executor' | 'works' | 'retie'> {
  const e = t.executor;
  const registry = e?.registry?.body ? { body: e.registry.body, category: trimmed(e.registry.category), number: trimmed(e.registry.number) } : undefined;
  const executor = e && (trimmed(e.name) || registry) ? { kind: e.kind, name: e.name.trim(), role: trimmed(e.role), registry } : undefined;

  const works = t.works ? { interventionType: t.works.interventionType, startDate: t.works.startDate || undefined, startProof: t.works.startProof || undefined } : undefined;

  const v = t.retie ?? (works ? emptyRetie() : undefined);
  const retie: RetieVerification | undefined = v && {
    applies: v.applies,
    documents: v.documents
      .map((d): RetieDocument => ({ kind: d.kind, reference: trimmed(d.reference), issuer: trimmed(d.issuer), date: d.date || undefined, result: d.result || undefined }))
      .filter((d) => d.reference || d.issuer || d.date || d.result),
    riskAnalysisDone: v.riskAnalysisDone || undefined,
    commissioningNotes: trimmed(v.commissioningNotes),
    status: v.applies === 'no' ? 'no-aplica' : v.status === 'no-aplica' ? 'pendiente' : v.status,
    verifiedBy: trimmed(v.verifiedBy),
    verifiedAt: v.verifiedAt || undefined,
    justification: trimmed(v.justification),
  };
  return { executor, works, retie };
}

/** Registro profesional de quien ejecuta, en una línea: «CONTE · TE-1 · N.º 123». */
export function registryText(executor: Task['executor']): string {
  const r = executor?.registry;
  if (!r) return '';
  return [r.body === 'otra' ? 'Otro registro' : r.body, r.category, r.number ? `N.º ${r.number}` : ''].filter(Boolean).join(' · ');
}
