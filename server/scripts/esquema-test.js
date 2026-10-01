// Crea (o recrea) el esquema de prueba a2_test copiando las tablas arc_* de public.
// Nunca escribe en las tablas reales: todo queda en a2_test.
export const ESQUEMA = 'a2_test';

export async function crear(pool) {
  await pool.query(`drop schema if exists ${ESQUEMA} cascade`);
  await pool.query(`create schema ${ESQUEMA}`);

  const { rows } = await pool.query(
    `select table_name from information_schema.tables
      where table_schema='public' and table_name like 'arc\\_%' order by table_name`
  );
  for (const r of rows) {
    await pool.query(
      `create table ${ESQUEMA}.${r.table_name} (like public.${r.table_name} including all)`
    );
  }

  await pool.query(`
    create table ${ESQUEMA}.app_accesos (
      id_usuario    bigint primary key references ${ESQUEMA}.arc_users(usr_idauto) on delete cascade,
      password_hash text not null,
      actualizado_en timestamptz not null default now()
    )`);

  return rows.length;
}
