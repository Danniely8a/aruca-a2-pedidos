import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Products() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/productos/categorias')
      .then((d) => setCategorias(d.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (categoria) params.set('categoria', categoria);
      if (cart.lista) params.set('lista', cart.lista);
      api(`/api/productos?${params.toString()}`)
        .then((d) => {
          if (!cancel) setItems(d.items || []);
        })
        .catch((e) => !cancel && setError(e.message))
        .finally(() => !cancel && setLoading(false));
    }, 220);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [q, categoria, cart.lista]);

  const money = (n) => `${cart.currency}${Number(n ?? 0).toFixed(2)}`;

  const agregar = (p) => {
    if (cart.tipo === 10) {
      const enCarrito =
        cart.lines.find((l) => l.producto.id === p.id)?.cantidad || 0;
      const disponible = Number(p.disponible ?? p.existencia) || 0;
      if (enCarrito + 1 > disponible) {
        toast.show(
          `"${p.descripcion}" solo tiene ${disponible} disponible(s)`,
          'error'
        );
        return;
      }
    }
    cart.addItem(p);
    toast.show(`${p.descripcion} agregado al documento`);
  };

  const limpiar = () => {
    setQ('');
    setCategoria('');
  };

  return (
    <div className="page catalog-page">
      <div className="catalog-head">
        <div>
          <h1>Productos</h1>
          <p className="muted">
            Explora el catálogo y arma tu pedido o presupuesto.
          </p>
        </div>
        <button
          type="button"
          className="cart-cta"
          onClick={() => navigate('/pedido')}
        >
          <span className="cart-cta-icon">▦</span>
          <span className="cart-cta-info">
            <span>Documento actual</span>
            <strong>
              {cart.count} artículo{cart.count === 1 ? '' : 's'}
            </strong>
          </span>
          <strong className="cart-cta-total">{money(cart.total)}</strong>
          <span className="cart-cta-arrow">→</span>
        </button>
      </div>

      <section className="catalog-filters card">
        <div className="catalog-search">
          <span className="search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            className="input search"
            placeholder="Buscar por código, descripción o categoría…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setQ('')}
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        <div className="chips-scroll">
          <div className="chips">
            <button
              className={`chip ${categoria === '' ? 'active' : ''}`}
              onClick={() => setCategoria('')}
            >
              Todas
            </button>
            {categorias.map((c) => (
              <button
                key={c}
                className={`chip ${categoria === c ? 'active' : ''}`}
                onClick={() => setCategoria(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-meta">
          <span>
            {loading
              ? 'Buscando productos…'
              : `${items.length} producto${items.length === 1 ? '' : 's'}`}
          </span>
          {(q || categoria) && (
            <button type="button" className="link" onClick={limpiar}>
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && items.length === 0 && (
        <p className="empty">Cargando productos…</p>
      )}
      {!loading && items.length === 0 && (
        <div className="empty-state card">
          <p>No se encontraron productos con ese criterio.</p>
          <button type="button" className="btn btn-ghost" onClick={limpiar}>
            Limpiar filtros
          </button>
        </div>
      )}

      <div className="prod-grid">
        {items.map((p) => {
          const existencia = Number(p.existencia) || 0;
          const disponible = Number(p.disponible ?? existencia) || 0;
          const sinDisponible = cart.tipo === 10 && disponible <= 0;
          const enPedido = cart.items.find((i) => i.producto.id === p.id);
          return (
            <article className="prod card" key={p.id}>
              <div className="prod-head">
                <span className="prod-code">{p.codigo}</span>
                <span className="prod-cat">{p.categoria}</span>
              </div>

              <h3 title={p.descripcion}>{p.descripcion}</h3>

              <div className="prod-stock">
                <span
                  className={`stock-dot ${disponible > 0 ? 'ok' : 'warn'}`}
                />
                <span>
                  Disponible: <strong>{disponible}</strong>
                </span>
                <span className="muted">Existencia: {existencia}</span>
              </div>

              <div className="prod-prices">
                <div
                  className={`price-tile ${
                    Number(cart.lista) === 1 ? 'active' : ''
                  }`}
                >
                  <span>Detal</span>
                  <strong>{money(p.precio_detal)}</strong>
                </div>
                <div
                  className={`price-tile ${
                    Number(cart.lista) === 3 ? 'active' : ''
                  }`}
                >
                  <span>Mayor</span>
                  <strong>{money(p.precio_mayor)}</strong>
                </div>
              </div>

              {Number(p.precio) === 0 && (
                <span className="tag tag-precio-cero">Precio 0</span>
              )}

              <div className="prod-actions">
                {enPedido && (
                  <span className="prod-in-cart">
                    En documento: {enPedido.cantidad}
                  </span>
                )}
                <button
                  className="btn btn-primary btn-block"
                  disabled={sinDisponible}
                  onClick={() => agregar(p)}
                >
                  {sinDisponible
                    ? 'Sin disponible'
                    : enPedido
                      ? `Agregar (+${enPedido.cantidad})`
                      : 'Agregar'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
