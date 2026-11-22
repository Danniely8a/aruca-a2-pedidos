import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { opsApi } from './api.js';
import { useOpsAuth } from './OpsAuthContext.jsx';
import {
  DuracionPedido,
  EstadoOps,
  formatFecha
} from './ui.jsx';

export default function OpsHome() {
  const { user } = useOpsAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const esJefe = user?.rol === 'jefe';

  const cargar = () => {
    setLoading(true);
    opsApi('/api/operaciones/pedidos')
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, []);

  const stats = useMemo(() => {
    const pendientes = items.filter((i) => i.estado === 'pendiente').length;
    const asignados = items.filter((i) => i.estado === 'asignado').length;
    const enProceso = items.filter((i) => i.estado === 'en_proceso').length;
    const armados = items.filter((i) => i.estado === 'armado').length;
    const porValidar = items.reduce(
      (s, i) => s + Math.max(0, Number(i.items_total) - Number(i.items_validados)),
      0
    );
    return { pendientes, asignados, enProceso, armados, porValidar };
  }, [items]);

  const recientes = items.slice(0, 6);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{esJefe ? 'Panel de almacén' : 'Mis pedidos'}</h1>
          <p className="muted">
            {esJefe
              ? 'Asigna pedidos al equipo y controla el avance del armado.'
              : 'Estos son los pedidos que tienes asignados para armar.'}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={cargar} disabled={loading}>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
          <Link className="btn btn-primary" to="/operaciones/pedidos">
            Ver pedidos
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="cards dashboard-stats">
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-amber">PA</span>
          <div>
            <span>Por asignar</span>
            <strong>{stats.pendientes}</strong>
          </div>
        </div>
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-blue">AS</span>
          <div>
            <span>Asignados</span>
            <strong>{stats.asignados}</strong>
          </div>
        </div>
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-violet">EP</span>
          <div>
            <span>En proceso</span>
            <strong>{stats.enProceso}</strong>
          </div>
        </div>
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-green">AR</span>
          <div>
            <span>Armados</span>
            <strong>{stats.armados}</strong>
          </div>
        </div>
      </div>

      <div className="grid-2 dashboard-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Pedidos recientes</h2>
              <p className="muted">
                {stats.porValidar} ítem{stats.porValidar === 1 ? '' : 's'} por validar
              </p>
            </div>
            <Link className="link" to="/operaciones/pedidos">
              Ver todos
            </Link>
          </div>

          {recientes.length === 0 ? (
            <p className="empty">
              {esJefe
                ? 'No hay pedidos pendientes ni en tránsito.'
                : 'No tienes pedidos asignados por ahora.'}
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table ops-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Cliente</th>
                    <th>Vendedor</th>
                    <th>Estado</th>
                    {esJefe && <th>Operario</th>}
                    <th>Tiempo</th>
                  </tr>
                </thead>
                <tbody>
                  {recientes.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link className="link" to={`/operaciones/pedidos/${p.id}`}>
                          <strong>{p.numero}</strong>
                        </Link>
                        <div className="muted ops-small">{formatFecha(p.fecha)}</div>
                      </td>
                      <td>
                        {p.cliente?.nombre}
                        {p.cliente?.codigo && (
                          <div className="muted ops-small">{p.cliente.codigo}</div>
                        )}
                      </td>
                      <td>{p.vendedor?.nombre || '—'}</td>
                      <td>
                        <EstadoOps estado={p.estado} />
                      </td>
                      {esJefe && <td>{p.operario_nombre || '—'}</td>}
                      <td>
                        <DuracionPedido
                          iniciado_en={p.iniciado_en}
                          finalizado_en={p.finalizado_en}
                          duracion_segundos={p.duracion_segundos}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Accesos rápidos</h2>
          </div>
          <div className="quick-grid">
            <Link className="quick-item" to="/operaciones/pedidos">
              <strong>Pedidos</strong>
              <span>Asignar, armar y validar</span>
            </Link>
            {esJefe && (
              <Link className="quick-item" to="/operaciones/operarios">
                <strong>Operarios</strong>
                <span>Crear y administrar el equipo</span>
              </Link>
            )}
            {esJefe && (
              <Link className="quick-item" to="/operaciones/reportes">
                <strong>Reportes</strong>
                <span>Tiempos por pedido e ítem</span>
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
