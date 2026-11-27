import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { opsApi, opsPost } from './api.js';
import { useOpsAuth } from './OpsAuthContext.jsx';
import {
  DuracionPedido,
  EstadoOps,
  FaltanteTag,
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
  const [faltanteItem, setFaltanteItem] = useState(null);
  const [motivoFaltante, setMotivoFaltante] = useState('');
  const [guardandoFaltante, setGuardandoFaltante] = useState(false);
  const [errorFaltante, setErrorFaltante] = useState('');

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

  const abrirFaltante = (item) => {
    setFaltanteItem(item);
    setMotivoFaltante('');
    setErrorFaltante('');
  };

  const reportarFaltante = async (e) => {
    e.preventDefault();
    if (!faltanteItem?.id) return;
    setGuardandoFaltante(true);
    setErrorFaltante('');
    try {
      await opsPost(
        `/api/operaciones/pedidos/${id}/items/${faltanteItem.id}/faltante`,
        { faltante: true, motivo: motivoFaltante }
      );
      setFaltanteItem(null);
      setMotivoFaltante('');
      setOk('Faltante reportado. El jefe de almacén fue notificado.');
      await cargar();
    } catch (err) {
      setErrorFaltante(err.message);
    } finally {
      setGuardandoFaltante(false);
    }
  };

  const quitarFaltante = async (item) => {
    if (!item.id) return;
    setAccion(true);
    setError('');
    setOk('');
    try {
      await opsPost(
        `/api/operaciones/pedidos/${id}/items/${item.id}/faltante`,
        { faltante: false }
      );
      setOk('Faltante retirado. Ya puedes validar el ítem.');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccion(false);
    }
  };

  const validarJefe = async () => {
    setAccion(true);
    setError('');
    setOk('');
    try {
      await opsPost(`/api/operaciones/pedidos/${id}/validar-jefe`, {});
      setOk('Pedido validado por el jefe de almacén.');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccion(false);
    }
  };

  const totalizar = async () => {
    setAccion(true);
    setError('');
    setOk('');
    try {
      await opsPost(`/api/operaciones/pedidos/${id}/totalizar`, {});
      navigate(`/operaciones/pedidos/${id}/nota`);
    } catch (err) {
      setError(err.message);
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
          <EstadoOps fase={pedido.fase} />
          <FaltanteTag count={pedido.items_faltantes} />
          <span className="tag tag-transito">A2: {estadoA2(pedido.estado_a2)}</span>
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

      {pedido.fase === 'armado' && (
        <div className="alert alert-warn ops-faltante-alert">
          <div>
            <strong>Pedido armado.</strong>{' '}
            {pedido.items_faltantes > 0
              ? `Quedan ${pedido.items_faltantes} ítem(s) faltante(s); se marcarán como pendientes en la nota. `
              : ''}
            Falta la validación del jefe de almacén.
          </div>
          {permisos.validar_jefe && (
            <button
              className="btn btn-sm btn-primary"
              onClick={validarJefe}
              disabled={accion}
            >
              Validar pedido
            </button>
          )}
        </div>
      )}

      {pedido.fase === 'validado' && (
        <div className="alert alert-info ops-faltante-alert">
          <div>
            <strong>Pedido validado.</strong>{' '}
            {pedido.validado_por_nombre
              ? `Validado por ${pedido.validado_por_nombre}. `
              : ''}
            Listo para totalizar y emitir la nota de entrega.
          </div>
          {(permisos.nota || permisos.totalizar) && (
            <div className="ops-item-actions">
              {permisos.nota && (
                <Link
                  className="btn btn-sm btn-ghost"
                  to={`/operaciones/pedidos/${pedido.id}/nota`}
                >
                  Nota de entrega
                </Link>
              )}
              {permisos.totalizar && (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={totalizar}
                  disabled={accion}
                >
                  Totalizar pedido
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {pedido.fase === 'entregado' && (
        <div className="alert alert-info ops-faltante-alert">
          <div>
            <strong>Pedido entregado.</strong>{' '}
            {pedido.entregado_por_nombre
              ? `Entregado por ${pedido.entregado_por_nombre}. `
              : ''}
            La nota de entrega está disponible.
          </div>
          <Link
            className="btn btn-sm btn-primary"
            to={`/operaciones/pedidos/${pedido.id}/nota`}
          >
            Ver nota de entrega
          </Link>
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
              <span>Vendedor</span>
              <strong>
                {pedido.vendedor?.nombre || '—'}
                {pedido.vendedor?.codigo ? ` (${pedido.vendedor.codigo})` : ''}
              </strong>
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
              <span>Fin preparación</span>
              <strong>{formatFechaHora(pedido.finalizado_en)}</strong>
            </div>
            <div>
              <span>Tiempo preparación</span>
              <strong>
                <DuracionPedido
                  iniciado_en={pedido.iniciado_en}
                  finalizado_en={pedido.finalizado_en}
                  duracion_segundos={pedido.duracion_segundos}
                />
              </strong>
            </div>
            {pedido.validado_en && (
              <>
                <div>
                  <span>Validado por</span>
                  <strong>{pedido.validado_por_nombre || '—'}</strong>
                </div>
                <div>
                  <span>Validado</span>
                  <strong>{formatFechaHora(pedido.validado_en)}</strong>
                </div>
                <div>
                  <span>Tiempo validación</span>
                  <strong>
                    {formatDuration(pedido.tiempo_validacion_segundos)}
                  </strong>
                </div>
              </>
            )}
            {pedido.entregado_en && (
              <>
                <div>
                  <span>Entregado por</span>
                  <strong>{pedido.entregado_por_nombre || '—'}</strong>
                </div>
                <div>
                  <span>Entregado</span>
                  <strong>{formatFechaHora(pedido.entregado_en)}</strong>
                </div>
                <div>
                  <span>Tiempo entrega</span>
                  <strong>
                    {formatDuration(pedido.tiempo_entrega_segundos)}
                  </strong>
                </div>
                <div>
                  <span>Tiempo total</span>
                  <strong>
                    {formatDuration(pedido.tiempo_total_segundos)}
                  </strong>
                </div>
              </>
            )}
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

      <section className="card ops-list-card">
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
          <>
          <div className="table-wrap ops-desktop-table">
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
                    className={
                      item.validado
                        ? 'ops-item-validado'
                        : item.faltante
                          ? 'ops-item-faltante'
                          : ''
                    }
                  >
                    <td>{item.linea}</td>
                    <td>
                      <strong>{item.codigo}</strong>
                    </td>
                    <td>
                      {item.descripcion}
                      {item.faltante && item.motivo_faltante && (
                        <div className="ops-item-motivo">
                          Motivo: {item.motivo_faltante}
                        </div>
                      )}
                    </td>
                    <td className="right">{item.cantidad}</td>
                    <td>
                      {item.faltante ? (
                        <span className="ops-status ops-status-faltante">
                          Faltante
                        </span>
                      ) : item.validado ? (
                        <span className="ops-status ops-status-armado">Validado</span>
                      ) : (
                        <span className="ops-status ops-status-pendiente">Pendiente</span>
                      )}
                    </td>
                    <td>{formatDuration(item.duracion_segundos)}</td>
                    <td>{formatDuration(item.acumulado_segundos)}</td>
                    <td>
                      {item.faltante
                        ? item.faltante_por_nombre || '—'
                        : item.validado_por_nombre || '—'}
                    </td>
                    <td>
                      {item.faltante ? (
                        <div className="ops-item-actions">
                          <button
                            className="link"
                            disabled={!permisos.faltante || accion}
                            onClick={() => quitarFaltante(item)}
                          >
                            Quitar faltante
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={!permisos.validar || accion}
                            onClick={() => validar(item, true)}
                          >
                            Validar
                          </button>
                        </div>
                      ) : item.validado ? (
                        <button
                          className="link"
                          disabled={!permisos.validar || accion}
                          onClick={() => validar(item, false)}
                        >
                          Quitar
                        </button>
                      ) : (
                        <div className="ops-item-actions">
                          <button
                            className="btn btn-sm btn-ghost"
                            disabled={!permisos.faltante || !item.id || accion}
                            onClick={() => abrirFaltante(item)}
                          >
                            Faltante
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={!permisos.validar || !item.id || accion}
                            onClick={() => validar(item, true)}
                          >
                            Validar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ops-item-list">
            {pedido.items.map((item) => (
              <article
                key={item.id || item.linea}
                className={`ops-item-card ${item.validado ? 'validado' : ''} ${
                  item.faltante ? 'faltante' : ''
                }`}
              >
                <div className="ops-item-card-top">
                  <div>
                    <span className="ops-item-code">{item.codigo}</span>
                    <strong>{item.descripcion}</strong>
                    {item.faltante && item.motivo_faltante && (
                      <div className="ops-item-motivo">
                        Motivo: {item.motivo_faltante}
                      </div>
                    )}
                  </div>
                  <span className="ops-item-qty">×{item.cantidad}</span>
                </div>
                <div className="ops-item-card-meta">
                  <div>
                    <span>Estado</span>
                    {item.faltante ? (
                      <span className="ops-status ops-status-faltante">
                        Faltante
                      </span>
                    ) : item.validado ? (
                      <span className="ops-status ops-status-armado">Validado</span>
                    ) : (
                      <span className="ops-status ops-status-pendiente">Pendiente</span>
                    )}
                  </div>
                  <div>
                    <span>Tiempo ítem</span>
                    <strong>{formatDuration(item.duracion_segundos)}</strong>
                  </div>
                  <div>
                    <span>Acumulado</span>
                    <strong>{formatDuration(item.acumulado_segundos)}</strong>
                  </div>
                </div>
                <div className="ops-item-card-foot">
                  <span className="muted ops-small">
                    {item.faltante
                      ? `Reportado por ${
                          item.faltante_por_nombre || 'operario'
                        }`
                      : item.validado_por_nombre
                        ? `Validado por ${item.validado_por_nombre}`
                        : `Línea ${item.linea}`}
                  </span>
                  {item.faltante ? (
                    <div className="ops-item-actions">
                      <button
                        className="link"
                        disabled={!permisos.faltante || accion}
                        onClick={() => quitarFaltante(item)}
                      >
                        Quitar faltante
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={!permisos.validar || accion}
                        onClick={() => validar(item, true)}
                      >
                        Validar
                      </button>
                    </div>
                  ) : item.validado ? (
                    <button
                      className="link"
                      disabled={!permisos.validar || accion}
                      onClick={() => validar(item, false)}
                    >
                      Quitar
                    </button>
                  ) : (
                    <div className="ops-item-actions">
                      <button
                        className="btn btn-sm btn-ghost"
                        disabled={!permisos.faltante || !item.id || accion}
                        onClick={() => abrirFaltante(item)}
                      >
                        Faltante
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={!permisos.validar || !item.id || accion}
                        onClick={() => validar(item, true)}
                      >
                        Validar
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
          </>
        )}
      </section>

      {faltanteItem && (
        <div className="modal-backdrop" onClick={() => setFaltanteItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Reportar producto faltante</h3>
                <p className="muted">
                  {faltanteItem.codigo} · {faltanteItem.descripcion}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setFaltanteItem(null)}
              >
                ×
              </button>
            </div>
            <form onSubmit={reportarFaltante}>
              <div className="modal-body">
                {errorFaltante && (
                  <div className="alert alert-error">{errorFaltante}</div>
                )}
                <label className="field">
                  <span>¿Qué falta o qué pasó?</span>
                  <textarea
                    className="input ops-textarea"
                    rows="3"
                    value={motivoFaltante}
                    onChange={(e) => setMotivoFaltante(e.target.value)}
                    placeholder="Ej.: no hay existencia en almacén, producto dañado, código incorrecto…"
                    autoFocus
                    required
                  />
                </label>
                <p className="muted ops-small">
                  El pedido quedará en proceso con este ítem marcado como
                  faltante. El jefe de almacén podrá resolverlo o autorizar un
                  armado parcial.
                </p>
              </div>
              <div className="modal-foot">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setFaltanteItem(null)}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  disabled={guardandoFaltante || !motivoFaltante.trim()}
                >
                  {guardandoFaltante ? 'Guardando…' : 'Reportar faltante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
