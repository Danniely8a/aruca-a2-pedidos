import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { store } from '../store/index.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, rol: user.rol, nombre: user.nombre, usuario: user.usuario },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const payload = jwt.verify(token, config.jwtSecret);
    const user = await store.getUserById(payload.sub);
    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Sesión inválida o usuario inactivo' });
    }
    req.user = {
      id: user.id,
      nombre: user.nombre,
      usuario: user.usuario,
      rol: user.rol
    };
    next();
  } catch {
    res.status(401).json({ error: 'Sesión expirada, vuelve a iniciar sesión' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ error: 'Requiere permisos de administrador' });
  }
  next();
}
