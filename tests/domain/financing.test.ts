import { describe, expect, it } from 'vitest';
import { chosenFinancing, FINANCING_GROUPS, FINANCING_MODELS, financingModelOf } from '@/domain/financing';

describe('modelos de financiación y contratación (guía UPME de PGEE, módulo 3)', () => {
  it('cada modelo tiene identificador único, un grupo conocido y una descripción', () => {
    const ids = FINANCING_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of FINANCING_MODELS) {
      expect(Object.keys(FINANCING_GROUPS)).toContain(m.group);
      expect(m.label.length).toBeGreaterThan(3);
      expect(m.description.length).toBeGreaterThan(30);
    }
  });

  it('cubre los caminos de la guía: recursos propios, crédito, contratos de servicios, APP, desempeño energético y FENOGE', () => {
    expect(FINANCING_MODELS.map((m) => m.id)).toEqual(['funcionamiento', 'inversion', 'ahorros', 'leasing', 'credito-proveedor', 'linea-credito', 'renting', 'app', 'desempeno', 'fenoge']);
    expect(financingModelOf('desempeno')?.label).toBe('Contrato por desempeño energético (ESCO)');
    expect(financingModelOf('no-existe')).toBeUndefined();
  });

  it('los elegidos salen en el orden del catálogo y se ignoran los que ya no existen', () => {
    expect(chosenFinancing(['fenoge', 'funcionamiento', 'antiguo']).map((m) => m.id)).toEqual(['funcionamiento', 'fenoge']);
    expect(chosenFinancing(undefined)).toEqual([]);
    expect(chosenFinancing([])).toEqual([]);
  });
});
