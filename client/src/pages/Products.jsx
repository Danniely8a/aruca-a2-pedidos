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
  }, [q, categoria]);

  const agregar = (p) => {
    cart.addItem(p);
    toast.show(`${p.descripcion} agregado al pedido`);
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
          const sinStock = Number(p.existencia) <= 0;
          const enPedido = cart.items.find((i) => i.producto.id === p.id);
          return (
            <article className="prod card" key={p.id}>
              <div className="prod-top">
                <span className="prod-code">{p.codigo}</span>
                <span className={`tag ${sinStock ? 'tag-rechazado' : 'tag-aprobado'}`}>
                  {sinStock ? 'Sin existencia' : `${p.existencia} ${p.unidad}(es)`}
                </span>
              </div>
              <h3>{p.descripcion}</h3>
              <span className="prod-cat">{p.categoria}</span>
              <div className="prod-foot">
                <strong className="price">
                  {p.precio != null && Number(p.precio) > 0
                    ? `${cart.currency}${Number(p.precio).toFixed(2)}`
                    : <span className="no-price">Sin precio</span>}
                </strong>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={sinStock}
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
