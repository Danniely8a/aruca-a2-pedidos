import { Router } from 'express';
import { store } from '../store/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const vendedorId = req.user.rol === 'admin' ? null : req.user.id;
    const stats = await store.stats({ vendedorId });
    res.json({ ...stats, moneda: process.env.CURRENCY || '$' });
  })
);

export default router;
