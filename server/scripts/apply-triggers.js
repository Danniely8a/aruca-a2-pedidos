import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, isConnected } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!isConnected) {
  console.log('No hay DATABASE_URL en server/.env');
  process.exit(0);
}

const sql = fs.readFileSync(path.join(__dirname, '../sql/triggers.sql'), 'utf8');

try {
  await pool.query('set search_path to public');
  await pool.query(sql);
  const { rows } = await pool.query(
    `select event_object_table as tabla, trigger_name
       from information_schema.triggers
      where event_object_schema = 'public'
        and event_object_table in ('arc_transacciones', 'arc_detalletranvtas')
      order by event_object_table, trigger_name`
  );
  console.log('✔ Triggers aplicados:');
  rows.forEach((r) => console.log(`   ${r.tabla}.${r.trigger_name}`));
} catch (err) {
  console.error('Error aplicando triggers:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
