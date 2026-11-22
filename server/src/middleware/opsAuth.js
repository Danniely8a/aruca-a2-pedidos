import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { opsStore } from '../store/operations.js';

export function signOpsToken(operario) {
  return jwt.sign(
    {
      sub: operario.id,
      scope: 'operaciones',
      rol: operario.rol,
      nombre: operario.nombre,
      email: operario.email
    },
    config.opsJwtSecret,
    { expiresIn: config.opsJwtExpiresIn }
  );
}

export async function requireOpsAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const payload = jwt.verify(token, config.opsJwtSecret);
    if (payload.scope !== 'operaciones') {
      return res.status(401).json({ error: 'Sesión de operaciones inválida' });
    }

    const operario = await opsStore.findById(payload.sub);
    if (!operario || !operario.activo) {
      return res.status(401).json({ error: 'Sesión inválida o usuario inactivo' });
    }

    req.operario = operario;
    next();
  } catch {
    res.status(401).json({ error: 'Sesión expirada, vuelve a iniciar sesión' });
  }
}

export function requireJefe(req, res, next) {
  if (req.operario?.rol !== 'jefe') {
    return res.status(403).json({ error: 'Requiere permisos de jefe de almacén' });
  }
  next();
}
