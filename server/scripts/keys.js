import { pool } from '../src/db.js';

const tablas = [
  'arc_transacciones',
  'arc_detalletranvtas',
  'arc_clientes',
  'arc_inventario',
  'arc_categorias',
  'arc_users',
  'arc_correlatives',
  'arc_tipo_operacion',
  'arc_existencia_actual',
  'arc_company'
];

for (const t of tablas) {
  const { rows: cols } = await pool.query(
    `select column_name, data_type, is_nullable, column_default
       from information_schema.columns
      where table_schema='public' and table_name=$1
      order by ordinal_position`,
    [t]
  );
  console.log(`\n■ ${t}`);
  console.log(
    '  PK: ' +
      (
        await pool.query(
          `select a.attname
             from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
            where i.indrelid = $1::regclass and i.indisprimary`,
          [t]
        )
      ).rows.map((r) => r.attname).join(', ')
  );
  const fks = await pool.query(
    `select kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_col
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name
       join information_schema.constraint_column_usage ccu on tc.constraint_name=ccu.constraint_name
      where tc.constraint_type='FOREIGN KEY' and tc.table_name=$1`,
    [t]
  );
  fks.rows.forEach((f) =>
    console.log(`  FK: ${f.column_name} -> ${f.ref_table}.${f.ref_col}`)
  );
  cols
    .filter((c) => c.column_default)
    .forEach((c) => console.log(`  DEFAULT: ${c.column_name} = ${c.column_default}`));
}

await pool.end();
