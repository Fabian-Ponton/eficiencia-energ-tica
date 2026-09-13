import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from 'docx';
import type { Kpi } from '../model';

/**
 * Plantilla del informe Word (dirección C, «consultoría editorial»): títulos en Georgia, texto en Calibri,
 * tonos de papel cálido, filetes finos y secciones numeradas. Fuentes que Word tiene en cualquier equipo.
 */

export const FONT = { heading: 'Georgia', body: 'Calibri', mono: 'Consolas' } as const;

export const COLOR = {
  ink: '1B2430',
  navy: '10234B',
  accent: '187F44',
  muted: '5C6A80',
  rule: 'D9D2C3',
  band: 'EFE8DA',
  zebra: 'FBF8F2',
  critical: 'B42318',
  serious: 'C2410C',
  warning: '9A6700',
  good: '15803D',
  info: '1D4ED8',
} as const;

/** Página carta con márgenes de 2,54 cm (en twips) y el ancho útil en píxeles a 96 ppp, para las imágenes. */
export const PAGE = { width: 12240, height: 15840, margin: 1440 } as const;
export const CONTENT_TWIPS = PAGE.width - PAGE.margin * 2;
export const CONTENT_PX = 624;

export const DOC_STYLES = {
  default: {
    document: { run: { font: FONT.body, size: 21, color: COLOR.ink }, paragraph: { spacing: { after: 120, line: 276 } } },
  },
  paragraphStyles: [
    {
      id: 'Heading1',
      name: 'Heading 1',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { font: FONT.heading, size: 36, color: COLOR.navy },
      paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule, space: 4 } } },
    },
    {
      id: 'Heading2',
      name: 'Heading 2',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { font: FONT.heading, size: 26, color: COLOR.navy },
      paragraph: { spacing: { before: 280, after: 100 }, keepNext: true },
    },
    {
      id: 'Heading3',
      name: 'Heading 3',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { font: FONT.body, size: 22, bold: true, color: COLOR.ink },
      paragraph: { spacing: { before: 200, after: 80 }, keepNext: true },
    },
    {
      id: 'Caption',
      name: 'Caption',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { size: 18, italics: true, color: COLOR.muted },
      paragraph: { spacing: { before: 60, after: 240 } },
    },
  ],
};

export const NUMBERING = {
  config: [
    {
      reference: 'vinetas',
      levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }],
    },
  ],
};

type Runs = string | ParagraphChild[];
const runs = (children: Runs): ParagraphChild[] => (typeof children === 'string' ? [new TextRun(children)] : children);

export const text = (value: string, opts: { bold?: boolean; italics?: boolean; color?: string; size?: number; font?: string } = {}) =>
  new TextRun({ text: value, bold: opts.bold, italics: opts.italics, color: opts.color, size: opts.size, font: opts.font });

export const para = (children: Runs, opts: Omit<IParagraphOptions, 'children'> = {}) => new Paragraph({ ...opts, children: runs(children) });

export const heading = (value: string, level: 1 | 2 | 3 = 1) =>
  new Paragraph({ heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: [new TextRun(value)] });

export const bullet = (children: Runs) => new Paragraph({ numbering: { reference: 'vinetas', level: 0 }, children: runs(children) });

export const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

/** Nota al margen en gris, para aclaraciones de método y limitaciones. */
export const note = (value: string) => para([text(value, { italics: true, color: COLOR.muted, size: 19 })]);

/** «Tabla 3. Consumo mensual…», encima de cada tabla. */
export const tableCaption = (number: number, value: string) =>
  para([text(`Tabla ${number}. `, { bold: true, color: COLOR.navy, size: 19 }), text(value, { size: 19, color: COLOR.muted })], { keepNext: true, spacing: { before: 200, after: 80 } });

const HAIRLINE = { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule } as const;
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;

export interface Column {
  header: string;
  /** Fracción del ancho de la tabla. */
  width: number;
  align?: 'left' | 'right' | 'center';
}

export type Cell = string | { text: string; bold?: boolean; color?: string };

const ALIGN = { left: AlignmentType.LEFT, right: AlignmentType.RIGHT, center: AlignmentType.CENTER } as const;

/** Tabla de datos: encabezado en tono papel, filetes finos, filas alternas y números a la derecha. */
export function dataTable(columns: readonly Column[], rows: readonly (readonly Cell[])[], total?: readonly Cell[]): Table {
  const widths = columns.map((c) => Math.round(c.width * CONTENT_TWIPS));
  const cell = (value: Cell, column: Column, opts: { header?: boolean; fill?: string; bold?: boolean }) => {
    const content = typeof value === 'string' ? { text: value } : value;
    return new TableCell({
      width: { size: widths[columns.indexOf(column)], type: WidthType.DXA },
      shading: opts.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: ALIGN[column.align ?? 'left'],
          spacing: { after: 0, line: 240 },
          children: [
            new TextRun({
              text: content.text,
              bold: opts.header || opts.bold || content.bold,
              color: opts.header ? COLOR.navy : content.color,
              size: opts.header ? 17 : 19,
              font: opts.header ? FONT.body : undefined,
            }),
          ],
        }),
      ],
    });
  };
  return new Table({
    width: { size: CONTENT_TWIPS, type: WidthType.DXA },
    columnWidths: widths,
    borders: { top: HAIRLINE, bottom: HAIRLINE, left: NONE, right: NONE, insideHorizontal: HAIRLINE, insideVertical: NONE },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: columns.map((c) => cell(c.header.toUpperCase(), c, { header: true, fill: COLOR.band })) }),
      ...rows.map((row, i) => new TableRow({ cantSplit: true, children: columns.map((c, j) => cell(row[j] ?? '', c, { fill: i % 2 ? COLOR.zebra : undefined })) })),
      ...(total ? [new TableRow({ cantSplit: true, children: columns.map((c, j) => cell(total[j] ?? '', c, { bold: true, fill: COLOR.band })) })] : []),
    ],
  });
}

/** Recuadros de indicadores del resumen ejecutivo: tres por fila. */
export function kpiGrid(kpis: readonly Kpi[]): Table {
  const perRow = 3;
  const width = Math.floor(CONTENT_TWIPS / perRow);
  const box = (kpi?: Kpi) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: kpi ? { type: ShadingType.CLEAR, color: 'auto', fill: COLOR.zebra } : undefined,
      margins: { top: 120, bottom: 120, left: 160, right: 120 },
      borders: { top: kpi ? { style: BorderStyle.SINGLE, size: 12, color: COLOR.accent } : NONE, bottom: NONE, left: NONE, right: NONE },
      children: kpi
        ? [
            para([text(kpi.label.toUpperCase(), { size: 15, color: COLOR.muted, bold: true })], { spacing: { after: 40 } }),
            para([text(kpi.value, { font: FONT.heading, size: 34, color: COLOR.navy }), ...(kpi.unit ? [text(` ${kpi.unit}`, { size: 17, color: COLOR.muted })] : [])], {
              spacing: { after: 20 },
            }),
            ...(kpi.note ? [para([text(kpi.note, { size: 16, color: COLOR.muted })], { spacing: { after: 0 } })] : []),
          ]
        : [new Paragraph('')],
    });
  const rows: TableRow[] = [];
  for (let i = 0; i < kpis.length; i += perRow) {
    rows.push(new TableRow({ cantSplit: true, children: Array.from({ length: perRow }, (_, j) => box(kpis[i + j])) }));
  }
  return new Table({
    width: { size: CONTENT_TWIPS, type: WidthType.DXA },
    columnWidths: Array.from({ length: perRow }, () => width),
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: { style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF' } },
    rows,
  });
}

/** Imagen centrada a lo ancho útil de la página y su pie: «Figura 2. Título. Fuente…». */
export function figure(data: Uint8Array, size: { width: number; height: number }, number: number, title: string, source?: string): Paragraph[] {
  const scale = Math.min(1, CONTENT_PX / size.width);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 60 },
      children: [
        new ImageRun({
          type: 'png',
          data,
          transformation: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) },
          altText: { name: `figura-${number}`, description: title, title },
        }),
      ],
    }),
    new Paragraph({
      style: 'Caption',
      children: [text(`Figura ${number}. `, { bold: true, italics: false, color: COLOR.navy }), text(title), ...(source ? [text(` ${source}`)] : [])],
    }),
  ];
}

/** Foto del anexo, a un tamaño máximo en píxeles (conserva la proporción). Las fotos de la app son JPEG; las importadas pueden ser PNG. */
export function photo(data: Uint8Array, size: { width: number; height: number; type?: 'jpg' | 'png' }, maxWidth: number, caption: string): Paragraph[] {
  const scale = Math.min(1, maxWidth / size.width, 420 / size.height);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 40 },
      children: [
        new ImageRun({
          type: size.type ?? 'jpg',
          data,
          transformation: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) },
          altText: { name: caption.slice(0, 40), description: caption, title: caption },
        }),
      ],
    }),
    new Paragraph({ style: 'Caption', alignment: AlignmentType.CENTER, children: [text(caption)] }),
  ];
}

/** Encabezado y pie de página con el nombre del documento, el del proyecto y «Página X de Y». */
export function pageHeader(projectName: string, documentName = 'Informe de auditoría energética'): Header {
  return new Header({
    children: [
      para([text(`PONTIA · ${documentName}`, { size: 16, color: COLOR.muted }), text(`   ${projectName}`, { size: 16, color: COLOR.navy, bold: true })], {
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule, space: 4 } },
      }),
    ],
  });
}

/** Portada: franja azul con el tipo de documento, el proyecto y el cliente; debajo, los datos del documento. */
export function coverPage(opts: { kicker: string; title: string; subtitle: string; facts: readonly [string, string][]; footer: string }): (Paragraph | Table)[] {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
  const band = new Table({
    width: { size: CONTENT_TWIPS, type: WidthType.DXA },
    columnWidths: [CONTENT_TWIPS],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: COLOR.navy },
            margins: { top: 480, bottom: 480, left: 360, right: 360 },
            children: [
              para([text(opts.kicker, { color: 'CFE3FF', size: 18, bold: true })], { spacing: { after: 160 } }),
              para([text(opts.title, { font: FONT.heading, size: 52, color: 'FFFFFF' })], { spacing: { after: 120 } }),
              para([text(opts.subtitle, { size: 24, color: 'E8EEF8' })], { spacing: { after: 0 } }),
            ],
          }),
        ],
      }),
    ],
  });
  return [
    new Paragraph({ spacing: { before: 1800 }, children: [] }),
    band,
    new Paragraph({ spacing: { after: 360 }, children: [] }),
    ...opts.facts.map(([label, value]) =>
      para([text(`${label.toUpperCase()}   `, { size: 16, color: COLOR.muted, bold: true }), text(value, { size: 22 })], {
        spacing: { after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule, space: 4 } },
      }),
    ),
    new Paragraph({ spacing: { before: 1200 }, children: [text(opts.footer, { size: 17, color: COLOR.muted, italics: true })] }),
  ];
}

/** Encabezado y pie vacíos, para la portada. */
export const blankHeader = () => new Header({ children: [] });
export const blankFooter = () => new Footer({ children: [] });

export function pageFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 16, color: COLOR.muted })],
      }),
    ],
  });
}
