import { Router } from 'express';
import { store } from '../store/index.js';
import { config } from '../config.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { calcOrderTotals, round2 } from '../store/totals.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/estados',
  asyncHandler(async (_req, res) => res.json({ items: store.estados() }))
);

router.get(
  '/pedidos',
  asyncHandler(async (req, res) => {
    const esAdmin = req.user.rol === 'admin';
    const vendedorId = esAdmin && req.query.todos === '1' ? null : req.user.id;
    const items = await store.listOrders({
      vendedorId,
      q: req.query.q || '',
      estado: req.query.estado || ''
    });
    res.json({ items, total: items.length });
  })
);

router.post(
  '/pedidos',
  asyncHandler(async (req, res) => {
    const { cliente_id, observacion = '', items, vendedor_id } = req.body || {};

    if (!cliente_id) throw new ApiError(400, 'Debes seleccionar un cliente');
    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'El pedido debe tener al menos un producto');
    }

    const cliente = await store.getCustomer(cliente_id);
    if (!cliente || cliente.activo === false) {
      throw new ApiError(404, 'Cliente no encontrado o inactivo');
    }

    const responsable =
      req.user.rol === 'admin' && vendedor_id ? Number(vendedor_id) : req.user.id;

    const lineas = [];
    for (const raw of items) {
      const producto = await store.getProduct(raw.producto_id);
      if (!producto || producto.activo === false) {
        throw new ApiError(400, `El producto ${raw.producto_id} no existe o está inactivo`);
      }
      const cantidad = Number(raw.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new ApiError(400, `Cantidad inválida para ${producto.descripcion}`);
      }
      const especial = await store.customerPrice(cliente.id, producto.id);
      const precioCatalogo =
        producto.precio != null && Number.isFinite(Number(producto.precio))
          ? Number(producto.precio)
          : null;
      const precio = especial ?? precioCatalogo ?? Number(raw.precio);
      if (!Number.isFinite(precio) || precio < 0) {
        throw new ApiError(
          400,
          `Falta el precio de ${producto.descripcion} (no está definido en el catálogo)`
        );
      }
      lineas.push({
        producto_id: producto.id,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        unidad: producto.unidad,
        cantidad,
        precio,
        descuento: Math.min(100, Math.max(0, Number(raw.descuento) || 0))
      });
    }

    const totales = calcOrderTotals(lineas, config.taxRate);

    const pedido = await store.createOrder({
      cliente_id: cliente.id,
      vendedor_id: responsable,
      estado: 'enviado',
      observacion: String(observacion || '').slice(0, 500),
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      impuestos: totales.impuestos,
      total: totales.total,
      detalles: totales.lines
    });

    res.status(201).json({
      pedido: { ...pedido, cliente },
      totales: {
        subtotal: totales.subtotal,
        descuento: totales.descuento,
        impuestos: totales.impuestos,
        total: totales.total,
        tasa: config.taxRate
      }
    });
  })
);

router.get(
  '/pedidos/:id',
  asyncHandler(async (req, res) => {
    const pedido = await store.getOrder(req.params.id);
    if (!pedido) throw new ApiError(404, 'Pedido no encontrado');
    if (req.user.rol !== 'admin' && pedido.vendedor_id !== req.user.id) {
      throw new ApiError(403, 'No tienes acceso a este pedido');
    }
    const tasa = config.taxRate;
    res.json({ pedido, tasa, currency: config.currency });
  })
);

router.patch(
  '/pedidos/:id/estado',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { estado } = req.body || {};
    if (!store.estados().includes(estado)) {
      throw new ApiError(400, 'Estado no válido');
    }
    const pedido = await store.updateOrderEstado(req.params.id, estado);
    if (!pedido) throw new ApiError(404, 'Pedido no encontrado');
    res.json({ pedido });
  })
);

export { round2 };
export default router;
