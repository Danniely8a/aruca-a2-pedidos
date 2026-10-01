import { pool } from '../db.js';
import { config } from '../config.js';

const q = (text, params) => pool.query(text, params);

const ESTADOS = ['borrador', 'enviado', 'aprobado', 'facturado', 'rechazado'];
const aEstado = (n) => ESTADOS[Number(n)] ?? 'enviado';
const aCodigo = (e) => Math.max(0, ESTADOS.indexOf(e));

const pad = (n) => String(n).padStart(6, '0');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const nivelValido = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1 || v > 6) return null;
  return Math.trunc(v);
};

// Columna de precio de arc_inv_costos_precios para una lista (1..6)
const colPrecio = (nivel) => {
  const n = nivelValido(nivel) ?? config.priceLevel;
  const sufijo = config.priceWithTax ? 'ipreciototal' : 'preciosinimpuesto';
  return `icp_p${String(n).padStart(2, '0')}${sufijo}`;
};

// Número de documento: usa arc_correlatives si existe el módulo, si no genera secuencia.
async function nextDocumento(cliente) {
  const modulo = config.orderModule;
  const { rows } = await cliente.query(
    'select cor_proximo, cor_emp_codigo from arc_correlatives where cor_modname = $1 for update',
    [modulo]
  );
  if (rows[0]) {
    const proximo = Number(rows[0].cor_proximo);
    await cliente.query(
      'update arc_correlatives set cor_proximo = $1, cor_fechaultimaactualizacion = now() where cor_modname = $2',
      [proximo + 1, modulo]
    );
    return { numero: pad(proximo), emp: rows[0].cor_emp_codigo };
  }
  const { rows: seq } = await cliente.query(
    'select coalesce(max(trn_autoincrement), 0) + 1 as n from arc_transacciones'
  );
  return { numero: pad(Number(seq[0].n)), emp: null };
}

const SQL_PRODUCTOS = `  select i.inv_id_auto as id,
         i.inv_codigo as codigo,
         i.inv_descripcion as descripcion,
         coalesce(c.cat_descripcion, i.inv_categoria) as categoria,
         i.inv_categoria as categoria_codigo,
         coalesce(nullif(i.inv_unidad, ''), 'unidad') as unidad,
         pr.__PRECIO__ as precio,
         coalesce(x.existencia, 0) as existencia,
         (i.inv_status is distinct from false) as activo
    from arc_inventario i
    left join arc_categorias c on c.cat_codigo = i.inv_categoria
    left join arc_inv_costos_precios pr on pr.icp_codeitem = i.inv_codigo
    left join lateral (
      select sum(e.exa_existencia) as existencia
        from arc_existencia_actual e
       where e.exa_codigoproducto = i.inv_codigo
    ) x on true`;

const sqlProductos = (nivel) =>
  SQL_PRODUCTOS.replace('__PRECIO__', colPrecio(nivel));

const SQL_CLIENTES = `
  select c.cli_id_auto as id,
         c.cli_codigo as codigo,
         c.cli_descripcion as nombre,
         c.cli_rif as rif,
         c.cli_telefono as telefono,
         c.cli_direccion1 as direccion,
         c.cli_zona as zona_codigo,
         z.zna_descripcion as ciudad,
         c.cli_preciodefecto as lista_precio,
         c.cli_vendedor as vendedor_codigo,
         coalesce(v.vnd_descripcion, u.usr_descripcion) as vendedor_nombre,
         coalesce(u.usr_idauto, 0) as vendedor_id,
         (c.cli_status is distinct from false) as activo
    from arc_clientes c
    left join arc_zonas z on z.zna_codigo = c.cli_zona
    left join arc_vendedores v on v.vnd_codigo = c.cli_vendedor
    left join arc_users u on u.usr_codigo = c.cli_vendedor`;

const SQL_PEDIDOS = `
  select t.trn_id_auto as id,
         t.trn_documento as numero,
         t.trn_fechaemision as fecha,
         t.trn_status as status,
         t.trn_totalneto as total,
         t.trn_totalbruto as subtotal,
         t.trn_descuento1monto as descuento,
         t.trn_impuesto1monto as impuestos,
         t.trn_rifcliente as rif,
         t.trn_vendedorasignado as vendedor_codigo,
         t.trn_detalle as observacion,
         c.cli_id_auto as cliente_id,
         c.cli_codigo as cliente_codigo,
         c.cli_descripcion as cliente_nombre,
         u.usr_idauto as vendedor_id,
         u.usr_descripcion as vendedor_nombre
    from arc_transacciones t
    left join arc_clientes c on c.cli_rif = t.trn_rifcliente
    left join arc_users u on u.usr_codigo = t.trn_vendedorasignado`;

function mapearPedido(r) {
  return {
    id: Number(r.id),
    numero: r.numero,
    fecha: r.fecha,
    estado: aEstado(r.status),
    subtotal: Number(r.subtotal || 0),
    descuento: Number(r.descuento || 0),
    impuestos: Number(r.impuestos || 0),
    total: Number(r.total || 0),
    observacion: r.observacion || '',
    rif: r.rif,
    cliente: r.cliente_id
      ? {
          id: Number(r.cliente_id),
          codigo: r.cliente_codigo,
          nombre: r.cliente_nombre,
          rif: r.rif
        }
      : { id: null, codigo: null, nombre: 'Cliente no encontrado', rif: r.rif },
    vendedor: r.vendedor_id
      ? { id: Number(r.vendedor_id), nombre: r.vendedor_nombre, codigo: r.vendedor_codigo }
      : { id: null, nombre: r.vendedor_codigo || '—', codigo: r.vendedor_codigo },
    vendedor_id: r.vendedor_id ? Number(r.vendedor_id) : null,
    cliente_id: r.cliente_id ? Number(r.cliente_id) : null
  };
}

export const arcStore = {
  mode: 'postgres',

  async findUserByLogin(login) {
    const { rows } = await q(
      `select u.usr_idauto as id,
              u.usr_descripcion as nombre,
              coalesce(u.usr_login, u.usr_emailusuario) as usuario,
              u.usr_emailusuario as email,
              u.usr_rol as rol,
              u.usr_codigo as codigo,
              (u.usr_status is distinct from false) as activo,
              a.password_hash
         from arc_users u
         left join app_accesos a on a.id_usuario = u.usr_idauto
        where (u.usr_login = $1 or u.usr_emailusuario = $1)
        limit 1`,
      [String(login).trim()]
    );
    const u = rows[0];
    if (!u || !u.activo || !u.password_hash) return null;
    return {
      id: Number(u.id),
      nombre: u.nombre || u.usuario,
      usuario: u.usuario,
      rol: /admin/i.test(u.rol || '') ? 'admin' : 'vendedor',
      codigo: u.codigo,
      activo: true,
      password_hash: u.password_hash
    };
  },

  async getUserById(id) {
    const u = await this.findUserById(id);
    return u;
  },
  async findUserById(id) {
    const { rows } = await q(
      `select usr_idauto as id, usr_descripcion as nombre,
              coalesce(usr_login, usr_emailusuario) as usuario,
              usr_rol as rol, (usr_status is distinct from false) as activo
         from arc_users where usr_idauto = $1`,
      [id]
    );
    if (!rows[0]) return null;
    const u = rows[0];
    return {
      id: Number(u.id),
      nombre: u.nombre || u.usuario,
      usuario: u.usuario,
      rol: /admin/i.test(u.rol || '') ? 'admin' : 'vendedor',
      activo: u.activo
    };
  },

  async listCategories() {
    const { rows } = await q(
      `select distinct cat_descripcion
         from arc_categorias
        where cat_status is distinct from false and cat_descripcion is not null
        order by 1`
    );
    return rows.map((r) => r.cat_descripcion);
  },

  async listProducts({ q: term = '', categoria = '' } = {}) {
    const params = [];
    const where = ['i.inv_status is distinct from false'];
    if (categoria) {
      params.push(categoria);
      const n = params.length;
      where.push(`(c.cat_descripcion = $${n} or i.inv_categoria = $${n})`);
    }
    if (term) {
      params.push(`%${term}%`);
      const n = params.length;
      where.push(
        `(i.inv_codigo ilike $${n} or i.inv_descripcion ilike $${n} or i.inv_categoria ilike $${n})`
      );
    }
    const { rows } = await q(
      `${sqlProductos(config.priceLevel)} where ${where.join(' and ')} order by i.inv_descripcion limit 500`,
      params
    );
    return rows;
  },
  async getProduct(id) {
    const { rows } = await q(
      `${sqlProductos(config.priceLevel)} where i.inv_id_auto = $1`,
      [id]
    );
    return rows[0] || null;
  },
  async getProductByCodigo(codigo) {
    const { rows } = await q(
      `${sqlProductos(config.priceLevel)} where i.inv_codigo = $1`,
      [codigo]
    );
    return rows[0] || null;
  },

  async listCustomers({ q: term = '' } = {}) {
    const params = [];
    const where = ['c.cli_status is distinct from false'];
    if (term) {
      params.push(`%${term}%`);
      const n = params.length;
      where.push(
        `(c.cli_descripcion ilike $${n} or c.cli_codigo ilike $${n}
          or c.cli_rif ilike $${n} or c.cli_zona ilike $${n})`
      );
    }
    const { rows } = await q(
      `${SQL_CLIENTES} where ${where.join(' and ')} order by c.cli_descripcion limit 500`,
      params
    );
    return rows;
  },
  async getCustomer(id) {
    const { rows } = await q(`${SQL_CLIENTES} where c.cli_id_auto = $1`, [id]);
    if (rows[0]) return rows[0];
    const porCodigo = await q(`${SQL_CLIENTES} where c.cli_codigo = $1`, [id]);
    return porCodigo.rows[0] || null;
  },
  async nivelDelCliente(clienteId) {
    const { rows } = await q(
      'select cli_preciodefecto from arc_clientes where cli_id_auto = $1',
      [clienteId]
    );
    return nivelValido(rows[0]?.cli_preciodefecto);
  },

  // Precios "especiales" del cliente: solo los productos donde su lista
  // (cli_preciodefecto) difiere de la lista general (A2_LISTA_PRECIO).
  async customerPrices(clienteId) {
    const nivel = (await this.nivelDelCliente(clienteId)) ?? config.priceLevel;
    if (nivel === config.priceLevel) return [];
    const clienteCol = colPrecio(nivel);
    const generalCol = colPrecio(config.priceLevel);
    const { rows } = await q(
      `select i.inv_id_auto as producto_id, p.${clienteCol} as precio
         from arc_inventario i
         join arc_inv_costos_precios p on p.icp_codeitem = i.inv_codigo
        where p.${clienteCol} is not null
          and p.${clienteCol} is distinct from p.${generalCol}`
    );
    return rows;
  },
  async customerPrice(clienteId, productoId) {
    const lista = await this.customerPrices(clienteId);
    const fila = lista.find((r) => Number(r.producto_id) === Number(productoId));
    return fila ? Number(fila.precio) : null;
  },

  async createOrder(data) {
    const cliente = await this.getCustomer(data.cliente_id);
    if (!cliente) throw new Error('Cliente no encontrado en el A2');

    const vendedor = await q(
      'select usr_codigo from arc_users where usr_idauto = $1',
      [data.vendedor_id]
    );
    const codigoVendedor = vendedor.rows[0]?.usr_codigo || null;

    const c = await pool.connect();
    try {
      await c.query('begin');

      const { numero } = await nextDocumento(c);
      const auto = await c.query(
        'select coalesce(max(trn_autoincrement), 0) + 1 as n from arc_transacciones'
      );
      const autoincrement = Number(auto.rows[0].n);
      const tipo = config.orderTipo;
      const base = round2(Number(data.subtotal) - Number(data.descuento));

      const insertTrn = await c.query(
        `insert into arc_transacciones (
           trn_autoincrement, trn_documento, trn_tipo, trn_status,
           trn_fechaemision, trn_rifcliente, trn_vendedorasignado, trn_totalitems,
           trn_totalbruto, trn_descuento1monto, trn_baseimponible,
           trn_impuesto1porcent, trn_impuesto1monto, trn_totalneto, trn_totalprecio,
           trn_detalle, trn_usercreator, trn_namemachine, trn_systemdate
         ) values ($1,$2,$3,$4, now(), $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, $14, $15, 'A2-WEB', now())
         returning trn_id_auto`,
        [
          autoincrement,
          numero,
          tipo,
          aCodigo(data.estado || 'enviado'),
          cliente.rif || null,
          codigoVendedor,
          data.detalles.length,
          data.subtotal,
          data.descuento,
          base,
          round2(config.taxRate * 100),
          data.impuestos,
          data.total,
          data.observacion || null,
          String(data.vendedor_codigo || 'sistema')
        ]
      );
      const idTrn = Number(insertTrn.rows[0].trn_id_auto);

      let linea = 0;
      for (const d of data.detalles) {
        linea += 1;
        const cantidad = Number(d.cantidad) || 0;
        const precio = Number(d.precio) || 0;
        const pctDesc = Number(d.descuento) || 0;
        const bruto = round2(precio * cantidad);
        const montoDesc = round2((bruto * pctDesc) / 100);
        const netoLinea = round2(bruto - montoDesc);
        await c.query(
          `insert into arc_detalletranvtas (
             dtv_tipooperacion, dtv_codigo, dtv_linea, dtv_documento,
             dtv_autoincrement, dtv_clienteproveedor, dtv_cantidad, dtv_preciodeventa,
             dtv_preciosindescuento, dtv_preciocondescuento, dtv_porcentdescuento1,
             dtv_descuentoparcial, dtv_impuesto1, dtv_montoimpuesto1, dtv_fechaoperacion,
             dtv_usercreator, dtv_namemachine, dtv_systemdate
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13, current_date, $14, 'A2-WEB', now())`,
          [
            tipo,
            d.codigo,
            linea,
            numero,
            autoincrement,
            cliente.codigo,
            cantidad,
            precio,
            cantidad > 0 ? round2(netoLinea / cantidad) : precio,
            pctDesc,
            montoDesc,
            config.taxRate,
            round2(netoLinea * config.taxRate),
            String(data.vendedor_codigo || 'sistema')
          ]
        );
      }

      await c.query('commit');
      return {
        id: idTrn,
        numero,
        fecha: new Date().toISOString(),
        estado: data.estado || 'enviado',
        total: data.total
      };
    } catch (err) {
      await c.query('rollback');
      throw err;
    } finally {
      c.release();
    }
  },

  async updateOrderEstado(id, estado) {
    const { rows } = await q(
      'update arc_transacciones set trn_status = $1, trn_lastupdatedate = now() where trn_id_auto = $2 returning trn_id_auto',
      [aCodigo(estado), id]
    );
    if (!rows[0]) return null;
    const { rows: p } = await q(`${SQL_PEDIDOS} where t.trn_id_auto = $1`, [id]);
    return p[0] ? mapearPedido(p[0]) : null;
  },

  async listOrders({ vendedorId = null, q: term = '', estado = '' } = {}) {
    const params = [];
    const where = [`t.trn_tipo = $${(params.push(config.orderTipo), params.length)}`];

    if (vendedorId) {
      const u = await q('select usr_codigo from arc_users where usr_idauto = $1', [
        vendedorId
      ]);
      const codigo = u.rows[0]?.usr_codigo;
      if (!codigo) return [];
      params.push(codigo);
      where.push(`t.trn_vendedorasignado = $${params.length}`);
    }
    if (estado) {
      params.push(aCodigo(estado));
      where.push(`t.trn_status = $${params.length}`);
    }
    if (term) {
      params.push(`%${term}%`);
      const n = params.length;
      where.push(`(t.trn_documento ilike $${n} or c.cli_descripcion ilike $${n})`);
    }

    const { rows } = await q(
      `${SQL_PEDIDOS} where ${where.join(' and ')} order by t.trn_fechaemision desc limit 300`,
      params
    );
    return rows.map(mapearPedido);
  },

  async getOrder(id) {
    const { rows } = await q(`${SQL_PEDIDOS} where t.trn_id_auto = $1`, [id]);
    if (!rows[0]) return null;
    const pedido = mapearPedido(rows[0]);
    const { rows: detalle } = await q(
      `select d.dtv_id_auto as id, d.dtv_linea as linea, d.dtv_codigo as codigo_producto,
              d.dtv_cantidad as cantidad, d.dtv_preciodeventa as precio,
              d.dtv_porcentdescuento1 as descuento,
              coalesce(d.dtv_preciodeventa * d.dtv_cantidad, 0)
                - coalesce(d.dtv_preciodeventa * d.dtv_cantidad * coalesce(d.dtv_porcentdescuento1,0) / 100, 0) as subtotal,
              p.inv_descripcion as descripcion, p.inv_unidad as unidad, p.inv_codigo as codigo
         from arc_detalletranvtas d
         left join arc_inventario p on p.inv_codigo = d.dtv_codigo
        where d.dtv_autoincrement = (select trn_autoincrement from arc_transacciones where trn_id_auto = $1)
          and d.dtv_documento = (select trn_documento from arc_transacciones where trn_id_auto = $1)
        order by d.dtv_linea`,
      [id]
    );
    return {
      ...pedido,
      detalles: detalle.map((d) => ({
        id: Number(d.id),
        producto_id: null,
        cantidad: Number(d.cantidad),
        precio: Number(d.precio || 0),
        descuento: Number(d.descuento || 0),
        subtotal: round2(d.subtotal),
        producto: {
          id: null,
          codigo: d.codigo,
          descripcion: d.descripcion || `Producto ${d.codigo_producto}`,
          unidad: d.unidad || 'unidad'
        }
      }))
    };
  },

  async stats({ vendedorId = null } = {}) {
    let filtro = '';
    const params = [config.orderTipo];
    if (vendedorId) {
      const u = await q('select usr_codigo from arc_users where usr_idauto = $1', [vendedorId]);
      const codigo = u.rows[0]?.usr_codigo;
      if (!codigo) return { pedidos_mes: 0, monto_mes: 0, clientes: 0, productos: 0, vendedores: 0 };
      params.push(codigo);
      filtro = 'and trn_vendedorasignado = $2';
    }
    const [pedidos, clientes, productos, vendedores] = await Promise.all([
      q(
        `select count(*) as n, coalesce(sum(trn_totalneto),0) as monto
           from arc_transacciones
          where trn_tipo = $1 and trn_fechaemision >= date_trunc('month', now()) ${filtro}`,
        params
      ),
      q('select count(*) as n from arc_clientes where cli_status is distinct from false'),
      q('select count(*) as n from arc_inventario where inv_status is distinct from false'),
      q('select count(*) as n from arc_users where usr_status is distinct from false')
    ]);
    return {
      pedidos_mes: Number(pedidos.rows[0].n),
      monto_mes: round2(pedidos.rows[0].monto),
      clientes: Number(clientes.rows[0].n),
      productos: Number(productos.rows[0].n),
      vendedores: Number(vendedores.rows[0].n)
    };
  },

  estados: () => ESTADOS
};
