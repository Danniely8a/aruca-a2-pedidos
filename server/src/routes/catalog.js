import { Router } from 'express';
import { store } from '../store/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/productos',
  asyncHandler(async (req, res) => {
    const { q = '', categoria = '' } = req.query;
    const items = await store.listProducts({ q, categoria });
    res.json({ items, total: items.length });
  })
);

router.get(
  '/productos/categorias',
  asyncHandler(async (_req, res) => {
    res.json({ items: await store.listCategories() });
  })
);

router.get(
  '/clientes',
  asyncHandler(async (req, res) => {
    const { q = '' } = req.query;
    const items = await store.listCustomers({ q });
    res.json({ items, total: items.length });
  })
);

router.get(
  '/clientes/:id',
  asyncHandler(async (req, res) => {
    const cliente = await store.getCustomer(req.params.id);
    if (!cliente) throw new ApiError(404, 'Cliente no encontrado');

    let precios = [];
    if (store.customerPrices) {
      precios = await store.customerPrices(cliente.id);
    } else {
      precios = (await store.listProducts()).map((p) => ({ producto_id: p.id })).filter(Boolean);
    }
    res.json({ cliente, precios });
  })
);

export default router;
