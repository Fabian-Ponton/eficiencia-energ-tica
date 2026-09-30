import { describe, expect, it } from 'vitest';
import { createProjectRecord } from '@/db/projects';
import { findEntity, findSite, groupBySite, knownEntities, normalizeName } from '@/domain/entities';
import type { Project } from '@/domain/types';

const proyecto = (name: string, updatedAt: number, extra: Partial<Project> = {}): Project => ({ ...createProjectRecord({ name }), updatedAt, ...extra });

describe('entidades y sedes', () => {
  it('compara nombres sin tildes, mayúsculas ni espacios de más', () => {
    expect(normalizeName('  Universidad  de LA Guajira ')).toBe('universidad de la guajira');
    expect(normalizeName('Educación')).toBe(normalizeName('educacion'));
    expect(normalizeName(undefined)).toBe('');
  });

  it('junta las entidades de los proyectos y toma sus datos del más reciente', () => {
    const entidades = knownEntities([
      proyecto('Bloque 6', 100, {
        client: 'Universidad de La Guajira',
        nit: '900.000.000-0',
        city: 'Riohacha',
        site: { name: 'Riohacha', upmeCode: 'SEDE-01' },
        address: 'Calle 1',
        entity: { kind: 'publica', order: 'territorial' },
      }),
      proyecto('Laboratorios', 300, { client: 'universidad de la guajira', site: { name: 'Riohacha' } }),
      proyecto('Sede Maicao', 200, { client: 'Universidad de La Guajira', site: { name: 'Maicao' } }),
      proyecto('Otro cliente', 50, { client: 'Clínica del Norte', entity: { kind: 'privada' } }),
      proyecto('Sin cliente', 10),
      proyecto('Eliminado', 999, { client: 'Entidad borrada', deletedAt: 1 }),
    ]);
    expect(entidades.map((e) => e.name)).toEqual(['universidad de la guajira', 'Clínica del Norte']);
    const uni = findEntity(entidades, 'Universidad de La Guajira')!;
    expect(uni).toMatchObject({ nit: '900.000.000-0', kind: 'publica', order: 'territorial', city: 'Riohacha' });
    expect(uni.sites.map((s) => s.name)).toEqual(['Riohacha', 'Maicao']);
    // Los datos de la sede se completan con el proyecto que sí los tiene
    expect(findSite(uni, 'RIOHACHA')).toMatchObject({ upmeCode: 'SEDE-01', address: 'Calle 1' });
    expect(findEntity(entidades, 'Entidad borrada')).toBeUndefined();
    expect(findSite(undefined, 'Riohacha')).toBeUndefined();
  });

  it('agrupa por entidad y sede en el orden de llegada y deja al final los que no tienen ninguna', () => {
    const lista = [
      proyecto('A', 5, { client: 'Universidad', site: { name: 'Riohacha' } }),
      proyecto('B', 4),
      proyecto('C', 3, { client: 'Clínica' }),
      proyecto('D', 2, { client: 'UNIVERSIDAD', site: { name: 'riohacha' } }),
      proyecto('E', 1, { client: 'Universidad', site: { name: 'Maicao' } }),
    ];
    const grupos = groupBySite(lista, (p) => p);
    expect(grupos.map((g) => [g.entity, g.site, g.items.map((p) => p.name)])).toEqual([
      ['Universidad', 'Riohacha', ['A', 'D']],
      ['Clínica', '', ['C']],
      ['Universidad', 'Maicao', ['E']],
      ['', '', ['B']],
    ]);
  });

  it('sin proyectos no hay grupos', () => {
    expect(groupBySite([], (p: Project) => p)).toEqual([]);
    expect(knownEntities([])).toEqual([]);
  });
});
