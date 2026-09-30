import type { FileChild, Table } from 'docx';
import { auditorChecklist, auditorKindLabel, hasAuditorData, isCertifiedExperience, registryLines, sectorLabel } from '@/domain/auditor';
import { groupStatus, lowerFirst } from '@/domain/compliance';
import { formatDate } from '@/utils/dates';
import type { AuditModel } from '../model';
import { COLOR, dataTable, heading, note, para, text, type Cell } from './theme';

/**
 * Datos de quien hizo la auditoría (Res. MME 40412 de 2024, art. 6): tipo, nombre o razón social, formación, experiencia certificada por un
 * tercero, matrículas y la verificación del artículo. Nunca imprime la cédula ni el RUT: solo si están reunidos. Sin perfil, no hay sección.
 */
export function auditorSection(m: AuditModel, { table, title }: { table: (caption: string, t: Table) => FileChild[]; title: string }): FileChild[] {
  const profile = m.data.auditor;
  if (!profile || !hasAuditorData(profile)) return [];
  const status = groupStatus(auditorChecklist(profile));

  const training = profile.training.map((t) => {
    const year = t.date ? ` (${t.date.slice(0, 4)})` : '';
    const hours = t.hours ? `, ${t.hours} h` : '';
    return `${t.kind === 'certificacion' ? 'Certificación' : 'Diploma'}: ${t.program || 'sin nombre'}, ${t.institution || 'sin institución'}${hours}${year}${t.backed ? '' : '. Soporte pendiente'}`;
  });
  const experience = profile.experience.map((e) => {
    const certificate = isCertifiedExperience(e)
      ? `certificada por ${e.certifier} el ${formatDate(e.certifiedAt)}`
      : e.certifier || e.certifiedAt
        ? `certificado del tercero incompleto${e.certifier ? ` (${e.certifier})` : ''}`
        : 'sin certificado de un tercero';
    return `${sectorLabel(e.sector)}: ${e.description || 'sin descripción'}${e.year ? ` (${e.year})` : ''}; ${certificate}`;
  });
  const registries = registryLines(profile);

  const rows: Cell[][] = [
    ['Tipo de auditor', auditorKindLabel(profile.kind) || '—'],
    [profile.kind === 'juridica' ? 'Razón social' : 'Nombre', profile.name?.trim() || '—'],
    ...(profile.kind === 'juridica' ? ([['NIT', profile.nit?.trim() || '—']] as Cell[][]) : []),
    ['Documento de identidad, RUT o existencia y representación legal', profile.identityDocs ? 'Reunido por la entidad contratante para su verificación' : 'Pendiente'],
    ['Formación', training.length ? training.join('\n') : 'Sin registrar'],
    ['Experiencia', experience.length ? experience.join('\n') : 'Sin registrar'],
    ['Matrículas', registries.length ? registries.join('\n') : 'Sin registrar'],
    [
      'Verificación del artículo 6',
      status.complete ? { text: 'Cumple los requisitos registrados', bold: true, color: COLOR.good } : { text: `Faltan: ${status.missing.map((i) => lowerFirst(i.label)).join('; ')}`, color: COLOR.serious },
    ],
  ];

  return [
    heading(title),
    para('Datos de quien realizó la auditoría, según el artículo 6 de la Resolución 40412 de 2024. No incluyen documentos de identidad.'),
    ...table('Datos del auditor energético.', dataTable([{ header: 'Dato', width: 0.3 }, { header: 'Registro', width: 0.7 }], rows)),
    note('La experiencia certificada por un tercero y los documentos del parágrafo 2 del artículo 6 los verifica la entidad contratante; este cuadro solo reúne lo registrado en PONTIA.'),
    ...(status.complete ? [] : [para([text('Atención. ', { bold: true, color: COLOR.serious }), text('El perfil del auditor está incompleto: complétalo en Ajustes → Perfil del auditor antes de entregar el informe.')])]),
  ];
}
