import { useEffect, useState } from 'react';
import { opsApi } from './api.js';
import {
  EstadoOps,
  FaltanteTag,
  formatDuration,
  formatFecha,
  formatFechaHora
} from './ui.jsx';

const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
};

const hoy = new Date();
const hace30 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 29);

export default function OpsReports() {
  const [desde, setDesde] = useState(ymd(hace30));
  const [hasta, setHasta] = useState(ymd(hoy));
  const [operarioFiltro, setOperarioFiltro] = useState('');
  const [operarios, setOperarios] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    opsApi('/api/operaciones/operarios')
      .then((d) => setOperarios(d.items || []))
      .catch(() => {});
  }, []);

  const cargar = () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ desde, hasta });
    if (operarioFiltro) params.set('operario_id', operarioFiltro);
    return opsApi(`/api/operaciones/reportes?${params.toString()}`)
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = data?.resumen || {};
  const pedidos = data?.pedidos || [];
  const items = data?.items || [];
  const porOperario = data?.por_operario || [];

  return (
    <div className="page ops-reports">
      <div className="page-head">
        <div>
          <h1>Reportes de tiempos</h1>
          <p className="muted">
            Tiempo por pedido, por ítem y por operario en el rango seleccionado.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={cargar} disabled={loading}>
            {loading ? 'Calculando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar ops-toolbar ops-report-filter">
        <label className="field">
          <span>Desde</span>
          <input
            className="input"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Hasta</span>
          <input
            className="input"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Operario</span>
          <select
            className="input select"
            value={operarioFiltro}
            onChange={(e) => setOperarioFiltro(e.target.value)}
          >
            <option value="">Todos</option>
            {operarios.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" onClick={cargar} disabled={loading}>
          Aplicar
        </button>
      </div>

      <div className="cards dashboard-stats">
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-blue">PE</span>
          <div>
            <span>Pedidos armados</span>
            <strong>{r.armados ?? 0}</strong>
            <span className="ops-small">
              {r.armados_parciales ?? 0} parcial
              {(r.armados_parciales ?? 0) === 1 ? '' : 'es'}
            </span>
          </div>
        </div>
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-green">TP</span>
          <div>
            <span>Promedio por pedido</span>
            <strong>{formatDuration(r.tiempo_promedio_pedido_segundos)}</strong>
          </div>
        </div>
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-amber">TI</span>
          <div>
            <span>Promedio por ítem</span>
            <strong>{formatDuration(r.tiempo_promedio_item_segundos)}</strong>
          </div>
        </div>
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-violet">IV</span>
          <div>
            <span>Ítems validados</span>
            <strong>
              {r.items_validados ?? 0}/{r.items ?? 0}
            </strong>
            <span className="ops-small">
              {r.items_faltantes ?? 0} faltante
              {(r.items_faltantes ?? 0) === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Tiempos por pedido</h2>
            <p className="muted">
              {pedidos.length} pedido{pedidos.length === 1 ? '' : 's'} con
              operaciones en el rango
            </p>
          </div>
        </div>

        {pedidos.length === 0 ? (
          <p className="empty">No hay pedidos de almacén en ese rango.</p>
        ) : (
          <div className="table-wrap">
            <table className="table ops-table ops-table-stack">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Operario</th>
                  <th>Estado</th>
                  <th>Asignado</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Tiempo</th>
                  <th>Ítems</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={`${p.numero}-${p.asignado_en}`}>
                    <td data-label="Documento">
                      <strong>{p.numero}</strong>
                      <div className="muted ops-small">{formatFecha(p.fecha)}</div>
                    </td>
                    <td data-label="Cliente">{p.cliente}</td>
                    <td data-label="Vendedor">{p.vendedor || '—'}</td>
                    <td data-label="Operario">{p.operario}</td>
                    <td data-label="Estado">
                      <EstadoOps
                        estado={p.estado}
                        parcial={p.armado_parcial}
                      />
                      <FaltanteTag count={p.items_faltantes} />
                    </td>
                    <td data-label="Asignado">{formatFechaHora(p.asignado_en)}</td>
                    <td data-label="Inicio">{formatFechaHora(p.iniciado_en)}</td>
                    <td data-label="Fin">{formatFechaHora(p.finalizado_en)}</td>
                    <td data-label="Tiempo">
                      <strong>{formatDuration(p.duracion_segundos)}</strong>
                    </td>
                    <td data-label="Ítems">
                      {p.items_validados}/{p.items_total}
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
          <div>
            <h2>Tiempos por ítem</h2>
            <p className="muted">
              El tiempo de cada ítem es el transcurrido desde la validación anterior.
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="empty">No hay ítems de almacén en ese rango.</p>
        ) : (
          <div className="table-wrap">
            <table className="table ops-table ops-table-stack">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Operario</th>
                  <th>Código</th>
                  <th>Producto</th>
                  <th className="right">Cantidad</th>
                  <th>Estado</th>
                  <th>Validado</th>
                  <th>Tiempo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={`${i.numero}-${i.codigo}-${idx}`}>
                    <td data-label="Documento">
                      <strong>{i.numero}</strong>
                    </td>
                    <td data-label="Operario">{i.operario}</td>
                    <td data-label="Código">{i.codigo}</td>
                    <td data-label="Producto">
                      {i.descripcion}
                      {i.faltante && i.motivo_faltante && (
                        <div className="ops-item-motivo">
                          Motivo: {i.motivo_faltante}
                        </div>
                      )}
                    </td>
                    <td className="right" data-label="Cantidad">{i.cantidad}</td>
                    <td data-label="Estado">
                      {i.faltante ? (
                        <span className="ops-status ops-status-faltante">
                          Faltante
                        </span>
                      ) : i.validado ? (
                        <span className="ops-status ops-status-armado">Validado</span>
                      ) : (
                        <span className="ops-status ops-status-pendiente">Pendiente</span>
                      )}
                    </td>
                    <td data-label="Validado">{formatFechaHora(i.validado_en)}</td>
                    <td data-label="Tiempo">{formatDuration(i.duracion_segundos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Resumen por operario</h2>
        </div>

        {porOperario.length === 0 ? (
          <p className="empty">No hay datos por operario.</p>
        ) : (
          <div className="table-wrap">
            <table className="table ops-table ops-table-stack">
              <thead>
                <tr>
                  <th>Operario</th>
                  <th className="right">Pedidos</th>
                  <th className="right">Armados</th>
                  <th className="right">Ítems</th>
                  <th>Promedio pedido</th>
                  <th>Promedio ítem</th>
                </tr>
              </thead>
              <tbody>
                {porOperario.map((o) => (
                  <tr key={o.operario}>
                    <td data-label="Operario">
                      <strong>{o.operario}</strong>
                    </td>
                    <td className="right" data-label="Pedidos">{o.pedidos}</td>
                    <td className="right" data-label="Armados">{o.armados}</td>
                    <td className="right" data-label="Ítems">
                      {o.items_validados}/{o.items}
                    </td>
                    <td data-label="Promedio pedido">
                      {formatDuration(o.tiempo_promedio_pedido_segundos)}
                    </td>
                    <td data-label="Promedio ítem">
                      {formatDuration(o.tiempo_promedio_item_segundos)}
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
