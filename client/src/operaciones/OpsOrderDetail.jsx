import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { opsApi, opsPost } from './api.js';
import { useOpsAuth } from './OpsAuthContext.jsx';
import {
  DuracionPedido,
  EstadoOps,
  Progreso,
  formatDuration,
  formatFechaHora
} from './ui.jsx';

const estadoA2 = (n) => {
  const v = Number(n);
  if (v === 2) return 'Pendiente';
  if (v === 4) return 'En tránsito';
  if (v === 1) return 'Procesada';
  return `Estado ${v}`;
};

export default function OpsOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useOpsAuth();
  const esJefe = user?.rol === 'jefe';

  const [pedido, setPedido] = useState(null);
  const [permisos, setPermisos] = useState({});
  const [operarios, setOperarios] = useState([]);
  const [operarioSel, setOperarioSel] = useState('');
  const [loading, setLoading] = useState(true);
  const [accion, setAccion] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const cargar = () => {
    setLoading(true);
    setError('');
    return opsApi(`/api/operaciones/pedidos/${id}`)
      .then((d) => {
        setPedido(d.pedido);
        setPermisos(d.permisos || {});
        if (d.pedido?.operario_id) {
          setOperarioSel(String(d.pedido.operario_id));
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!esJefe) return;
    opsApi('/api/operaciones/operarios')
      .then((d) => setOperarios(d.items || []))
      .catch(() => {});
  }, [esJefe]);

  const operariosDisponibles = useMemo(() => {
    const actual = pedido?.operario_id;
    return operarios.filter((o) => o.activo || o.id === actual);
  }, [operarios, pedido]);

  useEffect(() => {
    if (!operarioSel && operariosDisponibles[0]) {
      setOperarioSel(String(operariosDisponibles[0].id));
    }
  }, [operariosDisponibles, operarioSel]);

  const asignar = async (e) => {
    e.preventDefault();
    if (!operarioSel) return;
    setAccion(true);
    setError('');
    setOk('');
    try {
      await opsPost(`/api/operaciones/pedidos/${id}/asignar`, {
        operario_id: Number(operarioSel)
      });
      setOk('Pedido asignado correctamente.');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccion(false);
    }
  };

  const iniciar = async () => {
    setAccion(true);
    setError('');
    setOk('');
    try {
      await opsPost(`/api/operaciones/pedidos/${id}/iniciar`, {});
      setOk('Armado iniciado. El tiempo está corriendo.');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccion(false);
    }
  };

  const validar = async (item, validado) => {
    if (!item.id) return;
    setAccion(true);
    setError('');
    setOk('');
    try {
      await opsPost(
        `/api/operaciones/pedidos/${id}/items/${item.id}/validar`,
        { validado }
      );
      setOk(validado ? 'Ítem validado.' : 'Validación retirada.');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccion(false);
    }
  };

  if (loading && !pedido) {
    return (
      <div className="page">
        <p className="empty">Cargando pedido…</p>
      </div>
    );
  }

  if (error && !pedido) {
    return (
      <div className="page">
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          Volver
        </button>
      </div>
    );
  }

  if (!pedido) return null;

  return (
    <div className="page ops-detail">
      <div className="page-head">
        <div>
          <button className="link" onClick={() => navigate(-1)}>
            ← Volver
          </button>
          <h1>{pedido.numero}</h1>
          <p className="muted">
            {pedido.cliente?.nombre} · {formatFechaHora(pedido.fecha)}
          </p>
        </div>
        <div className="page-head-tags">
          <EstadoOps estado={pedido.estado} />
          <span className="tag tag-transito">A2: {estadoA2(pedido.estado_a2)}</span>
          {pedido.estado === 'armado' && (
            <span className="tag tag-aprobado">Armado y validado</span>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {ok && <div className="alert alert-info">{ok}</div>}

      {!pedido.operacion_id && (
        <div className="alert alert-info">
          Asigna este pedido para crear las tareas de armado y poder validar cada
          ítem.
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Pedido</h2>
          </div>
          <div className="kv ops-kv">
            <div>
              <span>Cliente</span>
              <strong>{pedido.cliente?.nombre}</strong>
            </div>
            <div>
              <span>Código</span>
              <strong>{pedido.cliente?.codigo || '—'}</strong>
            </div>
            <div>
              <span>Teléfono</span>
              <strong>{pedido.cliente?.telefono || '—'}</strong>
            </div>
            <div>
              <span>Dirección</span>
              <strong>{pedido.cliente?.direccion || '—'}</strong>
            </div>
            <div>
              <span>Ítems</span>
              <strong>{pedido.items_total}</strong>
            </div>
            <div>
              <span>Unidades</span>
              <strong>{pedido.unidades}</strong>
            </div>
          </div>
          {pedido.observacion && (
            <>
              <h3>Observaciones</h3>
              <p className="obs">{pedido.observacion}</p>
            </>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Armado y tiempos</h2>
            <button className="link" onClick={cargar} disabled={loading}>
              Refrescar
            </button>
          </div>

          <div className="kv ops-kv">
            <div>
              <span>Operario</span>
              <strong>{pedido.operario_nombre || 'Sin asignar'}</strong>
            </div>
            <div>
              <span>Asignado por</span>
              <strong>{pedido.asignado_por_nombre || '—'}</strong>
            </div>
            <div>
              <span>Asignado</span>
              <strong>{formatFechaHora(pedido.asignado_en)}</strong>
            </div>
            <div>
              <span>Inicio</span>
              <strong>{formatFechaHora(pedido.iniciado_en)}</strong>
            </div>
            <div>
              <span>Fin</span>
              <strong>{formatFechaHora(pedido.finalizado_en)}</strong>
            </div>
            <div>
              <span>Tiempo total</span>
              <strong>
                <DuracionPedido
                  iniciado_en={pedido.iniciado_en}
                  finalizado_en={pedido.finalizado_en}
                  duracion_segundos={pedido.duracion_segundos}
                />
              </strong>
            </div>
          </div>

          <Progreso total={pedido.items_total} validados={pedido.items_validados} />

          {permisos.iniciar && (
            <button
              className="btn btn-primary btn-block ops-start"
              onClick={iniciar}
              disabled={accion}
            >
              {accion ? 'Iniciando…' : 'Iniciar armado'}
            </button>
          )}

          {esJefe && permisos.asignar && (
            <form className="ops-assign" onSubmit={asignar}>
              <label className="field">
                <span>{pedido.operacion_id ? 'Reasignar a' : 'Asignar a'}</span>
                <select
                  className="input"
                  value={operarioSel}
                  onChange={(e) => setOperarioSel(e.target.value)}
                  disabled={accion || operariosDisponibles.length === 0}
                >
                  {operariosDisponibles.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </label>
              {operariosDisponibles.length === 0 ? (
                <p className="muted ops-small">
                  No hay operarios activos.{' '}
                  <Link to="/operaciones/operarios">Crear operario</Link>.
                </p>
              ) : (
                <button
                  className="btn btn-ghost btn-block"
                  disabled={accion || !operarioSel}
                >
                  {accion
                    ? 'Guardando…'
                    : pedido.operacion_id
                      ? 'Reasignar pedido'
                      : 'Asignar pedido'}
                </button>
              )}
            </form>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Ítems del pedido</h2>
            <p className="muted">
              Valida cada producto. El tiempo del ítem se calcula desde la
              validación anterior.
            </p>
          </div>
        </div>

        {pedido.items.length === 0 ? (
          <p className="empty">Este pedido no tiene ítems.</p>
        ) : (
          <div className="table-wrap">
            <table className="table ops-table ops-items-table">
              <thead>
                <tr>
                  <th>Línea</th>
                  <th>Código</th>
                  <th>Producto</th>
                  <th className="right">Cantidad</th>
                  <th>Estado</th>
                  <th>Tiempo ítem</th>
                  <th>Acumulado</th>
                  <th>Validado por</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pedido.items.map((item) => (
                  <tr
                    key={item.id || item.linea}
                    className={item.validado ? 'ops-item-validado' : ''}
                  >
                    <td>{item.linea}</td>
                    <td>
                      <strong>{item.codigo}</strong>
                    </td>
                    <td>{item.descripcion}</td>
                    <td className="right">{item.cantidad}</td>
                    <td>
                      {item.validado ? (
                        <span className="ops-status ops-status-armado">Validado</span>
                      ) : (
                        <span className="ops-status ops-status-pendiente">Pendiente</span>
                      )}
                    </td>
                    <td>{formatDuration(item.duracion_segundos)}</td>
                    <td>{formatDuration(item.acumulado_segundos)}</td>
                    <td>{item.validado_por_nombre || '—'}</td>
                    <td>
                      {item.validado ? (
                        <button
                          className="link"
                          disabled={!permisos.validar || accion}
                          onClick={() => validar(item, false)}
                        >
                          Quitar
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={!permisos.validar || !item.id || accion}
                          onClick={() => validar(item, true)}
                        >
                          Validar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
