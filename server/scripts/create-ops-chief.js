import { pool, isConnected, ensureAppSchema } from '../src/db.js';
import { opsStore } from '../src/store/operations.js';

const arg = (nombre, fallback = '') => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

async function main() {
  if (!isConnected) {
    console.log('No hay DATABASE_URL en server/.env: no hay nada que crear.');
    return;
  }

  const nombre = arg('nombre', 'Jefe de Almacén');
  const email = arg('email', 'almacen@arucamaquinarias.com');
  const password = arg('password', 'ArucaAlmacen2026*');

  await ensureAppSchema();

  const existente = await opsStore.findByEmail(email);
  if (existente) {
    await opsStore.updateOperario(
      existente.id,
      { nombre, email, password, rol: 'jefe', activo: true },
      existente.id
    );
    console.log(`Jefe actualizado: ${email}`);
  } else {
    await opsStore.createOperario({
      nombre,
      email,
      password,
      rol: 'jefe'
    });
    console.log(`Jefe creado: ${email}`);
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error('Error:', e.message);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
