import 'dotenv/config';

const int = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: int(process.env.PORT, 4000),
  databaseUrl: (process.env.DATABASE_URL || '').trim(),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  // Impuesto: acepta 0.16 (fracción) o 16 (porcentaje) → se normaliza a fracción
  taxRate: (() => {
    const v = int(process.env.TAX_RATE, 0.16);
    return v > 1 ? v / 100 : v;
  })(),
  currency: process.env.CURRENCY || '$',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Tipo de operación A2 que identifica los pedidos montados desde la web
  orderTipo: int(process.env.A2_TIPO_PEDIDO, 1),
  // Módulo de correlativos en arc_correlatives (si no existe, se genera solo)
  orderModule: process.env.A2_MODULO_PEDIDO || 'PEDIDO',
  // Lista de precios a usar (1..6) y si el precio ya trae impuestos
  priceLevel: Math.min(6, Math.max(1, int(process.env.A2_LISTA_PRECIO, 1))),
  priceWithTax: process.env.A2_PRECIO_CON_IMPUESTO === '1'
};
