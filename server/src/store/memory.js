import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { round2, calcOrderTotals } from './totals.js';

const hash = (pwd) => bcrypt.hashSync(pwd, 10);

const usuarios = [
  {
    id: 1,
    nombre: 'Administrador',
    usuario: 'admin@empresa.com',
    password_hash: hash('admin123'),
    rol: 'admin',
    activo: true
  },
  {
    id: 2,
    nombre: 'Carlos Vendedor',
    usuario: 'carlos@empresa.com',
    password_hash: hash('vendedor123'),
    rol: 'vendedor',
    activo: true
  },
  {
    id: 3,
    nombre: 'María Vendedora',
    usuario: 'maria@empresa.com',
    password_hash: hash('vendedor123'),
    rol: 'vendedor',
    activo: true
  }
];

const clientes = [
  { id: 1, codigo: 'C-0001', nombre: 'Almacén El Progreso', rif: 'J-30123456-7', telefono: '0212-5550101', ciudad: 'Caracas', direccion: 'Av. Bolívar, Urb. El Rosal', vendedor_id: 2, activo: true },
  { id: 2, codigo: 'C-0002', nombre: 'Distribuidora La Fortuna', rif: 'J-30987654-3', telefono: '0241-5550202', ciudad: 'Valencia', direccion: 'Calle 50, Zona Industrial', vendedor_id: 2, activo: true },
  { id: 3, codigo: 'C-0003', nombre: 'Supermercado Doña Rosa', rif: 'J-29876543-1', telefono: '0212-5550303', ciudad: 'Caracas', direccion: 'Av. Sucre, Coche', vendedor_id: 3, activo: true },
  { id: 4, codigo: 'C-0004', nombre: 'Comercializadora Andes', rif: 'J-27654321-9', telefono: '0261-5550404', ciudad: 'Maracaibo', direccion: 'Av. 5 de Julio, Sector Norte', vendedor_id: 3, activo: true },
  { id: 5, codigo: 'C-0005', nombre: 'Tienda El Ahorro', rif: 'J-25432198-5', telefono: '0212-5550505', ciudad: 'Barquisimeto', direccion: 'Calle 20 con Av. Libertador', vendedor_id: 2, activo: true },
  { id: 6, codigo: 'C-0006', nombre: 'Mayorista El Triunfo', rif: 'J-21345678-2', telefono: '0414-5550606', ciudad: 'Maracay', direccion: 'Av. Bolívar, Choroní', vendedor_id: 3, activo: true }
];

const productos = [
  { id: 1, codigo: 'P-1001', descripcion: 'Arroz blanco 1 kg', categoria: 'Granos', unidad: 'unidad', precio: 1.25, existencia: 850, activo: true },
  { id: 2, codigo: 'P-1002', descripcion: 'Aceite vegetal 1 L', categoria: 'Aceites', unidad: 'unidad', precio: 3.4, existencia: 420, activo: true },
  { id: 3, codigo: 'P-1003', descripcion: 'Azúcar refinada 1 kg', categoria: 'Granos', unidad: 'unidad', precio: 1.1, existencia: 630, activo: true },
  { id: 4, codigo: 'P-1004', descripcion: 'Harina de trigo 1 kg', categoria: 'Granos', unidad: 'unidad', precio: 0.95, existencia: 540, activo: true },
  { id: 5, codigo: 'P-1005', descripcion: 'Leche en polvo 400 g', categoria: 'Lácteos', unidad: 'unidad', precio: 4.75, existencia: 180, activo: true },
  { id: 6, codigo: 'P-1006', descripcion: 'Queso blanco duro 1 kg', categoria: 'Lácteos', unidad: 'kg', precio: 6.9, existencia: 95, activo: true },
  { id: 7, codigo: 'P-1007', descripcion: 'Café molido 500 g', categoria: 'Bebidas', unidad: 'unidad', precio: 5.2, existencia: 260, activo: true },
  { id: 8, codigo: 'P-1008', descripcion: 'Jugo de naranja 1 L', categoria: 'Bebidas', unidad: 'unidad', precio: 1.85, existencia: 310, activo: true },
  { id: 9, codigo: 'P-1009', descripcion: 'Agua mineral 1.5 L', categoria: 'Bebidas', unidad: 'unidad', precio: 0.7, existencia: 1200, activo: true },
  { id: 10, codigo: 'P-1010', descripcion: 'Detergente en polvo 1 kg', categoria: 'Limpieza', unidad: 'unidad', precio: 2.6, existencia: 340, activo: true },
  { id: 11, codigo: 'P-1011', descripcion: 'Papel higiénico 4 u', categoria: 'Limpieza', unidad: 'paquete', precio: 1.95, existencia: 700, activo: true },
  { id: 12, codigo: 'P-1012', descripcion: 'Azúcar glas 500 g', categoria: 'Granos', unidad: 'unidad', precio: 1.4, existencia: 0, activo: true },
  { id: 13, codigo: 'P-1013', descripcion: 'Galletas surtidas 300 g', categoria: 'Snacks', unidad: 'unidad', precio: 2.15, existencia: 480, activo: true },
  { id: 14, codigo: 'P-1014', descripcion: 'Pasta dental 100 g', categoria: 'Higiene', unidad: 'unidad', precio: 1.6, existencia: 290, activo: true },
  { id: 15, codigo: 'P-1015', descripcion: 'Atún en aceite 160 g', categoria: 'Enlatados', unidad: 'unidad', precio: 2.3, existencia: 520, activo: true },
  { id: 16, codigo: 'P-1016', descripcion: 'Salsa de tomate 500 g', categoria: 'Enlatados', unidad: 'unidad', precio: 1.75, existencia: 410, activo: true }
];

const preciosClientes = [
  { cliente_id: 1, producto_id: 1, precio: 1.15 },
  { cliente_id: 1, producto_id: 2, precio: 3.15 },
  { cliente_id: 2, producto_id: 7, precio: 4.85 },
  { cliente_id: 3, producto_id: 6, precio: 6.5 }
];

const estados = ['borrador', 'enviado', 'aprobado', 'facturado', 'rechazado'];

let pedidos = [
  {
    id: 1,
    numero: 'PED-000001',
    cliente_id: 1,
    vendedor_id: 2,
    fecha: new Date(Date.now() - 86400000 * 4).toISOString(),
    estado: 'facturado',
    observacion: 'Entrega en horario de mañana',
    detalles: [
      { producto_id: 1, cantidad: 50, precio: 1.15, descuento: 0 },
      { producto_id: 2, cantidad: 30, precio: 3.15, descuento: 2 }
    ]
  },
  {
    id: 2,
    numero: 'PED-000002',
    cliente_id: 3,
    vendedor_id: 3,
    fecha: new Date(Date.now() - 86400000 * 2).toISOString(),
    estado: 'aprobado',
    observacion: '',
    detalles: [
      { producto_id: 5, cantidad: 20, precio: 4.75, descuento: 0 },
      { producto_id: 8, cantidad: 40, precio: 1.85, descuento: 0 }
    ]
  },
  {
    id: 3,
    numero: 'PED-000003',
    cliente_id: 4,
    vendedor_id: 3,
    fecha: new Date(Date.now() - 86400000).toISOString(),
    estado: 'enviado',
    observacion: 'Cliente solicita factura a nombre de la empresa',
    detalles: [{ producto_id: 10, cantidad: 25, precio: 2.6, descuento: 5 }]
  }
];

let secuenciaPedido = pedidos.length;

const decorarPedido = (p) => {
  const t = calcOrderTotals(p.detalles, config.taxRate);
  return {
    ...p,
    subtotal: t.subtotal,
    descuento: t.descuento,
    impuestos: t.impuestos,
    total: t.total,
    detalles: t.lines.map((l, i) => ({ id: i + 1, ...l }))
  };
};
pedidos = pedidos.map(decorarPedido);

const byId = (lista, id) => lista.find((x) => x.id === Number(id));

export const memoryStore = {
  mode: 'demo',
  findUserByLogin: async (login) =>
    usuarios.find(
      (u) =>
        u.usuario.toLowerCase() === String(login).toLowerCase() && u.activo
    ) || null,
  getUserById: async (id) => byId(usuarios, id) || null,

  listCategories: async () =>
    [...new Set(productos.map((p) => p.categoria))].sort(),

  listProducts: async ({ q = '', categoria = '' } = {}) => {
    const term = q.trim().toLowerCase();
    return productos.filter(
      (p) =>
        p.activo &&
        (!categoria || p.categoria === categoria) &&
        (!term ||
          p.codigo.toLowerCase().includes(term) ||
          p.descripcion.toLowerCase().includes(term) ||
          p.categoria.toLowerCase().includes(term))
    );
  },
  getProduct: async (id) => byId(productos, id) || null,

  listCustomers: async ({ q = '' } = {}) => {
    const term = q.trim().toLowerCase();
    return clientes.filter(
      (c) =>
        c.activo &&
        (!term ||
          c.nombre.toLowerCase().includes(term) ||
          c.codigo.toLowerCase().includes(term) ||
          c.rif.toLowerCase().includes(term) ||
          c.ciudad.toLowerCase().includes(term))
    );
  },
  getCustomer: async (id) => byId(clientes, id) || null,
  customerPrices: async (clienteId) =>
    preciosClientes.filter((p) => p.cliente_id === Number(clienteId)),
  customerPrice: async (clienteId, productoId) => {
    const row = preciosClientes.find(
      (p) => p.cliente_id === Number(clienteId) && p.producto_id === Number(productoId)
    );
    return row ? row.precio : null;
  },

  createOrder: async (data) => {
    secuenciaPedido += 1;
    const order = {
      id: secuenciaPedido,
      numero: `PED-${String(secuenciaPedido).padStart(6, '0')}`,
      fecha: new Date().toISOString(),
      estado: 'enviado',
      ...data
    };
    pedidos = [order, ...pedidos];
    return order;
  },
  updateOrderEstado: async (id, estado) => {
    const order = pedidos.find((p) => p.id === Number(id));
    if (!order) return null;
    order.estado = estado;
    return order;
  },
  listOrders: async ({ vendedorId = null, q = '', estado = '' } = {}) => {
    const term = q.trim().toLowerCase();
    return pedidos
      .filter((p) => (!vendedorId || p.vendedor_id === Number(vendedorId)))
      .filter((p) => !estado || p.estado === estado)
      .filter((p) => {
        if (!term) return true;
        const cliente = byId(clientes, p.cliente_id);
        return (
          p.numero.toLowerCase().includes(term) ||
          (cliente && cliente.nombre.toLowerCase().includes(term))
        );
      })
      .map((p) => ({
        ...p,
        cliente: byId(clientes, p.cliente_id),
        vendedor: byId(usuarios, p.vendedor_id)
      }));
  },
  getOrder: async (id) => {
    const p = pedidos.find((x) => x.id === Number(id));
    if (!p) return null;
    const detalles = p.detalles.map((d) => ({
      ...d,
      producto: byId(productos, d.producto_id)
    }));
    return {
      ...p,
      cliente: byId(clientes, p.cliente_id),
      vendedor: byId(usuarios, p.vendedor_id),
      detalles
    };
  },

  stats: async ({ vendedorId = null } = {}) => {
    const mes = new Date();
    mes.setDate(1);
    mes.setHours(0, 0, 0, 0);
    const propios = vendedorId
      ? pedidos.filter((p) => p.vendedor_id === Number(vendedorId))
      : pedidos;
    const delMes = propios.filter((p) => new Date(p.fecha) >= mes);
    return {
      pedidos_mes: delMes.length,
      monto_mes: round2(
        delMes.reduce((acc, p) => acc + Number(p.total || 0), 0)
      ),
      clientes: clientes.length,
      productos: productos.length,
      vendedores: usuarios.filter((u) => u.rol === 'vendedor').length
    };
  },

  estados: () => estados,

  _data: { usuarios, clientes, productos, pedidos }
};
