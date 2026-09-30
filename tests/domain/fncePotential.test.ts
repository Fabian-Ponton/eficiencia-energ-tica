import { describe, expect, it } from 'vitest';
import { FNCE_DEFAULTS, fncePotential, fnceStatement } from '@/domain/fncePotential';

describe('potencial de FNCER (solar fotovoltaica, dato de referencia)', () => {
  it('calcula los módulos que caben en la cubierta y la generación con las horas solares pico', () => {
    const p = fncePotential({ areas: [{ roofAvailableM2: 400 }, { roofAvailableM2: 200 }, {}], peakSunHours: 5.5, annualKwh: 186_400, tariffCopPerKwh: 850 })!;
    // 600 m² ÷ 2,6 m² = 230 módulos de 550 Wp = 126,5 kWp; 126,5 × 5,5 h × 0,8 × 365 días
    expect(p.roofM2).toBe(600);
    expect(p.modules).toBe(230);
    expect(p.kwp).toBeCloseTo(126.5, 6);
    expect(p.arrayAreaM2).toBeCloseTo(230 * 2.6, 6);
    expect(p.annualGenerationKwh).toBeCloseTo(126.5 * 5.5 * 0.8 * 365, 3);
    expect(p.coverage).toBeCloseTo(p.annualGenerationKwh / 186_400, 6);
    expect(p.savingsCopYear).toBeCloseTo(p.annualGenerationKwh * 850, 3);
    expect(FNCE_DEFAULTS.moduleWp).toBe(550);
  });

  it('sin cubierta, sin horas solares o con una cubierta menor que un módulo no hay potencial', () => {
    expect(fncePotential({ areas: [{}], peakSunHours: 5 })).toBeNull();
    expect(fncePotential({ areas: [{ roofAvailableM2: 100 }] })).toBeNull();
    expect(fncePotential({ areas: [{ roofAvailableM2: 2 }], peakSunHours: 5 })).toBeNull();
    // Sin consumo o sin tarifa, esas cifras quedan vacías pero el potencial existe
    const p = fncePotential({ areas: [{ roofAvailableM2: 50 }], peakSunHours: 5 })!;
    expect(p.coverage).toBeNull();
    expect(p.savingsCopYear).toBeNull();
  });
});

describe('párrafo de FNCER del informe', () => {
  const potencial = fncePotential({ areas: [{ roofAvailableM2: 600 }], peakSunHours: 5.5, annualKwh: 186_400 });

  it('con potencial dice lo que admite la cubierta y aclara que no es un diseño', () => {
    const s = fnceStatement({ fnce: 'potencial' }, potencial);
    expect(s.kind).toBe('potencial');
    expect(s.text).toContain('600 m²');
    expect(s.text).toContain('230 módulos de 550 Wp');
    expect(s.text).toContain('126,5 kWp');
    expect(s.text).toContain('no incluye el diseño del sistema');
  });

  it('con potencial pero sin datos, pide la cubierta y las horas solares', () => {
    const s = fnceStatement({ fnce: 'potencial' }, null);
    expect(s.kind).toBe('potencial');
    expect(s.text).toContain('faltan el área de cubierta disponible');
  });

  it('la exclusión lleva la justificación que escribió el auditor', () => {
    const s = fnceStatement({ fnce: 'excluida', fnceNote: 'la cubierta es de otra dependencia' }, potencial);
    expect(s.kind).toBe('excluida');
    expect(s.text).toContain('por fuera del alcance');
    expect(s.text).toContain('la cubierta es de otra dependencia');
    expect(fnceStatement({ fnce: 'excluida' }, null).text).not.toContain(': .');
  });

  it('mientras el auditor no excluya las FNCER, el informe reporta el potencial (la opción por omisión)', () => {
    expect(fnceStatement(undefined, potencial).kind).toBe('potencial');
    expect(fnceStatement(undefined, potencial).text).toContain('126,5 kWp');
    expect(fnceStatement(undefined, null).text).toContain('Datos generales');
  });
});
