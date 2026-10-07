import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { config } from '../config.js';

const q = (text, params) => pool.query(text, params);
const Usuario = 'A2-WEB';

const nulo = (v) => (v === undefined || v === null || v === '' ? null : v);
const texto = (v) => (v === undefined || v === null ? '' : String(v).trim());

function mapCompany(r) {
  if (!r) return null;
  return {
    id: Number(r.emp_idauto),
    codigo: r.emp_codigo,
    descripcion: r.emp_descripcion || '',
    idfiscal: r.emp_idfiscal || '',
    status: r.emp_status !== false,
    direccionf: r.emp_direccionf || '',
    direccionl: r.emp_direccionl || '',
    telefono1: r.emp_telefono1 || '',
    telefono2: r.emp_telefono2 || '',
    representante: r.emp_representante || '',
    email: r.emp_emailempresa || ''
  };
}

function mapCorrelativo(r) {
  return {
    id: Number(r.cor_idauto),
    modulo: r.cor_modname,
    proximo: Number(r.cor_proximo),
    empresa: r.cor_emp_codigo,
    actualizado: r.cor_fechaultimaactualizacion || r.cor_fechacreacion
  };
}

function mapTipo(r) {
  return {
    id: Number(r.tip_id),
    descripcion: r.tip_descripcion,
    categoria: r.tip_categoria,
    afectaInventario: r.tip_afecta_inventario === true
  };
}

function mapUsuario(r) {
  return {
    id: Number(r.usr_idauto),
    codigo: r.usr_codigo,
    login: r.usr_login || '',
    nombre: r.usr_descripcion || '',
    email: r.usr_emailusuario || '',
    rol: /admin/i.test(r.usr_rol || '') ? 'admin' : 'vendedor',
    status: r.usr_status !== false,
    tieneClave: Boolean(r.tiene_clave)
  };
}

export const settingsStore = {
  // ---------------------------------------------------------------- Empresa
  async getCompany() {
    const { rows } = await q('select * from arc_company order by emp_idauto limit 1');
    return mapCompany(rows[0] || null);
  },

  async updateCompany(data) {
    const codigo = texto(data.codigo);
    if (!codigo) throw new Error('El código de empresa es obligatorio');

    const { rows: actuales } = await q('select * from arc_company order by emp_idauto limit 1');
    const a = actuales[0] || {};
    const toma = (clave, actual) => (data[clave] === undefined ? actual : data[clave]);

    const campos = [
      codigo,
      nulo(toma('descripcion', a.emp_descripcion)),
      nulo(toma('idfiscal', a.emp_idfiscal)),
      nulo(toma('direccionf', a.emp_direccionf)),
      nulo(toma('direccionl', a.emp_direccionl)),
      nulo(toma('telefono1', a.emp_telefono1)),
      nulo(toma('telefono2', a.emp_telefono2)),
      nulo(toma('representante', a.emp_representante)),
      nulo(toma('email', a.emp_emailempresa)),
      data.status === undefined ? a.emp_status !== false : data.status !== false
    ];

    if (actuales[0]) {
      await q(
        `update arc_company
            set emp_codigo=$1, emp_descripcion=$2, emp_idfiscal=$3, emp_direccionf=$4,
                emp_direccionl=$5, emp_telefono1=$6, emp_telefono2=$7, emp_representante=$8,
                emp_emailempresa=$9, emp_status=$10, emp_fechaultimaactualizacion=now(),
                emp_userlastupdate=$11
          where emp_idauto=$12`,
        [...campos, Usuario, actuales[0].emp_idauto]
      );
    } else {
      await q(
        `insert into arc_company
           (emp_codigo, emp_descripcion, emp_idfiscal, emp_direccionf, emp_direccionl,
            emp_telefono1, emp_telefono2, emp_representante, emp_emailempresa, emp_status,
            emp_fechacreacion, emp_fechasistema, emp_usercreator, emp_namemachine)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now(), $11, 'A2-WEB')`,
        [...campos, Usuario]
      );
    }
    return this.getCompany();
  },

  // ------------------------------------------------------------ Correlativos
  async listCorrelativos() {
    const { rows } = await q('select * from arc_correlatives order by cor_modname');
    return rows.map(mapCorrelativo);
  },

  async createCorrelativo({ modulo, proximo, empresa }) {
    const mod = texto(modulo);
    if (!mod) throw new Error('El nombre del módulo es obligatorio');
    const tipo = await q('select 1 from arc_tipo_operacion where tip_descripcion = $1', [mod]);
    if (!tipo.rows.length) {
      throw new Error(`El módulo "${mod}" no existe en Tipo de operación (arc_tipo_operacion)`);
    }
    const emp = texto(empresa) || (await this.getCompany())?.codigo;
    if (!emp) throw new Error('No hay empresa configurada (cor_emp_codigo)');
    await q(
      `insert into arc_correlatives
         (cor_modname, cor_proximo, cor_emp_codigo, cor_usercreator, cor_namemachine,
          cor_fechacreacion, cor_fechasistema)
       values ($1, $2, $3, $4, 'A2-WEB', now(), now())`,
      [mod, Math.max(0, Math.trunc(Number(proximo) || 1)), emp, Usuario]
    );
    return true;
  },

  async updateCorrelativo(id, { modulo, proximo, empresa }) {
    const mod = texto(modulo);
    if (!mod) throw new Error('El nombre del módulo es obligatorio');
    const emp = texto(empresa) || (await this.getCompany())?.codigo;
    const { rows } = await q(
      `update arc_correlatives
          set cor_modname=$1, cor_proximo=$2, cor_emp_codigo=$3,
              cor_fechaultimaactualizacion=now(), cor_userlastupdate=$4
        where cor_idauto=$5
        returning cor_idauto`,
      [mod, Math.max(0, Math.trunc(Number(proximo) || 0)), emp, Usuario, id]
    );
    if (!rows[0]) throw new Error('Correlativo no encontrado');
    return true;
  },

  async deleteCorrelativo(id) {
    const { rowCount } = await q('delete from arc_correlatives where cor_idauto = $1', [id]);
    if (!rowCount) throw new Error('Correlativo no encontrado');
    return true;
  },

  // -------------------------------------------------------- Tipo operación
  async listTipos() {
    const { rows } = await q('select * from arc_tipo_operacion order by tip_id');
    return rows.map(mapTipo);
  },

  async createTipo({ id, descripcion, categoria, afectaInventario }) {
    const desc = texto(descripcion);
    const cat = texto(categoria).toUpperCase();
    if (!desc) throw new Error('La descripción es obligatoria');
    if (!cat) throw new Error('La categoría es obligatoria');

    let nuevoId = Math.trunc(Number(id));
    if (!Number.isFinite(nuevoId) || nuevoId <= 0) {
      const { rows } = await q('select coalesce(max(tip_id), 0) + 1 as n from arc_tipo_operacion');
      nuevoId = Number(rows[0].n);
    }
    await q(
      `insert into arc_tipo_operacion (tip_id, tip_descripcion, tip_categoria, tip_afecta_inventario)
       values ($1, $2, $3, $4)`,
      [nuevoId, desc, cat, afectaInventario === true]
    );
    return nuevoId;
  },

  async updateTipo(id, { descripcion, categoria, afectaInventario }) {
    const desc = texto(descripcion);
    const cat = texto(categoria).toUpperCase();
    if (!desc) throw new Error('La descripción es obligatoria');
    if (!cat) throw new Error('La categoría es obligatoria');
    const { rows } = await q(
      `update arc_tipo_operacion
          set tip_descripcion=$1, tip_categoria=$2, tip_afecta_inventario=$3
        where tip_id=$4 returning tip_id`,
      [desc, cat, afectaInventario === true, id]
    );
    if (!rows[0]) throw new Error('Tipo de operación no encontrado');
    return true;
  },

  async deleteTipo(id) {
    const { rowCount } = await q('delete from arc_tipo_operacion where tip_id = $1', [id]);
    if (!rowCount) throw new Error('Tipo de operación no encontrado');
    return true;
  },

  // -------------------------------------------------------------- Usuarios
  async listUsers() {
    const { rows } = await q(
      `select u.*, exists(select 1 from app_accesos a where a.id_usuario = u.usr_idauto) as tiene_clave
         from arc_users u
        order by u.usr_descripcion`
    );
    return rows.map(mapUsuario);
  },

  async empresaId() {
    const { rows } = await q('select emp_idauto from arc_company order by emp_idauto limit 1');
    return rows[0] ? Number(rows[0].emp_idauto) : null;
  },

  async createUser({ codigo, login, nombre, email, rol, status, password }) {
    const cod = texto(codigo);
    const log = texto(login);
    const nom = texto(nombre);
    if (!cod) throw new Error('El código es obligatorio');
    if (!log) throw new Error('El usuario (login) es obligatorio');
    if (!nom) throw new Error('El nombre es obligatorio');

    const dup = await q('select 1 from arc_users where usr_codigo = $1 or usr_login = $2', [cod, log]);
    if (dup.rows.length) throw new Error('Ya existe un usuario con ese código o login');

    const emp = await this.empresaId();
    if (!emp) throw new Error('No hay empresa configurada');

    const { rows } = await q(
      `insert into arc_users
         (usr_codigo, usr_login, usr_descripcion, usr_emailusuario, usr_rol, usr_status,
          usr_emp_idauto, usr_fechacreacion, usr_fechasistema, usr_namemachine, usr_usercreator)
       values ($1,$2,$3,$4,$5,$6,$7, now(), now(), 'A2-WEB', $8)
       returning usr_idauto`,
      [
        cod,
        log,
        nom,
        nulo(email),
        texto(rol) === 'admin' ? 'admin' : 'vendedor',
        status === false ? false : true,
        emp,
        Usuario
      ]
    );
    const id = Number(rows[0].usr_idauto);
    if (texto(password)) await this.setUserPassword(id, password);
    return id;
  },

  async updateUser(id, { codigo, login, nombre, email, rol, status }) {
    const cod = texto(codigo);
    const log = texto(login);
    const nom = texto(nombre);
    if (!cod) throw new Error('El código es obligatorio');
    if (!log) throw new Error('El usuario (login) es obligatorio');
    if (!nom) throw new Error('El nombre es obligatorio');

    const dup = await q(
      'select 1 from arc_users where (usr_codigo = $1 or usr_login = $2) and usr_idauto <> $3',
      [cod, log, id]
    );
    if (dup.rows.length) throw new Error('Ya existe otro usuario con ese código o login');

    const { rows } = await q(
      `update arc_users
          set usr_codigo=$1, usr_login=$2, usr_descripcion=$3, usr_emailusuario=$4,
              usr_rol=$5, usr_status=$6, usr_fechaultimaactualizacion=now(), usr_userlastupdate=$7
        where usr_idauto=$8 returning usr_idauto`,
      [
        cod,
        log,
        nom,
        nulo(email),
        texto(rol) === 'admin' ? 'admin' : 'vendedor',
        status === false ? false : true,
        Usuario,
        id
      ]
    );
    if (!rows[0]) throw new Error('Usuario no encontrado');
    return true;
  },

  async setUserPassword(id, password) {
    const clave = texto(password);
    if (clave.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres');
    const hash = await bcrypt.hash(clave, 10);
    await q(
      `insert into app_accesos (id_usuario, password_hash, actualizado_en)
       values ($1, $2, now())
       on conflict (id_usuario) do update set password_hash = excluded.password_hash,
                                               actualizado_en = now()`,
      [id, hash]
    );
    return true;
  },

  async deleteUser(id) {
    const { rowCount } = await q('delete from arc_users where usr_idauto = $1', [id]);
    if (!rowCount) throw new Error('Usuario no encontrado');
    return true;
  },

  // ------------------------------------------------- Config de la plataforma
  async getConfig() {
    const valores = {};
    try {
      const { rows } = await q('select clave, valor from app_config');
      rows.forEach((r) => (valores[r.clave] = r.valor));
    } catch {
      // app_config todavía no existe
    }

    const tipo = Number(valores.tipo_operacion_pedidos) || config.orderTipo;
    const modulo = valores.modulo_correlativo_pedidos || config.orderModule;
    const lista = Math.min(6, Math.max(1, Number(valores.lista_precios) || config.priceLevel));

    const tipos = await q('select tip_id, tip_descripcion from arc_tipo_operacion order by tip_id');
    const mods = await q('select cor_modname, cor_proximo from arc_correlatives order by cor_modname');
    const tipoActual = tipos.rows.find((t) => Number(t.tip_id) === tipo);

    return {
      tipo_operacion: tipo,
      tipo_descripcion: tipoActual ? tipoActual.tip_descripcion : null,
      modulo_correlativo: modulo,
      lista_precios: lista,
      fuentes: {
        tipo_operacion: valores.tipo_operacion_pedidos ? 'configurado' : 'por defecto',
        modulo_correlativo: valores.modulo_correlativo_pedidos ? 'configurado' : 'por defecto',
        lista_precios: valores.lista_precios ? 'configurado' : 'por defecto'
      },
      tipos: tipos.rows.map((t) => ({ id: Number(t.tip_id), descripcion: t.tip_descripcion })),
      modulos: mods.rows.map((m) => ({ modulo: m.cor_modname, proximo: Number(m.cor_proximo) }))
    };
  },

  async setConfig({ tipo_operacion, modulo_correlativo, lista_precios }) {
    const set = async (clave, valor) => {
      await q(
        `insert into app_config (clave, valor, actualizado_en)
         values ($1, $2, now())
         on conflict (clave) do update set valor = excluded.valor, actualizado_en = now()`,
        [clave, String(valor)]
      );
    };

    if (tipo_operacion !== undefined && tipo_operacion !== null && tipo_operacion !== '') {
      const n = Math.trunc(Number(tipo_operacion));
      if (!Number.isFinite(n)) throw new Error('Tipo de operación inválido');
      const ok = await q('select 1 from arc_tipo_operacion where tip_id = $1', [n]);
      if (!ok.rows.length) throw new Error(`El tipo de operación ${n} no existe`);
      await set('tipo_operacion_pedidos', n);
    }

    if (modulo_correlativo !== undefined && modulo_correlativo !== null && modulo_correlativo !== '') {
      const mod = texto(modulo_correlativo);
      const ok = await q('select 1 from arc_correlatives where cor_modname = $1', [mod]);
      if (!ok.rows.length) throw new Error(`El módulo "${mod}" no existe en arc_correlatives`);
      await set('modulo_correlativo_pedidos', mod);
    }

    if (lista_precios !== undefined && lista_precios !== null && lista_precios !== '') {
      const n = Math.trunc(Number(lista_precios));
      if (!Number.isFinite(n) || n < 1 || n > 6) throw new Error('La lista de precios debe estar entre 1 y 6');
      await set('lista_precios', n);
    }

    const { invalidarConfigCache } = await import('./arc.js');
    invalidarConfigCache();
    return this.getConfig();
  }
};
