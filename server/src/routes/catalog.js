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

router.post(
  '/clientes',
  asyncHandler(async (req, res) => {
    const {
      nombre = '',
      rif = '',
      telefono = '',
      direccion = '',
      correo = '',
      estado = 'activo',
      tipo_contribuyente = 'ordinario',
      moneda = 'USD'
    } = req.body || {};

    if (!String(nombre).trim()) throw new ApiError(400, 'El nombre del cliente es obligatorio');
    if (!String(rif).trim()) throw new ApiError(400, 'El RIF del cliente es obligatorio');
    if (!['activo', 'inactivo'].includes(estado)) {
      throw new ApiError(400, 'Estado del cliente no válido');
    }
    if (!['especial', 'ordinario'].includes(tipo_contribuyente)) {
      throw new ApiError(400, 'Tipo de contribuyente no válido');
    }
    if (String(correo).trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo).trim())) {
      throw new ApiError(400, 'El correo del cliente no es válido');
    }

    const existente = await store.findCustomerByRif(rif);
    if (existente) {
      throw new ApiError(409, `Ya existe un cliente con el RIF ${rif} (${existente.nombre})`);
    }

    const cliente = await store.createCustomer({
      nombre: String(nombre).trim(),
      rif: String(rif).trim(),
      telefono: String(telefono).trim(),
      direccion: String(direccion).trim(),
      correo: String(correo).trim(),
      estado,
      tipo_contribuyente,
      moneda,
      vendedor_id: req.user.id
    });

    res.status(201).json({ cliente });
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
