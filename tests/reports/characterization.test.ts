import { describe, expect, it } from 'vitest';
import { createProjectRecord } from '@/db/projects';
import type { Project } from '@/domain/types';
import { characterizationFacts, characterizationNotes } from '@/reports/characterization';

const base = (extra: Partial<Project> = {}): Project => ({ ...createProjectRecord({ name: 'Laboratorios' }), ...extra });
const valor = (rows: [string, string][], etiqueta: string) => rows.find(([label]) => label === etiqueta)?.[1];

describe('caracterización de la entidad en el informe', () => {
  it('un proyecto sin datos muestra rayas, no valores inventados', () => {
    const filas = characterizationFacts(base(), 2026);
    for (const etiqueta of ['Entidad', 'NIT', 'Sede', 'Ubicación', 'Proceso o actividad', 'Entorno', 'Edad y pisos', 'Tenencia del edificio', 'Área construida', 'Usuarios']) {
      expect(valor(filas, etiqueta), etiqueta).toBe('—');
    }
    expect(valor(filas, 'Población')).toBeUndefined();
  });

  it('arma cada fila con lo registrado', () => {
    const filas = characterizationFacts(
      base({
        client: 'Universidad de ejemplo',
        nit: '900.000.000-0',
        city: 'Riohacha',
        address: 'Calle 1 # 2-3',
        areaM2: 1200,
        users: 950,
        entity: { kind: 'publica', order: 'territorial' },
        site: { name: 'Sede Riohacha', upmeCode: 'SEDE-01' },
        building: { builtYear: 1998, floors: 2, activity: 'Docencia y laboratorios', surroundings: 'Campus urbano', tenure: 'propia' },
        population: { students: 800, staff: 120, floating: 30 },
      }),
      2026,
    );
    expect(valor(filas, 'Entidad')).toBe('Universidad de ejemplo · Pública · orden territorial');
    expect(valor(filas, 'Sede')).toBe('Sede Riohacha · código SEDE-01');
    expect(valor(filas, 'Ubicación')).toBe('Calle 1 # 2-3, Riohacha');
    expect(valor(filas, 'Edad y pisos')).toBe('1998 (28 años) · 2 pisos');
    expect(valor(filas, 'Tenencia del edificio')).toBe('Propia');
    expect(valor(filas, 'Población')).toBe('800 estudiantes, 120 de personal docente y administrativo, 30 de población flotante');
    expect(valor(filas, 'Usuarios')).toBe('950');
  });

  it('las notas dicen qué falta, la consecuencia de la tenencia y el alcance escrito', () => {
    const vacio = characterizationNotes(base({ client: 'Universidad de ejemplo' }));
    expect(vacio.missing).toContain('tenencia del edificio');
    expect(vacio.missing).not.toContain('entidad o cliente');
    expect(vacio.tenure).toContain('por confirmar');
    expect(vacio.scope).toEqual([]);

    const arrendado = characterizationNotes(
      base({
        building: { tenure: 'arrendada' },
        scope: { boundary: ' El edificio de laboratorios. ', limitations: 'Un laboratorio en mantenimiento.', fnce: 'potencial' },
      }),
    );
    expect(arrendado.tenure).toContain('en arrendamiento');
    expect(arrendado.scope).toEqual([
      { title: 'Frontera de la auditoría', text: 'El edificio de laboratorios.' },
      { title: 'Limitaciones', text: 'Un laboratorio en mantenimiento.' },
    ]);
  });
});
