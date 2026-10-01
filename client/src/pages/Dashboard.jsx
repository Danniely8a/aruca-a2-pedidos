import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

const money = (n, c = '$') => `${c}${Number(n || 0).toFixed(2)}`;

export default function Dashboard() {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/api/dashboard'), api('/api/pedidos')])
      .then(([s, p]) => {
        setStats(s);
        setRecientes((p.items || []).slice(0, 5));
      })
      .catch((e) => setError(e.message));
  }, [user]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Hola, {user.nombre.split(' ')[0]}</h1>
          <p className="muted">Resumen de tu operación comercial</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/pedido')}>
          Montar nuevo pedido
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="cards">
        <div className="card stat">
          <span>Pedidos este mes</span>
          <strong>{stats?.pedidos_mes ?? '—'}</strong>
        </div>
        <div className="card stat">
          <span>Monto del mes</span>
          <strong>{stats ? money(stats.monto_mes, cart.currency) : '—'}</strong>
        </div>
        <div className="card stat">
          <span>Clientes</span>
          <strong>{stats?.clientes ?? '—'}</strong>
        </div>
        <div className="card stat">
          <span>Productos</span>
          <strong>{stats?.productos ?? '—'}</strong>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Pedidos recientes</h2>
            <Link to="/pedidos" className="link">
              Ver historial →
            </Link>
          </div>
          {recientes.length === 0 ? (
            <p className="empty">Aún no tienes pedidos registrados.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/pedidos/${p.id}`)}>
                    <td>
                      <strong>{p.numero}</strong>
                    </td>
                    <td>{p.cliente?.nombre}</td>
                    <td>
                      <EstadoTag estado={p.estado} />
                    </td>
                    <td className="right">{money(p.total, cart.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Accesos rápidos</h2>
          </div>
          <div className="quick">
            <Link className="quick-item" to="/pedido">
              <strong>Montar pedido</strong>
              <span>Selecciona cliente y agrega productos</span>
            </Link>
            <Link className="quick-item" to="/productos">
              <strong>Catálogo</strong>
              <span>Busca artículos y añádelos al pedido</span>
            </Link>
            <Link className="quick-item" to="/clientes">
              <strong>Clientes</strong>
              <span>Consulta fichas y listas de precios</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export function EstadoTag({ estado }) {
  return <span className={`tag tag-${estado}`}>{estado}</span>;
}
