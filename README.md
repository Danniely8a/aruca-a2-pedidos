# A2 Pedidos — Plataforma de montaje de pedidos

Aplicación web para que los **vendedores externos** monten pedidos desde cualquier lugar sin tener el sistema A2 instalado. Lee el catálogo, clientes y precios del A2 (Supabase/PostgreSQL) y **escribe los pedidos en las tablas reales** (`arc_transacciones` + `arc_detalletranvtas`), respetando correlativos, estados y listas de precios.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + React Router |
| Backend | Node.js + Express + JWT (bcryptjs) |
| Base de datos | PostgreSQL (Supabase) sobre las tablas `arc_*` del A2 |

## Estructura

```
├── client/               # SPA React
│   ├── src/pages/        # Login, Dashboard, Products, Customers, OrderBuilder, OrderHistory, OrderDetail, Settings
│   ├── src/context/      # AuthContext, CartContext (carrito persistente), ToastContext
│   └── public/logo-aruca.png
└── server/               # API Express
    ├── src/routes/       # auth, catalog, orders, dashboard, settings
    ├── src/store/        # arc.js (Supabase) / memory.js (demo sin BD) / settings.js
    ├── sql/demo.sql      # datos de prueba
    └── scripts/          # seed y pruebas
```

## Requisitos

- Node.js 18 o superior
- Una base PostgreSQL (Supabase u otra) con las tablas `arc_*` del A2

## Instalación

```bash
# 1. Backend
cd server
npm install
cp .env.example .env      # Windows: copy .env.example .env
# Edita server/.env con tu DATABASE_URL (Supabase → Session pooler)

# 2. Frontend
cd ../client
npm install
```

### Variables de `server/.env`

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión de Supabase | `postgresql://user:pass@host:5432/postgres` |
| `JWT_SECRET` | Secreto para firmar los tokens | texto largo y aleatorio |
| `PORT` | Puerto de la API | `4000` |
| `TAX_RATE` | Impuesto: `0.16` (Venezuela) o `16` (%) | `0.16` |
| `CURRENCY` | Símbolo de moneda | `$` |
| `A2_TIPO_PEDIDO` | Valor de `trn_tipo` que identifica estos pedidos | `10` (Pedidos) |
| `A2_MODULO_PEDIDO` | Módulo en `arc_correlatives` | `Pedidos` |
| `A2_LISTA_PRECIO` | Lista de precios general (1..6) | `1` |

> Los tres `A2_*` son el **valor por defecto**: la pantalla de Configuración (solo admin)
> los puede cambiar en caliente y quedan guardados en la tabla auxiliar `app_config`.

> **Nunca subas `.env` a Git.** Ya está en `.gitignore`; solo se versiona `.env.example`.

## Cómo correr

**Desarrollo** (2 terminales):

```bash
cd server && npm run dev      # API en http://localhost:4000
cd client && npm run dev      # Front en http://localhost:5173 (proxy /api → 4000)
```

**Producción** (un solo puerto):

```bash
cd client && npm run build    # genera client/dist
cd ../server && npm start     # Express sirve API + dist en http://localhost:4000
```

Si no hay `DATABASE_URL`, la app arranca en **modo demo** (datos en memoria) para probar la interfaz.

## Datos de prueba

```bash
cd server
npm run seed:demo     # solo inserta si las tablas están VACÍAS
```

Crea 16 productos con precios, 6 clientes, 3 usuarios y 4 categorías:

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin@empresa.com` | `admin123` | admin |
| `carlos@empresa.com` | `vendedor123` | vendedor |
| `maria@empresa.com` | `vendedor123` | vendedor |

Los usuarios se guardan en `arc_users` y sus contraseñas (hash bcrypt) en la tabla auxiliar `app_accesos`, que **se crea sola** al arrancar. La app nunca modifica la estructura de las tablas del A2.

## Scripts útiles (`server/`)

| Comando | Qué hace |
|---|---|
| `npm run dev` | API con recarga automática |
| `npm run seed:demo` | Carga datos de prueba (solo si está vacío) |
| `npm run seed` | Importa `server/sql/datos.sql` (tu volcado del A2) |
| `npm run test:e2e` | Prueba end-to-end contra Supabase en un esquema aislado `a2_test` |
| `npm run db:tablas` | Lista columnas y conteos de las tablas `arc_*` |
| `npm run db:test-schema` | (Re)crea el esquema de pruebas `a2_test` |

`test:e2e` crea y elimina su propio esquema `a2_test`; **nunca escribe en tus tablas reales**.

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | `{ usuario, password }` → token JWT |
| GET | `/api/auth/me` | Usuario del token |
| GET | `/api/productos?q=&categoria=&lista=` | Catálogo con precio de la lista indicada (1..6) o la lista por defecto |
| GET | `/api/productos/categorias` | Categorías |
| GET | `/api/clientes?q=` | Clientes con zona y vendedor |
| POST | `/api/clientes` | Registra cliente nuevo (nombre, RIF, teléfono, dirección, correo, estado, tipo de contribuyente) |
| GET | `/api/clientes/:id` | Cliente + precios especiales de su lista |
| POST | `/api/pedidos` | Crea pedido (cliente, items, precios, descuentos; `lista` opcional 1..6) |
| GET | `/api/pedidos?todos=1` | Historial (admin ve todos) |
| GET | `/api/pedidos/:id` | Detalle con líneas del A2 |
| PATCH | `/api/pedidos/:id/estado` | Cambia estado (solo admin) |
| GET | `/api/dashboard` | KPIs del mes |
| GET | `/api/reportes?desde=&hasta=` | Reportes por rango: resumen, series diaria/semanal/mensual, productos, clientes, estados y vendedores |
| GET/PUT | `/api/settings/empresa` | Datos de `arc_company` (solo admin) |
| GET/POST/PUT/DELETE | `/api/settings/correlativos` | CRUD de `arc_correlatives` (solo admin) |
| GET/POST/PUT/DELETE | `/api/settings/tipos` | CRUD de `arc_tipo_operacion` (solo admin) |
| GET/POST/PUT/DELETE | `/api/settings/usuarios` | CRUD de `arc_users` + contraseña en `app_accesos` |
| PUT | `/api/settings/usuarios/:id/password` | Cambia la contraseña |
| GET/PUT | `/api/settings/config` | Tipo de operación, módulo y lista de precios |

## Configuración (solo administradores)

La ruta `/configuracion` (menú visible solo con `usr_rol = 'admin'`) administra:

| Pestaña | Tabla | Acciones |
|---|---|---|
| Empresa | `arc_company` | ver / editar la única fila |
| Plataforma | `app_config` | tipo de operación del pedido (10 = *Pedidos*), módulo de correlativo y lista de precios general |
| Correlativos | `arc_correlatives` | ver / editar / crear / borrar (`cor_modname` debe existir en `arc_tipo_operacion`) |
| Tipo de operación | `arc_tipo_operacion` | ver / editar / crear / borrar (`tip_id` se asigna con max+1) |
| Usuarios | `arc_users` + `app_accesos` | ver / editar / crear / borrar, y cambiar la contraseña |

Todo lo que se cambia ahí aplica de inmediato a la API (la config se cachea 30 s y se
invalida al guardar). Los endpoints responden `401` sin token y `403` a los vendedores.

## Reglas de negocio

- **IVA**: se calcula sobre `subtotal − descuento`. `TAX_RATE=0.16`.
- **Listas de precios**: de `arc_inv_costos_precios` (columnas `icp_p01…icp_p06…`). Si el cliente tiene `cli_preciodefecto` distinto a la lista general, la API devuelve esos precios como especiales y el carrito los usa automáticamente.
- **Estados** (`trn_status`, códigos 1..5): `borrador` 1, `aprobado` 2, `facturado` 3, `enviado` 4 y `rechazado` 5. Los pedidos creados desde la web quedan en **4 (enviado)**. Solo un admin cambia el estado.
- **Números de documento**: desde `arc_correlatives` (`cor_modname='Pedidos'`, configurable en `/configuracion`); si no existe el módulo, genera la secuencia solo.
- **Escritura transaccional**: cada pedido se inserta con `BEGIN … COMMIT` (cabecera + líneas) y se revierte ante cualquier error.
- **Mapeo A2 del detalle**: `dtv_operacion_autoincrement` enlaza con `trn_autoincrement`; `dtv_autoincrement`/`dtv_base_autoincrement` son únicos por línea, `dtv_linea` empieza en 0 y `dtv_status` copia el estado del pedido.
- **Impuestos en el detalle**: `dtv_impuesto1=16`, `dtv_montoimpuesto1` se guarda **por unidad** y `dtv_preciodeventa = dtv_preciocondescuento + dtv_montoimpuesto1`.
- **Vendedor**: se resuelve por nombre contra `arc_vendedores.vnd_codigo` (no con `arc_users.usr_codigo`).
- **Valores por defecto del mapeo**: moneda 2, moneda de pago 2, depósito 1, serie `WEB`, máquina `WEB`, origen de precio 3. Se configuran con `A2_MONEDA`, `A2_MONEDA_PAGO`, `A2_DEPOSITO`, `A2_SERIE` y `A2_MAQUINA`.
- **Tablas auxiliares de la app**: `app_accesos` (contraseñas bcrypt), `app_config` (parámetros de la plataforma) y `app_clientes_extra` (correo y tipo de contribuyente). Se crean solas al arrancar; las tablas `arc_*` del A2 **nunca cambian de estructura**.
