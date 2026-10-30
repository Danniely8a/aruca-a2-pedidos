import { Router } from 'express';
import { store } from '../store/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';

const router = Router();
router.use(requireAuth);

const fecha = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

router.get(
  '/reportes',
  asyncHandler(async (req, res) => {
    const desde = fecha(req.query.desde);
    const hasta = fecha(req.query.hasta);

    if (!desde || !hasta) {
      throw new ApiError(400, 'Indica una fecha desde y una fecha hasta válidas');
    }
    if (new Date(desde) > new Date(hasta)) {
      throw new ApiError(400, 'La fecha desde no puede ser mayor que la fecha hasta');
    }

    const vendedorId = req.user.rol === 'admin' ? null : req.user.id;
    const reporte = await store.reportes({ desde, hasta, vendedorId });
    res.json(reporte);
  })
);

export default router;
