import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { EstadoTag } from './Dashboard.jsx';

function HistoryBlock({ titulo, items, currency, navigate }) {
  if (!items.length) return null;
  const money = (n) => `${currency}${Number(n || 0).toFixed(2)}`;
  const fecha = (f) =>
    new Date(f).toLocaleString('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

  return (
    <section className="card history-section">
      <div className="card-head">
        <div>
          <h2>{titulo}</h2>
          <p className="muted">
            {items.length} documento{items.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="table-wrap history-desktop">
        <table className="table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Estado</th>
              <th className="right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr
                key={p.id}
                className="row-click"
                onClick={() => navigate(`/pedidos/${p.id}`)}
              >
                <td>
                  <strong>{p.numero}</strong>
                </td>
                <td>{fecha(p.fecha)}</td>
                <td>{p.cliente?.nombre}</td>
                <td>{p.vendedor?.nombre}</td>
                <td>
                  <EstadoTag estado={p.estado} />
                </td>
                <td className="right">
                  <strong>{money(p.total)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="history-mobile">
        {items.map((p) => (
          <button
            type="button"
            className="history-card"
            key={p.id}
            onClick={() => navigate(`/pedidos/${p.id}`)}
          >
            <div className="history-card-top">
              <strong>{p.numero}</strong>
              <EstadoTag estado={p.estado} />
            </div>
            <div className="history-card-client">{p.cliente?.nombre}</div>
            <div className="history-card-meta">
              <span>{fecha(p.fecha)}</span>
              <span>{p.vendedor?.nombre}</span>
            </div>
            <div className="history-card-foot">
              <span className="tag">{titulo.slice(0, -1)}</span>
              <strong>{money(p.total)}</strong>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function OrderHistory() {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [todos, setTodos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [estados, setEstados] = useState([]);

  useEffect(() => {
    api('/api/estados')
      .then((d) => setEstados(d.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (estado) params.set('estado', estado);
    if (tipo) params.set('tipo', tipo);
    if (todos && user.rol === 'admin') params.set('todos', '1');
    const t = setTimeout(() => {
      api(`/api/pedidos?${params.toString()}`)
        .then((d) => !cancel && setItems(d.items || []))
        .catch((e) => !cancel && setError(e.message))
        .finally(() => !cancel && setLoading(false));
    }, 220);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [q, estado, tipo, todos, user]);

  const pedidos = items.filter((p) => Number(p.tipo) === 10);
  const presupuestos = items.filter((p) => Number(p.tipo) === 9);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Historial de documentos</h1>
          <p className="muted">Pedidos y presupuestos montados desde la web</p>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input search"
          placeholder="Buscar por número o cliente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input select"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Pedidos y presupuestos</option>
          <option value="10">Pedidos</option>
          <option value="9">Presupuestos</option>
        </select>
        <select
          className="input select"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {estados.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        {user.rol === 'admin' && (
          <label className="check">
            <input
              type="checkbox"
              checked={todos}
              onChange={(e) => setTodos(e.target.checked)}
            />
            Ver documentos de todos los vendedores
          </label>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="empty">Cargando documentos…</p>}
      {!loading && items.length === 0 && (
        <p className="empty">No hay documentos con esos filtros.</p>
      )}

      {!loading && items.length > 0 && (
        <>
          {(tipo === '' || tipo === '10') && (
            <HistoryBlock
              titulo="Pedidos"
              items={pedidos}
              currency={cart.currency}
              navigate={navigate}
            />
          )}
          {(tipo === '' || tipo === '9') && (
            <HistoryBlock
              titulo="Presupuestos"
              items={presupuestos}
              currency={cart.currency}
              navigate={navigate}
            />
          )}
        </>
      )}
    </div>
  );
}
