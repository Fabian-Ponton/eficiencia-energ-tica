/**
 * Cambia la clave de la pantalla de entrada.
 *
 *   npm run clave -- "la clave nueva"
 *
 * Calcula la sal y el resultado de la clave y los escribe en `src/domain/access.ts`.
 * La clave en sí no se guarda en ningún lado ni se imprime: anótala en tu gestor de contraseñas.
 *
 * Con `--mostrar` no toca el archivo y solo imprime las dos líneas, para pegarlas a mano.
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUNDS = 200_000;
const ARCHIVO = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'domain', 'access.ts');

const args = process.argv.slice(2);
const soloMostrar = args.includes('--mostrar');
const clave = args.filter((a) => a !== '--mostrar').join(' ');

if (!clave) {
  console.error('Falta la clave. Uso:  npm run clave -- "la clave nueva"');
  process.exit(1);
}
if (clave.length < 8) {
  console.error('La clave es muy corta: usa al menos 8 caracteres (mejor una frase).');
  process.exit(1);
}
if (clave === 'PONTIA-2026') {
  console.error('Esa es la clave de ejemplo que trae el repositorio y está escrita en su documentación. Elige otra.');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(clave.normalize('NFKC'), Buffer.from(salt, 'hex'), ROUNDS, 32, 'sha256').toString('hex');
const lineaSal = `export const PASSPHRASE_SALT = '${salt}';`;
const lineaHash = `export const PASSPHRASE_HASH = '${hash}';`;

if (soloMostrar) {
  console.log('\nPega estas dos líneas en src/domain/access.ts:\n');
  console.log(lineaSal);
  console.log(lineaHash);
  console.log('\nGuarda la clave en tu gestor de contraseñas: no queda escrita en ninguna parte.\n');
  process.exit(0);
}

let fuente;
try {
  fuente = readFileSync(ARCHIVO, 'utf8');
} catch {
  console.error(`No se pudo leer ${ARCHIVO}. Ejecuta el comando desde la carpeta del proyecto.`);
  process.exit(1);
}

const RE_SAL = /^export const PASSPHRASE_SALT = '[0-9a-f]*';$/m;
const RE_HASH = /^export const PASSPHRASE_HASH = '[0-9a-f]*';$/m;

if (!RE_SAL.test(fuente) || !RE_HASH.test(fuente)) {
  console.error('No encontré las líneas de la sal y el resultado en src/domain/access.ts.');
  console.error('No se modificó nada. Vuelve a intentarlo con --mostrar y pégalas a mano:');
  console.error('   npm run clave -- --mostrar "la clave nueva"');
  process.exit(1);
}

const actualizado = fuente.replace(RE_SAL, lineaSal).replace(RE_HASH, lineaHash);
writeFileSync(ARCHIVO, actualizado);

console.log('\nListo: la clave nueva quedó escrita en src/domain/access.ts.');
console.log('La clave en sí no se guardó en ninguna parte: anótala en tu gestor de contraseñas.\n');
console.log('Comprueba y publica así:');
console.log('   npx vitest run tests/domain/ownership.test.ts\n');
