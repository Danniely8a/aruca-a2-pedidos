import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const TABS = [
  { id: 'empresa', label: 'Empresa' },
  { id: 'plataforma', label: 'Plataforma' },
  { id: 'correlativos', label: 'Correlativos' },
  { id: 'tipos', label: 'Tipo de operación' },
  { id: 'usuarios', label: 'Usuarios' }
];

const EMPRESA_VACIA = {
  codigo: '',
  descripcion: '',
  idfiscal: '',
  direccionf: '',
  direccionl: '',
  telefono1: '',
  telefono2: '',
  representante: '',
  email: '',
  status: true
};

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('empresa');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [empresa, setEmpresa] = useState(EMPRESA_VACIA);
  const [cfg, setCfg] = useState(null);
  const [correlativos, setCorrelativos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [modal, setModal] = useState(null);

  const esAdmin = user?.rol === 'admin';

  const cargar = async (t) => {
    setCargando(true);
    setError('');
    try {
      if (t === 'empresa') {
        setEmpresa({ ...EMPRESA_VACIA, ...(await api('/api/settings/empresa')) || {} });
      } else if (t === 'plataforma') {
        setCfg(await api('/api/settings/config'));
      } else if (t === 'correlativos') {
        setCorrelativos(await api('/api/settings/correlativos'));
      } else if (t === 'tipos') {
        setTipos(await api('/api/settings/tipos'));
      } else if (t === 'usuarios') {
        setUsuarios(await api('/api/settings/usuarios'));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (esAdmin) cargar(tab);
    else setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, esAdmin]);

  const guardar = async (ruta, method, body, mensaje) => {
    setGuardando(true);
    try {
      await api(ruta, { method, body });
      toast.show(mensaje);
      setModal(null);
      setError('');
      await cargar(tab);
      return true;
    } catch (e) {
      setError(e.message);
      toast.show(e.message, 'error');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (ruta, mensaje) => {
    if (!window.confirm('¿Seguro que quieres eliminar este registro? Esta acción no se puede deshacer.'))
      return;
    await guardar(ruta, 'DELETE', undefined, mensaje);
  };

  const campo = (k, valor) => setModal((m) => ({ ...m, form: { ...m.form, [k]: valor } }));
  const campoEmpresa = (k, valor) => setEmpresa((e) => ({ ...e, [k]: valor }));

  if (!esAdmin) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>Configuración</h1>
            <p className="muted">Solo administradores</p>
          </div>
        </div>
        <div className="alert alert-error">
          Tu usuario no tiene permisos para ver la configuración.{' '}
          <Link to="/">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Configuración</h1>
          <p className="muted">
            Parámetros de la plataforma: empresa, correlativos, tipos de operación y usuarios
          </p>
        </div>
      </div>

      <div className="chips">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`chip ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {cargando && <p className="empty">Cargando…</p>}

      {!cargando && tab === 'empresa' && (
        <div className="card">
          <div className="card-head">
            <h2>Datos de la empresa</h2>
            <button
              className="btn btn-primary"
              disabled={guardando}
              onClick={() =>
                guardar('/api/settings/empresa', 'PUT', empresa, 'Empresa actualizada')
              }
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
          <div className="grid-2">
            <label className="field">
              <span>Código *</span>
              <input
                className="input"
                value={empresa.codigo}
                onChange={(e) => campoEmpresa('codigo', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Razón social</span>
              <input
                className="input"
                value={empresa.descripcion}
                onChange={(e) => campoEmpresa('descripcion', e.target.value)}
              />
            </label>
            <label className="field">
              <span>RIF / ID fiscal</span>
              <input
                className="input"
                value={empresa.idfiscal}
                onChange={(e) => campoEmpresa('idfiscal', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Representante</span>
              <input
                className="input"
                value={empresa.representante}
                onChange={(e) => campoEmpresa('representante', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Dirección fiscal</span>
              <input
                className="input"
                value={empresa.direccionf}
                onChange={(e) => campoEmpresa('direccionf', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Dirección de despacho</span>
              <input
                className="input"
                value={empresa.direccionl}
                onChange={(e) => campoEmpresa('direccionl', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Teléfono 1</span>
              <input
                className="input"
                value={empresa.telefono1}
                onChange={(e) => campoEmpresa('telefono1', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Teléfono 2</span>
              <input
                className="input"
                value={empresa.telefono2}
                onChange={(e) => campoEmpresa('telefono2', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Correo</span>
              <input
                className="input"
                value={empresa.email}
                onChange={(e) => campoEmpresa('email', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Estado</span>
              <select
                className="select"
                value={empresa.status ? '1' : '0'}
                onChange={(e) => campoEmpresa('status', e.target.value === '1')}
              >
                <option value="1">Activa</option>
                <option value="0">Inactiva</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {!cargando && tab === 'plataforma' && cfg && (
        <div className="card">
          <div className="card-head">
            <h2>Parámetros del pedido</h2>
            <button
              className="btn btn-primary"
              disabled={guardando}
              onClick={() =>
                guardar('/api/settings/config', 'PUT', cfg, 'Configuración guardada')
              }
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
          <div className="grid-2">
            <label className="field">
              <span>
                Tipo de operación del pedido
                {cfg.fuentes && <em className="muted"> ({cfg.fuentes.tipo_operacion})</em>}
              </span>
              <select
                className="select"
                value={String(cfg.tipo_operacion)}
                onChange={(e) => setCfg({ ...cfg, tipo_operacion: Number(e.target.value) })}
              >
                {(cfg.tipos || []).map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.id} · {t.descripcion}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                Módulo de correlativo
                {cfg.fuentes && <em className="muted"> ({cfg.fuentes.modulo_correlativo})</em>}
              </span>
              <select
                className="select"
                value={cfg.modulo_correlativo}
                onChange={(e) => setCfg({ ...cfg, modulo_correlativo: e.target.value })}
              >
                {(cfg.modulos || []).map((m) => (
                  <option key={m.modulo} value={m.modulo}>
                    {m.modulo} · próximo {m.proximo}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                Lista de precios general
                {cfg.fuentes && <em className="muted"> ({cfg.fuentes.lista_precios})</em>}
              </span>
              <select
                className="select"
                value={String(cfg.lista_precios)}
                onChange={(e) => setCfg({ ...cfg, lista_precios: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={String(n)}>
                    Lista {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="sub" style={{ marginTop: 12 }}>
            {cfg.tipo_descripcion
              ? `Los pedidos montados en la web se guardan como «${cfg.tipo_descripcion}» y toman el número del módulo «${cfg.modulo_correlativo}» de arc_correlatives.`
              : 'Selecciona un tipo de operación existente en arc_tipo_operacion.'}
          </p>
        </div>
      )}

      {!cargando && tab === 'correlativos' && (
        <>
          <div className="toolbar">
            <button
              className="btn btn-primary"
              onClick={() =>
                setModal({
                  tipo: 'correlativo',
                  form: { modulo: '', proximo: 1, empresa: empresa.codigo }
                })
              }
            >
              Nuevo correlativo
            </button>
          </div>
          <div className="table-wrap card">
            <table className="table">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th className="right">Próximo</th>
                  <th>Empresa</th>
                  <th>Actualizado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {correlativos.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.modulo}</strong>
                    </td>
                    <td className="right">{c.proximo}</td>
                    <td>{c.empresa}</td>
                    <td className="muted">
                      {c.actualizado ? new Date(c.actualizado).toLocaleDateString() : '—'}
                    </td>
                    <td className="right">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setModal({
                            tipo: 'correlativo',
                            form: {
                              id: c.id,
                              modulo: c.modulo,
                              proximo: c.proximo,
                              empresa: c.empresa
                            }
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => eliminar(`/api/settings/correlativos/${c.id}`, 'Correlativo eliminado')}
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
                {correlativos.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty">
                      No hay correlativos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!cargando && tab === 'tipos' && (
        <>
          <div className="toolbar">
            <button
              className="btn btn-primary"
              onClick={() =>
                setModal({
                  tipo: 'tipo',
                  form: { descripcion: '', categoria: 'VENTA', afectaInventario: false }
                })
              }
            >
              Nuevo tipo
            </button>
          </div>
          <div className="table-wrap card">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Afecta inventario</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>
                      <strong>{t.descripcion}</strong>
                    </td>
                    <td>{t.categoria}</td>
                    <td>{t.afectaInventario ? 'Sí' : 'No'}</td>
                    <td className="right">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setModal({
                            tipo: 'tipo',
                            form: {
                              id: t.id,
                              descripcion: t.descripcion,
                              categoria: t.categoria,
                              afectaInventario: t.afectaInventario
                            }
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => eliminar(`/api/settings/tipos/${t.id}`, 'Tipo eliminado')}
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!cargando && tab === 'usuarios' && (
        <>
          <div className="toolbar">
            <button
              className="btn btn-primary"
              onClick={() =>
                setModal({
                  tipo: 'usuario',
                  form: {
                    codigo: '',
                    login: '',
                    nombre: '',
                    email: '',
                    rol: 'vendedor',
                    status: true,
                    password: ''
                  }
                })
              }
            >
              Nuevo usuario
            </button>
          </div>
          <div className="table-wrap card">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>{u.codigo}</td>
                    <td>
                      <strong className="link" onClick={() => setModal({ tipo: 'clave', form: { id: u.id, nombre: u.nombre, password: '' } })}>
                        {u.login}
                      </strong>
                      <div className="sub">{u.email || '—'}</div>
                    </td>
                    <td>{u.nombre}</td>
                    <td>
                      <span className={`badge ${u.rol === 'admin' ? '' : 'badge-light'}`}>
                        {u.rol === 'admin' ? 'Admin' : 'Vendedor'}
                      </span>
                    </td>
                    <td>{u.status ? 'Activo' : 'Inactivo'}</td>
                    <td className="right">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setModal({
                            tipo: 'usuario',
                            form: {
                              id: u.id,
                              codigo: u.codigo,
                              login: u.login,
                              nombre: u.nombre,
                              email: u.email,
                              rol: u.rol,
                              status: u.status,
                              password: ''
                            }
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setModal({ tipo: 'clave', form: { id: u.id, nombre: u.nombre, password: '' } })}
                      >
                        Contraseña
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => eliminar(`/api/settings/usuarios/${u.id}`, 'Usuario eliminado')}
                        disabled={u.id === user?.id}
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>
                  {modal.tipo === 'correlativo'
                    ? modal.form.id
                      ? 'Editar correlativo'
                      : 'Nuevo correlativo'
                    : modal.tipo === 'tipo'
                      ? modal.form.id
                        ? 'Editar tipo de operación'
                        : 'Nuevo tipo de operación'
                      : modal.tipo === 'clave'
                        ? 'Cambiar contraseña'
                        : modal.form.id
                          ? 'Editar usuario'
                          : 'Nuevo usuario'}
                </h2>
                <span className="muted">
                  {modal.tipo === 'clave' ? modal.form.nombre : 'arc_' + (modal.tipo === 'correlativo' ? 'correlatives' : modal.tipo === 'tipo' ? 'tipo_operacion' : 'users')}
                </span>
              </div>
              <button className="icon-btn" onClick={() => setModal(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {modal.tipo === 'correlativo' && (
                <div className="grid-2">
                  <label className="field">
                    <span>Módulo (debe existir en Tipo de operación) *</span>
                    <input
                      className="input"
                      value={modal.form.modulo}
                      onChange={(e) => campo('modulo', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Próximo número</span>
                    <input
                      className="input input-num"
                      type="number"
                      min="0"
                      value={modal.form.proximo}
                      onChange={(e) => campo('proximo', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Empresa (arc_company.emp_codigo)</span>
                    <input
                      className="input"
                      value={modal.form.empresa}
                      onChange={(e) => campo('empresa', e.target.value)}
                    />
                  </label>
                </div>
              )}

              {modal.tipo === 'tipo' && (
                <div className="grid-2">
                  <label className="field">
                    <span>Descripción *</span>
                    <input
                      className="input"
                      value={modal.form.descripcion}
                      onChange={(e) => campo('descripcion', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Categoría *</span>
                    <select
                      className="select"
                      value={modal.form.categoria}
                      onChange={(e) => campo('categoria', e.target.value)}
                    >
                      {['VENTA', 'COMPRA', 'INVENTARIO', 'CONTABLE'].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Afecta inventario</span>
                    <select
                      className="select"
                      value={modal.form.afectaInventario ? '1' : '0'}
                      onChange={(e) => campo('afectaInventario', e.target.value === '1')}
                    >
                      <option value="0">No</option>
                      <option value="1">Sí</option>
                    </select>
                  </label>
                  {!modal.form.id && (
                    <p className="sub">El ID se asigna automáticamente (max + 1).</p>
                  )}
                </div>
              )}

              {modal.tipo === 'usuario' && (
                <div className="grid-2">
                  <label className="field">
                    <span>Código de vendedor *</span>
                    <input
                      className="input"
                      value={modal.form.codigo}
                      onChange={(e) => campo('codigo', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Login (correo) *</span>
                    <input
                      className="input"
                      value={modal.form.login}
                      onChange={(e) => campo('login', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Nombre *</span>
                    <input
                      className="input"
                      value={modal.form.nombre}
                      onChange={(e) => campo('nombre', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Correo</span>
                    <input
                      className="input"
                      value={modal.form.email}
                      onChange={(e) => campo('email', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Rol</span>
                    <select
                      className="select"
                      value={modal.form.rol}
                      onChange={(e) => campo('rol', e.target.value)}
                    >
                      <option value="vendedor">Vendedor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Estado</span>
                    <select
                      className="select"
                      value={modal.form.status ? '1' : '0'}
                      onChange={(e) => campo('status', e.target.value === '1')}
                    >
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
                    </select>
                  </label>
                  {!modal.form.id && (
                    <label className="field">
                      <span>Contraseña (opcional)</span>
                      <input
                        className="input"
                        type="password"
                        value={modal.form.password}
                        onChange={(e) => campo('password', e.target.value)}
                      />
                    </label>
                  )}
                </div>
              )}

              {modal.tipo === 'clave' && (
                <label className="field">
                  <span>Nueva contraseña (mínimo 4 caracteres) *</span>
                  <input
                    className="input"
                    type="password"
                    autoFocus
                    value={modal.form.password}
                    onChange={(e) => campo('password', e.target.value)}
                  />
                </label>
              )}
            </div>

            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={guardando}
                onClick={async () => {
                  if (modal.tipo === 'correlativo') {
                    const { id, ...body } = modal.form;
                    await guardar(
                      id ? `/api/settings/correlativos/${id}` : '/api/settings/correlativos',
                      id ? 'PUT' : 'POST',
                      body,
                      'Correlativo guardado'
                    );
                  } else if (modal.tipo === 'tipo') {
                    const { id, ...body } = modal.form;
                    await guardar(
                      id ? `/api/settings/tipos/${id}` : '/api/settings/tipos',
                      id ? 'PUT' : 'POST',
                      body,
                      'Tipo de operación guardado'
                    );
                  } else if (modal.tipo === 'clave') {
                    await guardar(
                      `/api/settings/usuarios/${modal.form.id}/password`,
                      'PUT',
                      { password: modal.form.password },
                      'Contraseña actualizada'
                    );
                  } else {
                    const { id, ...body } = modal.form;
                    await guardar(
                      id ? `/api/settings/usuarios/${id}` : '/api/settings/usuarios',
                      id ? 'PUT' : 'POST',
                      body,
                      'Usuario guardado'
                    );
                  }
                }}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
