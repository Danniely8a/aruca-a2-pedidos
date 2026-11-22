import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { useOpsAuth } from './OpsAuthContext.jsx';

export default function OpsLogin() {
  const { login } = useOpsAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(usuario.trim(), password);
      navigate('/operaciones', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login ops-login">
      <section className="login-brand">
        <div className="login-brand-inner">
          <div className="logo-tile">
            <Logo size={120} />
          </div>
          <h1>Aruca Almacén</h1>
          <p>
            Módulo de operaciones para asignar pedidos, armar mercancía y validar
            cada producto con su tiempo de trabajo.
          </p>
          <ul className="login-points">
            <li>Pedidos pendientes y en tránsito</li>
            <li>Asignación por operario</li>
            <li>Validación y tiempos por pedido e ítem</li>
          </ul>
        </div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="logo-tile logo-tile-sm">
            <Logo size={46} />
          </div>
          <h2>Acceso de almacén</h2>
          <p className="muted">Ingresa con tu cuenta de operaciones</p>

          {error && <div className="alert alert-error">{error}</div>}

          <label className="field">
            <span>Correo</span>
            <input
              className="input"
              type="email"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="operario@arucamaquinarias.com"
              autoComplete="username"
              autoFocus
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <div className="password">
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </label>

          <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Validando…' : 'Entrar a operaciones'}
          </button>

          <p className="ops-login-note">
            Si no tienes acceso, solicita tus credenciales al jefe de almacén.
          </p>

          <a className="link login-alt" href="/login">
            Acceso para vendedores
          </a>
        </form>
      </section>

      <footer className="site-footer">Aruca Maquinarias C.A. · Operaciones</footer>
    </div>
  );
}
