import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, patch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { EstadoTag } from './Dashboard.jsx';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    api(`/api/pedidos/${id}`)
      .then((d) => setPedido(d.pedido))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, [id]);

  const cambiarEstado = async (estado) => {
    try {
      await patch(`/api/pedidos/${id}/estado`, { estado });
      toast.show(`Estado actualizado a “${estado}”`);
      cargar();
    } catch (e) {
      toast.show(e.message, 'error');
    }
  };

  if (cargando) return <div className="page"><p className="empty">Cargando pedido…</p></div>;
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;
  if (!pedido) return null;

  const d = new Date(pedido.fecha);
  const subtotal = Number(pedido.subtotal);
  const descuento = Number(pedido.descuento);
  const impuestos = Number(pedido.impuestos);
  const total = Number(pedido.total);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="link" onClick={() => navigate(-1)}>
            ← Volver
          </button>
          <h1>{pedido.numero}</h1>
          <p className="muted">
            {d.toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'short' })}
          </p>
        </div>
        <EstadoTag estado={pedido.estado} />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Cliente</h2>
          </div>
          <div className="kv">
            <div>
              <span>Nombre</span>
              <strong>{pedido.cliente?.nombre}</strong>
            </div>
            <div>
              <span>Código / RIF</span>
              <strong>
                {pedido.cliente?.codigo} · {pedido.cliente?.rif}
              </strong>
            </div>
            <div>
              <span>Ciudad</span>
              <strong>{pedido.cliente?.ciudad || '—'}</strong>
            </div>
            <div>
              <span>Vendedor</span>
              <strong>{pedido.vendedor?.nombre}</strong>
            </div>
          </div>
          {pedido.observacion && (
            <>
              <h3>Observaciones</h3>
              <p className="obs">{pedido.observacion}</p>
            </>
          )}
        </section>

        <section className="card totals">
          <h2>Totales</h2>
          <div className="total-row">
            <span>Subtotal</span>
            <span>
              {cart.currency}
              {subtotal.toFixed(2)}
            </span>
          </div>
          <div className="total-row">
            <span>Descuentos</span>
            <span className="neg">
              -{cart.currency}
              {descuento.toFixed(2)}
            </span>
          </div>
          <div className="total-row">
            <span>Impuestos</span>
            <span>
              {cart.currency}
              {impuestos.toFixed(2)}
            </span>
          </div>
          <div className="total-row total-final">
            <span>Total</span>
            <span>
              {cart.currency}
              {total.toFixed(2)}
            </span>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Detalle del pedido</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="right">Precio</th>
                <th className="center">Cantidad</th>
                <th className="center">Desc. %</th>
                <th className="right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {pedido.detalles.map((l) => (
                <tr key={l.id ?? l.producto_id}>
                  <td>
                    <strong>{l.producto?.descripcion}</strong>
                    <div className="sub">{l.producto?.codigo}</div>
                  </td>
                  <td className="right">
                    {cart.currency}
                    {Number(l.precio).toFixed(2)}
                  </td>
                  <td className="center">{Number(l.cantidad)}</td>
                  <td className="center">{Number(l.descuento)}%</td>
                  <td className="right">
                    <strong>
                      {cart.currency}
                      {Number(l.subtotal).toFixed(2)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {user.rol === 'admin' && (
        <section className="card">
          <div className="card-head">
            <h2>Acciones de administrador</h2>
          </div>
          <div className="actions">
            {['aprobado', 'facturado', 'rechazado', 'enviado'].map((e) => (
              <button
                key={e}
                className="btn btn-ghost btn-sm"
                disabled={pedido.estado === e}
                onClick={() => cambiarEstado(e)}
              >
                Marcar “{e}”
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="actions">
        <Link className="btn btn-primary" to="/pedido">
          Montar otro pedido
        </Link>
        <Link className="btn btn-ghost" to="/pedidos">
          Ver historial
        </Link>
      </div>
    </div>
  );
}
