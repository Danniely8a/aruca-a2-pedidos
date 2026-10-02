import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';
import Footer from './Footer.jsx';
import ServerStatus from './ServerStatus.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

const NAV = [
  { to: '/', label: 'Inicio', icon: '◈' },
  { to: '/pedido', label: 'Montar pedido', icon: '＋' },
  { to: '/productos', label: 'Productos', icon: '▦' },
  { to: '/clientes', label: 'Clientes', icon: '☺' },
  { to: '/pedidos', label: 'Historial', icon: '≣' }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const cerrarSesion = () => {
    logout();
    cart.reset();
    navigate('/login');
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <Logo size={38} />
          <div>
            <strong>A2 Pedidos</strong>
            <span>Plataforma de montaje</span>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.to === '/pedido' && cart.count > 0 && (
                <span className="badge">{cart.count}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{(user?.nombre || '?').charAt(0).toUpperCase()}</div>
            <div className="user-meta">
              <strong>{user?.nombre}</strong>
              <span>{user?.rol === 'admin' ? 'Administrador' : 'Vendedor'}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-block" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {open && <div className="backdrop" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setOpen((v) => !v)} aria-label="Menú">
            ☰
          </button>
          <div className="topbar-title">Sistema A2 · Pedidos externos</div>
          <ServerStatus />
          <button className="btn btn-primary" onClick={() => navigate('/pedido')}>
            Montar pedido
            {cart.count > 0 && <span className="badge badge-light">{cart.count}</span>}
          </button>
        </header>

        <main className="content">
          <Outlet />
        </main>

        <Footer />
      </div>
    </div>
  );
}
