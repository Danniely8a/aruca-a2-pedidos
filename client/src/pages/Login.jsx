import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    api('/api/health', { auth: false })
      .then((h) => setDemo(h.mode === 'demo'))
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(usuario.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <section className="login-brand">
        <div className="login-brand-inner">
          <div className="logo-tile">
            <Logo size={120} />
          </div>
          <h1>A2 Pedidos</h1>
          <p>
            Monta y envía pedidos desde cualquier lugar. La conexión directa con el
            sistema A2 mantiene clientes, precios y existencias siempre al día.
          </p>
          <ul className="login-points">
            <li>Catálogo en línea con búsqueda rápida</li>
            <li>Historial y seguimiento de cada pedido</li>
          </ul>
        </div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="logo-tile logo-tile-sm">
            <Logo size={46} />
          </div>
          <h2>Iniciar sesión</h2>
          <p className="muted">Ingresa con tu cuenta de vendedor</p>

          {error && <div className="alert alert-error">{error}</div>}

          <label className="field">
            <span>Usuario o correo</span>
            <input
              className="input"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="vendedor@empresa.com"
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
            {loading ? 'Validando…' : 'Entrar a la plataforma'}
          </button>

          {demo && (
            <div className="demo-box">
              <strong>Modo demostración (sin base de datos)</strong>
              <span>admin@empresa.com · admin123</span>
              <span>carlos@empresa.com · vendedor123</span>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
