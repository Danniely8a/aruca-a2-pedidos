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

  const agregar = (p) => {
    if (cart.tipo === 10) {
      const enCarrito =
        cart.lines.find((l) => l.producto.id === p.id)?.cantidad || 0;
      const disponible = Number(p.disponible ?? p.existencia) || 0;
      if (enCarrito + 1 > disponible) {
        toast.show(`"${p.descripcion}" solo tiene ${disponible} disponible(s)`, 'error');
        return;
      }
    }
    cart.addItem(p);
    toast.show(`${p.descripcion} agregado al documento`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Catálogo de productos</h1>
          <p className="muted">Busca artículos y agrégalos al pedido en curso</p>
        </div>
        <div className="cart-pill" onClick={() => navigate('/pedido')}>
          Pedido actual: <strong>{cart.count}</strong> artículos
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input search"
          placeholder="Buscar por código, descripción o categoría…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="empty">Cargando productos…</p>}
      {!loading && items.length === 0 && (
        <p className="empty">No se encontraron productos con ese criterio.</p>
      )}

      <div className="prod-grid">
        {items.map((p) => {
          const existencia = Number(p.existencia) || 0;
          const disponible = Number(p.disponible ?? existencia) || 0;
          const sinDisponible = cart.tipo === 10 && disponible <= 0;
          const enPedido = cart.items.find((i) => i.producto.id === p.id);
          const money = (n) => `${cart.currency}${Number(n ?? 0).toFixed(2)}`;
          return (
            <article className="prod card" key={p.id}>
              <div className="prod-top">
                <span className="prod-code">{p.codigo}</span>
                <span
                  className={`tag ${
                    sinDisponible ? 'tag-pendiente' : 'tag-aprobado'
                  }`}
                >
                  Disp. {disponible} · Exist. {existencia}
                </span>
              </div>
              <h3>{p.descripcion}</h3>
              <span className="prod-cat">{p.categoria}</span>
              <div className="prod-prices">
                <span>Detal {money(p.precio_detal)}</span>
                <span>Mayor {money(p.precio_mayor)}</span>
              </div>
              <div className="prod-foot">
                <strong className="price">
                  {Number(p.precio) === 0 ? (
                    <span className="tag tag-precio-cero">Precio 0</span>
                  ) : (
                    money(p.precio)
                  )}
                </strong>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={sinDisponible}
                  onClick={() => agregar(p)}
                >
                  {enPedido ? `Agregar (+${enPedido.cantidad})` : 'Agregar'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
