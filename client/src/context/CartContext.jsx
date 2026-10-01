import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const CartContext = createContext(null);
const STORAGE_KEY = 'a2_cart';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const emptyCart = { cliente: null, precios: {}, items: [], observacion: '' };

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCart;
    const parsed = JSON.parse(raw);
    return { ...emptyCart, ...parsed, precios: parsed.precios || {} };
  } catch {
    return emptyCart;
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(load);
  const [taxRate, setTaxRate] = useState(0.16);
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    api('/api/health', { auth: false })
      .then((h) => {
        if (typeof h.taxRate === 'number') setTaxRate(h.taxRate);
        if (h.currency) setCurrency(h.currency);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const priceOf = (linea) => {
    const especial = cart.precios[linea.producto.id];
    if (especial != null) return Number(especial);
    if (linea.precio != null && linea.precio !== '') return Number(linea.precio);
    if (linea.producto.precio != null) return Number(linea.producto.precio);
    return 0;
  };

  const value = useMemo(() => {
    const lines = cart.items.map((item) => {
      const precio = priceOf(item);
      const bruto = round2(precio * item.cantidad);
      const desc = round2((bruto * (item.descuento || 0)) / 100);
      return {
        ...item,
        precio,
        precioManual: item.precio,
        esEspecial: cart.precios[item.producto.id] != null,
        bruto,
        descuentoValor: desc,
        subtotal: round2(bruto - desc)
      };
    });

    const subtotal = round2(lines.reduce((a, l) => a + l.bruto, 0));
    const descuento = round2(lines.reduce((a, l) => a + l.descuentoValor, 0));
    const base = round2(subtotal - descuento);
    const impuestos = round2(base * taxRate);
    const total = round2(base + impuestos);

    return {
      ...cart,
      taxRate,
      currency,
      lines,
      subtotal,
      descuento,
      base,
      impuestos,
      total,
      count: lines.reduce((a, l) => a + l.cantidad, 0),

      async setCliente(cliente) {
        if (!cliente) {
          setCart((c) => ({ ...c, cliente: null, precios: {} }));
          return;
        }
        setCart((c) => ({ ...c, cliente }));
        try {
          const data = await api(`/api/clientes/${cliente.id}`);
          const mapa = {};
          (data.precios || []).forEach((p) => {
            mapa[p.producto_id] = Number(p.precio);
          });
          setCart((c) => ({ ...c, cliente, precios: mapa }));
        } catch {
          setCart((c) => ({ ...c, cliente, precios: {} }));
        }
      },
      addItem(producto, cantidad = 1) {
        setCart((c) => {
          const existe = c.items.find((i) => i.producto.id === producto.id);
          if (existe) {
            return {
              ...c,
              items: c.items.map((i) =>
                i.producto.id === producto.id
                  ? { ...i, cantidad: i.cantidad + cantidad }
                  : i
              )
            };
          }
          return {
            ...c,
            items: [
              ...c.items,
              {
                producto,
                cantidad,
                descuento: 0,
                precio: producto.precio != null ? Number(producto.precio) : null
              }
            ]
          };
        });
      },
      setPrecio(id, precio) {
        setCart((c) => ({
          ...c,
          items: c.items.map((i) =>
            i.producto.id === id
              ? { ...i, precio: precio === '' ? null : Math.max(0, Number(precio) || 0) }
              : i
          )
        }));
      },
      setCantidad(id, cantidad) {
        setCart((c) => ({
          ...c,
          items: c.items.map((i) =>
            i.producto.id === id
              ? { ...i, cantidad: Math.max(0, Number(cantidad) || 0) }
              : i
          )
        }));
      },
      setDescuento(id, descuento) {
        setCart((c) => ({
          ...c,
          items: c.items.map((i) =>
            i.producto.id === id
              ? { ...i, descuento: Math.min(100, Math.max(0, Number(descuento) || 0)) }
              : i
          )
        }));
      },
      removeItem(id) {
        setCart((c) => ({ ...c, items: c.items.filter((i) => i.producto.id !== id) }));
      },
      setObservacion(observacion) {
        setCart((c) => ({ ...c, observacion }));
      },
      clear() {
        setCart((c) => ({ ...emptyCart, cliente: c.cliente, precios: c.precios }));
      },
      reset() {
        setCart(emptyCart);
      }
    };
  }, [cart, taxRate, currency]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
