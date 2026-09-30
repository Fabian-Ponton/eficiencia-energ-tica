import type { FileChild } from 'docx';
import { CONTROL_HIERARCHY, HIGH_RISK_ACTION, RISK_LEVELS, SAFETY_STATUS_LABEL, levelOf, needsAttention, riskFactorInfo, safetyCodes } from '@/domain/safety';
import type { SafetyFinding } from '@/domain/types';
import { formatDate } from '@/utils/dates';
import type { AuditModel } from '../model';
import { bullet, COLOR, dataTable, heading, note, para, text, type Cell } from './theme';
import type { SectionTools } from './upmeBaselineSection';

const LEVEL_COLOR = { 'muy-alto': COLOR.critical, alto: COLOR.serious, medio: COLOR.warning, bajo: COLOR.good, 'muy-bajo': COLOR.good } as const;

/** Nombre del espacio, equipo o elemento del sistema eléctrico donde está el hallazgo. */
function placeOf(f: SafetyFinding, m: AuditModel): string {
  if (!f.entityId) return '—';
  if (f.entityType === 'area') return m.data.areas.find((a) => a.id === f.entityId)?.name ?? '—';
  if (f.entityType === 'equipo') return m.data.equipment.find((e) => e.id === f.entityId)?.name ?? '—';
  if (f.entityType === 'electrico') return m.data.electrical.find((n) => n.id === f.entityId)?.name ?? '—';
  return '—';
}

/**
 * Seguridad eléctrica del informe: los riesgos de origen eléctrico valorados con la matriz del RETIE (art. 1.5.1.4.1), aparte de los
 * hallazgos energéticos y sin sumarse a los ahorros. Lo de alto riesgo o peligro inminente se ve siempre, sin importar el ahorro.
 */
export function safetySection(m: AuditModel, { fig, table, title }: SectionTools & { title: string }): FileChild[] {
  const findings = m.data.safetyFindings;
  const { summary, suggestions } = m.safety;
  if (!findings.length && !suggestions.length && !m.data.project.safetyReviewed) return [];
  const codes = safetyCodes(findings);
  const out: FileChild[] = [
    heading(title),
    para(
      'Los riesgos de origen eléctrico se identificaron con los factores de riesgo del RETIE (Resolución MME 40284 de 2026, art. 1.5.1.3) y se valoraron con su matriz de análisis de riesgos (art. 1.5.1.4.1), que cruza la consecuencia más grave con la frecuencia. ' +
        'Esta valoración se presenta aparte de los hallazgos energéticos y no suma ahorros; no reemplaza el dictamen de inspección del RETIE ni el sistema de gestión de la seguridad y salud en el trabajo de la entidad.',
    ),
  ];

  if (!findings.length) {
    out.push(para(m.data.project.safetyReviewed ? 'El auditor revisó la seguridad eléctrica de la instalación y no registró hallazgos.' : 'Aún no se registran hallazgos de seguridad eléctrica.'));
  } else {
    out.push(
      para(
        `Se registraron ${summary.total} ${summary.total === 1 ? 'hallazgo' : 'hallazgos'} (${summary.open} ${summary.open === 1 ? 'abierto' : 'abiertos'} y ${summary.closed} ${summary.closed === 1 ? 'cerrado' : 'cerrados'}): ` +
          `${summary.imminent} de peligro inminente, ${summary.highRisk} de alto riesgo, ${summary.highLevel} de nivel alto o muy alto en la matriz y ${summary.unevaluated} por valorar.`,
      ),
    );
    if (summary.attention) out.push(para([text('Atención inmediata. ', { bold: true, color: COLOR.critical }), text(HIGH_RISK_ACTION)]));
    out.push(...fig('matriz-riesgos'));
    out.push(
      ...table(
        'Hallazgos de seguridad eléctrica, del más urgente al menos urgente.',
        dataTable(
          [
            { header: 'Cód.', width: 0.07 },
            { header: 'Factor de riesgo', width: 0.2 },
            { header: 'Ubicación', width: 0.2 },
            { header: 'Nivel', width: 0.15 },
            { header: 'Estado', width: 0.12 },
            { header: 'Responsable y fecha', width: 0.26 },
          ],
          findings.map((f): Cell[] => {
            const level = levelOf(f);
            return [
              codes.get(f.id) ?? '',
              riskFactorInfo(f.riskFactor).label,
              placeOf(f, m),
              level ? { text: `${RISK_LEVELS[level].label}${f.imminent ? ' · inminente' : f.highRisk ? ' · alto riesgo' : ''}`, bold: needsAttention(f), color: LEVEL_COLOR[level] } : f.imminent || f.highRisk ? { text: f.imminent ? 'Peligro inminente' : 'Alto riesgo', bold: true, color: COLOR.critical } : 'Por valorar',
              SAFETY_STATUS_LABEL[f.status],
              [f.responsible, f.dueDate ? formatDate(f.dueDate) : undefined].filter(Boolean).join(' · ') || '—',
            ];
          }),
        ),
      ),
    );
    // El detalle de cada hallazgo abierto que pide atención: qué exige el RETIE y qué se hará
    for (const f of findings.filter(needsAttention)) {
      const level = levelOf(f);
      out.push(para([text(`${codes.get(f.id)} · ${riskFactorInfo(f.riskFactor).label}`, { bold: true }), text(level ? ` — riesgo ${RISK_LEVELS[level].label.toLowerCase()}` : ' — por valorar', { color: level ? LEVEL_COLOR[level] : undefined })], { spacing: { before: 160, after: 40 } }));
      out.push(para(`${f.description}${placeOf(f, m) !== '—' ? ` Ubicación: ${placeOf(f, m)}.` : ''}`));
      if (level) out.push(para([text('Decisión del RETIE. ', { bold: true }), text(`${RISK_LEVELS[level].decision} ${RISK_LEVELS[level].permit}`.trim())], { spacing: { after: 40 } }));
      if (f.immediateAction) out.push(para([text('Acción inmediata. ', { bold: true }), text(f.immediateAction)], { spacing: { after: 40 } }));
      if (f.recommendedAction) out.push(para([text('Acción recomendada. ', { bold: true }), text(`${f.recommendedAction}${f.control ? ` (${CONTROL_HIERARCHY.find((c) => c.id === f.control)?.label.toLowerCase()})` : ''}`)], { spacing: { after: 40 } }));
      if (f.precedent) out.push(para([text('Antecedente comparable. ', { bold: true }), text(f.precedent)], { spacing: { after: 40 } }));
    }
  }

  if (suggestions.length) {
    out.push(para([text('Situaciones de los datos por valorar', { bold: true })], { spacing: { before: 160, after: 60 } }));
    out.push(para('El análisis de capacidad, las mediciones por fase y el inventario señalan estas situaciones. Aún no se valoran con la matriz del RETIE:'));
    for (const s of suggestions) out.push(bullet(`${s.title}. ${s.description}`));
  }
  out.push(note('Los hallazgos de seguridad eléctrica no se incluyen en el potencial de ahorro ni en la priorización de las medidas.'));
  return out;
}
