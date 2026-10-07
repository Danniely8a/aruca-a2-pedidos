import { Router } from 'express';
import { settingsStore } from '../store/settings.js';
import { ensureAppSchema } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';

const router = Router();

const id = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ApiError(400, 'Identificador inválido');
  return n;
};

const wrap = (fn) =>
  asyncHandler(async (req, res) => {
    try {
      await ensureAppSchema().catch(() => {});
      res.json(await fn(req));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(400, e.message || 'No se pudo completar la operación');
    }
  });

router.use(requireAuth, requireAdmin);

// Empresa
router.get('/empresa', wrap(() => settingsStore.getCompany()));
router.put('/empresa', wrap((req) => settingsStore.updateCompany(req.body || {})));

// Correlativos
router.get('/correlativos', wrap(() => settingsStore.listCorrelativos()));
router.post('/correlativos', wrap((req) => settingsStore.createCorrelativo(req.body || {})));
router.put(
  '/correlativos/:id',
  wrap((req) => settingsStore.updateCorrelativo(id(req.params.id), req.body || {}))
);
router.delete(
  '/correlativos/:id',
  wrap((req) => settingsStore.deleteCorrelativo(id(req.params.id)))
);

// Tipos de operación
router.get('/tipos', wrap(() => settingsStore.listTipos()));
router.post('/tipos', wrap((req) => settingsStore.createTipo(req.body || {})));
router.put('/tipos/:id', wrap((req) => settingsStore.updateTipo(id(req.params.id), req.body || {})));
router.delete('/tipos/:id', wrap((req) => settingsStore.deleteTipo(id(req.params.id))));

// Usuarios
router.get('/usuarios', wrap(() => settingsStore.listUsers()));
router.post('/usuarios', wrap((req) => settingsStore.createUser(req.body || {})));
router.put(
  '/usuarios/:id',
  wrap((req) => settingsStore.updateUser(id(req.params.id), req.body || {}))
);
router.put(
  '/usuarios/:id/password',
  wrap((req) => settingsStore.setUserPassword(id(req.params.id), (req.body || {}).password))
);
router.delete(
  '/usuarios/:id',
  wrap((req) => {
    if (Number(req.params.id) === Number(req.user.id)) {
      throw new ApiError(400, 'No puedes eliminar tu propio usuario');
    }
    return settingsStore.deleteUser(id(req.params.id));
  })
);

// Configuración de la plataforma
router.get('/config', wrap(() => settingsStore.getConfig()));
router.put('/config', wrap((req) => settingsStore.setConfig(req.body || {})));

export default router;
