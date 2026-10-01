import pg from 'pg';
import { config } from '../src/config.js';

const limpia = new URL(config.databaseUrl);
limpia.searchParams.delete('sslmode');

const c = new pg.Client({
  connectionString: limpia.toString(),
  ssl: { rejectUnauthorized: false },
  options: '-c search_path=a2_test,public'
});
await c.connect();
const r = await c.query('select current_schemas(true) as s, current_database() as db');
console.log('search_path probado ->', JSON.stringify(r.rows[0]));
const t = await c.query(
  "select count(*) n from information_schema.tables where table_schema='a2_test'"
);
console.log('tablas en a2_test ->', t.rows[0].n);
await c.end();
