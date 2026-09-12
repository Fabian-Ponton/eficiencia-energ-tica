/** 1 W de calor equivale a 3,412 BTU/h. */
export const BTU_H_PER_WATT = 3.412;

/**
 * Datos del método simplificado de carga térmica. Las densidades por tipo de espacio vienen de
 * catálogos editables: son reglas prácticas, no reemplazan un cálculo detallado (ASHRAE).
 */
export interface CoolingLoadInput {
  areaM2: number;
  /** Carga por envolvente y ventilación según el tipo de espacio (BTU/h por m²). */
  envelopeBtuHPerM2: number;
  people: number;
  btuHPerPerson: number;
  lightingW: number;
  equipmentW: number;
  windowAreaM2?: number;
  /** Ganancia solar por m² de ventana (BTU/h), según orientación. */
  solarBtuHPerM2?: number;
  /** Factor de seguridad como fracción (0,10 = 10 %). */
  safetyFactor?: number;
}

export interface CoolingLoadResult {
  components: {
    envelope: number;
    people: number;
    solar: number;
    equipment: number;
    lighting: number;
    safety: number;
  };
  totalBtuH: number;
}

export function coolingLoad(i: CoolingLoadInput): CoolingLoadResult {
  const envelope = i.areaM2 * i.envelopeBtuHPerM2;
  const people = i.people * i.btuHPerPerson;
  const solar = (i.windowAreaM2 ?? 0) * (i.solarBtuHPerM2 ?? 0);
  const equipment = i.equipmentW * BTU_H_PER_WATT;
  const lighting = i.lightingW * BTU_H_PER_WATT;
  const subtotal = envelope + people + solar + equipment + lighting;
  const safety = subtotal * (i.safetyFactor ?? 0);
  return { components: { envelope, people, solar, equipment, lighting, safety }, totalBtuH: subtotal + safety };
}

export type CoolingAdequacy = 'subdimensionado' | 'adecuado' | 'sobredimensionado';

/** Compara la capacidad instalada con la requerida. Umbrales configurables (90 % y 115 % por defecto). */
export function coolingAdequacy(requiredBtuH: number, installedBtuH: number, { under = 0.9, over = 1.15 } = {}): {
  ratio: number;
  status: CoolingAdequacy;
} {
  const ratio = installedBtuH / requiredBtuH;
  const status: CoolingAdequacy = ratio < under ? 'subdimensionado' : ratio > over ? 'sobredimensionado' : 'adecuado';
  return { ratio, status };
}
