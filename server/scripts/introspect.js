import { pool, isConnected } from '../src/db.js';

if (!isConnected) {
  console.log('No hay DATABASE_URL en server/.env');
  process.exit(0);
}

const { rows: tablas } = await pool.query(`
  select table_schema, table_name,
         (xpath('/row/cnt/text()', query_to_xml(
           format('select count(*) as cnt from %I.%I', table_schema, table_name),
           false, true, '')))[1]::text::int as filas
    from information_schema.tables
   where table_schema not in ('pg_catalog','information_schema')
     and table_type = 'BASE TABLE'
   order by table_schema, table_name
`);

console.log(`Tablas encontradas: ${tablas.length}\n`);

for (const t of tablas) {
  console.log(`■ ${t.table_schema}.${t.table_name}  (${t.filas} filas)`);
  const { rows: cols } = await pool.query(
    `select column_name, data_type, is_nullable
       from information_schema.columns
      where table_schema = $1 and table_name = $2
      order by ordinal_position`,
    [t.table_schema, t.table_name]
  );
  cols.forEach((c) => {
    console.log(
      `    - ${c.column_name.padEnd(28)} ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`
    );
  });
  console.log('');
}

await pool.end();
