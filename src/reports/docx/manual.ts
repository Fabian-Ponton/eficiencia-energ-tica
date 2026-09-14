import { Document, Packer, TableOfContents, type FileChild } from 'docx';
import { MANUAL_DATA, MANUAL_FAQ, MANUAL_HIGHLIGHTS, MANUAL_MINIMUM, MANUAL_SECTIONS, MANUAL_START, MANUAL_WHAT, type ManualStep } from '@/content/manual';
import { findStep } from '@/navigation';
import { formatDate, toLocalDate } from '@/utils/dates';
import type { GeneratedFile } from '../generate';
import { blankFooter, blankHeader, bullet, COLOR, coverPage, dataTable, DOC_STYLES, heading, note, NUMBERING, PAGE, pageBreak, pageFooter, pageHeader, para, tableCaption, text } from './theme';

/** Manual de uso en Word: el mismo texto de la pantalla «Manual», con la plantilla de los informes. */

const NEED_COLOR = { obligatorio: COLOR.critical, recomendado: COLOR.info, opcional: COLOR.muted } as const;

/** Título de cada etapa en el manual: el menú usa nombres más cortos. */
const STAGE_TITLES: Record<string, string> = {
  campo: 'Levantamiento en campo',
  analisis: 'Análisis del consumo',
  plan: 'Plan de mejora',
  informes: 'Informes y exportación',
};

/** Tabla de datos de entrada de un paso: qué se pide, si es obligatorio y de dónde sale. */
function inputsTable(step: ManualStep, number: number, title: string) {
  return [
    tableCaption(number, `Datos de entrada de «${title}»`),
    dataTable(
      [
        { header: 'Dato', width: 0.32 },
        { header: 'Hace falta', width: 0.14 },
        { header: 'De dónde sale', width: 0.54 },
      ],
      step.inputs.map((input) => [input.label, { text: input.need, color: NEED_COLOR[input.need], bold: input.need === 'obligatorio' }, input.source]),
    ),
  ];
}

export function buildManualDocument(generatedAt = new Date()): Document {
  const today = toLocalDate(generatedAt);
  const body: FileChild[] = [
    ...coverPage({
      kicker: 'MANUAL DE USO',
      title: 'PONTIA',
      subtitle: 'Plataforma de auditoría y eficiencia energética',
      facts: [
        ['Documento', 'Manual de usuario'],
        ['Fecha', formatDate(today)],
        ['Alcance', 'Instalación, uso de las 14 pantallas y datos de entrada'],
        ['Referencia', 'ISO 50002 · ISO 50001 · ISO 50006 · IPMVP'],
      ],
      footer: 'Este manual se genera desde la propia app, en Ajustes → Manual de uso.',
    }),
    pageBreak(),
    new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-2' }),
    note('Si el índice aparece vacío, en Word haz clic derecho sobre él y elige «Actualizar campos».'),
    pageBreak(),

    heading('1. Qué es PONTIA'),
    para(MANUAL_WHAT),
    ...MANUAL_HIGHLIGHTS.map((h) => bullet([text(`${h.title}: `, { bold: true }), text(h.text)])),

    heading('2. Primeros pasos'),
    ...MANUAL_START.flatMap((s, i) => [heading(`2.${i + 1} ${s.title}`, 3), para(s.text)]),
  ];

  // 3 a 6: una sección por etapa de la auditoría, con la ficha de cada pantalla
  let table = 0;
  MANUAL_SECTIONS.forEach((section, index) => {
    const chapter = index + 3;
    body.push(heading(`${chapter}. ${STAGE_TITLES[section.id]}`), para(section.intro));
    section.steps.forEach((step, position) => {
      const nav = findStep(step.id);
      const title = nav?.label ?? step.id;
      // Una etapa de una sola pantalla (Informes) no repite el título como subcapítulo
      if (section.steps.length > 1) body.push(heading(`${chapter}.${position + 1} ${title}`, 2));
      body.push(para(step.what), ...inputsTable(step, ++table, title));
      body.push(para([text('Qué obtienes: ', { bold: true }), text(step.result)], { spacing: { before: 160 } }));
      if (step.tip) body.push(note(`Consejo: ${step.tip}`));
    });
  });

  body.push(
    pageBreak(),
    heading('7. Datos mínimos para cada resultado'),
    para('Si algo aparece vacío en la app, casi siempre falta uno de estos datos.'),
    tableCaption(++table, 'Qué se necesita para cada resultado'),
    dataTable(
      [
        { header: 'Para', width: 0.4 },
        { header: 'Necesitas', width: 0.6 },
      ],
      MANUAL_MINIMUM.map((row) => [row.goal, row.needs]),
    ),

    heading('8. Dónde se guardan tus datos'),
    ...MANUAL_DATA.map((d) => bullet([text(`${d.title}: `, { bold: true }), text(d.text)])),

    heading('9. Preguntas frecuentes'),
    ...MANUAL_FAQ.flatMap((f) => [heading(f.q, 3), para(f.a)]),
  );

  return new Document({
    creator: 'PONTIA',
    title: 'PONTIA · Manual de uso',
    description: 'Manual de usuario de PONTIA: qué hace la app y qué datos necesita',
    features: { updateFields: true },
    styles: DOC_STYLES,
    numbering: NUMBERING,
    sections: [
      {
        properties: {
          titlePage: true,
          page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin } },
        },
        headers: { default: pageHeader('Auditoría energética', 'Manual de uso'), first: blankHeader() },
        footers: { default: pageFooter(), first: blankFooter() },
        children: body,
      },
    ],
  });
}

/** Manual de uso listo para descargar. No depende de ningún proyecto. */
export async function generateManual(generatedAt = new Date()): Promise<GeneratedFile> {
  return { blob: await Packer.toBlob(buildManualDocument(generatedAt)), fileName: `PONTIA_Manual-de-uso_${toLocalDate(generatedAt)}.docx` };
}
