import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, isConnected, ensureAppSchema } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!isConnected) {
    console.log('No hay DATABASE_URL en server/.env → nada que importar (modo demo).');
    return;
  }

  await ensureAppSchema();
  console.log('✔ Tabla auxiliar app_accesos verificada');

  const archivo = path.join(__dirname, '../sql/datos.sql');
  if (!fs.existsSync(archivo)) {
    console.log('');
    console.log('No existe server/sql/datos.sql');
    console.log('Coloca ahí el volcado de tu base A2 (o los datos que quieras cargar)');
    console.log('y vuelve a ejecutar:  npm run seed');
    return;
  }

  const sql = fs.readFileSync(archivo, 'utf8');
  if (!sql.trim()) {
    console.log('server/sql/datos.sql está vacío, no se ejecuta nada.');
    return;
  }

  console.log('Importando server/sql/datos.sql …');
  await pool.query(sql);
  console.log('✔ Importación terminada');

  const { rows } = await pool.query(`
    select (select count(*) from arc_clientes) as clientes,
           (select count(*) from arc_inventario) as productos,
           (select count(*) from arc_users) as usuarios,
           (select count(*) from arc_transacciones) as transacciones
  `);
  const r = rows[0];
  console.log(
    `   clientes=${r.clientes}  productos=${r.productos}  usuarios=${r.usuarios}  transacciones=${r.transacciones}`
  );

  await pool.end();
}

main().catch(async (err) => {
  console.error('Error al importar:', err.message);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
