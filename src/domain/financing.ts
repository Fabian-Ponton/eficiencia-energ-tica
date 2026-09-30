/**
 * Modelos de financiación y de contratación que la Guía UPME de PGEE para entidades públicas (dic. 2020, módulo 3) presenta para
 * llevar las medidas a la práctica. El PGEE no decide el instrumento jurídico: la entidad lo define con su oficina jurídica y de
 * presupuesto. Aquí solo se elige cuáles se consideran y se deja constancia en el plan.
 */

export type FinancingModelId = 'funcionamiento' | 'inversion' | 'ahorros' | 'leasing' | 'credito-proveedor' | 'linea-credito' | 'renting' | 'app' | 'desempeno' | 'fenoge';

export type FinancingGroup = 'recursos' | 'credito' | 'servicios' | 'fondos';

export interface FinancingModel {
  id: FinancingModelId;
  label: string;
  group: FinancingGroup;
  /** Qué es y cómo se paga, en una frase. */
  description: string;
}

export const FINANCING_GROUPS: Record<FinancingGroup, string> = {
  recursos: 'Recursos de la entidad',
  credito: 'Operaciones de crédito',
  servicios: 'Contratos de servicios y alianzas',
  fondos: 'Fondos y líneas de fomento',
};

export const FINANCING_MODELS: readonly FinancingModel[] = [
  {
    id: 'funcionamiento',
    label: 'Gastos de funcionamiento',
    group: 'recursos',
    description: 'Compras ordinarias de la entidad con criterios de compra pública sostenible y con lo que resulte de la auditoría.',
  },
  {
    id: 'inversion',
    label: 'Proyecto de inversión',
    group: 'recursos',
    description: 'Se formula en el banco de proyectos con los ahorros esperados como beneficios, y se ejecuta contra el presupuesto de inversión.',
  },
  {
    id: 'ahorros',
    label: 'Ahorros reinvertidos',
    group: 'recursos',
    description: 'La Ley 1715 (art. 30) permite usar los ahorros de las medidas de eficiencia y de la autogeneración con FNCER para pagar las inversiones y nuevas inversiones.',
  },
  {
    id: 'leasing',
    label: 'Leasing financiero o de infraestructura',
    group: 'credito',
    description: 'La entidad recibe los equipos y paga un canon periódico; permite plazos largos que los ahorros ayudan a sostener.',
  },
  {
    id: 'credito-proveedor',
    label: 'Crédito de proveedor',
    group: 'credito',
    description: 'Pago aplazado al proveedor del equipo: la entidad lo usa desde el inicio y es suyo desde entonces.',
  },
  {
    id: 'linea-credito',
    label: 'Líneas de crédito para eficiencia energética',
    group: 'credito',
    description: 'Líneas de la banca de fomento (por ejemplo, FINDETER y BANCOLDEX) y de la banca privada para proyectos de eficiencia energética.',
  },
  {
    id: 'renting',
    label: 'Renting',
    group: 'servicios',
    description: 'Arrendamiento de equipos con su administración, operación y mantenimiento; contratos de largo plazo, normalmente con vigencias futuras.',
  },
  {
    id: 'app',
    label: 'Alianza público-privada (APP)',
    group: 'servicios',
    description: 'El privado financia, diseña y construye o moderniza la infraestructura y la entidad paga por el servicio; se piensa para inversiones grandes.',
  },
  {
    id: 'desempeno',
    label: 'Contrato por desempeño energético (ESCO)',
    group: 'servicios',
    description: 'El contratista implementa las medidas y recupera la inversión con los ahorros que genera, compartidos o garantizados.',
  },
  {
    id: 'fenoge',
    label: 'FENOGE',
    group: 'fondos',
    description: 'Fondo creado por la Ley 1715 (art. 10) para financiar inversiones en eficiencia energética; sus recursos pueden ser reembolsables o no.',
  },
];

export const financingModelOf = (id: string): FinancingModel | undefined => FINANCING_MODELS.find((m) => m.id === id);

/** Etiquetas de los modelos elegidos, en el orden del catálogo (ignora los ids que ya no existen). */
export function chosenFinancing(ids: readonly string[] | undefined): FinancingModel[] {
  const chosen = new Set(ids ?? []);
  return FINANCING_MODELS.filter((m) => chosen.has(m.id));
}
