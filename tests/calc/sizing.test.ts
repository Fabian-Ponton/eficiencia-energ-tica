import { describe, expect, it } from 'vitest';
import { loadingLevel, loadingRatio, phaseImbalance, threePhaseCurrentA } from '@/domain/calc/sizing/capacity';
import { coolingAdequacy, coolingLoad } from '@/domain/calc/sizing/cooling';
import { achievedLux, lightingPowerDensity, lightingStatus, luminairesRequired } from '@/domain/calc/sizing/lighting';
import { floorArea, roomIndex, roomVolume } from '@/domain/calc/sizing/space';

describe('dimensionamiento de espacios', () => {
  const aula = { lengthM: 8, widthM: 6, heightM: 3 };

  it('área, volumen e índice del local', () => {
    expect(floorArea(aula)).toBe(48);
    expect(roomVolume(aula)).toBe(144);
    expect(roomIndex(aula)).toBeCloseTo(1.5584, 4);
  });

  it('método de los lúmenes', () => {
    const base = { targetLux: 500, areaM2: 48, lumensPerLuminaire: 4000, maintenanceFactor: 0.8 };
    const conCu060 = luminairesRequired({ ...base, utilizationFactor: 0.6 });
    expect(conCu060.exact).toBeCloseTo(12.5, 10);
    expect(conCu060.count).toBe(13);
    expect(luminairesRequired({ ...base, utilizationFactor: 0.63 }).count).toBe(12);
    expect(achievedLux(12, { ...base, utilizationFactor: 0.63 })).toBeCloseTo(504, 8);
    expect(lightingPowerDensity(480, 48)).toBe(10);
    expect(lightingStatus(312, 500)).toBe('insuficiente');
    expect(lightingStatus(520, 500)).toBe('adecuada');
  });

  it('carga térmica del aula 601 frente a los aires instalados', () => {
    const carga = coolingLoad({
      areaM2: 48,
      envelopeBtuHPerM2: 350,
      people: 35,
      btuHPerPerson: 450,
      lightingW: 480,
      equipmentW: 600,
      windowAreaM2: 6,
      solarBtuHPerM2: 400,
      safetyFactor: 0.1,
    });
    expect(carga.components.envelope).toBe(16_800);
    expect(carga.components.people).toBe(15_750);
    expect(carga.totalBtuH).toBeCloseTo(42_498.5, 1);
    const evaluacion = coolingAdequacy(carga.totalBtuH, 36_000);
    expect(evaluacion.status).toBe('subdimensionado');
    expect(evaluacion.ratio).toBeCloseTo(0.847, 3);
  });
});

describe('carga instalada frente a la capacidad', () => {
  it('90 kVA sobre un transformador de 112,5 kVA → 80 %', () => {
    expect(loadingRatio(90, 112.5)).toBeCloseTo(0.8, 10);
    expect(loadingLevel(0.8)).toBe('alta');
    expect(loadingLevel(96 / 110)).toBe('critica');
    expect(loadingLevel(0.45)).toBe('normal');
  });

  it('corriente trifásica y desbalance de fases', () => {
    expect(threePhaseCurrentA(58.5, 208)).toBeCloseTo(162.38, 2);
    expect(phaseImbalance([30, 25, 22])).toBeCloseTo(0.1688, 4);
  });
});
