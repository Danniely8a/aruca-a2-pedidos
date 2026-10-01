import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ClienteSelector from '../components/ClienteSelector.jsx';

export default function OrderBuilder() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async () => {
    setError('');
    if (!cart.cliente) {
      setError('Selecciona el cliente del pedido.');
      return;
    }
    const items = cart.lines
      .filter((l) => l.cantidad > 0)
      .map((l) => ({
        producto_id: l.producto.id,
        cantidad: l.cantidad,
        descuento: l.descuento || 0,
        precio: l.precio
      }));
    if (items.length === 0) {
      setError('Agrega al menos un producto con cantidad mayor a cero.');
      return;
    }
    const sinPrecio = cart.lines.find(
      (l) => l.cantidad > 0 && (!l.precio || l.precio <= 0)
    );
    if (sinPrecio) {
      setError(
        `Indica el precio de "${sinPrecio.producto.descripcion}" antes de enviar.`
      );
      return;
    }

    setEnviando(true);
    try {
      const data = await post('/api/pedidos', {
        cliente_id: cart.cliente.id,
        observacion: cart.observacion,
        items
      });
      cart.reset();
      toast.show(`Pedido ${data.pedido.numero} enviado correctamente`);
      navigate(`/pedidos/${data.pedido.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Montar pedido</h1>
          <p className="muted">Cliente → productos → envío al sistema A2</p>
        </div>
        <Link to="/productos" className="btn btn-ghost">
          Agregar más productos
        </Link>
      </div>

      <div className="builder">
        <div className="builder-main">
          <section className="card">
            <div className="card-head">
              <h2>1. Cliente</h2>
            </div>
            <ClienteSelector
              value={cart.cliente?.id || null}
              onChange={(c) => cart.setCliente(c)}
              autoFocus={!cart.cliente}
            />
            {cart.cliente && Object.keys(cart.precios).length > 0 && (
              <p className="hint">
                Este cliente tiene {Object.keys(cart.precios).length} producto(s) con
                precio especial aplicado automáticamente.
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>2. Productos del pedido</h2>
              <span className="muted">{cart.lines.length} línea(s)</span>
            </div>

            {cart.lines.length === 0 ? (
              <div className="empty-state">
                <p>Todavía no has agregado productos.</p>
                <Link to="/productos" className="btn btn-primary">
                  Ir al catálogo
                </Link>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table-lines">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="right">Precio</th>
                      <th className="center">Cantidad</th>
                      <th className="center">Desc. %</th>
                      <th className="right">Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.lines.map((l) => (
                      <tr key={l.producto.id}>
                        <td>
                          <strong>{l.producto.descripcion}</strong>
                          <div className="sub">
                            {l.producto.codigo}
                            {l.esEspecial && <span className="tag tag-especial">precio especial</span>}
                          </div>
                        </td>
                        <td className="right">
                          <input
                            className="input input-num input-price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.precioManual ?? ''}
                            placeholder="Sin precio"
                            onChange={(e) =>
                              cart.setPrecio(l.producto.id, e.target.value)
                            }
                          />
                        </td>
                        <td className="center">
                          <input
                            className="input input-num"
                            type="number"
                            min="0"
                            value={l.cantidad}
                            onChange={(e) => cart.setCantidad(l.producto.id, e.target.value)}
                          />
                        </td>
                        <td className="center">
                          <input
                            className="input input-num"
                            type="number"
                            min="0"
                            max="100"
                            value={l.descuento}
                            onChange={(e) => cart.setDescuento(l.producto.id, e.target.value)}
                          />
                        </td>
                        <td className="right">
                          <strong>
                            {cart.currency}
                            {l.subtotal.toFixed(2)}
                          </strong>
                          {l.descuentoValor > 0 && (
                            <div className="sub">
                              -{cart.currency}
                              {l.descuentoValor.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="right">
                          <button
                            className="icon-btn"
                            title="Quitar"
                            onClick={() => cart.removeItem(l.producto.id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>3. Observaciones</h2>
            </div>
            <textarea
              className="input textarea"
              rows={3}
              placeholder="Instrucciones de entrega, referencias, horarios…"
              value={cart.observacion}
              onChange={(e) => cart.setObservacion(e.target.value)}
            />
          </section>
        </div>

        <aside className="builder-side">
          <div className="card totals">
            <h2>Resumen</h2>
            <div className="total-row">
              <span>Subtotal</span>
              <span>
                {cart.currency}
                {cart.subtotal.toFixed(2)}
              </span>
            </div>
            <div className="total-row">
              <span>Descuentos</span>
              <span className="neg">
                -{cart.currency}
                {cart.descuento.toFixed(2)}
              </span>
            </div>
            <div className="total-row">
              <span>Impuestos ({Math.round(cart.taxRate * 100)}%)</span>
              <span>
                {cart.currency}
                {cart.impuestos.toFixed(2)}
              </span>
            </div>
            <div className="total-row total-final">
              <span>Total</span>
              <span>
                {cart.currency}
                {cart.total.toFixed(2)}
              </span>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <button
              className="btn btn-primary btn-block btn-lg"
              onClick={enviar}
              disabled={enviando || cart.lines.length === 0}
            >
              {enviando ? 'Enviando…' : 'Enviar pedido al sistema A2'}
            </button>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => cart.clear()}
              disabled={cart.lines.length === 0}
            >
              Vaciar productos
            </button>
            {!cart.cliente && (
              <p className="hint">Recuerda seleccionar el cliente antes de enviar.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
