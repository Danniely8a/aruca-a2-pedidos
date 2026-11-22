import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { ensureAppSchema } from '../db.js';
import { opsStore } from '../store/operations.js';
import { signOpsToken, requireOpsAuth, requireJefe } from '../middleware/opsAuth.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';

const router = Router();

const idPositivo = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const { usuario, password } = req.body || {};
    if (!usuario || !password) {
      throw new ApiError(400, 'Correo y contraseña son obligatorios');
    }

    // En Vercel el arranque es frío; garantiza las tablas y el jefe inicial.
    await ensureAppSchema().catch(() => {});
    await opsStore.ensureBootstrapChief();

    const operario = await opsStore.findByEmail(String(usuario).trim());
    const ok =
      operario &&
      operario.activo &&
      (await bcrypt.compare(String(password), operario.password_hash));
    if (!ok) throw new ApiError(401, 'Correo o contraseña incorrectos');

    res.json({
      token: signOpsToken(operario),
      user: {
        id: Number(operario.id),
        nombre: operario.nombre,
        email: operario.email,
        rol: operario.rol
      }
    });
  })
);

router.get(
  '/auth/me',
  requireOpsAuth,
  asyncHandler(async (req, res) => res.json({ user: req.operario }))
);

router.use(requireOpsAuth);

router.get(
  '/pedidos',
  asyncHandler(async (req, res) => {
    const esJefe = req.operario.rol === 'jefe';
    let operarioId = esJefe ? null : req.operario.id;
    if (esJefe && req.query.operario_id) {
      operarioId = idPositivo(req.query.operario_id);
      if (!operarioId) throw new ApiError(400, 'Operario inválido');
    }

    const items = await opsStore.listOrders({
      operarioId,
      estado: req.query.estado || '',
      q: req.query.q || ''
    });
    res.json({ items, total: items.length });
  })
);

router.get(
  '/pedidos/:id',
  asyncHandler(async (req, res) => {
    const pedido = await opsStore.getOrderForActor(req.params.id, req.operario);
    if (!pedido) throw new ApiError(404, 'Pedido no encontrado');

    const esJefe = req.operario.rol === 'jefe';
    const asignadoAmi =
      pedido.operario_id != null &&
      Number(pedido.operario_id) === Number(req.operario.id);
    const puedeOperar = esJefe || asignadoAmi;

    res.json({
      pedido,
      permisos: {
        asignar: esJefe && pedido.estado !== 'armado',
        iniciar:
          puedeOperar &&
          Boolean(pedido.operacion_id) &&
          !pedido.iniciado_en &&
          pedido.estado !== 'armado',
        validar: puedeOperar && Boolean(pedido.iniciado_en)
      }
    });
  })
);

router.post(
  '/pedidos/:id/asignar',
  requireJefe,
  asyncHandler(async (req, res) => {
    const operarioId = idPositivo(req.body?.operario_id);
    if (!operarioId) throw new ApiError(400, 'Selecciona un operario válido');

    const pedido = await opsStore.assignOrder(
      req.params.id,
      operarioId,
      req.operario
    );
    if (!pedido) throw new ApiError(404, 'Pedido no encontrado');
    res.json({ pedido });
  })
);

router.post(
  '/pedidos/:id/iniciar',
  asyncHandler(async (req, res) => {
    const pedido = await opsStore.startOrder(req.params.id, req.operario);
    res.json({ pedido });
  })
);

router.post(
  '/pedidos/:id/items/:itemId/validar',
  asyncHandler(async (req, res) => {
    const validado = req.body?.validado !== false;
    const pedido = await opsStore.validateItem(
      req.params.id,
      req.params.itemId,
      validado,
      req.operario
    );
    res.json({ pedido });
  })
);

router.get(
  '/operarios',
  requireJefe,
  asyncHandler(async (_req, res) => {
    const items = await opsStore.listOperarios();
    res.json({ items });
  })
);

router.post(
  '/operarios',
  requireJefe,
  asyncHandler(async (req, res) => {
    const operario = await opsStore.createOperario(req.body || {});
    res.status(201).json({ operario });
  })
);

router.patch(
  '/operarios/:id',
  requireJefe,
  asyncHandler(async (req, res) => {
    const id = idPositivo(req.params.id);
    if (!id) throw new ApiError(400, 'Operario inválido');
    const operario = await opsStore.updateOperario(id, req.body || {}, req.operario.id);
    res.json({ operario });
  })
);

router.get(
  '/reportes',
  requireJefe,
  asyncHandler(async (req, res) => {
    let operarioId = null;
    if (req.query.operario_id) {
      operarioId = idPositivo(req.query.operario_id);
      if (!operarioId) throw new ApiError(400, 'Operario inválido');
    }
    const reporte = await opsStore.getReports({
      desde: req.query.desde,
      hasta: req.query.hasta,
      operarioId
    });
    res.json(reporte);
  })
);

export default router;
