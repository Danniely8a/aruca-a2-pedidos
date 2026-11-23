import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const isConnected = Boolean(config.databaseUrl);
const poolMax = Number(process.env.PG_POOL_MAX);

// Algunas cadenas de Supabase traen sslmode=require; lo quitamos para poder
// controlar el SSL desde aquí (supabase usa certificados que Node no valida
// por defecto en algunos entornos con proxy).
function buildConfig(url) {
  const needsSsl = /sslmode=require|supabase\.(co|in)|pooler/i.test(url);
  let limpia = url;
  try {
    const u = new URL(url);
    u.searchParams.delete('sslmode');
    limpia = u.toString();
  } catch {
    limpia = url.replace(/[?&]sslmode=[^&]*/g, '');
  }
  return {
    connectionString: limpia,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    ...(process.env.PG_SEARCH_PATH
      ? { options: `-c search_path=${process.env.PG_SEARCH_PATH}` }
      : {}),
    max:
      Number.isFinite(poolMax) && poolMax > 0
        ? Math.trunc(poolMax)
        : process.env.VERCEL
          ? 1
          : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000
  };
}

export const pool = isConnected ? new Pool(buildConfig(config.databaseUrl)) : null;

export async function query(text, params) {
  return pool.query(text, params);
}

// Tabla auxiliar de la plataforma (NO pertenece al A2): guarda la contraseña
// de los vendedores que existen en arc_users. Se crea sola al arrancar.
export async function ensureAppSchema() {
  if (!isConnected) return;
  await pool.query(`
    create table if not exists app_accesos (
      id_usuario    bigint primary key references arc_users(usr_idauto) on delete cascade,
      password_hash text not null,
      actualizado_en timestamptz not null default now()
    )
  `);
  await pool.query(`
    create table if not exists app_config (
      clave         text primary key,
      valor         text not null,
      actualizado_en timestamptz not null default now()
    )
  `);

  // Datos del cliente que no existen en las tablas del A2 (correo y tipo de
  // contribuyente). Se enlazan por cli_id_auto sin alterar arc_clientes.
  await pool.query(`
    create table if not exists app_clientes_extra (
      id_cliente          bigint primary key,
      email               text,
      tipo_contribuyente  text not null default 'ordinario',
      moneda              text not null default 'USD',
      actualizado_en      timestamptz not null default now()
    )
  `);

  // Módulo de operaciones de almacén: usuarios propios, órdenes de armado y
  // validación/tiempos por cada línea del pedido.
  await pool.query(`
    create table if not exists app_operarios (
      id             bigserial primary key,
      nombre         text not null,
      email          text not null,
      password_hash  text not null,
      rol            text not null default 'operario' check (rol in ('jefe','operario')),
      activo         boolean not null default true,
      creado_en      timestamptz not null default now(),
      actualizado_en timestamptz not null default now()
    )
  `);
  await pool.query(
    'create unique index if not exists app_operarios_email_uniq on app_operarios (lower(email))'
  );
  await pool.query(`
    create table if not exists app_operaciones_pedidos (
      id             bigserial primary key,
      trn_id_auto    bigint not null unique,
      operario_id    bigint references app_operarios(id) on delete set null,
      asignado_por   bigint references app_operarios(id) on delete set null,
      estado         text not null default 'asignado'
                     check (estado in ('asignado','en_proceso','armado')),
      asignado_en    timestamptz not null default now(),
      iniciado_en    timestamptz,
      finalizado_en  timestamptz,
      armado_parcial boolean not null default false,
      autorizado_por bigint references app_operarios(id) on delete set null,
      autorizado_en  timestamptz,
      creado_en      timestamptz not null default now(),
      actualizado_en timestamptz not null default now()
    )
  `);
  await pool.query(
    'create index if not exists app_operaciones_pedidos_operario_idx on app_operaciones_pedidos (operario_id)'
  );
  await pool.query(
    'create index if not exists app_operaciones_pedidos_estado_idx on app_operaciones_pedidos (estado)'
  );
  await pool.query(`
    create table if not exists app_operaciones_items (
      id                bigserial primary key,
      operacion_id      bigint not null references app_operaciones_pedidos(id) on delete cascade,
      linea             integer not null,
      codigo            text not null,
      descripcion       text,
      cantidad          numeric(14,2) not null default 0,
      validado          boolean not null default false,
      validado_por      bigint references app_operarios(id) on delete set null,
      validado_en       timestamptz,
      duracion_segundos integer,
      faltante          boolean not null default false,
      motivo_faltante   text,
      faltante_por      bigint references app_operarios(id) on delete set null,
      faltante_en       timestamptz,
      creado_en         timestamptz not null default now(),
      unique (operacion_id, linea)
    )
  `);
  await pool.query(
    'create index if not exists app_operaciones_items_operacion_idx on app_operaciones_items (operacion_id)'
  );

  // Migraciones idempotentes para instalaciones que ya tenían las tablas.
  await pool.query(
    'alter table app_operaciones_pedidos add column if not exists armado_parcial boolean not null default false'
  );
  await pool.query(
    'alter table app_operaciones_pedidos add column if not exists autorizado_por bigint references app_operarios(id) on delete set null'
  );
  await pool.query(
    'alter table app_operaciones_pedidos add column if not exists autorizado_en timestamptz'
  );
  await pool.query(
    'alter table app_operaciones_items add column if not exists faltante boolean not null default false'
  );
  await pool.query(
    'alter table app_operaciones_items add column if not exists motivo_faltante text'
  );
  await pool.query(
    'alter table app_operaciones_items add column if not exists faltante_por bigint references app_operarios(id) on delete set null'
  );
  await pool.query(
    'alter table app_operaciones_items add column if not exists faltante_en timestamptz'
  );
  await pool.query(
    'create index if not exists app_operaciones_items_faltante_idx on app_operaciones_items (operacion_id) where faltante'
  );
}
