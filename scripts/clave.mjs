/**
 * Calcula la sal y el resultado de una clave nueva para la pantalla de entrada.
 *
 *   npm run clave -- "la clave nueva"
 *
 * Después hay que pegar las dos líneas que imprime en `src/domain/access.ts` y volver a publicar.
 * La clave en sí no se guarda en ningún lado.
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const ROUNDS = 200_000;
const clave = process.argv.slice(2).join(' ');

if (!clave) {
  console.error('Falta la clave. Uso:  npm run clave -- "la clave nueva"');
  process.exit(1);
}
if (clave.length < 8) {
  console.error('La clave es muy corta: usa al menos 8 caracteres (mejor una frase).');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(clave.normalize('NFKC'), Buffer.from(salt, 'hex'), ROUNDS, 32, 'sha256').toString('hex');

console.log('\nPega estas dos líneas en src/domain/access.ts:\n');
console.log(`export const PASSPHRASE_SALT = '${salt}';`);
console.log(`export const PASSPHRASE_HASH = '${hash}';`);
console.log('\nGuarda la clave en tu gestor de contraseñas: no queda escrita en ninguna parte.\n');
