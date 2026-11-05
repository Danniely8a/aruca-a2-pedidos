import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import InstallApp from '../components/InstallApp.jsx';

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
    <div className="page dashboard-page">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Panel comercial</span>
          <h1>Hola, {user.nombre.split(' ')[0]}</h1>
          <p>Este es el resumen de tu operación y tus accesos rápidos.</p>
          <div className="hero-actions">
            <button
              className="btn btn-light"
              onClick={() => navigate('/pedido')}
            >
              Nuevo documento
            </button>
            <Link className="btn btn-hero-ghost" to="/productos">
              Ver catálogo
            </Link>
          </div>
        </div>

        <div className="hero-side">
          <div className="hero-cart">
            <span>Documento en curso</span>
            <strong>
              {cart.count} artículo{cart.count === 1 ? '' : 's'}
            </strong>
            <span>{money(cart.total, cart.currency)}</span>
          </div>
          <InstallApp />
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="cards dashboard-stats">
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-blue">≣</span>
          <div>
            <span>Pedidos este mes</span>
            <strong>{stats?.pedidos_mes ?? '—'}</strong>
          </div>
        </div>
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-green">$</span>
          <div>
            <span>Monto del mes</span>
            <strong>
              {stats ? money(stats.monto_mes, cart.currency) : '—'}
            </strong>
          </div>
        </div>
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-amber">☺</span>
          <div>
            <span>Clientes</span>
            <strong>{stats?.clientes ?? '—'}</strong>
          </div>
        </div>
        <div className="card stat stat-card">
          <span className="stat-icon stat-icon-violet">▦</span>
          <div>
            <span>Productos</span>
            <strong>{stats?.productos ?? '—'}</strong>
          </div>
        </div>
      </div>

      <div className="grid-2 dashboard-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Actividad reciente</h2>
              <p className="muted">Últimos documentos montados</p>
            </div>
            <Link to="/pedidos" className="link">
              Ver todo →
            </Link>
          </div>

          {recientes.length === 0 ? (
            <p className="empty">Aún no tienes documentos registrados.</p>
          ) : (
            <div className="recent-list">
              {recientes.map((p) => (
                <button
                  type="button"
                  className="recent-item"
                  key={p.id}
                  onClick={() => navigate(`/pedidos/${p.id}`)}
                >
                  <div className="recent-main">
                    <strong>{p.numero}</strong>
                    <span>{p.cliente?.nombre}</span>
                  </div>
                  <div className="recent-meta">
                    <EstadoTag estado={p.estado} />
                    <span>
                      {Number(p.tipo) === 9 ? 'Presupuesto' : 'Pedido'}
                    </span>
                  </div>
                  <strong className="recent-total">
                    {money(p.total, cart.currency)}
                  </strong>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Accesos rápidos</h2>
          </div>
          <div className="quick quick-grid">
            <Link className="quick-item" to="/pedido">
              <span className="quick-icon">＋</span>
              <div>
                <strong>Montar documento</strong>
                <span>Cliente, productos y envío</span>
              </div>
            </Link>
            <Link className="quick-item" to="/productos">
              <span className="quick-icon">▦</span>
              <div>
                <strong>Catálogo</strong>
                <span>Precios, stock y disponibilidad</span>
              </div>
            </Link>
            <Link className="quick-item" to="/clientes">
              <span className="quick-icon">☺</span>
              <div>
                <strong>Clientes</strong>
                <span>Fichas y listas de precios</span>
              </div>
            </Link>
            <Link className="quick-item" to="/reportes">
              <span className="quick-icon">▥</span>
              <div>
                <strong>Reportes</strong>
                <span>Ventas por periodo</span>
              </div>
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
