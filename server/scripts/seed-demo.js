import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, isConnected, ensureAppSchema } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CUENTAS = [
  ['admin@empresa.com', 'admin123'],
  ['carlos@empresa.com', 'vendedor123'],
  ['maria@empresa.com', 'vendedor123']
];

async function main() {
  if (!isConnected) {
    console.log('No hay DATABASE_URL en server/.env → no hay nada que cargar.');
    return;
  }

  await ensureAppSchema();

  const sql = fs.readFileSync(path.join(__dirname, '../sql/demo.sql'), 'utf8');
  await pool.query(sql);
  console.log('✔ Datos de prueba insertados (solo si las tablas estaban vacías)');

  for (const [login, pwd] of CUENTAS) {
    const { rows } = await pool.query(
      'select usr_idauto from arc_users where usr_login = $1 or usr_emailusuario = $1',
      [login]
    );
    if (!rows[0]) {
      console.log(`  - ${login}: no existe en arc_users (tabla con datos reales)`);
      continue;
    }
    const hash = await bcrypt.hash(pwd, 10);
    await pool.query(
      `insert into app_accesos (id_usuario, password_hash, actualizado_en)
       values ($1, $2, now())
       on conflict (id_usuario) do update set password_hash = excluded.password_hash,
                                               actualizado_en = now()`,
      [rows[0].usr_idauto, hash]
    );
    console.log(`  - ${login} / ${pwd} ✔`);
  }

  const { rows } = await pool.query(`
    select (select count(*) from arc_clientes) as clientes,
           (select count(*) from arc_inventario) as productos,
           (select count(*) from arc_users) as usuarios
  `);
  console.log(
    `Totales: clientes=${rows[0].clientes} productos=${rows[0].productos} usuarios=${rows[0].usuarios}`
  );

  await pool.end();
}

main().catch(async (err) => {
  console.error('Error:', err.message);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
