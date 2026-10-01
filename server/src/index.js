import { app } from './app.js';
import { config } from './config.js';
import { mode } from './store/index.js';

app.listen(config.port, () => {
  console.log(`API A2 Pedidos escuchando en http://localhost:${config.port}`);
  console.log(
    `Modo de datos: ${mode === 'postgres' ? 'PostgreSQL/Supabase conectado' : 'DEMO (sin DATABASE_URL)'}`
  );
});
