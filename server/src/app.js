import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { isConnected, ensureAppSchema } from './db.js';
import { mode } from './store/index.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import orderRoutes from './routes/orders.js';
import dashboardRoutes from './routes/dashboard.js';
import { ApiError } from './middleware/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(
  cors({
    origin: [config.clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode,
    connected: isConnected,
    taxRate: config.taxRate,
    currency: config.currency
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', orderRoutes);
app.use('/api', dashboardRoutes);

// En local (fuera de Vercel) Express también sirve el build del cliente.
const dist = path.resolve(__dirname, '../../client/dist');
if (!process.env.VERCEL && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.path}` }));

app.use((err, _req, res, _next) => {
  const status = err instanceof ApiError ? err.status : err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.message || 'Error interno del servidor' });
});

ensureAppSchema().catch((e) => console.warn('[app_accesos]', e.message));
