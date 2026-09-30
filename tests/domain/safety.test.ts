import { describe, expect, it } from 'vitest';
import {
  CONSEQUENCE_CLASSES,
  FREQUENCIES,
  HIGH_RISK_CRITERIA,
  RISK_FACTORS,
  RISK_LEVELS,
  RISK_MATRIX,
  levelOf,
  matrixCounts,
  needsAttention,
  pendingSafetySuggestions,
  riskFactorInfo,
  riskLevel,
  safetyCodes,
  safetyFindingFromSuggestion,
  safetySuggestions,
  summarizeSafety,
  urgencyOf,
  worstConsequence,
  type Frequency,
} from '@/domain/safety';
import type { RetieRiskFactor, RiskLevelNumber, SafetyFinding } from '@/domain/types';

const hallazgo = (id: string, extra: Partial<SafetyFinding> = {}): SafetyFinding => ({
  id,
  projectId: 'p',
  createdAt: Number(id.replace(/\D/g, '')) || 0,
  updatedAt: 0,
  foundAt: '2026-09-10',
  riskFactor: 'sobrecarga',
  real: false,
  highRisk: false,
  imminent: false,
  description: 'Prueba',
  status: 'abierto',
  auto: false,
  ...extra,
});

const FRECUENCIAS_DE_MENOR_A_MAYOR: Frequency[] = ['e', 'd', 'c', 'b', 'a'];

describe('factores de riesgo eléctrico del RETIE (1.5.1.3)', () => {
  it('son los doce de la tabla, cada uno con sus causas y sus medidas de protección', () => {
    const ids: RetieRiskFactor[] = [
      'arcos',
      'ausencia-electricidad',
      'campos-electromagneticos',
      'contacto-directo',
      'contacto-indirecto',
      'cortocircuito',
      'electricidad-estatica',
      'equipo-defectuoso',
      'rayos',
      'sobrecarga',
      'tension-contacto',
      'tension-paso',
    ];
    expect(RISK_FACTORS.map((f) => f.id)).toEqual(ids);
    for (const f of RISK_FACTORS) {
      expect(f.label.length).toBeGreaterThan(3);
      expect(f.causes.length).toBeGreaterThan(20);
      expect(f.protections.length).toBeGreaterThan(20);
    }
    expect(riskFactorInfo('arcos').causes).toContain('Malos contactos');
    expect(riskFactorInfo('sobrecarga').protections).toContain('compensación de energía reactiva con banco de condensadores');
    expect(riskFactorInfo('contacto-directo').protections).toContain('probar ausencia de tensión');
  });
});

describe('matriz de análisis de riesgos (Tabla 1.5.1.4.1.a)', () => {
  it('reproduce las 25 celdas de la tabla', () => {
    // Filas: consecuencia 5 a 1; columnas: frecuencia E, D, C, B, A (de izquierda a derecha en la tabla)
    const tabla: [RiskLevelNumber, string[]][] = [
      [5, ['medio', 'alto', 'alto', 'alto', 'muy-alto']],
      [4, ['medio', 'medio', 'medio', 'alto', 'alto']],
      [3, ['bajo', 'medio', 'medio', 'medio', 'alto']],
      [2, ['bajo', 'bajo', 'medio', 'medio', 'medio']],
      [1, ['muy-bajo', 'bajo', 'bajo', 'bajo', 'medio']],
    ];
    for (const [consecuencia, fila] of tabla) {
      FRECUENCIAS_DE_MENOR_A_MAYOR.forEach((frecuencia, i) => expect(riskLevel(consecuencia, frecuencia), `consecuencia ${consecuencia} y frecuencia ${frecuencia}`).toBe(fila[i]));
    }
  });

  it('el nivel nunca baja cuando sube la consecuencia ni cuando sube la frecuencia', () => {
    const rank = (c: RiskLevelNumber, f: Frequency) => RISK_LEVELS[RISK_MATRIX[c][f]].rank;
    for (const f of FRECUENCIAS_DE_MENOR_A_MAYOR) for (const c of [1, 2, 3, 4] as const) expect(rank((c + 1) as RiskLevelNumber, f)).toBeGreaterThanOrEqual(rank(c, f));
    for (const c of [1, 2, 3, 4, 5] as const) FRECUENCIAS_DE_MENOR_A_MAYOR.slice(1).forEach((f, i) => expect(rank(c, f)).toBeGreaterThanOrEqual(rank(c, FRECUENCIAS_DE_MENOR_A_MAYOR[i])));
  });

  it('las clases de consecuencia y las frecuencias traen su descripción', () => {
    expect(CONSEQUENCE_CLASSES.map((c) => c.id)).toEqual(['personas', 'economicas', 'ambientales', 'imagen']);
    expect(CONSEQUENCE_CLASSES[0].levels[5]).toBe('Una o más muertes');
    expect(CONSEQUENCE_CLASSES[0].levels[1]).toContain('Molestia funcional');
    expect(CONSEQUENCE_CLASSES[3].levels[4]).toBe('Nacional');
    expect(FREQUENCIES.map((f) => f.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(FREQUENCIES[0].label).toContain('varias veces al mes');
    expect(RISK_LEVELS['muy-alto'].decision).toContain('Inadmisible para trabajar');
    expect(RISK_LEVELS.bajo.permit).toBe('No requiere permiso especial de trabajo.');
    expect(HIGH_RISK_CRITERIA.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('se toma la consecuencia más grave de las cuatro clases y el nivel queda sin valorar si falta algún dato', () => {
    expect(worstConsequence({ personas: 3, economicas: 4, imagen: 2 })).toBe(4);
    expect(worstConsequence({})).toBeUndefined();
    expect(worstConsequence(undefined)).toBeUndefined();
    expect(levelOf({ consequence: 4, frequency: 'b' })).toBe('alto');
    expect(levelOf({ consequence: 4 })).toBeNull();
    expect(levelOf({ frequency: 'a' })).toBeNull();
  });
});

describe('hallazgos de seguridad', () => {
  const valorados = [
    hallazgo('s1', { consequence: 5, frequency: 'a' }),
    hallazgo('s2', { consequence: 2, frequency: 'e' }),
    hallazgo('s3', { consequence: 3, frequency: 'c', highRisk: true }),
    hallazgo('s4', { imminent: true }),
    hallazgo('s5', { consequence: 4, frequency: 'b', status: 'cerrado' }),
    hallazgo('s6'),
  ];

  it('piden atención los abiertos de alto riesgo, peligro inminente o nivel alto en la matriz; los cerrados no', () => {
    expect(valorados.map(needsAttention)).toEqual([true, false, true, true, false, false]);
  });

  it('se ordenan por peligro inminente, alto riesgo, nivel de la matriz y, al final, lo cerrado', () => {
    const orden = [...valorados].sort((a, b) => urgencyOf(b) - urgencyOf(a)).map((f) => f.id);
    expect(orden).toEqual(['s4', 's3', 's1', 's6', 's2', 's5']);
  });

  it('el resumen cuenta lo abierto, lo urgente y lo que falta valorar', () => {
    const s = summarizeSafety(valorados);
    expect(s).toMatchObject({ total: 6, open: 5, closed: 1, imminent: 1, highRisk: 1, highLevel: 1, attention: 3, unevaluated: 2 });
    expect(s.byLevel).toEqual({ 'muy-bajo': 0, bajo: 1, medio: 1, alto: 0, 'muy-alto': 1 });
    expect(summarizeSafety([hallazgo('s1', { deletedAt: 5 })]).total).toBe(0);
    expect(summarizeSafety([]).attention).toBe(0);
  });

  it('los códigos siguen el orden de registro y la matriz solo cuenta los abiertos valorados', () => {
    const codigos = safetyCodes(valorados);
    expect(codigos.get('s1')).toBe('S1');
    expect(codigos.get('s6')).toBe('S6');
    const celdas = matrixCounts(valorados);
    expect([...celdas.keys()].sort()).toEqual(['2e', '3c', '5a']);
    expect(celdas.get('5a')?.map((f) => f.id)).toEqual(['s1']);
  });
});

describe('sugerencias de seguridad a partir de los datos', () => {
  const nodo = (id: string, name: string) => ({ id, name, kind: 'tablero' as const });
  const entrada = {
    checks: [
      { node: nodo('t1', 'Transformador T1'), level: 'critica' as const, ratio: 0.82, load: 122.9, capacity: 150, unit: 'kVA' },
      { node: nodo('td', 'TD-AA · Aires'), level: 'alta' as const, ratio: 0.75, load: 168, capacity: 225, unit: 'A' },
      { node: nodo('ok', 'Circuito holgado'), level: 'normal' as const, ratio: 0.2, load: 4, capacity: 20, unit: 'A' },
    ],
    imbalance: [
      { measurement: { id: 'm1', pointType: 'tablero', pointId: 'td' }, point: 'TD-AA · Aires', level: 'alto' as const, imbalance: 0.1, currents: [168, 151, 139] },
      { measurement: { id: 'm2' }, point: 'General', level: 'normal' as const, imbalance: 0.01, currents: [10, 10, 10] },
    ],
    equipment: [
      { id: 'e1', name: 'Extensión sin polo a tierra', quantity: 2, condition: 'deficiente' as const, areaId: 'a1' },
      { id: 'e2', name: 'Regleta sobrecargada', quantity: 1, condition: 'deficiente' as const, areaId: 'a1' },
      { id: 'e3', name: 'Tablero sin tapa', quantity: 1, condition: 'deficiente' as const },
      { id: 'e4', name: 'Computador', quantity: 5, condition: 'bueno' as const, areaId: 'a1' },
    ],
    areas: [{ id: 'a1', name: 'Laboratorio de química' }],
  };

  it('ofrece los elementos cargados, los desbalances y los equipos deficientes por espacio, cada uno con su factor de riesgo', () => {
    const s = safetySuggestions(entrada);
    expect(s.map((x) => x.ruleId)).toEqual(['carga-t1', 'carga-td', 'desbalance-m1', 'equipos-deficientes-a1', 'equipos-deficientes-sin-espacio']);
    expect(s.map((x) => x.riskFactor)).toEqual(['sobrecarga', 'sobrecarga', 'sobrecarga', 'equipo-defectuoso', 'equipo-defectuoso']);
    expect(s[0]).toMatchObject({ title: 'Transformador T1: carga crítica', entityType: 'electrico', entityId: 't1' });
    expect(s[0].description).toContain('82 %');
    expect(s[2].description).toContain('10,0 %');
    expect(s[3]).toMatchObject({ title: 'Equipos en estado deficiente en Laboratorio de química', entityType: 'area', entityId: 'a1' });
    expect(s[3].description).toContain('3 equipos están en estado deficiente');
    expect(s[4].entityId).toBeUndefined();
  });

  it('lo que ya se adoptó no se vuelve a ofrecer y el borrador nace sin valorar', () => {
    const todas = safetySuggestions(entrada);
    const adoptado = hallazgo('s1', { ruleId: 'carga-t1' });
    const borrado = hallazgo('s2', { ruleId: 'carga-td', deletedAt: 9 });
    const pendientes = pendingSafetySuggestions(todas, [adoptado, borrado]);
    expect(pendientes.map((x) => x.ruleId)).toEqual(['carga-td', 'desbalance-m1', 'equipos-deficientes-a1', 'equipos-deficientes-sin-espacio']);
    const borrador = safetyFindingFromSuggestion(todas[0], 'p', '2026-09-30');
    expect(borrador).toMatchObject({ projectId: 'p', foundAt: '2026-09-30', riskFactor: 'sobrecarga', real: false, highRisk: false, imminent: false, status: 'abierto', auto: true, ruleId: 'carga-t1', entityId: 't1' });
    expect(borrador.consequence).toBeUndefined();
    expect(borrador.frequency).toBeUndefined();
    expect(levelOf(borrador)).toBeNull();
  });
});
