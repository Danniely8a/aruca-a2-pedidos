import { useEffect, useState } from 'react';
import { opsApi, opsPatch, opsPost } from './api.js';
import { useOpsAuth } from './OpsAuthContext.jsx';
import { formatDuration, formatFecha } from './ui.jsx';

const FORM_VACIO = {
  nombre: '',
  email: '',
  password: '',
  rol: 'operario',
  activo: true
};

export default function OpsWorkers() {
  const { user } = useOpsAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const cargar = () => {
    setLoading(true);
    return opsApi('/api/operaciones/operarios')
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
  }, []);

  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const limpiar = () => {
    setForm(FORM_VACIO);
    setEditando(null);
  };

  const editar = (o) => {
    setEditando(o.id);
    setForm({
      nombre: o.nombre,
      email: o.email,
      password: '',
      rol: o.rol,
      activo: o.activo
    });
    setError('');
    setOk('');
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setOk('');
    try {
      if (editando) {
        await opsPatch(`/api/operaciones/operarios/${editando}`, {
          nombre: form.nombre,
          email: form.email,
          rol: form.rol,
          activo: form.activo,
          password: form.password || undefined
        });
        setOk('Operario actualizado.');
      } else {
        await opsPost('/api/operaciones/operarios', {
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          rol: form.rol
        });
        setOk('Operario creado. Ya puede entrar por /operaciones/login.');
      }
      limpiar();
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const alternar = async (o) => {
    setError('');
    setOk('');
    try {
      await opsPatch(`/api/operaciones/operarios/${o.id}`, {
        activo: !o.activo
      });
      setOk(o.activo ? 'Operario desactivado.' : 'Operario activado.');
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page ops-workers">
      <div className="page-head">
        <div>
          <h1>Operarios de almacén</h1>
          <p className="muted">
            Crea las cuentas del personal. Cada uno entra por /operaciones/login.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={cargar} disabled={loading}>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {ok && <div className="alert alert-info">{ok}</div>}

      <div className="ops-workers-grid">
        <section className="card">
          <div className="card-head">
            <h2>{editando ? 'Editar operario' : 'Nuevo operario'}</h2>
            {editando && (
              <button className="link" onClick={limpiar} type="button">
                Cancelar
              </button>
            )}
          </div>

          <form className="ops-worker-form" onSubmit={guardar}>
            <label className="field">
              <span>Nombre completo</span>
              <input
                className="input"
                value={form.nombre}
                onChange={(e) => cambiar('nombre', e.target.value)}
                placeholder="Nombre del operario"
                required
              />
            </label>

            <label className="field">
              <span>Correo (usuario)</span>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => cambiar('email', e.target.value)}
                placeholder="operario@arucamaquinarias.com"
                autoComplete="off"
                required
              />
            </label>

            <label className="field">
              <span>{editando ? 'Nueva contraseña (opcional)' : 'Contraseña'}</span>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => cambiar('password', e.target.value)}
                placeholder={editando ? 'Dejar vacío para mantener' : 'Mínimo 6 caracteres'}
                autoComplete="new-password"
                required={!editando}
              />
            </label>

            <label className="field">
              <span>Rol</span>
              <select
                className="input"
                value={form.rol}
                onChange={(e) => cambiar('rol', e.target.value)}
              >
                <option value="operario">Operario de almacén</option>
                <option value="jefe">Jefe de almacén</option>
              </select>
            </label>

            {editando && (
              <label className="field ops-check-field">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => cambiar('activo', e.target.checked)}
                  disabled={Number(editando) === Number(user?.id)}
                />
                <span>Usuario activo</span>
              </label>
            )}

            <button className="btn btn-primary btn-block" disabled={guardando}>
              {guardando
                ? 'Guardando…'
                : editando
                  ? 'Guardar cambios'
                  : 'Crear operario'}
            </button>
          </form>
        </section>

        <section className="card ops-list-card">
          <div className="card-head">
            <div>
              <h2>Equipo</h2>
              <p className="muted">
                {items.length} cuenta{items.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="empty">Todavía no hay operarios registrados.</p>
          ) : (
            <>
            <div className="table-wrap ops-desktop-table">
              <table className="table ops-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th className="right">Asignados</th>
                    <th className="right">Armados</th>
                    <th>Tiempo prom.</th>
                    <th>Creado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.nombre}</strong>
                        {Number(o.id) === Number(user?.id) && (
                          <span className="tag ops-tag-self">Tú</span>
                        )}
                      </td>
                      <td>{o.email}</td>
                      <td>{o.rol === 'jefe' ? 'Jefe' : 'Operario'}</td>
                      <td>
                        <span
                          className={`ops-status ${
                            o.activo ? 'ops-status-armado' : 'ops-status-pendiente'
                          }`}
                        >
                          {o.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="right">{o.asignados ?? 0}</td>
                      <td className="right">{o.armados ?? 0}</td>
                      <td>{formatDuration(o.tiempo_promedio_segundos)}</td>
                      <td>{formatFecha(o.creado_en)}</td>
                      <td>
                        <div className="ops-row-actions">
                          <button className="btn btn-sm btn-ghost" onClick={() => editar(o)}>
                            Editar
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => alternar(o)}
                            disabled={Number(o.id) === Number(user?.id)}
                          >
                            {o.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ops-worker-list">
              {items.map((o) => (
                <article className="ops-worker-card" key={o.id}>
                  <div className="ops-worker-card-top">
                    <div>
                      <strong>{o.nombre}</strong>
                      {Number(o.id) === Number(user?.id) && (
                        <span className="tag ops-tag-self">Tú</span>
                      )}
                      <div className="muted ops-small">{o.email}</div>
                    </div>
                    <span
                      className={`ops-status ${
                        o.activo ? 'ops-status-armado' : 'ops-status-pendiente'
                      }`}
                    >
                      {o.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="ops-worker-card-meta">
                    <span>{o.rol === 'jefe' ? 'Jefe de almacén' : 'Operario'}</span>
                    <span>Creado {formatFecha(o.creado_en)}</span>
                  </div>
                  <div className="ops-worker-card-stats">
                    <div>
                      <span>Asignados</span>
                      <strong>{o.asignados ?? 0}</strong>
                    </div>
                    <div>
                      <span>Armados</span>
                      <strong>{o.armados ?? 0}</strong>
                    </div>
                    <div>
                      <span>Tiempo prom.</span>
                      <strong>{formatDuration(o.tiempo_promedio_segundos)}</strong>
                    </div>
                  </div>
                  <div className="ops-worker-card-foot">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => editar(o)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => alternar(o)}
                      disabled={Number(o.id) === Number(user?.id)}
                    >
                      {o.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
