import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { opsApi, opsPost } from './api.js';
import { useOpsAuth } from './OpsAuthContext.jsx';
import OrderCard from './components/OrderCard.jsx';
import {
  DuracionPedido,
  EstadoOps,
  FaltanteTag,
  formatFecha,
  formatFechaHora
} from './ui.jsx';

function AsignarModal({ pedido, operarios, onClose, onAssigned }) {
  const activos = operarios.filter((o) => o.activo);
  const [operarioId, setOperarioId] = useState(activos[0]?.id || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const asignar = async (e) => {
    e.preventDefault();
    if (!operarioId) {
      setError('Selecciona un operario');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await opsPost(`/api/operaciones/pedidos/${pedido.id}/asignar`, {
        operario_id: Number(operarioId)
      });
      onAssigned();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Asignar pedido</h3>
            <p className="muted">{pedido.numero} · {pedido.cliente?.nombre}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={asignar}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            {activos.length === 0 ? (
              <div className="alert alert-info">
                No hay operarios activos. Crea uno en{' '}
                <Link to="/operaciones/operarios" onClick={onClose}>
                  Operarios
                </Link>
                .
              </div>
            ) : (
              <label className="field">
                <span>Operario de almacén</span>
                <select
                  className="input"
                  value={operarioId}
                  onChange={(e) => setOperarioId(e.target.value)}
                >
                  {activos.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              disabled={guardando || activos.length === 0}
            >
              {guardando ? 'Asignando…' : 'Asignar pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OpsOrders() {
  const { user } = useOpsAuth();
  const esJefe = user?.rol === 'jefe';
  const [items, setItems] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [operarioFiltro, setOperarioFiltro] = useState('');
  const [soloFaltantes, setSoloFaltantes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [asignar, setAsignar] = useState(null);

  const cargar = () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (estado) params.set('estado', estado);
    if (esJefe && operarioFiltro) params.set('operario_id', operarioFiltro);
    if (soloFaltantes) params.set('faltantes', '1');
    return opsApi(`/api/operaciones/pedidos?${params.toString()}`)
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!esJefe) return;
    opsApi('/api/operaciones/operarios')
      .then((d) => setOperarios(d.items || []))
      .catch(() => {});
  }, [esJefe]);

  useEffect(() => {
    const t = setTimeout(cargar, q ? 220 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, estado, operarioFiltro, esJefe, soloFaltantes]);

  useEffect(() => {
    const refrescar = () => {
      if (!document.hidden) cargar();
    };
    const id = setInterval(refrescar, 30000);
    document.addEventListener('visibilitychange', refrescar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refrescar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, estado, operarioFiltro, esJefe, soloFaltantes]);

  const activos = useMemo(() => operarios.filter((o) => o.activo), [operarios]);

  const chips = [
    { value: '', label: 'Todos' },
    { value: 'pendiente', label: 'Por asignar' },
    { value: 'asignado', label: 'Asignados' },
    { value: 'en_proceso', label: 'En proceso' },
    { value: 'armado', label: 'Armados' }
  ];

  const asignado = () => {
    setAsignar(null);
    setOk('Pedido asignado correctamente.');
    cargar();
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Pedidos de almacén</h1>
          <p className="muted">
            {esJefe
              ? 'Asigna pedidos y sigue el avance de cada operario.'
              : 'Pedidos asignados a ti, con su avance y tiempos.'}
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

      <div className="toolbar ops-toolbar">
        <input
          className="input search"
          placeholder="Buscar por número o cliente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {esJefe && (
          <select
            className="input select"
            value={operarioFiltro}
            onChange={(e) => setOperarioFiltro(e.target.value)}
          >
            <option value="">Todos los operarios</option>
            {activos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="chips chips-scroll ops-chips">
        {chips.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`chip ${estado === c.value ? 'active' : ''}`}
            onClick={() => setEstado(c.value)}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          className={`chip ops-chip-faltante ${soloFaltantes ? 'active' : ''}`}
          onClick={() => setSoloFaltantes((v) => !v)}
        >
          Con faltantes
        </button>
      </div>

      <section className="card ops-list-card">
        <div className="card-head">
          <div>
            <h2>Listado</h2>
            <p className="muted">
              {items.length} pedido{items.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {loading && items.length === 0 ? (
          <p className="empty">Cargando pedidos…</p>
        ) : items.length === 0 ? (
          <p className="empty">No hay pedidos con ese filtro.</p>
          ) : (
            <>
              <div className="table-wrap ops-desktop-table">
              <table className="table ops-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Artículos</th>
                  <th>Operario</th>
                  <th>Estado</th>
                  <th>Tiempo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="link" to={`/operaciones/pedidos/${p.id}`}>
                        <strong>{p.numero}</strong>
                      </Link>
                    </td>
                    <td>{formatFecha(p.fecha)}</td>
                    <td>
                      {p.cliente?.nombre}
                      {p.cliente?.codigo && (
                        <div className="muted ops-small">{p.cliente.codigo}</div>
                      )}
                    </td>
                    <td>{p.vendedor?.nombre || '—'}</td>
                    <td>
                      <strong>{p.items_validados}/{p.items_total}</strong>
                      <div className="muted ops-small">
                        {p.unidades} unidad{p.unidades === 1 ? '' : 'es'}
                      </div>
                    </td>
                    <td>
                      {p.operario_nombre || '—'}
                      {p.asignado_en && (
                        <div className="muted ops-small">
                          {formatFechaHora(p.asignado_en)}
                        </div>
                      )}
                    </td>
                    <td>
                      <EstadoOps
                        estado={p.estado}
                        parcial={p.armado_parcial}
                      />
                      <FaltanteTag count={p.items_faltantes} />
                    </td>
                    <td>
                      <DuracionPedido
                        iniciado_en={p.iniciado_en}
                        finalizado_en={p.finalizado_en}
                        duracion_segundos={p.duracion_segundos}
                      />
                    </td>
                    <td>
                      <div className="ops-row-actions">
                        <Link
                          className="btn btn-sm btn-ghost"
                          to={`/operaciones/pedidos/${p.id}`}
                        >
                          Abrir
                        </Link>
                        {esJefe && p.estado === 'pendiente' && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setOk('');
                              setAsignar(p);
                            }}
                          >
                            Asignar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
              <div className="ops-order-list">
                {items.map((p) => (
                  <OrderCard
                    key={p.id}
                    pedido={p}
                    esJefe={esJefe}
                    onAsignar={(pedido) => {
                      setOk('');
                      setAsignar(pedido);
                    }}
                  />
                ))}
              </div>
            </>
        )}
      </section>

      {asignar && (
        <AsignarModal
          pedido={asignar}
          operarios={operarios}
          onClose={() => setAsignar(null)}
          onAssigned={asignado}
        />
      )}
    </div>
  );
}
