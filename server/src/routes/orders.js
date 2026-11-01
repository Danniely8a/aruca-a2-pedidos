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
      estado: req.query.estado || '',
      tipo: req.query.tipo || null
    });
    res.json({ items, total: items.length });
  })
);

router.post(
  '/pedidos',
  asyncHandler(async (req, res) => {
    const { cliente_id, observacion = '', items, vendedor_id, lista, tipo } =
      req.body || {};

    const nLista = Number(lista);
    const listaSel = Number.isInteger(nLista) && nLista >= 1 && nLista <= 6 ? nLista : null;

    const tipoRaw =
      tipo === undefined || tipo === null || tipo === '' ? 10 : Number(tipo);
    if (tipoRaw !== 9 && tipoRaw !== 10) {
      throw new ApiError(400, 'Tipo de documento no válido (9 o 10)');
    }
    const tipoSel = tipoRaw;
    const estado = tipoSel === 9 ? 'borrador' : 'enviado';

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
      const producto = await store.getProduct(raw.producto_id, listaSel);
      if (!producto || producto.activo === false) {
        throw new ApiError(400, `El producto ${raw.producto_id} no existe o está inactivo`);
      }
      const cantidad = Number(raw.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new ApiError(400, `Cantidad inválida para ${producto.descripcion}`);
      }
      const especial = listaSel ? null : await store.customerPrice(cliente.id, producto.id);
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
        descuento: 0
      });
    }

    const totales = calcOrderTotals(lineas, config.taxRate);

    const pedido = await store.createOrder({
      cliente_id: cliente.id,
      vendedor_id: responsable,
      tipo: tipoSel,
      estado,
      lista: listaSel,
      observacion: String(observacion || '').slice(0, 500),
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      impuestos: totales.impuestos,
      total: totales.total,
      detalles: totales.lines
    });

    // En PostgreSQL los totales oficiales los dejan los triggers; en modo
    // demo se usan los calculados por Node.
    const oficiales = {
      subtotal: Number(pedido.subtotal ?? totales.subtotal),
      descuento: Number(pedido.descuento ?? totales.descuento),
      impuestos: Number(pedido.impuestos ?? totales.impuestos),
      total: Number(pedido.total ?? totales.total),
      tasa: config.taxRate
    };

    res.status(201).json({
      pedido: { ...pedido, cliente },
      totales: oficiales
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
    // El comprobante necesita la ficha completa del cliente y los datos de la
    // empresa, no solo lo mínimo que trae el listado de pedidos.
    if (pedido.cliente_id) {
      const ficha = await store.getCustomer(pedido.cliente_id);
      if (ficha) pedido.cliente = { ...pedido.cliente, ...ficha };
    }
    const empresa = await store.getCompany();
    const tasa = config.taxRate;
    res.json({ pedido, empresa, tasa, currency: config.currency });
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
    const actual = await store.getOrder(req.params.id);
    if (!actual) throw new ApiError(404, 'Pedido no encontrado');
    if (actual.sync_status === true) {
      throw new ApiError(
        409,
        'El pedido ya fue sincronizado con el A2 y no se puede modificar'
      );
    }
    const pedido = await store.updateOrderEstado(req.params.id, estado);
    res.json({ pedido });
  })
);

export { round2 };
export default router;
