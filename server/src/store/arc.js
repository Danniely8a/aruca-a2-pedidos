import { pool } from '../db.js';
import { config } from '../config.js';
import { agruparSeries, aNumero } from './report-utils.js';

const q = (text, params) => pool.query(text, params);

// El A2 usa códigos 1..5 (no 0..4). El pedido que crea la web queda en 4
// (enviado), tal como indica el mapeo de transacciones.
const ESTADOS = [
  { codigo: 1, nombre: 'borrador' },
  { codigo: 2, nombre: 'aprobado' },
  { codigo: 3, nombre: 'facturado' },
  { codigo: 4, nombre: 'enviado' },
  { codigo: 5, nombre: 'rechazado' }
];
const aEstado = (n) => ESTADOS.find((e) => e.codigo === Number(n))?.nombre ?? 'enviado';
const aCodigo = (nombre) => ESTADOS.find((e) => e.nombre === nombre)?.codigo ?? 4;

const pad = (n) => String(n).padStart(6, '0');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const round4 = (n) => Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;

const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

// El A2 identifica al vendedor por arc_vendedores.vnd_codigo. No hay una
// relación directa con arc_users, así que se empareja por nombre.
async function codigoVendedorPorUsuario(userId) {
  const [usuario, vendedores] = await Promise.all([
    q('select usr_codigo, usr_descripcion from arc_users where usr_idauto = $1', [userId]),
    q('select vnd_codigo, vnd_descripcion from arc_vendedores')
  ]);
  const u = usuario.rows[0];
  if (!u) return null;
  const match = vendedores.rows.find(
    (v) => normalizar(v.vnd_descripcion) === normalizar(u.usr_descripcion)
  );
  return match?.vnd_codigo || null;
}

async function factorDolar() {
  const { rows } = await q(
    `select mda_factoractivo
       from arc_currencies
      where mda_codigo = $1 or mda_iso4217 = 'USD'
      order by (mda_iso4217 = 'USD') desc
      limit 1`,
    [String(config.currencyCode).padStart(2, '0')]
  );
  return rows[0] ? Number(rows[0].mda_factoractivo) : 1;
}

const nivelValido = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1 || v > 6) return null;
  return Math.trunc(v);
};

// Columna de precio de arc_inv_costos_precios para una lista (1..6).
// Los pedidos son en dólares (moneda 2), por lo que el A2 usa las columnas
// ...preciototalext. Para bolívares se usan las columnas locales.
const colPrecio = (nivel) => {
  const n = nivelValido(nivel) ?? config.priceLevel;
  const prefijo = `icp_p${String(n).padStart(2, '0')}`;
  if (config.currencyCode === 2) return `${prefijo}preciototalext`;
  const sufijo = config.priceWithTax ? 'ipreciototal' : 'preciosinimpuesto';
  return `${prefijo}${sufijo}`;
};

// Configuración de la plataforma persistida en app_config (la edita el
// administrador desde la pantalla de Configuración). Cache corta para no
// golpear la base en cada petición.
let cacheCfg = null;
let cacheTs = 0;

export function invalidarConfigCache() {
  cacheCfg = null;
  cacheTs = 0;
}

async function cfg() {
  if (cacheCfg && Date.now() - cacheTs < 30000) return cacheCfg;
  let tipo = config.orderTipo;
  let modulo = config.orderModule;
  let lista = config.priceLevel;
  try {
    const { rows } = await q('select clave, valor from app_config');
    const m = {};
    rows.forEach((r) => (m[r.clave] = r.valor));
    if (m.tipo_operacion_pedidos) tipo = Number(m.tipo_operacion_pedidos) || tipo;
    if (m.modulo_correlativo_pedidos) modulo = m.modulo_correlativo_pedidos;
    if (m.lista_precios) lista = Math.min(6, Math.max(1, Number(m.lista_precios) || lista));
  } catch {
    // app_config todavía no existe: se usan los valores por defecto
  }
  cacheCfg = { tipo, modulo, lista };
  cacheTs = Date.now();
  return cacheCfg;
}

// Número de documento: usa arc_correlatives si existe el módulo, si no genera secuencia.
async function nextDocumento(cliente, modulo = config.orderModule) {
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
         pr.icp_costoactbolivares as costo_bolivares,
         pr.icp_costoactextranjero as costo_extranjero,
         i.inv_descripciondetallada as descripcion_detallada,
         i.inv_existdecimal as exist_decimal,
         i.inv_seriales as usa_seriales,
         i.inv_depositos as usa_depositos,
         i.inv_capacidad as capacidad,
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
         c.cli_nit as nit,
         c.cli_telefono as telefono,
         c.cli_direccion1 as direccion,
         c.cli_zona as zona_codigo,
         c.cli_cobrador as cobrador_codigo,
         c.cli_diascredito as dias_credito,
         c.cli_moneda as moneda_codigo,
         c.cli_exento as exento,
         c.cli_especial as especial,
         z.zna_descripcion as ciudad,
         c.cli_preciodefecto as lista_precio,
         c.cli_vendedor as vendedor_codigo,
         coalesce(v.vnd_descripcion, u.usr_descripcion) as vendedor_nombre,
         coalesce(u.usr_idauto, 0) as vendedor_id,
         coalesce(x.email, '') as correo,
         coalesce(x.tipo_contribuyente, 'ordinario') as tipo_contribuyente,
         coalesce(x.moneda, 'USD') as moneda,
         (c.cli_status is distinct from false) as activo
    from arc_clientes c
    left join arc_zonas z on z.zna_codigo = c.cli_zona
    left join arc_vendedores v on v.vnd_codigo = c.cli_vendedor
    left join arc_users u on u.usr_codigo = c.cli_vendedor
    left join app_clientes_extra x on x.id_cliente = c.cli_id_auto`;

const SQL_PEDIDOS = `
  select t.trn_id_auto as id,
         t.trn_documento as numero,
         t.trn_fechaemision as fecha,
         t.trn_tipo as tipo,
         t.trn_status as status,
         t.trn_totalneto as total,
         t.trn_totalbruto as subtotal,
         t.trn_descuento1monto as descuento,
         t.trn_impuesto1monto as impuestos,
         t.trn_rifcliente as rif,
         t.trn_vendedorasignado as vendedor_codigo,
         t.trn_detalle as observacion,
         t.trn_sync_status as sync_status,
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
    tipo: Number(r.tipo) || 10,
    estado: aEstado(r.status),
    subtotal: Number(r.subtotal || 0),
    descuento: Number(r.descuento || 0),
    impuestos: Number(r.impuestos || 0),
    total: Number(r.total || 0),
    observacion: r.observacion || '',
    sync_status: r.sync_status,
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
              usr_codigo as codigo,
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
      codigo: u.codigo,
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

  async listProducts({ q: term = '', categoria = '', lista } = {}) {
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
    const nivel = nivelValido(lista) ?? (await cfg()).lista;
    const { rows } = await q(
      `${sqlProductos(nivel)} where ${where.join(' and ')} order by i.inv_descripcion limit 500`,
      params
    );
    return rows;
  },
  async getProduct(id, lista) {
    const nivel = nivelValido(lista) ?? (await cfg()).lista;
    const { rows } = await q(`${sqlProductos(nivel)} where i.inv_id_auto = $1`, [id]);
    return rows[0] || null;
  },
  async getProductByCodigo(codigo, lista) {
    const nivel = nivelValido(lista) ?? (await cfg()).lista;
    const { rows } = await q(`${sqlProductos(nivel)} where i.inv_codigo = $1`, [codigo]);
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
  async findCustomerByRif(rif) {
    const { rows } = await q(`${SQL_CLIENTES} where upper(c.cli_rif) = upper($1) limit 1`, [
      String(rif).trim()
    ]);
    return rows[0] || null;
  },
  async getCompany() {
    const { rows } = await q(
      `select emp_idauto as id,
              emp_codigo as codigo,
              emp_descripcion as descripcion,
              emp_idfiscal as idfiscal,
              emp_direccionf as direccion,
              emp_telefono1 as telefono1,
              emp_telefono2 as telefono2,
              emp_emailempresa as email
         from arc_company
        order by emp_idauto
        limit 1`
    );
    return rows[0] || null;
  },
  async createCustomer(data) {
    const codigoVendedor = await codigoVendedorPorUsuario(data.vendedor_id);

    const c = await pool.connect();
    try {
      await c.query('begin');

      const seq = await c.query(
        `select coalesce(max((nullif(regexp_replace(cli_codigo, '\\D', '', 'g'), ''))::int), 0) + 1 as n
           from arc_clientes`
      );
      const codigo = `C-${String(Number(seq.rows[0].n) || 1).padStart(4, '0')}`;

      const insert = await c.query(
        `insert into arc_clientes (
           cli_codigo, cli_descripcion, cli_rif, cli_telefono, cli_direccion1,
           cli_vendedor, cli_preciodefecto, cli_status, cli_systemdate
         ) values ($1,$2,$3,$4,$5,$6,$7,$8, now())
         returning cli_id_auto as id`,
        [
          codigo,
          data.nombre,
          data.rif,
          data.telefono || null,
          data.direccion || null,
          codigoVendedor,
          config.priceLevel,
          data.estado !== 'inactivo'
        ]
      );
      const id = Number(insert.rows[0].id);

      await c.query(
        `insert into app_clientes_extra (id_cliente, email, tipo_contribuyente, moneda)
         values ($1,$2,$3,$4)
         on conflict (id_cliente) do update
            set email = excluded.email,
                tipo_contribuyente = excluded.tipo_contribuyente,
                moneda = excluded.moneda,
                actualizado_en = now()`,
        [
          id,
          data.correo || null,
          data.tipo_contribuyente || 'ordinario',
          data.moneda || 'USD'
        ]
      );

      await c.query('commit');
      return this.getCustomer(id);
    } catch (err) {
      await c.query('rollback');
      throw err;
    } finally {
      c.release();
    }
  },
  async nivelDelCliente(clienteId) {
    const { rows } = await q(
      'select cli_preciodefecto from arc_clientes where cli_id_auto = $1',
      [clienteId]
    );
    return nivelValido(rows[0]?.cli_preciodefecto);
  },

  // Precios "especiales" del cliente: solo los productos donde su lista
  // (cli_preciodefecto) difiere de la lista base del pedido.
  async customerPrices(clienteId, lista) {
    const general = nivelValido(lista) ?? (await cfg()).lista;
    const nivel = (await this.nivelDelCliente(clienteId)) ?? general;
    if (nivel === general) return [];
    const clienteCol = colPrecio(nivel);
    const generalCol = colPrecio(general);
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

    const usuario = await this.getUserById(data.vendedor_id);
    const codigoVendedor = await codigoVendedorPorUsuario(data.vendedor_id);
    const usuarioCodigo = usuario?.codigo || usuario?.usuario || 'WEB';
    const factor = await factorDolar();
    const moneda = config.currencyCode;
    const deposito = config.depositSource;
    const maquina = config.machine;
    const serie = config.serie;

    const tipoSolicitado = Number(data.tipo);
    const tipoDocumento = tipoSolicitado === 9 ? 9 : 10;
    const estadoNombre =
      data.estado || (tipoDocumento === 9 ? 'borrador' : 'enviado');
    const status = aCodigo(estadoNombre);
    const listaUsada = Number(data.lista) || Number(cliente.lista_precio) || 1;
    const tipoPrecio = Math.min(3, Math.max(0, listaUsada - 1));

    const ahora = new Date();
    const hora = ahora.toTimeString().slice(0, 8);
    const diasCredito = Number(cliente.dias_credito) || 0;
    const vencimiento = new Date(ahora);
    vencimiento.setDate(vencimiento.getDate() + diasCredito);
    const fechaVencido = `${vencimiento.getFullYear()}-${String(
      vencimiento.getMonth() + 1
    ).padStart(2, '0')}-${String(vencimiento.getDate()).padStart(2, '0')}`;

    const lineas = [];
    for (const d of data.detalles) {
      const producto = await this.getProduct(d.producto_id, data.lista);
      const cantidad = Number(d.cantidad) || 0;
      const precio = Number(d.precio) || 0;
      const pctDesc = Math.min(100, Math.max(0, Number(d.descuento) || 0));
      const baseUnit = round4(precio * (1 - pctDesc / 100));
      const impuestoUnit = round4(baseUnit * config.taxRate);
      const precioVentaUnit = round4(baseUnit + impuestoUnit);
      const costoLocal = Number(producto?.costo_bolivares) || 0;
      const costoExt = Number(producto?.costo_extranjero) || 0;
      const costoOperacion =
        costoLocal > 0 && factor > 0 ? round4(costoLocal / factor) : round4(costoExt);
      lineas.push({
        d,
        producto,
        cantidad,
        precio,
        pctDesc,
        baseUnit,
        impuestoUnit,
        precioVentaUnit,
        costoLocal,
        costoExt,
        costoOperacion
      });
    }

    const c = await pool.connect();
    try {
      await c.query('begin');

      const configuracion = await cfg();
      const tipo = tipoDocumento;
      const modulo = tipo === 9 ? 'Presupuestos' : configuracion.modulo;
      const { numero } = await nextDocumento(c, modulo);
      const auto = await c.query(
        'select coalesce(max(trn_autoincrement), 0) + 1 as n from arc_transacciones'
      );
      const autoincrement = Number(auto.rows[0].n);

      const seqDetalle = await c.query(
        'select coalesce(max(dtv_autoincrement), 0) + 1 as n from arc_detalletranvtas'
      );
      const primerDetalle = Number(seqDetalle.rows[0].n);

      const impuestoPorcent = round2(config.taxRate * 100);

      const cabecera = {
        trn_autoincrement: autoincrement,
        trn_documento: numero,
        trn_tipo: tipo,
        trn_status: status,
        trn_visible: true,
        trn_fechaemision: ahora,
        trn_depositosource: deposito,
        trn_depositodestino: null,
        trn_moneda: moneda,
        trn_factorcambio: factor,
        trn_clasificacion: 0,
        trn_descripclasify: null,
        trn_user: Number(data.vendedor_id) || null,
        trn_autorizadopor: 'Crédito',
        trn_proposito: null,
        trn_responsable: cliente.codigo,
        trn_detalle: data.observacion || null,
        trn_tienelotes: false,
        trn_updateitems: true,
        trn_descuento1porcent: 0,
        trn_descuento1origen: 1,
        trn_descuento2porcent: 0,
        trn_descuento2monto: 0,
        trn_descuento2origen: 1,
        trn_descuentoparcial: 0,
        trn_fleteporcent: 0,
        trn_fletemoneda: 0,
        trn_fleteorigen: 1,
        trn_baseimponible2: 0,
        trn_impuesto2porcent: 0,
        trn_impuesto2monto: 0,
        trn_descuentocuadre: 0,
        trn_fechavencido: fechaVencido,
        trn_diasvencimiento: diasCredito,
        trn_rifcliente: cliente.rif || null,
        trn_nitcliente: cliente.nit || null,
        trn_personacontacto: cliente.nombre || null,
        trn_telefonocontacto: cliente.telefono || null,
        trn_direcciondespacho: cliente.direccion || null,
        trn_detallecomentario: null,
        trn_ordencompra: null,
        trn_existeplanillaimportacion: false,
        trn_porcentfletesinasignar: 0,
        trn_monedapago: config.paymentCurrency,
        trn_vuelto: 0,
        trn_autorizados: null,
        trn_excento: Boolean(cliente.exento),
        trn_tipooperacionorigen: 0,
        trn_documentoorigen: null,
        trn_fromcompuestos: false,
        trn_vendedorasignado: codigoVendedor,
        trn_zonaventa: cliente.zona_codigo || null,
        trn_pendingforprint: null,
        trn_cobradorasignado: cliente.cobrador_codigo || null,
        trn_comisioncobros: 0,
        trn_comisioncobrosbloqueada: false,
        trn_facturasloterandom: null,
        trn_multiplevendedor: false,
        trn_multipledeposito: false,
        trn_timesaved: null,
        trn_tipoprecio: tipoPrecio,
        trn_base_autoincrement: autoincrement,
        trn_serie: serie,
        trn_nameformato: null,
        trn_machinename: maquina,
        trn_comisionventa: 0,
        trn_montopagado: 0,
        trn_montoperiodo: 0,
        trn_porcentperiodo: 0,
        trn_hora: hora,
        trn_guiadespacho: null,
        trn_norecibocaja: null,
        trn_ctocosto: null,
        trn_prefixinventario: null,
        trn_numerocontrol: null,
        trn_costoajustado: 0,
        trn_factorreferencia: factor,
        trn_finicial: 0,
        trn_fintereses: 0,
        trn_finteresesp: 0,
        trn_fmanejo: 0,
        trn_fmanejop: 0,
        trn_fextraordinaria: 0,
        trn_fctdextraordinaria: 0,
        trn_fintextraordinaria: 0,
        trn_fmtocuota: 0,
        trn_fctdcuota: 0,
        trn_fcobranza: 0,
        trn_totalfinanciado: 0,
        trn_saldofinanciar: 0,
        trn_capitalcuotaextra: 0,
        trn_credicard: null,
        trn_maquinafiscal: null,
        trn_totalpaginas: 0,
        trn_sucursalorigen: 0,
        trn_fechalibro: ahora,
        trn_ivaintereses: 0,
        trn_reimpresafiscal: false,
        trn_dctofiscalorigen: null,
        trn_fechafactura: '1899-12-30',
        trn_dctoiva: 0,
        trn_monedacambio: null,
        trn_tipofactorcambio: 0,
        trn_origencambio: 0,
        trn_factorvuelto: 0,
        trn_codecambio: null,
        trn_vueltoorg: 0,
        trn_vtanapago: 0,
        trn_factorreferencia2: 0,
        trn_extrafield01: null,
        trn_extrafield02: null,
        trn_extrafield03: null,
        trn_extrafield04: null,
        trn_extrafield05: null,
        trn_baseigtf: 0,
        trn_extrafield06: null,
        trn_imprentaasignacion: null,
        trn_imprentahora: null,
        trn_statusimprenta: 0,
        trn_imprentadocorigen: null,
        trn_imprentamotivo: null,
        trn_imprentafechaorigen: '1899-12-30',
        trn_imprentaserieorigen: null,
        trn_imprentamtoorigen: 0,
        trn_mtootroscargos: 0,
        trn_imprentacorrelativo: 0,
        trn_imprentacontrolorigen: null,
        trn_systemdate: ahora,
        trn_namemachine: maquina,
        trn_usercreator: usuarioCodigo,
        trn_lastupdatedate: ahora,
        trn_lastmachine: maquina,
        trn_userlastupdate: usuarioCodigo,
        trn_sync_status: false
      };

      const columnas = Object.keys(cabecera);
      const valores = Object.values(cabecera);
      const marcas = columnas.map((_, i) => `$${i + 1}`);
      const insertTrn = await c.query(
        `insert into arc_transacciones (${columnas.join(', ')})
         values (${marcas.join(', ')})
         returning trn_id_auto`,
        valores
      );
      const idTrn = Number(insertTrn.rows[0].trn_id_auto);

      for (let i = 0; i < lineas.length; i += 1) {
        const l = lineas[i];
        const dtvAutoincrement = primerDetalle + i;
        const detalle = {
          dtv_tipooperacion: tipo,
          dtv_codigo: l.d.codigo,
          dtv_linea: i,
          dtv_documento: numero,
          dtv_autoincrement: dtvAutoincrement,
          dtv_clienteproveedor: cliente.codigo,
          dtv_documentoorigen: null,
          dtv_lineaorigen: null,
          dtv_clasificacion: 0,
          dtv_status: status,
          dtv_visible: true,
          dtv_costo: l.costoOperacion,
          dtv_cantidad: l.cantidad,
          dtv_cantidadpendiente: l.cantidad,
          dtv_lote: null,
          dtv_loterandom: 0,
          dtv_newlote: false,
          dtv_depositosource: deposito,
          dtv_depositotarget: null,
          dtv_operacion_autoincrement: autoincrement,
          dtv_decimales: Boolean(l.producto?.exist_decimal),
          dtv_decimalespen: Boolean(l.producto?.exist_decimal),
          dtv_serialnumber: Math.floor(Math.random() * 2000000000) + 1,
          dtv_usaseriales: Boolean(l.producto?.usa_seriales),
          dtv_usadepositos: Boolean(l.producto?.usa_depositos),
          dtv_costooperacion: l.costoOperacion,
          dtv_memodetalle: l.producto?.descripcion_detallada || null,
          dtv_moneda: moneda,
          dtv_factorcambio: factor,
          dtv_existedetalleimportacion: false,
          dtv_existedetalledecostos: false,
          dtv_alicuotafleteotros: 0,
          dtv_impuesto1: impuestoPorcent,
          dtv_porcentimpuesto1: true,
          dtv_montoimpuesto1: l.impuestoUnit,
          dtv_impuesto2: 0,
          dtv_porcentimpuesto2: false,
          dtv_montoimpuesto2: 0,
          dtv_origenprice: 3,
          dtv_porcentdescparcial: 0,
          dtv_descuentoparcial: 0,
          dtv_preciosindescuento: l.precio,
          dtv_preciocondescuento: l.baseUnit,
          dtv_preciodeventa: l.precioVentaUnit,
          dtv_rounddesctparcial: 0,
          dtv_comisionfija: 0,
          dtv_comisionfijap: true,
          dtv_unddescarga: Number(l.producto?.capacidad) || 1,
          dtv_undcapacidad: Number(l.producto?.capacidad) || 1,
          dtv_unddetallada: Boolean(l.producto?.exist_decimal),
          dtv_indexprices: 0,
          dtv_partesusanseriales: false,
          dtv_costodeventas: l.costoOperacion,
          dtv_descripcionoferta: null,
          dtv_vendedorasignado: codigoVendedor,
          dtv_montocomision: 0,
          dtv_preciobasecomision: l.baseUnit,
          dtv_comisionbloqueada: false,
          dtv_comisionyapagada: false,
          dtv_documentoliberacion: null,
          dtv_tipodecomision: 0,
          dtv_priceforcomision: 1,
          dtv_fechaoperacion: ahora,
          dtv_user: Number(data.vendedor_id) || null,
          dtv_porcentdescuento1: l.pctDesc,
          dtv_porcentdescuento2: 0,
          dtv_costosupdate: false,
          dtv_base_autoincrement: dtvAutoincrement,
          dtv_totalpeso: 0,
          dtv_ctocosto: 0,
          dtv_autorizado: null,
          dtv_markperiodo: false,
          dtv_ctocostostr: null,
          dtv_costoactualnacional: l.costoLocal,
          dtv_costoactualext: l.costoExt,
          dtv_prefixinventario: null,
          dtv_costoajustado: 0,
          dtv_fechalibro: '1899-12-30',
          dtv_montoliquidado: 0,
          dtv_tipodocumentoorigen: 0,
          dtv_statusdocumentoorigen: 0,
          dtv_dctoiva: 0,
          dtv_montoimpuesto1dcto: 0,
          dtv_preciodeventadcto: 0,
          dtv_systemdate: ahora,
          dtv_namemachine: maquina,
          dtv_usercreator: usuarioCodigo,
          dtv_lastupdatedate: ahora,
          dtv_lastmachine: maquina,
          dtv_userlastupdate: usuarioCodigo,
          dtv_sync_status: false
        };

        const dcols = Object.keys(detalle);
        const dvals = Object.values(detalle);
        const dmarcas = dcols.map((_, idx) => `$${idx + 1}`);
        await c.query(
          `insert into arc_detalletranvtas (${dcols.join(', ')})
           values (${dmarcas.join(', ')})`,
          dvals
        );
      }

      const { rows: filasOficiales } = await c.query(
        `select trn_totalbruto as subtotal,
                trn_descuento1monto as descuento,
                trn_impuesto1monto as impuestos,
                trn_totalneto as total,
                trn_totalitems as items,
                trn_sync_status as sync_status
           from arc_transacciones
          where trn_id_auto = $1`,
        [idTrn]
      );
      const o = filasOficiales[0] || {};

      await c.query('commit');
      return {
        id: idTrn,
        numero,
        fecha: ahora.toISOString(),
        tipo,
        estado: aEstado(status),
        subtotal: Number(o.subtotal) || 0,
        descuento: Number(o.descuento) || 0,
        impuestos: Number(o.impuestos) || 0,
        total: Number(o.total) || 0,
        items: Number(o.items) || 0,
        sync_status: o.sync_status
      };
    } catch (err) {
      await c.query('rollback');
      throw err;
    } finally {
      c.release();
    }
  },

  async updateOrderEstado(id, estado) {
    const codigo = aCodigo(estado);
    const cabecera = await q(
      'select trn_autoincrement, trn_documento from arc_transacciones where trn_id_auto = $1',
      [id]
    );
    if (!cabecera.rows[0]) return null;

    await q(
      'update arc_transacciones set trn_status = $1, trn_lastupdatedate = now() where trn_id_auto = $2',
      [codigo, id]
    );
    await q(
      `update arc_detalletranvtas
          set dtv_status = $1, dtv_lastupdatedate = now()
        where dtv_operacion_autoincrement = $2 and dtv_documento = $3`,
      [codigo, cabecera.rows[0].trn_autoincrement, cabecera.rows[0].trn_documento]
    );

    const { rows: p } = await q(`${SQL_PEDIDOS} where t.trn_id_auto = $1`, [id]);
    return p[0] ? mapearPedido(p[0]) : null;
  },

  async listOrders({ vendedorId = null, q: term = '', estado = '', tipo = null } = {}) {
    const params = [];
    const where = [];
    const tipoSel = Number(tipo);
    if (tipoSel === 9 || tipoSel === 10) {
      params.push(tipoSel);
      where.push(`t.trn_tipo = $${params.length}`);
    } else {
      where.push('t.trn_tipo in (9, 10)');
    }

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
        where d.dtv_operacion_autoincrement = (select trn_autoincrement from arc_transacciones where trn_id_auto = $1)
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
    const params = [(await cfg()).tipo];
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

  async reportes({ desde, hasta, vendedorId = null, tipo = null } = {}) {
    const params = [desde, hasta];
    const where = [
      't.trn_fechaemision >= $1',
      't.trn_fechaemision <= $2'
    ];
    const tipoSel = Number(tipo);
    if (tipoSel === 9 || tipoSel === 10) {
      params.push(tipoSel);
      where.push(`t.trn_tipo = $${params.length}`);
    } else {
      where.push('t.trn_tipo in (9, 10)');
    }

    if (vendedorId) {
      const u = await q('select usr_codigo from arc_users where usr_idauto = $1', [
        vendedorId
      ]);
      const codigo = u.rows[0]?.usr_codigo;
      if (!codigo) {
        return {
          rango: { desde, hasta },
          resumen: {
            pedidos: 0,
            items: 0,
            subtotal: 0,
            descuento: 0,
            impuestos: 0,
            total: 0,
            promedio: 0
          },
          series: { dia: [], semana: [], mes: [] },
          productos: [],
          clientes: [],
          estados: [],
          vendedores: []
        };
      }
      params.push(codigo);
      where.push(`t.trn_vendedorasignado = $${params.length}`);
    }

    const filtro = where.join(' and ');
    const serieParams = [...params, config.reportTimezone];
    const zona = `$${serieParams.length}`;

    const [resumenQ, serieQ, productosQ, clientesQ, estadosQ, vendedoresQ] =
      await Promise.all([
        q(
          `select count(*) as pedidos,
                  coalesce(sum(t.trn_totalbruto), 0) as subtotal,
                  coalesce(sum(t.trn_descuento1monto), 0) as descuento,
                  coalesce(sum(t.trn_impuesto1monto), 0) as impuestos,
                  coalesce(sum(t.trn_totalneto), 0) as total
             from arc_transacciones t
            where ${filtro}`,
          params
        ),
        q(
          `select to_char((t.trn_fechaemision at time zone ${zona})::date, 'YYYY-MM-DD') as periodo,
                  count(*) as pedidos,
                  coalesce(sum(t.trn_totalneto), 0) as total,
                  coalesce(sum(x.items), 0) as items
             from arc_transacciones t
             left join lateral (
               select coalesce(sum(d.dtv_cantidad), 0) as items
                 from arc_detalletranvtas d
                where d.dtv_autoincrement = t.trn_autoincrement
                  and d.dtv_documento = t.trn_documento
             ) x on true
            where ${filtro}
            group by 1
            order by 1`,
          serieParams
        ),
        q(
          `select d.dtv_codigo as codigo,
                  coalesce(p.inv_descripcion, d.dtv_codigo) as descripcion,
                  coalesce(sum(d.dtv_cantidad), 0) as cantidad,
                  coalesce(sum(d.dtv_preciodeventa * d.dtv_cantidad *
                    (1 - coalesce(d.dtv_porcentdescuento1, 0) / 100.0)), 0) as total,
                  count(distinct t.trn_id_auto) as pedidos
             from arc_detalletranvtas d
             join arc_transacciones t
               on t.trn_autoincrement = d.dtv_autoincrement
              and t.trn_documento = d.dtv_documento
             left join arc_inventario p on p.inv_codigo = d.dtv_codigo
            where ${filtro}
            group by d.dtv_codigo, p.inv_descripcion
            order by total desc
            limit 100`,
          params
        ),
        q(
          `select coalesce(c.cli_descripcion, t.trn_rifcliente) as cliente,
                  t.trn_rifcliente as rif,
                  count(*) as pedidos,
                  coalesce(sum(t.trn_totalneto), 0) as total
             from arc_transacciones t
             left join arc_clientes c on c.cli_rif = t.trn_rifcliente
            where ${filtro}
            group by 1, 2
            order by total desc
            limit 100`,
          params
        ),
        q(
          `select t.trn_status as status,
                  count(*) as pedidos,
                  coalesce(sum(t.trn_totalneto), 0) as total
             from arc_transacciones t
            where ${filtro}
            group by 1
            order by 2 desc`,
          params
        ),
        q(
          `select coalesce(u.usr_descripcion, t.trn_vendedorasignado, 'Sin vendedor') as vendedor,
                  count(*) as pedidos,
                  coalesce(sum(t.trn_totalneto), 0) as total
             from arc_transacciones t
             left join arc_users u on u.usr_codigo = t.trn_vendedorasignado
            where ${filtro}
            group by 1
            order by total desc`,
          params
        )
      ]);

    const filasDiarias = serieQ.rows.map((r) => ({
      periodo: r.periodo,
      pedidos: aNumero(r.pedidos),
      items: aNumero(r.items),
      total: aNumero(r.total)
    }));
    const series = agruparSeries(filasDiarias);
    const items = filasDiarias.reduce((acc, f) => acc + f.items, 0);

    const r = resumenQ.rows[0] || {};
    const pedidos = aNumero(r.pedidos);
    const total = round2(aNumero(r.total));

    return {
      rango: { desde, hasta },
      resumen: {
        pedidos,
        items,
        subtotal: round2(aNumero(r.subtotal)),
        descuento: round2(aNumero(r.descuento)),
        impuestos: round2(aNumero(r.impuestos)),
        total,
        promedio: pedidos ? round2(total / pedidos) : 0
      },
      series,
      productos: productosQ.rows.map((x) => ({
        codigo: x.codigo,
        descripcion: x.descripcion,
        cantidad: aNumero(x.cantidad),
        total: round2(aNumero(x.total)),
        pedidos: aNumero(x.pedidos)
      })),
      clientes: clientesQ.rows.map((x) => ({
        cliente: x.cliente,
        rif: x.rif,
        pedidos: aNumero(x.pedidos),
        total: round2(aNumero(x.total))
      })),
      estados: estadosQ.rows.map((x) => ({
        estado: aEstado(x.status),
        pedidos: aNumero(x.pedidos),
        total: round2(aNumero(x.total))
      })),
      vendedores: vendedoresQ.rows.map((x) => ({
        vendedor: x.vendedor,
        pedidos: aNumero(x.pedidos),
        total: round2(aNumero(x.total))
      }))
    };
  },

  estados: () => ESTADOS.map((e) => e.nombre)
};
