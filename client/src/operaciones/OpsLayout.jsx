import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { useOpsAuth } from './OpsAuthContext.jsx';

export default function OpsLayout() {
  const { user, logout } = useOpsAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const esJefe = user?.rol === 'jefe';

  const NAV = [
    { to: '/operaciones', label: 'Inicio', short: 'Inicio', icon: 'IN' },
    { to: '/operaciones/pedidos', label: 'Pedidos', short: 'Pedidos', icon: 'PE' },
    ...(esJefe
      ? [
          { to: '/operaciones/operarios', label: 'Operarios', short: 'Equipo', icon: 'OP' },
          { to: '/operaciones/reportes', label: 'Reportes', short: 'Tiempos', icon: 'RE' }
        ]
      : [])
  ];

  const cerrarSesion = () => {
    logout();
    navigate('/operaciones/login', { replace: true });
  };

  return (
    <div className="shell ops-shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <Logo size={38} />
          <div>
            <strong>Aruca Almacén</strong>
            <span>Módulo de operaciones</span>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/operaciones'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <span className="nav-icon ops-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{(user?.nombre || '?').charAt(0).toUpperCase()}</div>
            <div className="user-meta">
              <strong>{user?.nombre}</strong>
              <span>{esJefe ? 'Jefe de almacén' : 'Operario de almacén'}</span>
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
            ≡
          </button>
          <div className="topbar-title">Operaciones de almacén</div>
          <span className="ops-topbar-badge">ALMACÉN</span>
        </header>

        <main className="content">
          <Outlet />
        </main>

        <footer className="site-footer">
          Aruca Maquinarias C.A. · Módulo de operaciones
        </footer>
      </div>

      <nav className="mobile-nav" aria-label="Menú de operaciones">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/operaciones'}
            className={({ isActive }) =>
              `mobile-nav-link ${isActive ? 'active' : ''}`
            }
            onClick={() => setOpen(false)}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span>{item.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
