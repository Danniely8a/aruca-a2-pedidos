import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { EstadoTag } from './Dashboard.jsx';

export default function OrderHistory() {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
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
  }, [q, estado, todos, user]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Historial de pedidos</h1>
          <p className="muted">Seguimiento de todo lo que has montado</p>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input search"
          placeholder="Buscar por número o cliente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input select" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {estados.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        {user.rol === 'admin' && (
          <label className="check">
            <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
            Ver pedidos de todos los vendedores
          </label>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="empty">Cargando pedidos…</p>}
      {!loading && items.length === 0 && <p className="empty">No hay pedidos con esos filtros.</p>}

      {!loading && items.length > 0 && (
        <div className="table-wrap card">
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
                <tr key={p.id} className="row-click" onClick={() => navigate(`/pedidos/${p.id}`)}>
                  <td>
                    <strong>{p.numero}</strong>
                  </td>
                  <td>{new Date(p.fecha).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td>{p.cliente?.nombre}</td>
                  <td>{p.vendedor?.nombre}</td>
                  <td>
                    <EstadoTag estado={p.estado} />
                  </td>
                  <td className="right">
                    <strong>
                      {cart.currency}
                      {Number(p.total).toFixed(2)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
