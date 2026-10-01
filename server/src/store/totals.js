export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function calcOrderTotals(items, taxRate) {
  const lines = items.map((item) => {
    const cantidad = Math.max(0, Number(item.cantidad) || 0);
    const precio = round2(item.precio);
    const descuentoPct = Math.min(100, Math.max(0, Number(item.descuento) || 0));
    const bruto = round2(precio * cantidad);
    const descuentoMonto = round2((bruto * descuentoPct) / 100);
    return {
      ...item,
      cantidad,
      precio,
      descuento: descuentoPct, // porcentaje (lo usan la UI y el detalle A2)
      descuentoValor: descuentoMonto, // monto del descuento
      bruto,
      subtotal: round2(bruto - descuentoMonto)
    };
  });

  const subtotal = round2(lines.reduce((acc, l) => acc + l.bruto, 0));
  const descuento = round2(lines.reduce((acc, l) => acc + l.descuentoValor, 0));
  const base = round2(subtotal - descuento);
  const impuestos = round2(base * taxRate);
  const total = round2(base + impuestos);

  return { lines, subtotal, descuento, base, impuestos, total };
}
