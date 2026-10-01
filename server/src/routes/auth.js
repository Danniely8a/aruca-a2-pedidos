import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { store } from '../store/index.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { usuario, password } = req.body || {};
    if (!usuario || !password) {
      throw new ApiError(400, 'Usuario y contraseña son obligatorios');
    }

    const user = await store.findUserByLogin(String(usuario).trim());
    const ok = user && (await bcrypt.compare(String(password), user.password_hash));
    if (!ok) throw new ApiError(401, 'Usuario o contraseña incorrectos');

    res.json({
      token: signToken(user),
      user: { id: user.id, nombre: user.nombre, usuario: user.usuario, rol: user.rol }
    });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

export default router;
