import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { config } from '../src/config.js';
import { crear } from './esquema-test.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 4001;
const BASE = `http://localhost:${PUERTO}`;
const CUENTAS = [
  ['admin@empresa.com', 'admin123'],
  ['carlos@empresa.com', 'vendedor123'],
  ['maria@empresa.com', 'vendedor123']
];

let ok = 0;
let mal = 0;
const check = (nombre, cond, extra = '') => {
  if (cond) {
    ok += 1;
    console.log(`  ✔ ${nombre}`);
  } else {
    mal += 1;
    console.log(`  ✘ ${nombre} ${extra}`);
  }
};

async function seed() {
  // Recrea el esquema de prueba: cada corrida parte de cero y jamás toca public.*
  await crear(pool);
  const c = await pool.connect();
  try {
    // search_path SOLO a2_test: así jamás se escriben las tablas públicas del A2
    await c.query('set search_path to a2_test');
    await c.query(fs.readFileSync(path.join(__dirname, '../sql/demo.sql'), 'utf8'));
    for (const [login, pwd] of CUENTAS) {
      const { rows } = await c.query(
        'select usr_idauto from arc_users where usr_login = $1',
        [login]
      );
      if (!rows[0]) continue;
      const hash = await bcrypt.hash(pwd, 10);
      await c.query(
        `insert into a2_test.app_accesos (id_usuario, password_hash) values ($1,$2)
         on conflict (id_usuario) do update set password_hash = excluded.password_hash`,
        [rows[0].usr_idauto, hash]
      );
    }
  } finally {
    c.release();
  }
}

const req = async (ruta, { method = 'GET', token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${ruta}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
};

async function esperarServicio(intentos = 40) {
  for (let i = 0; i < intentos; i += 1) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  console.log('1) Cargando datos de prueba en a2_test …');
  await seed();

  const url = new URL(config.databaseUrl);
  url.searchParams.delete('sslmode');

  console.log('2) Arrancando API de prueba (puerto 4001) …');
  const servidor = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL: url.toString(),
      PG_SEARCH_PATH: 'a2_test,public',
      PORT: String(PUERTO)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  servidor.stdout.on('data', (d) => process.stdout.write(`   [api] ${d}`));
  servidor.stderr.on('data', (d) => process.stderr.write(`   [api] ${d}`));

  try {
    if (!(await esperarServicio())) throw new Error('La API no arrancó');

    console.log('3) Pruebas:');
    const health = await req('/api/health');
    check('health en modo postgres', health.data.mode === 'postgres');
    check('tasa de impuesto = 0.16', health.data.taxRate === 0.16, `=${health.data.taxRate}`);

    const sinToken = await req('/api/productos');
    check('productos sin token → 401', sinToken.status === 401);

    const malo = await req('/api/auth/login', {
      method: 'POST',
      body: { usuario: 'admin@empresa.com', password: 'incorrecta' }
    });
    check('login con contraseña mala → 401', malo.status === 401);

    const admin = await req('/api/auth/login', {
      method: 'POST',
      body: { usuario: 'admin@empresa.com', password: 'admin123' }
    });
    check('login admin', admin.status === 200, JSON.stringify(admin.data));
    const tAdmin = admin.data.token;

    const carlos = await req('/api/auth/login', {
      method: 'POST',
      body: { usuario: 'carlos@empresa.com', password: 'vendedor123' }
    });
    check('login vendedor', carlos.status === 200);
    const tCarlos = carlos.data.token;

    const productos = await req('/api/productos', { token: tAdmin });
    check('catálogo trae 16 productos', productos.data.total === 16, `=${productos.data.total}`);
    check(
      'producto con existencias calculadas',
      Number(productos.data.items[0]?.existencia) >= 0
    );

    const busca = await req('/api/productos?q=sierra', { token: tAdmin });
    check('búsqueda "sierra" encuentra resultados', busca.data.total > 0, `=${busca.data.total}`);

    const clientes = await req('/api/clientes', { token: tAdmin });
    check('clientes = 6', clientes.data.total === 6, `=${clientes.data.total}`);

    const cat = await req('/api/productos/categorias', { token: tAdmin });
    check('categorías = 4', cat.data.items.length === 4, `=${cat.data.items.length}`);

    // Los IDs son IDENTITY: se resuelven por código, nunca se asumen fijos
    const p1 = productos.data.items.find((x) => x.codigo === 'P-1001');
    const p5 = productos.data.items.find((x) => x.codigo === 'P-1005');
    check('productos P-1001 y P-1005 resueltos', Boolean(p1 && p5), `p1=${p1?.id} p5=${p5?.id}`);
    const cli = clientes.data.items.find((x) => x.codigo === 'C-0001');
    check('cliente C-0001 resuelto', Boolean(cli), `=${cli?.id}`);

    const cli1 = await req(`/api/clientes/${cli?.id}`, { token: tAdmin });
    check('detalle cliente', cli1.data.cliente?.nombre === 'Almacén El Progreso', JSON.stringify(cli1.data.cliente));

    const precioCat = Number(p1?.precio);
    const precio = Number.isFinite(precioCat) && precioCat > 0 ? precioCat : 150;
    check('producto con precio de lista', Number.isFinite(precioCat) && precioCat > 0, `=${p1?.precio}`);

    const creado = await req('/api/pedidos', {
      method: 'POST',
      token: tCarlos,
      body: {
        cliente_id: cli?.id,
        observacion: 'Pedido de prueba E2E',
        items: [
          { producto_id: p1?.id, cantidad: 2, descuento: 0, precio },
          { producto_id: p5?.id, cantidad: 1, descuento: 5, precio: Number(p5?.precio) || 80 }
        ]
      }
    });
    check('crear pedido → 201', creado.status === 201, JSON.stringify(creado.data));
    const numero = creado.data?.pedido?.numero;
    check('número de documento generado', Boolean(numero), `=${numero}`);
    // 2*12500 + 1350 (P-1005) con 5% de descuento en la segunda línea
    const t = creado.data?.totales || {};
    check('subtotal = 26350', Number(t.subtotal) === 26350, `=${t.subtotal}`);
    check('descuento en MONTO = 67.50 (no el porcentaje)', Number(t.descuento) === 67.5, `=${t.descuento}`);
    check('impuestos = base * 0.16', Number(t.impuestos) === 4205.2, `=${t.impuestos}`);
    check('total = 30487.70', Number(t.total) === 30487.7, `=${t.total}`);

    const historial = await req('/api/pedidos', { token: tCarlos });
    check('historial del vendedor = 1', historial.data.total === 1, `=${historial.data.total}`);

    const adminTodos = await req('/api/pedidos?todos=1', { token: tAdmin });
    check('admin ve todos los pedidos', adminTodos.data.total >= 1, `=${adminTodos.data.total}`);

    const detalle = await req(`/api/pedidos/${creado.data.pedido.id}`, { token: tCarlos });
    check('detalle con 2 líneas', detalle.data.pedido?.detalles?.length === 2, JSON.stringify(detalle.data.pedido?.detalles));
    check('línea con descripción del producto', Boolean(detalle.data.pedido?.detalles?.[0]?.producto?.descripcion));

    const cambio = await req(`/api/pedidos/${creado.data.pedido.id}/estado`, {
      method: 'PATCH',
      token: tAdmin,
      body: { estado: 'aprobado' }
    });
    check('admin cambia estado a aprobado', cambio.data.pedido?.estado === 'aprobado', JSON.stringify(cambio.data));

    const bloqueo = await req(`/api/pedidos/${creado.data.pedido.id}/estado`, {
      method: 'PATCH',
      token: tCarlos,
      body: { estado: 'rechazado' }
    });
    check('vendedor no puede cambiar estado → 403', bloqueo.status === 403, `=${bloqueo.status}`);

    const dash = await req('/api/dashboard', { token: tAdmin });
    check('dashboard con conteos', Number(dash.data.clientes) === 6, JSON.stringify(dash.data));

    const pedidoA2 = await pool.query(
      'select trn_documento, trn_status, trn_rifcliente, trn_vendedorasignado, trn_totalneto from a2_test.arc_transacciones'
    );
    check('pedido escrito en arc_transacciones', pedidoA2.rows.length === 1, `=${pedidoA2.rows.length}`);
    console.log('     fila A2:', JSON.stringify(pedidoA2.rows[0]));

    const detalleA2 = await pool.query(
      'select dtv_codigo, dtv_linea, dtv_cantidad, dtv_preciodeventa, dtv_clienteproveedor from a2_test.arc_detalletranvtas order by dtv_linea'
    );
    check('detalle escrito en arc_detalletranvtas', detalleA2.rows.length === 2, `=${detalleA2.rows.length}`);
    console.log('     fila A2:', JSON.stringify(detalleA2.rows[0]));

    // --- Precios por lista del cliente (cli_preciodefecto) ---------------
    const cli2 = clientes.data.items.find((x) => x.codigo === 'C-0002');
    const det2 = await req(`/api/clientes/${cli2?.id}`, { token: tAdmin });
    check(
      'cliente de lista 2 trae precios especiales',
      (det2.data.precios || []).length > 0,
      `=${det2.data.precios?.length}`
    );
    const esperado = Math.round(Number(p1.precio) * 0.92 * 100) / 100;
    const esp = (det2.data.precios || []).find((x) => Number(x.producto_id) === Number(p1.id));
    check('precio especial = lista general x 0.92', Number(esp?.precio) === esperado, `=${esp?.precio} esperado=${esperado}`);

    const pedido2 = await req('/api/pedidos', {
      method: 'POST',
      token: tCarlos,
      body: {
        cliente_id: cli2?.id,
        items: [{ producto_id: p1?.id, cantidad: 1, descuento: 0, precio: Number(p1.precio) }]
      }
    });
    check('pedido con precio especial → 201', pedido2.status === 201, JSON.stringify(pedido2.data));
    check(
      'subtotal usa el precio especial (no el de lista)',
      Number(pedido2.data?.totales?.subtotal) === esperado,
      `=${pedido2.data?.totales?.subtotal} esperado=${esperado}`
    );
    check(
      'cliente de lista 1 no recibe precios especiales',
      (cli1.data.precios || []).length === 0,
      `=${cli1.data.precios?.length}`
    );
  } finally {
    servidor.kill();
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nResultado: ${ok} correctas, ${mal} con error`);
  await pool.end();
  process.exit(mal === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('FALLO GENERAL:', e);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
