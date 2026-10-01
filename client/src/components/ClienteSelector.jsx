import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';

export default function ClienteSelector({ value, onChange, autoFocus = false }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await api(`/api/clientes?q=${encodeURIComponent(q)}`);
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
  }, [q]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const seleccionado = useMemo(
    () => items.find((i) => i.id === value) || detalle,
    [items, detalle, value]
  );

  useEffect(() => {
    if (!value) {
      setDetalle(null);
      return;
    }
    if (items.some((i) => i.id === value)) {
      setDetalle(null);
      return;
    }
    api(`/api/clientes/${value}`)
      .then((d) => setDetalle(d.cliente))
      .catch(() => setDetalle(null));
  }, [value, items]);

  if (value && !open) {
    return (
      <div className="cliente-selected" ref={boxRef}>
        <div>
          <strong>{seleccionado?.nombre || `Cliente #${value}`}</strong>
          <span>
            {seleccionado?.codigo} {seleccionado?.rif ? `· ${seleccionado.rif}` : ''}{' '}
            {seleccionado?.ciudad ? `· ${seleccionado.ciudad}` : ''}
          </span>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => {
            onChange(null);
            setOpen(true);
          }}
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="combo" ref={boxRef}>
      <input
        className="input"
        autoFocus={autoFocus}
        placeholder="Buscar cliente por nombre, código, RIF o ciudad…"
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
            <div className="combo-empty">Sin clientes para “{q}”</div>
          )}
          {!loading &&
            items.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`combo-item ${c.id === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setQ('');
                }}
              >
                <strong>{c.nombre}</strong>
                <span>
                  {c.codigo} · {c.rif} · {c.ciudad}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
