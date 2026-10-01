import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const isConnected = Boolean(config.databaseUrl);

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
    max: 10,
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
}
