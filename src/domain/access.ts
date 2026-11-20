/**
 * Pantalla de entrada: aviso de propiedad y clave de acceso.
 *
 * QUÉ PROTEGE Y QUÉ NO. La aplicación se publica en internet, así que su programa llega al navegador de quien
 * abra la dirección. Esta clave es una barrera de entrada y, sobre todo, la constancia de que quien entra fue
 * advertido; no es una caja fuerte. Para impedir de verdad el acceso hay que poner el sitio detrás de un control
 * del servidor (por ejemplo Cloudflare Access) con el repositorio privado.
 *
 * La clave no se guarda: se guarda el resultado de pasarla 200.000 veces por PBKDF2-SHA256 con una sal fija.
 * Aunque alguien lea este archivo, probar claves le sale caro.
 *
 * CÓMO CAMBIAR LA CLAVE
 *   1. npm run clave -- "la clave nueva"   (escribe aquí mismo la sal y el resultado)
 *   2. npx vitest run tests/domain/ownership.test.ts   (comprueba que quedó bien)
 *   3. volver a publicar
 * La clave en sí no se guarda en ninguna parte: hay que anotarla en un gestor de contraseñas.
 * El repositorio trae una clave de ejemplo; una prueba del paso 2 falla mientras siga vigente.
 */

/** Pedir la clave además del aviso. En `false` solo se muestra el aviso de propiedad. */
export const REQUIRE_PASSPHRASE = true;

/** Sal y resultado de la clave vigente (ver «cómo cambiar la clave»). */
export const PASSPHRASE_SALT = 'c052486eef2ed599f5d715876fe4a2c5';
export const PASSPHRASE_HASH = 'e06613a91ed19c817415fd5e368dc6cc0f08c1af15e25abde14800d7b569469b';
export const PASSPHRASE_ROUNDS = 200_000;

/**
 * Versión del aviso. Al subirla, la aplicación vuelve a pedir la aceptación en todos los equipos:
 * conviene hacerlo solo cuando cambie el texto legal.
 */
export const TERMS_VERSION = 1;

const STORAGE_KEY = 'pontia_acceso';

export interface AccessRecord {
  /** Cuándo se aceptó, en hora local (AAAA-MM-DDTHH:mm). */
  at: string;
  version: number;
}

const bytes = (hex: string) => Uint8Array.from(hex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? []);
const hex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/** Comparación en tiempo constante: no delata cuántos caracteres acertó quien prueba claves. */
function sameDigest(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Pasa una clave por PBKDF2-SHA256 con la sal y las vueltas indicadas y devuelve el resultado en hexadecimal.
 * Devuelve `null` si el navegador no tiene `crypto.subtle`. Se expone aparte para poder probar el mecanismo
 * sin que las pruebas tengan que conocer la clave vigente.
 */
export async function derivePassphrase(passphrase: string, salt: string, rounds: number): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const key = await subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const derived = await subtle.deriveBits({ name: 'PBKDF2', salt: bytes(salt), iterations: rounds, hash: 'SHA-256' }, key, 256);
  return hex(derived);
}

/** `true` si la clave escrita coincide con la vigente. */
export async function checkPassphrase(passphrase: string): Promise<boolean> {
  const derived = await derivePassphrase(passphrase, PASSPHRASE_SALT, PASSPHRASE_ROUNDS);
  // Sin crypto.subtle (página abierta como archivo local, navegador antiguo) no se puede comprobar: ver `accessState`.
  if (derived === null) return true;
  return sameDigest(derived, PASSPHRASE_HASH);
}

/** La clave solo se puede comprobar en un contexto seguro (https o localhost). */
export const canCheckPassphrase = (): boolean => Boolean(globalThis.crypto?.subtle);

/** Aceptación guardada en este equipo, si sigue siendo de la versión vigente del aviso. */
export function readAccess(): AccessRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as AccessRecord;
    return record?.version === TERMS_VERSION && typeof record.at === 'string' ? record : null;
  } catch {
    // Navegador con el almacenamiento bloqueado: se pide la aceptación cada vez
    return null;
  }
}

export function grantAccess(now = new Date()): void {
  const at = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ at, version: TERMS_VERSION } satisfies AccessRecord));
  } catch {
    // Sin almacenamiento el acceso dura lo que la pestaña
  }
}

/** Olvida la aceptación en este equipo: la próxima vez se vuelve a pedir. */
export function revokeAccess(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que borrar
  }
}
