import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';

export default function ProductoBuscador({ onSelect, lista, tipo = 10 }) {
  const cart = useCart();
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q });
        if (lista) params.set('lista', lista);
        const data = await api(`/api/productos?${params.toString()}`);
        if (!cancel) setItems(data.items || []);
      } catch {
        if (!cancel) setItems([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    }, 220);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [q, lista]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="combo" ref={boxRef}>
      <input
        className="input"
        placeholder="Buscar producto por código, descripción o categoría…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="combo-list">
          {loading && <div className="combo-empty">Buscando…</div>}
          {!loading && items.length === 0 && (
            <div className="combo-empty">Sin productos para “{q}”</div>
          )}
          {!loading &&
            items.map((p) => {
              const existencia = Number(p.existencia) || 0;
              const disponible = Number(p.disponible ?? existencia) || 0;
              const sinDisponible = tipo === 10 && disponible <= 0;
              const enPedido = cart.items.find((i) => i.producto.id === p.id);
              const money = (n) =>
                n == null ? '—' : `${cart.currency}${Number(n).toFixed(2)}`;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="combo-item"
                  disabled={sinDisponible}
                  onClick={() => {
                    onSelect(p);
                    setQ('');
                    setOpen(false);
                  }}
                >
                  <strong>
                    {p.codigo} · {p.descripcion}
                    {Number(p.precio) === 0 && (
                      <span className="tag tag-precio-cero">Precio 0</span>
                    )}
                  </strong>
                  <span>
                    Detal {money(p.precio_detal)} · Mayor {money(p.precio_mayor)}
                    {' · '}
                    Disp. {disponible} {p.unidad}(es)
                    {' · '}
                    Exist. {existencia}
                    {enPedido ? ` · ${enPedido.cantidad} en el documento` : ''}
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
