-- =====================================================================
-- Esquema de la plataforma de pedidos A2
-- Ejecútalo en DBeaver / Supabase SQL Editor (idempotente: puedes
-- correrlo las veces que necesites).
-- =====================================================================

create table if not exists usuarios (
  id            serial primary key,
  nombre        text not null,
  usuario       text not null unique,
  password_hash text not null,
  rol           text not null default 'vendedor' check (rol in ('admin','vendedor')),
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

create table if not exists clientes (
  id          serial primary key,
  codigo      text not null unique,
  nombre      text not null,
  rif         text,
  telefono    text,
  ciudad      text,
  direccion   text,
  vendedor_id integer references usuarios(id),
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table if not exists productos (
  id         serial primary key,
  codigo     text not null unique,
  descripcion text not null,
  categoria  text,
  unidad     text not null default 'unidad',
  precio     numeric(14,2) not null default 0,
  existencia numeric(14,2) not null default 0,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create table if not exists precios_cliente (
  id          serial primary key,
  cliente_id  integer not null references clientes(id) on delete cascade,
  producto_id integer not null references productos(id) on delete cascade,
  precio      numeric(14,2) not null,
  unique (cliente_id, producto_id)
);

create table if not exists pedidos (
  id          serial primary key,
  numero      text not null unique,
  cliente_id  integer not null references clientes(id),
  vendedor_id integer not null references usuarios(id),
  fecha       timestamptz not null default now(),
  estado      text not null default 'enviado'
              check (estado in ('borrador','enviado','aprobado','facturado','rechazado')),
  observacion text,
  subtotal    numeric(14,2) not null default 0,
  descuento   numeric(14,2) not null default 0,
  impuestos   numeric(14,2) not null default 0,
  total       numeric(14,2) not null default 0
);

create table if not exists pedido_detalles (
  id          serial primary key,
  pedido_id   integer not null references pedidos(id) on delete cascade,
  producto_id integer not null references productos(id),
  cantidad    numeric(14,2) not null,
  precio      numeric(14,2) not null,
  descuento   numeric(5,2)  not null default 0,
  subtotal    numeric(14,2) not null
);

create index if not exists idx_clientes_nombre   on clientes using gin (to_tsvector('spanish', nombre));
create index if not exists idx_productos_nombre  on productos using gin (to_tsvector('spanish', descripcion));
create index if not exists idx_pedidos_fecha     on pedidos (fecha desc);
create index if not exists idx_pedidos_vendedor  on pedidos (vendedor_id);

-- Secuencia para números de pedido (PED-000001, PED-000002, ...)
create sequence if not exists seq_pedido start 1;
