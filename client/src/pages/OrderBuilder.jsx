import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ClienteSelector from '../components/ClienteSelector.jsx';
import ProductoBuscador from '../components/ProductoBuscador.jsx';

const nuevoClienteVacio = {
  nombre: '',
  rif: '',
  telefono: '',
  direccion: '',
  correo: '',
  estado: 'activo',
  tipo_contribuyente: 'ordinario',
  moneda: 'USD'
};

export default function OrderBuilder() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [modoCliente, setModoCliente] = useState('existente');
  const [nuevo, setNuevo] = useState(nuevoClienteVacio);
  const [creando, setCreando] = useState(false);
  const [errorCliente, setErrorCliente] = useState('');

  const campo = (name) => ({
    value: nuevo[name],
    onChange: (e) => setNuevo((n) => ({ ...n, [name]: e.target.value }))
  });

  const registrarCliente = async (e) => {
    e.preventDefault();
    setErrorCliente('');
    if (!nuevo.nombre.trim() || !nuevo.rif.trim()) {
      setErrorCliente('El nombre y el RIF del cliente son obligatorios.');
      return;
    }
    setCreando(true);
    try {
      const data = await post('/api/clientes', nuevo);
      await cart.setCliente(data.cliente);
      setNuevo(nuevoClienteVacio);
      setModoCliente('existente');
      toast.show(`Cliente ${data.cliente.nombre} registrado`);
    } catch (err) {
      setErrorCliente(err.message);
    } finally {
      setCreando(false);
    }
  };

  const enviar = async () => {
    setError('');
    if (!cart.cliente) {
      setError('Selecciona o registra el cliente del pedido.');
      return;
    }
    if (cart.cliente.activo === false) {
      setError('El cliente está inactivo. Actívalo en el A2 antes de enviar el pedido.');
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
      toast.show(`Pedido ${data.pedido.numero} completado y enviado al A2`);
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
          <h1>Nuevo pedido</h1>
          <p className="muted">Cliente → moneda → productos → envío al sistema A2</p>
        </div>
        <Link to="/productos" className="btn btn-ghost">
          Ver catálogo
        </Link>
      </div>

      <div className="builder">
        <div className="builder-main">
          <section className="card">
            <div className="card-head">
              <h2>1. Cliente</h2>
              <div className="tabs">
                <button
                  type="button"
                  className={`tab ${modoCliente === 'existente' ? 'active' : ''}`}
                  onClick={() => setModoCliente('existente')}
                >
                  Existente
                </button>
                <button
                  type="button"
                  className={`tab ${modoCliente === 'nuevo' ? 'active' : ''}`}
                  onClick={() => setModoCliente('nuevo')}
                >
                  Cliente nuevo
                </button>
              </div>
            </div>

            {modoCliente === 'existente' ? (
              <>
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
              </>
            ) : (
              <form onSubmit={registrarCliente}>
                {errorCliente && (
                  <div className="alert alert-error">{errorCliente}</div>
                )}
                <div className="form-grid">
                  <label className="field span-2">
                    <span>Nombre del cliente *</span>
                    <input
                      className="input"
                      placeholder="Razón social o nombre comercial"
                      required
                      {...campo('nombre')}
                    />
                  </label>
                  <label className="field">
                    <span>RIF *</span>
                    <input
                      className="input"
                      placeholder="J-12345678-9"
                      required
                      {...campo('rif')}
                    />
                  </label>
                  <label className="field">
                    <span>Teléfono</span>
                    <input
                      className="input"
                      placeholder="0212-5550000"
                      {...campo('telefono')}
                    />
                  </label>
                  <label className="field span-2">
                    <span>Dirección</span>
                    <input
                      className="input"
                      placeholder="Avenida, sector, número"
                      {...campo('direccion')}
                    />
                  </label>
                  <label className="field span-2">
                    <span>Correo</span>
                    <input
                      className="input"
                      type="email"
                      placeholder="cliente@correo.com"
                      {...campo('correo')}
                    />
                  </label>
                  <label className="field">
                    <span>Estado del cliente</span>
                    <select className="input" {...campo('estado')}>
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Tipo de contribuyente</span>
                    <select className="input" {...campo('tipo_contribuyente')}>
                      <option value="ordinario">Ordinario</option>
                      <option value="especial">Especial</option>
                    </select>
                  </label>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={creando}
                  type="submit"
                >
                  {creando ? 'Registrando…' : 'Registrar cliente y continuar'}
                </button>
              </form>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>2. Moneda</h2>
              <span className="tag tag-aprobado">USD</span>
            </div>
            <div className="moneda-box">
              <div>
                <strong>Dólares estadounidenses (USD)</strong>
                <span>
                  Moneda que admite el pedido. Los precios se expresan con el símbolo
                  «{cart.currency}».
                </span>
              </div>
              <span className="moneda-symbol">{cart.currency}</span>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>3. Productos del pedido</h2>
              <span className="muted">{cart.lines.length} línea(s)</span>
            </div>

            <ProductoBuscador onSelect={(p) => cart.addItem(p)} />

            {cart.lines.length === 0 ? (
              <div className="empty-state">
                <p>Busca un producto por código o descripción para agregarlo.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table-lines">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th className="center">Cantidad</th>
                      <th className="right">Precio</th>
                      <th className="center">Desc. %</th>
                      <th className="right">Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.lines.map((l) => (
                      <tr key={l.producto.id}>
                        <td className="nowrap">
                          <strong>{l.producto.codigo}</strong>
                        </td>
                        <td>
                          {l.producto.descripcion}
                          {l.esEspecial && (
                            <span className="tag tag-especial">precio especial</span>
                          )}
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
              <h2>Observaciones</h2>
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
              <span>Moneda</span>
              <span>USD ({cart.currency})</span>
            </div>
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
              disabled={
                enviando ||
                cart.lines.length === 0 ||
                !cart.cliente ||
                cart.cliente.activo === false
              }
            >
              {enviando ? 'Enviando…' : 'Enviar pedido'}
            </button>
            <p className="hint">
              Al enviar, el pedido queda completado y registrado en el sistema A2.
            </p>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => cart.clear()}
              disabled={cart.lines.length === 0}
            >
              Vaciar productos
            </button>
            {!cart.cliente && (
              <p className="hint">Recuerda seleccionar o registrar el cliente.</p>
            )}
            {cart.cliente && cart.cliente.activo === false && (
              <p className="hint hint-error">
                El cliente está inactivo y no puede recibir pedidos.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
