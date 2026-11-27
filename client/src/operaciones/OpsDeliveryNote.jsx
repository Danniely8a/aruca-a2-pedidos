import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { opsApi } from './api.js';
import { formatFecha } from './ui.jsx';

export default function OpsDeliveryNote() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    opsApi(`/api/operaciones/pedidos/${id}/nota-entrega`)
      .then((d) => !cancel && setData(d))
      .catch((e) => !cancel && setError(e.message))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <p className="empty">Generando nota de entrega…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="alert alert-error">{error}</div>
        <Link className="btn btn-ghost" to={`/operaciones/pedidos/${id}`}>
          Volver al pedido
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { pedido, empresa, currency = '$', ops } = data;
  const money = (n) => `${currency}${Number(n || 0).toFixed(2)}`;
  const detalles = pedido.detalles || [];
  const faltantes = detalles.filter((d) => d.faltante);

  return (
    <div className="page ops-note-page">
      <div className="ops-note-actions">
        <Link className="btn btn-ghost" to={`/operaciones/pedidos/${id}`}>
          ← Volver al pedido
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Imprimir nota de entrega
        </button>
      </div>

      <article className="ops-note">
        <header className="ops-note-head">
          <div className="ops-note-brand">
            <img src="/logo-aruca.png" alt="ARUCA" />
            <div>
              <strong>{empresa?.descripcion || 'Aruca Maquinarias C.A.'}</strong>
              <span>{empresa?.idfiscal || ''}</span>
              <span>{empresa?.direccionf || ''}</span>
              <span>
                {empresa?.telefono1 || ''}
                {empresa?.email ? ` · ${empresa.email}` : ''}
              </span>
            </div>
          </div>
          <div className="ops-note-title">
            <span>Nota de entrega</span>
            <strong>{pedido.numero}</strong>
            <span>{formatFecha(pedido.fecha)}</span>
            {ops?.fase === 'entregado' ? (
              <em>ENTREGADO</em>
            ) : (
              <em>PENDIENTE DE ENTREGA</em>
            )}
          </div>
        </header>

        <section className="ops-note-info">
          <div>
            <h3>Cliente</h3>
            <strong>{pedido.cliente?.nombre}</strong>
            <span>{pedido.cliente?.rif || ''}</span>
            <span>{pedido.cliente?.direccion || ''}</span>
            <span>{pedido.cliente?.telefono || ''}</span>
          </div>
          <div>
            <h3>Datos del pedido</h3>
            <span>Vendedor: {pedido.vendedor?.nombre || '—'}</span>
            <span>
              Preparación:{' '}
              {formatFecha(ops?.finalizado_en || pedido.fecha)}
            </span>
            <span>
              Validado por: {ops?.validado_por_nombre || '—'}
            </span>
            <span>
              Entregado por: {ops?.entregado_por_nombre || '—'}
            </span>
          </div>
        </section>

        <table className="ops-note-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th className="right">Cantidad</th>
              <th className="right">Precio</th>
              <th className="right">Subtotal</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {detalles.map((d, idx) => (
              <tr
                key={`${d.codigo || d.producto?.codigo}-${idx}`}
                className={d.faltante ? 'faltante' : ''}
              >
                <td>{d.producto?.codigo || ''}</td>
                <td>
                  {d.producto?.descripcion || 'Producto'}
                  {d.faltante && d.motivo_faltante && (
                    <small>Motivo: {d.motivo_faltante}</small>
                  )}
                </td>
                <td className="right">{d.cantidad}</td>
                <td className="right">{money(d.precio)}</td>
                <td className="right">{money(d.subtotal)}</td>
                <td>
                  {d.faltante ? (
                    <span className="ops-note-pending">PENDIENTE</span>
                  ) : (
                    <span className="ops-note-ok">ENTREGADO</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="ops-note-foot">
          <div className="ops-note-totals">
            <div>
              <span>Subtotal</span>
              <strong>{money(pedido.subtotal)}</strong>
            </div>
            <div>
              <span>Descuento</span>
              <strong>{money(pedido.descuento)}</strong>
            </div>
            <div>
              <span>Impuestos</span>
              <strong>{money(pedido.impuestos)}</strong>
            </div>
            <div className="total">
              <span>Total del pedido</span>
              <strong>{money(pedido.total)}</strong>
            </div>
          </div>

          <div className="ops-note-alert">
            {faltantes.length > 0 ? (
              <p>
                <strong>Hay {faltantes.length} ítem(s) pendiente(s) por entrega.</strong>{' '}
                El total corresponde al pedido completo; los ítems marcados como
                PENDIENTE no fueron entregados.
              </p>
            ) : (
              <p>Todos los ítems del pedido fueron entregados.</p>
            )}
          </div>

          <div className="ops-note-signs">
            <div>
              <span>Preparado por</span>
              <strong>{ops?.operario_nombre || ''}</strong>
            </div>
            <div>
              <span>Validado por</span>
              <strong>{ops?.validado_por_nombre || ''}</strong>
            </div>
            <div>
              <span>Recibido por</span>
              <strong>&nbsp;</strong>
            </div>
          </div>

          <p className="ops-note-footer">
            {empresa?.descripcion || 'Aruca Maquinarias C.A.'} · Nota de entrega
            generada por el módulo de operaciones
          </p>
        </footer>
      </article>
    </div>
  );
}
