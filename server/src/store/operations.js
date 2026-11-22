import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { config } from '../config.js';

const q = (text, params) => pool.query(text, params);

const texto = (v) => (v === undefined || v === null ? '' : String(v).trim());
const numero = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';

const error = (status, message) => {
  const e = new Error(message);
  e.status = status;
  return e;
};

function mapOperario(r) {
  return {
    id: Number(r.id),
    nombre: r.nombre || '',
    email: r.email || '',
    rol: r.rol === 'jefe' ? 'jefe' : 'operario',
    activo: r.activo !== false,
    creado_en: r.creado_en || null,
    actualizado_en: r.actualizado_en || null
  };
}

function duracionSegundos(inicio, fin) {
  if (!inicio) return 0;
  const desde = new Date(inicio).getTime();
  const hasta = fin ? new Date(fin).getTime() : Date.now();
  return Math.max(0, Math.floor((hasta - desde) / 1000));
}

function fechaLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

function rangoReporte(desde, hasta) {
  const hoy = new Date();
  const hace30 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 29);
  let d = texto(desde) || fechaLocal(hace30);
  let h = texto(hasta) || fechaLocal(hoy);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(h)) {
    throw error(400, 'Las fechas deben tener el formato AAAA-MM-DD');
  }
  if (d > h) throw error(400, 'La fecha desde no puede ser mayor que la fecha hasta');
  return { desde: d, hasta: h };
}

async function ensureBootstrapChief() {
  const { rows } = await q('select count(*)::int as n from app_operarios');
  if (Number(rows[0]?.n) > 0) return;
  const hash = await bcrypt.hash(config.opsAdminPassword, 10);
  try {
    await q(
      `insert into app_operarios (nombre, email, password_hash, rol, activo)
       values ($1, $2, $3, 'jefe', true)`,
      [config.opsAdminNombre, config.opsAdminEmail.trim().toLowerCase(), hash]
    );
  } catch (e) {
    // Si otro proceso ya creó el jefe, no es un error.
    if (e.code !== '23505') throw e;
  }
}

async function findById(id) {
  const { rows } = await q(
    `select id, nombre, email, rol, activo, creado_en, actualizado_en
       from app_operarios
      where id = $1`,
    [id]
  );
  return rows[0] ? mapOperario(rows[0]) : null;
}

async function findByEmail(email) {
  const { rows } = await q(
    `select id, nombre, email, password_hash, rol, activo
       from app_operarios
      where lower(email) = lower($1)
      limit 1`,
    [texto(email)]
  );
  return rows[0] || null;
}

async function listOperarios() {
  const { rows } = await q(
    `select id, nombre, email, rol, activo, creado_en, actualizado_en
       from app_operarios
      order by activo desc, nombre asc`
  );
  return rows.map(mapOperario);
}

async function createOperario({ nombre, email, password, rol }) {
  const nom = texto(nombre);
  const mail = texto(email).toLowerCase();
  const clave = texto(password);
  const rolFinal = texto(rol) === 'jefe' ? 'jefe' : 'operario';

  if (!nom) throw error(400, 'El nombre es obligatorio');
  if (!mail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    throw error(400, 'El correo no es válido');
  }
  if (clave.length < 6) throw error(400, 'La contraseña debe tener al menos 6 caracteres');

  const existe = await findByEmail(mail);
  if (existe) throw error(409, 'Ya existe un operario con ese correo');

  const hash = await bcrypt.hash(clave, 10);
  const { rows } = await q(
    `insert into app_operarios (nombre, email, password_hash, rol, activo)
     values ($1, $2, $3, $4, true)
     returning id`,
    [nom, mail, hash, rolFinal]
  );
  return findById(rows[0].id);
}

async function updateOperario(id, data, actorId) {
  const actual = await findById(id);
  if (!actual) throw error(404, 'Operario no encontrado');

  const nom = data.nombre === undefined ? actual.nombre : texto(data.nombre);
  const mail =
    data.email === undefined ? actual.email : texto(data.email).toLowerCase();
  const rol = data.rol === undefined ? actual.rol : texto(data.rol) === 'jefe' ? 'jefe' : 'operario';
  const activo = data.activo === undefined ? actual.activo : bool(data.activo);
  const clave = texto(data.password);

  if (!nom) throw error(400, 'El nombre es obligatorio');
  if (!mail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    throw error(400, 'El correo no es válido');
  }
  if (clave && clave.length < 6) {
    throw error(400, 'La contraseña debe tener al menos 6 caracteres');
  }
  if (Number(id) === Number(actorId) && (!activo || rol !== 'jefe')) {
    throw error(400, 'No puedes desactivar tu propio usuario ni quitarte el rol de jefe');
  }

  const dup = await q(
    `select 1 from app_operarios where lower(email) = lower($1) and id <> $2`,
    [mail, id]
  );
  if (dup.rows.length) throw error(409, 'Ya existe otro operario con ese correo');

  if (clave) {
    const hash = await bcrypt.hash(clave, 10);
    await q(
      `update app_operarios
          set nombre=$1, email=$2, rol=$3, activo=$4, password_hash=$5,
              actualizado_en=now()
        where id=$6`,
      [nom, mail, rol, activo, hash, id]
    );
  } else {
    await q(
      `update app_operarios
          set nombre=$1, email=$2, rol=$3, activo=$4, actualizado_en=now()
        where id=$5`,
      [nom, mail, rol, activo, id]
    );
  }
  return findById(id);
}

async function getOrderDetails(orderId) {
  const { rows } = await q(
    `select d.dtv_linea as linea,
            d.dtv_codigo as codigo,
            coalesce(p.inv_descripcion, d.dtv_codigo) as descripcion,
            d.dtv_cantidad as cantidad
       from arc_detalletranvtas d
       left join arc_inventario p on p.inv_codigo = d.dtv_codigo
      where d.dtv_operacion_autoincrement =
            (select trn_autoincrement from arc_transacciones where trn_id_auto = $1)
        and d.dtv_documento =
            (select trn_documento from arc_transacciones where trn_id_auto = $1)
      order by d.dtv_linea`,
    [orderId]
  );
  return rows.map((r) => ({
    linea: Number(r.linea),
    codigo: r.codigo,
    descripcion: r.descripcion || r.codigo,
    cantidad: Number(r.cantidad || 0)
  }));
}

async function syncItems(db, operacionId, orderId) {
  const detalles = await getOrderDetails(orderId);
  const lineas = detalles.map((d) => d.linea);

  if (lineas.length) {
    await db.query(
      `delete from app_operaciones_items
        where operacion_id = $1
          and validado = false
          and not (linea = any($2::int[]))`,
      [operacionId, lineas]
    );
  } else {
    await db.query(
      'delete from app_operaciones_items where operacion_id = $1 and validado = false',
      [operacionId]
    );
  }

  for (const d of detalles) {
    await db.query(
      `insert into app_operaciones_items
         (operacion_id, linea, codigo, descripcion, cantidad)
       values ($1, $2, $3, $4, $5)
       on conflict (operacion_id, linea) do update
         set codigo = excluded.codigo,
             descripcion = excluded.descripcion,
             cantidad = case
                          when app_operaciones_items.validado
                          then app_operaciones_items.cantidad
                          else excluded.cantidad
                        end`,
      [operacionId, d.linea, d.codigo, d.descripcion, d.cantidad]
    );
  }

  await refreshEstado(db, operacionId);
}

async function recalcItemDurations(db, operacionId) {
  const { rows: orden } = await db.query(
    'select iniciado_en from app_operaciones_pedidos where id = $1',
    [operacionId]
  );
  if (!orden[0]?.iniciado_en) return;

  const { rows: items } = await db.query(
    `select id, validado_en
       from app_operaciones_items
      where operacion_id = $1 and validado = true and validado_en is not null
      order by validado_en asc, linea asc`,
    [operacionId]
  );

  let anterior = new Date(orden[0].iniciado_en).getTime();
  for (const item of items) {
    const fin = new Date(item.validado_en).getTime();
    const dur = Math.max(0, Math.floor((fin - anterior) / 1000));
    await db.query(
      'update app_operaciones_items set duracion_segundos = $1 where id = $2',
      [dur, item.id]
    );
    anterior = fin;
  }
}

async function refreshEstado(db, operacionId) {
  const { rows } = await db.query(
    `select count(*)::int as total,
            count(*) filter (where validado)::int as validados,
            max(validado_en) as ultimo
       from app_operaciones_items
      where operacion_id = $1`,
    [operacionId]
  );
  const total = Number(rows[0]?.total || 0);
  const validados = Number(rows[0]?.validados || 0);
  const ultimo = rows[0]?.ultimo || null;

  if (total > 0 && total === validados) {
    await db.query(
      `update app_operaciones_pedidos
          set estado = 'armado', finalizado_en = $1, actualizado_en = now()
        where id = $2`,
      [ultimo, operacionId]
    );
  } else {
    await db.query(
      `update app_operaciones_pedidos
          set estado = case when iniciado_en is not null then 'en_proceso' else 'asignado' end,
              finalizado_en = null,
              actualizado_en = now()
        where id = $1`,
      [operacionId]
    );
  }
}

const SQL_ORDEN = `
  select t.trn_id_auto as id,
         t.trn_documento as numero,
         t.trn_fechaemision as fecha,
         t.trn_status as estado_a2,
         t.trn_tipo as tipo,
         t.trn_detalle as observacion,
         t.trn_responsable as cliente_codigo,
         c.cli_descripcion as cliente_nombre,
         c.cli_telefono as cliente_telefono,
         c.cli_direccion1 as cliente_direccion,
         o.id as operacion_id,
         o.estado as estado_ops,
         o.operario_id,
         op.nombre as operario_nombre,
         o.asignado_por,
         ap.nombre as asignado_por_nombre,
         o.asignado_en,
         o.iniciado_en,
         o.finalizado_en
    from arc_transacciones t
    left join arc_clientes c on c.cli_codigo = t.trn_responsable
    left join app_operaciones_pedidos o on o.trn_id_auto = t.trn_id_auto
    left join app_operarios op on op.id = o.operario_id
    left join app_operarios ap on ap.id = o.asignado_por
   where t.trn_id_auto = $1
     and t.trn_tipo = 10
     and (t.trn_status in (2, 4) or o.id is not null)
   limit 1`;

async function getOrderForActor(orderId, actor) {
  const { rows } = await q(SQL_ORDEN, [orderId]);
  const r = rows[0];
  if (!r) return null;

  if (actor.rol !== 'jefe' && Number(r.operario_id) !== Number(actor.id)) {
    throw error(403, 'Este pedido no está asignado a ti');
  }

  const operacionId = r.operacion_id ? Number(r.operacion_id) : null;
  if (operacionId) {
    await syncItems(pool, operacionId, orderId);
  }

  const { rows: actual } = await q(SQL_ORDEN, [orderId]);
  const h = actual[0] || r;

  let items = [];
  if (operacionId) {
    const { rows: filas } = await q(
      `select i.id,
              i.linea,
              i.codigo,
              i.descripcion,
              i.cantidad,
              i.validado,
              i.validado_en,
              i.duracion_segundos,
              v.nombre as validado_por_nombre,
              case
                when i.validado_en is not null and o.iniciado_en is not null
                then greatest(0, floor(extract(epoch from (i.validado_en - o.iniciado_en))))::int
                else null
              end as acumulado_segundos
         from app_operaciones_items i
         join app_operaciones_pedidos o on o.id = i.operacion_id
         left join app_operarios v on v.id = i.validado_por
        where i.operacion_id = $1
        order by i.linea`,
      [operacionId]
    );
    items = filas.map((i) => ({
      id: Number(i.id),
      linea: Number(i.linea),
      codigo: i.codigo,
      descripcion: i.descripcion || i.codigo,
      cantidad: Number(i.cantidad || 0),
      validado: i.validado === true,
      validado_en: i.validado_en || null,
      duracion_segundos:
        i.duracion_segundos === null || i.duracion_segundos === undefined
          ? null
          : Number(i.duracion_segundos),
      acumulado_segundos:
        i.acumulado_segundos === null || i.acumulado_segundos === undefined
          ? null
          : Number(i.acumulado_segundos),
      validado_por_nombre: i.validado_por_nombre || null
    }));
  } else {
    const detalles = await getOrderDetails(orderId);
    items = detalles.map((d) => ({
      id: null,
      linea: d.linea,
      codigo: d.codigo,
      descripcion: d.descripcion,
      cantidad: d.cantidad,
      validado: false,
      validado_en: null,
      duracion_segundos: null,
      acumulado_segundos: null,
      validado_por_nombre: null
    }));
  }

  const iniciado = h.iniciado_en || null;
  const finalizado = h.finalizado_en || null;

  return {
    id: Number(h.id),
    numero: h.numero,
    fecha: h.fecha,
    tipo: Number(h.tipo) || 10,
    estado_a2: Number(h.estado_a2),
    estado: h.estado_ops || 'pendiente',
    observacion: h.observacion || '',
    cliente: {
      codigo: h.cliente_codigo || '',
      nombre: h.cliente_nombre || 'Cliente no encontrado',
      telefono: h.cliente_telefono || '',
      direccion: h.cliente_direccion || ''
    },
    operacion_id: operacionId,
    operario_id: h.operario_id ? Number(h.operario_id) : null,
    operario_nombre: h.operario_nombre || null,
    asignado_por_nombre: h.asignado_por_nombre || null,
    asignado_en: h.asignado_en || null,
    iniciado_en: iniciado,
    finalizado_en: finalizado,
    duracion_segundos: duracionSegundos(iniciado, finalizado),
    items,
    items_total: items.length,
    items_validados: items.filter((i) => i.validado).length,
    unidades: items.reduce((s, i) => s + Number(i.cantidad || 0), 0)
  };
}

async function assignOrder(orderId, operarioId, actor) {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: pedido } = await client.query(
      `select trn_id_auto, trn_status
         from arc_transacciones
        where trn_id_auto = $1 and trn_tipo = 10
        for update`,
      [orderId]
    );
    if (!pedido[0]) throw error(404, 'Pedido no encontrado');

    const { rows: previa } = await client.query(
      'select id, estado from app_operaciones_pedidos where trn_id_auto = $1 for update',
      [orderId]
    );
    if (previa[0]?.estado === 'armado') {
      throw error(409, 'El pedido ya está armado y no se puede reasignar');
    }
    if (!previa[0] && ![2, 4].includes(Number(pedido[0].trn_status))) {
      throw error(409, 'El pedido no está pendiente ni en tránsito');
    }

    const { rows: operario } = await client.query(
      'select id, activo from app_operarios where id = $1',
      [operarioId]
    );
    if (!operario[0]) throw error(404, 'Operario no encontrado');
    if (!operario[0].activo) throw error(400, 'El operario está inactivo');

    const { rows: operacion } = await client.query(
      `insert into app_operaciones_pedidos
         (trn_id_auto, operario_id, asignado_por, estado, asignado_en)
       values ($1, $2, $3, 'asignado', now())
       on conflict (trn_id_auto) do update
         set operario_id = excluded.operario_id,
             asignado_por = excluded.asignado_por,
             asignado_en = now(),
             actualizado_en = now()
       returning id`,
      [orderId, operarioId, actor.id]
    );

    await syncItems(client, operacion[0].id, orderId);
    await client.query('commit');

    return getOrderForActor(orderId, actor);
  } catch (e) {
    try {
      await client.query('rollback');
    } catch {}
    throw e;
  } finally {
    client.release();
  }
}

async function startOrder(orderId, actor) {
  const { rows } = await q(
    `select o.id, o.operario_id, o.estado, o.iniciado_en
       from app_operaciones_pedidos o
      where o.trn_id_auto = $1`,
    [orderId]
  );
  const op = rows[0];
  if (!op) throw error(409, 'Primero asigna el pedido a un operario');
  if (actor.rol !== 'jefe' && Number(op.operario_id) !== Number(actor.id)) {
    throw error(403, 'Este pedido no está asignado a ti');
  }
  if (op.estado === 'armado') throw error(409, 'El pedido ya está armado');

  await syncItems(pool, op.id, orderId);
  await q(
    `update app_operaciones_pedidos
        set iniciado_en = coalesce(iniciado_en, now()),
            estado = case when estado = 'asignado' then 'en_proceso' else estado end,
            actualizado_en = now()
      where id = $1`,
    [op.id]
  );
  return getOrderForActor(orderId, actor);
}

async function validateItem(orderId, itemId, validado, actor) {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: opRows } = await client.query(
      `select o.id, o.operario_id, o.iniciado_en, o.estado
         from app_operaciones_pedidos o
        where o.trn_id_auto = $1
        for update`,
      [orderId]
    );
    const op = opRows[0];
    if (!op) throw error(409, 'Primero asigna el pedido a un operario');
    if (actor.rol !== 'jefe' && Number(op.operario_id) !== Number(actor.id)) {
      throw error(403, 'Este pedido no está asignado a ti');
    }
    if (!op.iniciado_en) throw error(409, 'Primero inicia el armado del pedido');

    const { rows: itemRows } = await client.query(
      `select id, validado
         from app_operaciones_items
        where id = $1 and operacion_id = $2
        for update`,
      [itemId, op.id]
    );
    if (!itemRows[0]) throw error(404, 'Ítem no encontrado');

    if (validado === true && !itemRows[0].validado) {
      await client.query(
        `update app_operaciones_items
            set validado = true, validado_por = $1, validado_en = now()
          where id = $2`,
        [actor.id, itemId]
      );
    } else if (validado === false) {
      await client.query(
        `update app_operaciones_items
            set validado = false, validado_por = null, validado_en = null,
                duracion_segundos = null
          where id = $1`,
        [itemId]
      );
    }

    await recalcItemDurations(client, op.id);
    await refreshEstado(client, op.id);
    await client.query('commit');

    return getOrderForActor(orderId, actor);
  } catch (e) {
    try {
      await client.query('rollback');
    } catch {}
    throw e;
  } finally {
    client.release();
  }
}

async function listOrders({ operarioId = null, estado = '', q: termino = '' } = {}) {
  const filtro = texto(termino) ? `%${texto(termino)}%` : '';
  const estadoSel = texto(estado);
  const { rows } = await q(
    `select t.trn_id_auto as id,
            t.trn_documento as numero,
            t.trn_fechaemision as fecha,
            t.trn_status as estado_a2,
            c.cli_codigo as cliente_codigo,
            c.cli_descripcion as cliente_nombre,
            coalesce(o.estado, 'pendiente') as estado,
            o.id as operacion_id,
            o.operario_id,
            op.nombre as operario_nombre,
            o.asignado_en,
            o.iniciado_en,
            o.finalizado_en,
            case
              when o.id is not null then
                (select count(*)::int from app_operaciones_items i where i.operacion_id = o.id)
              else
                (select count(*)::int from arc_detalletranvtas d
                  where d.dtv_operacion_autoincrement = t.trn_autoincrement
                    and d.dtv_documento = t.trn_documento)
            end as items_total,
            (select count(*)::int from app_operaciones_items i
              where i.operacion_id = o.id and i.validado) as items_validados,
            (select coalesce(sum(d.dtv_cantidad), 0) from arc_detalletranvtas d
              where d.dtv_operacion_autoincrement = t.trn_autoincrement
                and d.dtv_documento = t.trn_documento) as unidades
       from arc_transacciones t
       left join arc_clientes c on c.cli_codigo = t.trn_responsable
       left join app_operaciones_pedidos o on o.trn_id_auto = t.trn_id_auto
       left join app_operarios op on op.id = o.operario_id
      where t.trn_tipo = 10
        and (t.trn_status in (2, 4) or o.id is not null)
        and ($1::bigint is null or o.operario_id = $1)
        and ($2::text = '' or coalesce(o.estado, 'pendiente') = $2)
        and ($3::text = ''
             or t.trn_documento ilike $3
             or c.cli_descripcion ilike $3)
      order by case coalesce(o.estado, 'pendiente')
                 when 'pendiente' then 0
                 when 'asignado' then 1
                 when 'en_proceso' then 2
                 else 3
               end,
               t.trn_fechaemision desc
      limit 300`,
    [operarioId, estadoSel, filtro]
  );

  return rows.map((r) => {
    const iniciado = r.iniciado_en || null;
    const finalizado = r.finalizado_en || null;
    return {
      id: Number(r.id),
      numero: r.numero,
      fecha: r.fecha,
      estado_a2: Number(r.estado_a2),
      estado: r.estado,
      operacion_id: r.operacion_id ? Number(r.operacion_id) : null,
      operario_id: r.operario_id ? Number(r.operario_id) : null,
      operario_nombre: r.operario_nombre || null,
      cliente: {
        codigo: r.cliente_codigo || '',
        nombre: r.cliente_nombre || 'Cliente no encontrado'
      },
      items_total: Number(r.items_total || 0),
      items_validados: Number(r.items_validados || 0),
      unidades: Number(r.unidades || 0),
      asignado_en: r.asignado_en || null,
      iniciado_en: iniciado,
      finalizado_en: finalizado,
      duracion_segundos: duracionSegundos(iniciado, finalizado)
    };
  });
}

async function getReports({ desde, hasta, operarioId = null } = {}) {
  const rango = rangoReporte(desde, hasta);
  const operario = numero(operarioId);

  const { rows: pedidos } = await q(
    `select t.trn_documento as numero,
            t.trn_fechaemision as fecha,
            c.cli_descripcion as cliente,
            op.nombre as operario,
            o.operario_id,
            o.estado,
            o.asignado_en,
            o.iniciado_en,
            o.finalizado_en,
            case
              when o.iniciado_en is not null
              then greatest(0, floor(extract(epoch from
                     (coalesce(o.finalizado_en, now()) - o.iniciado_en))))::int
              else 0
            end as duracion_segundos,
            (select count(*)::int from app_operaciones_items i
              where i.operacion_id = o.id) as items_total,
            (select count(*)::int from app_operaciones_items i
              where i.operacion_id = o.id and i.validado) as items_validados
       from app_operaciones_pedidos o
       join arc_transacciones t on t.trn_id_auto = o.trn_id_auto
       left join arc_clientes c on c.cli_codigo = t.trn_responsable
       left join app_operarios op on op.id = o.operario_id
      where o.asignado_en::date between $1::date and $2::date
        and ($3::bigint is null or o.operario_id = $3)
      order by o.asignado_en desc
      limit 1000`,
    [rango.desde, rango.hasta, operario]
  );

  const { rows: items } = await q(
    `select t.trn_documento as numero,
            op.nombre as operario,
            o.operario_id,
            i.codigo,
            i.descripcion,
            i.cantidad,
            i.validado,
            i.validado_en,
            i.duracion_segundos
       from app_operaciones_items i
       join app_operaciones_pedidos o on o.id = i.operacion_id
       join arc_transacciones t on t.trn_id_auto = o.trn_id_auto
       left join app_operarios op on op.id = o.operario_id
      where o.asignado_en::date between $1::date and $2::date
        and ($3::bigint is null or o.operario_id = $3)
      order by o.asignado_en desc, i.validado_en asc nulls last, i.linea
      limit 3000`,
    [rango.desde, rango.hasta, operario]
  );

  const pedidosMap = pedidos.map((p) => ({
    numero: p.numero,
    fecha: p.fecha,
    cliente: p.cliente || 'Cliente no encontrado',
    operario: p.operario || 'Sin operario',
    operario_id: p.operario_id ? Number(p.operario_id) : null,
    estado: p.estado,
    asignado_en: p.asignado_en,
    iniciado_en: p.iniciado_en,
    finalizado_en: p.finalizado_en,
    duracion_segundos: Number(p.duracion_segundos || 0),
    items_total: Number(p.items_total || 0),
    items_validados: Number(p.items_validados || 0)
  }));

  const itemsMap = items.map((i) => ({
    numero: i.numero,
    operario: i.operario || 'Sin operario',
    operario_id: i.operario_id ? Number(i.operario_id) : null,
    codigo: i.codigo,
    descripcion: i.descripcion || i.codigo,
    cantidad: Number(i.cantidad || 0),
    validado: i.validado === true,
    validado_en: i.validado_en || null,
    duracion_segundos:
      i.duracion_segundos === null || i.duracion_segundos === undefined
        ? null
        : Number(i.duracion_segundos)
  }));

  const armados = pedidosMap.filter((p) => p.estado === 'armado');
  const tiempoTotal = armados.reduce((s, p) => s + p.duracion_segundos, 0);
  const itemDurations = itemsMap
    .map((i) => i.duracion_segundos)
    .filter((d) => d !== null && Number.isFinite(d));
  const tiempoItems = itemDurations.reduce((s, d) => s + d, 0);

  const porOperario = new Map();
  for (const p of pedidosMap) {
    const key = p.operario_id || 0;
    if (!porOperario.has(key)) {
      porOperario.set(key, {
        operario: p.operario,
        pedidos: 0,
        armados: 0,
        tiempo_pedidos: 0,
        items: 0,
        items_validados: 0,
        tiempo_items: 0,
        items_con_tiempo: 0
      });
    }
    const row = porOperario.get(key);
    row.pedidos += 1;
    row.items += p.items_total;
    row.items_validados += p.items_validados;
    if (p.estado === 'armado') {
      row.armados += 1;
      row.tiempo_pedidos += p.duracion_segundos;
    }
  }
  for (const i of itemsMap) {
    const key = i.operario_id || 0;
    if (!porOperario.has(key)) {
      porOperario.set(key, {
        operario: i.operario,
        pedidos: 0,
        armados: 0,
        tiempo_pedidos: 0,
        items: 0,
        items_validados: 0,
        tiempo_items: 0,
        items_con_tiempo: 0
      });
    }
    const row = porOperario.get(key);
    if (i.duracion_segundos !== null) {
      row.tiempo_items += i.duracion_segundos;
      row.items_con_tiempo += 1;
    }
  }

  return {
    rango,
    resumen: {
      pedidos: pedidosMap.length,
      armados: armados.length,
      items: pedidosMap.reduce((s, p) => s + p.items_total, 0),
      items_validados: pedidosMap.reduce((s, p) => s + p.items_validados, 0),
      tiempo_total_segundos: tiempoTotal,
      tiempo_promedio_pedido_segundos: armados.length
        ? Math.round(tiempoTotal / armados.length)
        : 0,
      tiempo_promedio_item_segundos: itemDurations.length
        ? Math.round(tiempoItems / itemDurations.length)
        : 0
    },
    pedidos: pedidosMap,
    items: itemsMap,
    por_operario: [...porOperario.values()].map((r) => ({
      operario: r.operario,
      pedidos: r.pedidos,
      armados: r.armados,
      items: r.items,
      items_validados: r.items_validados,
      tiempo_promedio_pedido_segundos: r.armados
        ? Math.round(r.tiempo_pedidos / r.armados)
        : 0,
      tiempo_promedio_item_segundos: r.items_con_tiempo
        ? Math.round(r.tiempo_items / r.items_con_tiempo)
        : 0
    }))
  };
}

export const opsStore = {
  ensureBootstrapChief,
  findById,
  findByEmail,
  listOperarios,
  createOperario,
  updateOperario,
  getOrderForActor,
  assignOrder,
  startOrder,
  validateItem,
  listOrders,
  getReports
};
