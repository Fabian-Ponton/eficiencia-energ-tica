import { describe, expect, it } from 'vitest';
import { guessCategory } from '@/db/legacyImport';
import { END_USES, endUseOf, isLabType, PHOTO_KINDS, regimeOf, SPACE_GROUPS, SPACE_TYPES, spaceTypeOf, USAGE_REGIMES } from '@/domain/catalogs';
import { resolveSizing } from '@/domain/sizing';

describe('tipos de laboratorio (RETILAP 2026, Libro 3, tabla 36)', () => {
  const laboratorios = SPACE_TYPES.filter((t) => t.group === 'laboratorio');

  it('hay un tipo general y ocho específicos, cada uno con su fila de la norma', () => {
    expect(laboratorios.map((t) => t.id)).toEqual([
      'laboratorio',
      'lab-quimica',
      'lab-fisica',
      'lab-biologia',
      'lab-electronica',
      'lab-computo',
      'lab-mecanica',
      'lab-ambiental',
      'lab-otro',
    ]);
    for (const t of laboratorios) {
      expect(t.reference, t.id).toContain('RETILAP 2026');
      expect(t).toMatchObject({ uo: 0.6, ra: 80, ugr: 19 });
    }
  });

  it('la iluminancia es 500 lx, salvo el laboratorio de cómputo, que es de solo computadoras (300 lx)', () => {
    for (const t of laboratorios) expect(t.lux, t.id).toBe(t.id === 'lab-computo' ? 300 : 500);
    expect(spaceTypeOf('lab-computo')?.reference).toContain('36,11');
    expect(spaceTypeOf('lab-mecanica')?.reference).toContain('36,16');
    // El aula y el laboratorio general conservan sus valores de siempre
    expect(spaceTypeOf('aula')?.lux).toBe(500);
    expect(spaceTypeOf('sala-computo')?.lux).toBe(500);
  });

  it('el selector separa los laboratorios del resto y ningún tipo se pierde', () => {
    expect(SPACE_GROUPS.map((g) => g.label)).toEqual(['Laboratorios y talleres', 'Otros espacios']);
    expect(SPACE_GROUPS.flatMap((g) => g.items)).toHaveLength(SPACE_TYPES.length);
    expect(isLabType('lab-quimica')).toBe(true);
    expect(isLabType('oficina')).toBe(false);
    expect(isLabType(undefined)).toBe(false);
  });

  it('el VEEI de aulas y laboratorios es 4,0 y el de la oficina 3,0 (tabla 3.2.5.a)', () => {
    const { spaces } = resolveSizing();
    for (const id of ['aula', 'laboratorio', 'sala-computo', ...laboratorios.map((t) => t.id)]) expect(spaces[id].veeiLimit, id).toBe(4);
    expect(spaces.oficina.veeiLimit).toBe(3);
    // Los tipos de laboratorio heredan la carga de envolvente del laboratorio general
    expect(spaces['lab-quimica'].envelopeBtuHPerM2).toBe(spaces.laboratorio.envelopeBtuHPerM2);
    expect(spaces['lab-computo'].lux).toBe(300);
  });
});

describe('uso final de laboratorio', () => {
  it('es el octavo color de la paleta, antes de «Otros», y tiene su par para modo oscuro', () => {
    const ids = END_USES.map((u) => u.id);
    expect(ids).toEqual(['climatizacion', 'motores', 'refrigeracion', 'iluminacion', 'cocina', 'ti', 'laboratorio', 'otros']);
    expect(endUseOf('laboratorio')).toMatchObject({ label: 'Equipos de laboratorio', color: '#4a3aa7', colorDark: '#9085e9' });
    expect(new Set(END_USES.map((u) => u.color)).size).toBe(END_USES.length);
  });

  it('reconoce el equipo de laboratorio por su nombre sin confundirlo con la cocina', () => {
    for (const name of ['Mufla', 'Autoclave 50 L', 'Estufa de secado', 'Horno de secado', 'Incubadora de CO2', 'Campana de extracción', 'Centrífuga', 'Balanza analítica', 'Baño María']) {
      expect(guessCategory(name), name).toBe('laboratorio');
    }
    expect(guessCategory('Estufa eléctrica')).toBe('cocina');
    expect(guessCategory('Horno microondas')).toBe('cocina');
    expect(guessCategory('Aire acondicionado mini-split')).toBe('climatizacion');
    expect(guessCategory('Nevera de laboratorio')).toBe('refrigeracion');
  });

  it('las fotos admiten documentos e instrumentos', () => {
    expect(PHOTO_KINDS.map((k) => k.id)).toEqual(expect.arrayContaining(['documento', 'instrumento']));
  });
});

describe('regímenes de uso', () => {
  it('sin régimen se trata como «por horario»', () => {
    expect(regimeOf(undefined).id).toBe('horario');
    expect(regimeOf('continuo').label).toBe('Continuo 24 h');
    expect(USAGE_REGIMES.map((r) => r.id)).toEqual(['horario', 'continuo', 'ciclos', 'respaldo']);
  });
});
