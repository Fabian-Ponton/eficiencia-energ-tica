import { normalizeText } from '@/utils/text';
import { endUseOf } from './catalogs';
import type { Finding, Severity } from './types';

/**
 * Diagnóstico: los hallazgos que salen de los datos (reglas automáticas del análisis) se ofrecen como
 * sugerencias; el auditor decide cuáles adopta y los completa con fotos y su criterio.
 */

/** Hallazgo sugerido por las reglas (misma forma que los hallazgos automáticos del informe). */
export interface SuggestedFinding {
  tone: 'critical' | 'serious' | 'warning' | 'good' | 'info';
  topic: 'consumo' | 'climatizacion' | 'iluminacion' | 'electrico' | 'datos';
  title: string;
  detail: string;
}

const SEVERITY: Record<SuggestedFinding['tone'], Severity> = { critical: 'critico', serious: 'alto', warning: 'medio', info: 'bajo', good: 'bajo' };
const CATEGORY: Partial<Record<SuggestedFinding['topic'], Finding['category']>> = { climatizacion: 'climatizacion', iluminacion: 'iluminacion', electrico: 'electrico' };

/** Identificador estable de la regla, para no ofrecer dos veces el mismo hallazgo. */
export const ruleIdOf = (title: string): string =>
  normalizeText(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Sugerencias que vale la pena revisar: lo crítico, importante y a vigilar, sin las ya adoptadas. */
export function pendingSuggestions(suggestions: readonly SuggestedFinding[], findings: readonly Pick<Finding, 'ruleId'>[]): SuggestedFinding[] {
  const adopted = new Set(findings.map((f) => f.ruleId).filter(Boolean));
  return suggestions.filter((s) => s.tone !== 'good' && s.tone !== 'info' && !adopted.has(ruleIdOf(s.title)));
}

/** Borrador de hallazgo a partir de una sugerencia. */
export function findingFromSuggestion(s: SuggestedFinding, projectId: string): Omit<Finding, 'createdAt' | 'updatedAt' | 'deletedAt'> {
  return {
    id: crypto.randomUUID(),
    projectId,
    title: s.title,
    description: s.detail,
    severity: SEVERITY[s.tone],
    category: CATEGORY[s.topic],
    auto: true,
    ruleId: ruleIdOf(s.title),
    status: 'abierto',
  };
}

export const SEVERITY_ORDER: Record<Severity, number> = { critico: 0, alto: 1, medio: 2, bajo: 3 };

/** Textos de los documentos y las tablas; las pantallas los acompañan con ícono y color. */
export const SEVERITY_LABEL: Record<Severity, string> = { critico: 'Crítico', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };
export const FINDING_STATUS_LABEL: Record<Finding['status'], string> = { abierto: 'Abierto', 'en-medida': 'Con medida', cerrado: 'Cerrado' };

/** Tema del hallazgo: un uso final, el sistema eléctrico o la envolvente del edificio. */
export const findingTopicLabel = (category: Finding['category']): string =>
  !category ? '' : category === 'electrico' ? 'Sistema eléctrico' : category === 'envolvente' ? 'Envolvente' : endUseOf(category).label;
