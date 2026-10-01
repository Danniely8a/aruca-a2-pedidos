import { pool } from '../src/db.js';
import { crear, ESQUEMA } from './esquema-test.js';

crear(pool)
  .then((n) => {
    console.log(`✔ Esquema ${ESQUEMA} creado con ${n} tablas copiadas + app_accesos`);
    return pool.end();
  })
  .catch(async (e) => {
    console.error('Error:', e.message);
    try {
      await pool.end();
    } catch {}
    process.exit(1);
  });
