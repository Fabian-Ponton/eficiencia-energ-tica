import { describe, expect, it } from 'vitest';
import { measureAllowance, TENURES, tenureInfo, tenureScope, tenureStatement } from '@/domain/tenure';

describe('tenencia del edificio (Res. 40412/2024, art. 3, par. 3)', () => {
  it('la propia no limita nada', () => {
    expect(tenureScope('propia')).toBe('todas');
    expect(measureAllowance('todas', 'cambio-tecnologico')).toBe('permitida');
    expect(measureAllowance('todas', 'fncer')).toBe('permitida');
  });

  it('el arriendo, el comodato y otra figura similar solo permiten buenas prácticas de operación', () => {
    for (const tenure of ['arrendada', 'comodato', 'otra'] as const) {
      const scope = tenureScope(tenure);
      expect(scope, tenure).toBe('solo-bpo');
      expect(measureAllowance(scope, 'bpo')).toBe('permitida');
      for (const type of ['cambio-tecnologico', 'sustitucion-energetico', 'fncer', 'pasiva'] as const) {
        expect(measureAllowance(scope, type), `${tenure} · ${type}`).toBe('no-permitida');
      }
    }
  });

  it('la sede compartida y la tenencia sin registrar piden confirmar, sin bloquear', () => {
    expect(tenureScope('compartida')).toBe('confirmar');
    expect(tenureScope(undefined)).toBe('confirmar');
    expect(measureAllowance('confirmar', 'cambio-tecnologico')).toBe('confirmar');
    expect(measureAllowance('confirmar', 'bpo')).toBe('permitida');
  });

  it('una entidad privada no queda limitada por una resolución de la administración pública', () => {
    expect(tenureScope('arrendada', 'privada')).toBe('todas');
    expect(tenureScope(undefined, 'privada')).toBe('todas');
    expect(tenureScope('arrendada', 'publica')).toBe('solo-bpo');
  });

  it('cada tenencia tiene nombre, frase y explicación, y no se repite', () => {
    expect(new Set(TENURES.map((t) => t.id)).size).toBe(TENURES.length);
    expect(TENURES.map((t) => t.id)).toEqual(['propia', 'arrendada', 'comodato', 'compartida', 'otra']);
    for (const t of TENURES) {
      expect(t.label.length).toBeGreaterThan(2);
      expect(t.help.length).toBeGreaterThan(30);
      expect(tenureInfo(t.id)).toBe(t);
    }
  });

  it('el informe declara la restricción con la norma que la fija', () => {
    expect(tenureStatement('propia')).toContain('puede implementar cualquier medida');
    expect(tenureStatement('arrendada')).toContain('en arrendamiento');
    expect(tenureStatement('arrendada')).toContain('parágrafo 3 del artículo 3 de la Resolución 40412');
    expect(tenureStatement('otra')).toContain('en otra figura jurídica');
    expect(tenureStatement('compartida')).toContain('por confirmar');
    expect(tenureStatement(undefined)).toContain('por confirmar');
    expect(tenureStatement('arrendada', 'privada')).toBe('');
  });
});
