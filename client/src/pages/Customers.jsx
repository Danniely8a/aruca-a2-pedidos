import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Customers() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const t = setTimeout(() => {
      api(`/api/clientes?q=${encodeURIComponent(q)}`)
        .then((d) => !cancel && setItems(d.items || []))
        .catch((e) => !cancel && setError(e.message))
        .finally(() => !cancel && setLoading(false));
    }, 220);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [q]);

  const abrir = async (c) => {
    try {
      const data = await api(`/api/clientes/${c.id}`);
      const productos = await api('/api/productos');
      const mapa = Object.fromEntries(
        (data.precios || []).map((p) => [p.producto_id, p.precio])
      );
      const lista = productos.items
        .filter((p) => mapa[p.id] != null)
        .map((p) => ({ ...p, precioCliente: mapa[p.id] }));
      setDetalle({ cliente: data.cliente, lista });
    } catch (e) {
      toast.show(e.message, 'error');
    }
  };

  const montarCon = async (c) => {
    await cart.setCliente(c);
    toast.show(`Pedido para ${c.nombre}`);
    navigate('/pedido');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Clientes</h1>
          <p className="muted">Fichas y listas de precios negociadas</p>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input search"
          placeholder="Buscar por nombre, código, RIF o ciudad…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="empty">Cargando clientes…</p>}
      {!loading && items.length === 0 && (
        <p className="empty">No hay clientes para esa búsqueda.</p>
      )}

      <div className="table-wrap card">
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>Ciudad</th>
              <th>Vendedor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.codigo}</td>
                <td>
                  <strong
                    className="link"
                    onClick={() => abrir(c)}
                  >
                    {c.nombre}
                  </strong>
                  <div className="sub">{c.rif}</div>
                </td>
                <td>{c.ciudad}</td>
                <td>{c.vendedor_nombre || '—'}</td>
                <td className="right">
                  <button className="btn btn-ghost btn-sm" onClick={() => abrir(c)}>
                    Ver ficha
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => montarCon(c)}
                  >
                    Montar pedido
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div className="modal-backdrop" onClick={() => setDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{detalle.cliente.nombre}</h2>
                <span className="muted">
                  {detalle.cliente.codigo} · {detalle.cliente.rif}
                </span>
              </div>
              <button className="icon-btn" onClick={() => setDetalle(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="kv">
                <div>
                  <span>Teléfono</span>
                  <strong>{detalle.cliente.telefono || '—'}</strong>
                </div>
                <div>
                  <span>Ciudad</span>
                  <strong>{detalle.cliente.ciudad || '—'}</strong>
                </div>
                <div>
                  <span>Dirección</span>
                  <strong>{detalle.cliente.direccion || '—'}</strong>
                </div>
                <div>
                  <span>Vendedor</span>
                  <strong>{detalle.cliente.vendedor_nombre || '—'}</strong>
                </div>
              </div>

              <h3>Lista de precios</h3>
              {detalle.lista.length === 0 ? (
                <p className="empty">
                  Este cliente compra a precio de lista (sin descuentos negociados).
                </p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="right">Precio lista</th>
                      <th className="right">Precio cliente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.lista.map((p) => (
                      <tr key={p.id}>
                        <td>{p.descripcion}</td>
                        <td className="right muted">{cart.currency}{Number(p.precio).toFixed(2)}</td>
                        <td className="right">
                          <strong>{cart.currency}{Number(p.precioCliente).toFixed(2)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setDetalle(null)}>
                Cerrar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  montarCon(detalle.cliente);
                  setDetalle(null);
                }}
              >
                Montar pedido con este cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
