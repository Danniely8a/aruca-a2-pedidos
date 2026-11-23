import { Link } from 'react-router-dom';
import {
  DuracionPedido,
  EstadoOps,
  FaltanteTag,
  formatFecha,
  formatFechaHora
} from '../ui.jsx';

export default function OrderCard({ pedido, esJefe, onAsignar }) {
  const pendiente = pedido.estado === 'pendiente';

  return (
    <article className="ops-order-card">
      <div className="ops-order-card-top">
        <Link className="ops-order-card-link" to={`/operaciones/pedidos/${pedido.id}`}>
          <strong>{pedido.numero}</strong>
          <span>{formatFecha(pedido.fecha)}</span>
        </Link>
        <div className="ops-order-card-tags">
          <EstadoOps
            estado={pedido.estado}
            parcial={pedido.armado_parcial}
          />
          <FaltanteTag count={pedido.items_faltantes} />
        </div>
      </div>

      <div className="ops-order-card-client">{pedido.cliente?.nombre}</div>
      {pedido.cliente?.codigo && (
        <div className="muted ops-small">{pedido.cliente.codigo}</div>
      )}

      <div className="ops-order-card-seller">
        <span>Vendedor</span>
        <strong>{pedido.vendedor?.nombre || '—'}</strong>
      </div>

      {pedido.asignado_en && (
        <div className="ops-order-card-assigned">
          <span>Asignado</span>
          <strong>{formatFechaHora(pedido.asignado_en)}</strong>
        </div>
      )}

      <div className="ops-order-card-grid">
        {esJefe && (
          <div>
            <span>Operario</span>
            <strong>{pedido.operario_nombre || 'Sin asignar'}</strong>
          </div>
        )}
        <div>
          <span>Artículos</span>
          <strong>
            {pedido.items_validados}/{pedido.items_total}
          </strong>
        </div>
        <div>
          <span>Tiempo</span>
          <strong>
            <DuracionPedido
              iniciado_en={pedido.iniciado_en}
              finalizado_en={pedido.finalizado_en}
              duracion_segundos={pedido.duracion_segundos}
            />
          </strong>
        </div>
      </div>

      <div className="ops-order-card-foot">
        <Link className="btn btn-sm btn-ghost" to={`/operaciones/pedidos/${pedido.id}`}>
          Abrir
        </Link>
        {esJefe && pendiente && onAsignar && (
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onAsignar(pedido)}
          >
            Asignar
          </button>
        )}
      </div>
    </article>
  );
}
