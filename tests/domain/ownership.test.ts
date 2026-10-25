import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkPassphrase,
  grantAccess,
  PASSPHRASE_HASH,
  PASSPHRASE_ROUNDS,
  PASSPHRASE_SALT,
  readAccess,
  revokeAccess,
  REQUIRE_PASSPHRASE,
  TERMS_VERSION,
} from '@/domain/access';
import { ACCESS_TERMS, copyrightLine, copyrightShort, copyrightYears, DEFAULT_HOLDER, documentNotice, ownershipNotice } from '@/domain/ownership';

/** Almacenamiento de mentira: en Node no hay `localStorage`. */
function fakeStorage() {
  const datos = new Map<string, string>();
  const almacen = {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  };
  vi.stubGlobal('localStorage', almacen);
  return datos;
}

afterEach(() => vi.unstubAllGlobals());

describe('aviso de propiedad', () => {
  it('usa el titular por omisión y lo cambia cuando el auditor escribe otro', () => {
    expect(copyrightShort(undefined, new Date(2026, 0, 1))).toBe(`© 2026 ${DEFAULT_HOLDER} · PONTIA`);
    expect(copyrightShort('Energética del Caribe S.A.S.', new Date(2026, 0, 1))).toBe('© 2026 Energética del Caribe S.A.S. · PONTIA');
    // Un titular en blanco o con solo espacios no borra el aviso
    expect(copyrightShort('   ', new Date(2026, 0, 1))).toContain(DEFAULT_HOLDER);
  });

  it('el año es el de publicación y se vuelve un rango cuando pasa el tiempo', () => {
    expect(copyrightYears(new Date(2026, 5, 1))).toBe('2026');
    expect(copyrightYears(new Date(2028, 5, 1))).toBe('2026–2028');
  });

  it('la línea larga dice que los derechos están reservados y el aviso cita la norma', () => {
    expect(copyrightLine(undefined, new Date(2026, 0, 1))).toBe(`© 2026 ${DEFAULT_HOLDER} · PONTIA. Todos los derechos reservados.`);
    const aviso = ownershipNotice('Fulana Pérez', new Date(2026, 0, 1));
    expect(aviso).toContain('Fulana Pérez');
    expect(aviso).toContain('Ley 23 de 1982');
    expect(aviso).toContain('sin autorización escrita del titular');
    // El pie de los documentos dice con qué se hicieron y de quién son
    expect(documentNotice(undefined, new Date(2026, 0, 1))).toContain('Elaborado con PONTIA');
    expect(documentNotice(undefined, new Date(2026, 0, 1))).toContain('Todos los derechos reservados');
  });

  it('la pantalla de entrada advierte de la propiedad, de la copia y de dónde quedan los datos', () => {
    expect(ACCESS_TERMS).toHaveLength(3);
    expect(ACCESS_TERMS.join(' ')).toContain('propiedad');
    expect(ACCESS_TERMS.join(' ')).toContain('No está permitido copiar');
    expect(ACCESS_TERMS.join(' ')).toContain('únicamente en este equipo');
  });
});

describe('clave de la pantalla de entrada', () => {
  it('acepta la clave vigente y rechaza cualquier otra', async () => {
    expect(REQUIRE_PASSPHRASE).toBe(true);
    expect(await checkPassphrase('PONTIA-2026')).toBe(true);
    expect(await checkPassphrase('pontia-2026')).toBe(false);
    expect(await checkPassphrase('')).toBe(false);
    expect(await checkPassphrase('PONTIA-2026 ')).toBe(false);
  });

  it('la clave no está escrita en el código: solo queda su resultado con sal y muchas vueltas', () => {
    expect(PASSPHRASE_ROUNDS).toBeGreaterThanOrEqual(200_000);
    expect(PASSPHRASE_SALT).toMatch(/^[0-9a-f]{32}$/);
    expect(PASSPHRASE_HASH).toMatch(/^[0-9a-f]{64}$/);
    expect(PASSPHRASE_HASH.toLowerCase()).not.toContain('pontia');
  });
});

describe('aceptación guardada en el equipo', () => {
  it('se guarda al entrar, se recuerda y se puede olvidar', () => {
    fakeStorage();
    expect(readAccess()).toBeNull();
    grantAccess(new Date(2026, 9, 25, 14, 30));
    expect(readAccess()).toMatchObject({ at: '2026-10-25T14:30', version: TERMS_VERSION });
    revokeAccess();
    expect(readAccess()).toBeNull();
  });

  it('una aceptación de una versión anterior del aviso no vale: se vuelve a pedir', () => {
    const datos = fakeStorage();
    datos.set('pontia_acceso', JSON.stringify({ at: '2026-01-01T08:00', version: TERMS_VERSION - 1 }));
    expect(readAccess()).toBeNull();
  });

  it('sin almacenamiento disponible no se rompe: pide la aceptación cada vez', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    });
    expect(readAccess()).toBeNull();
    expect(() => grantAccess()).not.toThrow();
    expect(() => revokeAccess()).not.toThrow();
  });
});
