import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { EstadoTag } from './Dashboard.jsx';
import InformeReporte from '../components/InformeReporte.jsx';

const isoDia = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

const rangoPreset = (tipo) => {
  const hoy = new Date();
  if (tipo === 'hoy') return { desde: isoDia(hoy), hasta: isoDia(hoy) };
  if (tipo === 'semana') {
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - 6);
    return { desde: isoDia(desde), hasta: isoDia(hoy) };
  }
  if (tipo === 'mes') {
    return {
      desde: isoDia(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      hasta: isoDia(hoy)
    };
  }
  return null;
};

const etiquetaPeriodo = (periodo, agrupacion) => {
  if (agrupacion === 'mes') {
    return new Date(`${periodo}-01T00:00:00`).toLocaleDateString('es-VE', {
      month: 'short',
      year: '2-digit'
    });
  }
  return new Date(`${periodo}T00:00:00`).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short'
  });
};

const GRUPOS = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' }
];

const DETALLES = [
  { id: 'productos', label: 'Por producto' },
  { id: 'clientes', label: 'Por cliente' },
  { id: 'estados', label: 'Por estado' },
  { id: 'vendedores', label: 'Por vendedor' }
];

export default function Reports() {
  const cart = useCart();
  const { user } = useAuth();
  const inicial = rangoPreset('mes');
  const [preset, setPreset] = useState('mes');
  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);
  const [agrupacion, setAgrupacion] = useState('dia');
  const [detalle, setDetalle] = useState('productos');
  const [tipo, setTipo] = useState('10');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [informe, setInforme] = useState(false);

  useEffect(() => {
    let cancel = false;
    setError('');

    if (desde > hasta) {
      setDatos(null);
      setError('La fecha desde no puede ser mayor que la fecha hasta.');
      setCargando(false);
      return () => {
        cancel = true;
      };
    }

    setCargando(true);
    const timer = setTimeout(() => {
      const inicio = new Date(`${desde}T00:00:00`);
      const fin = new Date(`${hasta}T23:59:59.999`);
      const params = new URLSearchParams({
        desde: inicio.toISOString(),
        hasta: fin.toISOString(),
        tipo
      });
      api(`/api/reportes?${params.toString()}`)
        .then((d) => {
          if (!cancel) setDatos(d);
        })
        .catch((e) => {
          if (!cancel) {
            setError(e.message);
            setDatos(null);
          }
        })
        .finally(() => {
          if (!cancel) setCargando(false);
        });
    }, 250);

    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [desde, hasta, tipo]);

  const aplicarPreset = (tipo) => {
    setPreset(tipo);
    const rango = rangoPreset(tipo);
    if (rango) {
      setDesde(rango.desde);
      setHasta(rango.hasta);
    }
  };

  const cambiarFecha = (campo, valor) => {
    setPreset('personalizado');
    if (campo === 'desde') setDesde(valor);
    else setHasta(valor);
  };

  const money = (n) => `${cart.currency}${Number(n || 0).toFixed(2)}`;
  const resumen = datos?.resumen;
  const serie = datos?.series?.[agrupacion] || [];
  const maximo = Math.max(...serie.map((f) => f.total), 1);
  const barras =
    agrupacion === 'dia' ? serie.slice(-30) : agrupacion === 'semana' ? serie.slice(-16) : serie.slice(-12);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Reportes de documentos</h1>
          <p className="muted">
            Del {new Date(`${desde}T00:00:00`).toLocaleDateString('es-VE')} al{' '}
            {new Date(`${hasta}T00:00:00`).toLocaleDateString('es-VE')}
            {user?.rol !== 'admin' ? ' · Solo tus pedidos' : ''}
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setInforme(true)}
            disabled={!datos}
          >
            Ver informe
          </button>
        </div>
      </div>

      <div className="card report-filters">
        <div className="chips">
          <button
            className={`chip ${preset === 'hoy' ? 'active' : ''}`}
            onClick={() => aplicarPreset('hoy')}
          >
            Hoy
          </button>
          <button
            className={`chip ${preset === 'semana' ? 'active' : ''}`}
            onClick={() => aplicarPreset('semana')}
          >
            Últimos 7 días
          </button>
          <button
            className={`chip ${preset === 'mes' ? 'active' : ''}`}
            onClick={() => aplicarPreset('mes')}
          >
            Este mes
          </button>
        </div>
        <div className="report-dates">
          <label className="report-date">
            <span>Documento</span>
            <select
              className="input"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="10">Pedidos</option>
              <option value="9">Presupuestos</option>
              <option value="todos">Ambos</option>
            </select>
          </label>
          <label className="report-date">
            <span>Desde</span>
            <input
              className="input"
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => cambiarFecha('desde', e.target.value)}
            />
          </label>
          <label className="report-date">
            <span>Hasta</span>
            <input
              className="input"
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => cambiarFecha('hasta', e.target.value)}
            />
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {cargando && !datos && <p className="empty">Cargando reportes…</p>}

      {datos && (
        <>
          <div className="cards">
            <div className="card stat">
              <span>Documentos</span>
              <strong>{resumen.pedidos}</strong>
            </div>
            <div className="card stat">
              <span>Items vendidos</span>
              <strong>{resumen.items}</strong>
            </div>
            <div className="card stat">
              <span>Total facturado</span>
              <strong>{money(resumen.total)}</strong>
            </div>
            <div className="card stat">
              <span>Ticket promedio</span>
              <strong>{money(resumen.promedio)}</strong>
            </div>
          </div>

          <section className="card">
            <div className="card-head">
              <h2>Evolución de ventas</h2>
              <div className="tabs">
                {GRUPOS.map((g) => (
                  <button
                    key={g.id}
                    className={`tab ${agrupacion === g.id ? 'active' : ''}`}
                    onClick={() => setAgrupacion(g.id)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {barras.length === 0 ? (
              <p className="empty">No hay pedidos en este rango de fechas.</p>
            ) : (
              <>
                <div className="report-chart">
                  {barras.map((f) => (
                    <div className="report-bar" key={f.periodo}>
                      <div className="report-bar-track">
                        <div
                          className="report-bar-fill"
                          style={{ height: `${Math.max(4, (f.total / maximo) * 100)}%` }}
                          title={`${etiquetaPeriodo(f.periodo, agrupacion)}: ${money(f.total)}`}
                        />
                      </div>
                      <span>{etiquetaPeriodo(f.periodo, agrupacion)}</span>
                    </div>
                  ))}
                </div>

                <div className="report-totals">
                  <div>
                    <span>Subtotal</span>
                    <strong>{money(resumen.subtotal)}</strong>
                  </div>
                  <div>
                    <span>Descuentos</span>
                    <strong>{money(resumen.descuento)}</strong>
                  </div>
                  <div>
                    <span>Impuestos</span>
                    <strong>{money(resumen.impuestos)}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>{money(resumen.total)}</strong>
                  </div>
                </div>

                <div className="table-wrap report-table">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Periodo</th>
                        <th className="right">Pedidos</th>
                        <th className="right">Items</th>
                        <th className="right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serie.map((f) => (
                        <tr key={f.periodo}>
                          <td>{etiquetaPeriodo(f.periodo, agrupacion)}</td>
                          <td className="right">{f.pedidos}</td>
                          <td className="right">{f.items}</td>
                          <td className="right">
                            <strong>{money(f.total)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Detalle del reporte</h2>
              <div className="tabs">
                {DETALLES.map((d) => (
                  <button
                    key={d.id}
                    className={`tab ${detalle === d.id ? 'active' : ''}`}
                    onClick={() => setDetalle(d.id)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrap">
              {detalle === 'productos' && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Producto</th>
                      <th className="right">Cantidad</th>
                      <th className="right">Pedidos</th>
                      <th className="right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.productos.length === 0 && (
                      <tr>
                        <td colSpan={5} className="empty">
                          Sin productos en este rango.
                        </td>
                      </tr>
                    )}
                    {datos.productos.map((p) => (
                      <tr key={p.codigo}>
                        <td className="nowrap">{p.codigo}</td>
                        <td>{p.descripcion}</td>
                        <td className="right">{p.cantidad}</td>
                        <td className="right">{p.pedidos}</td>
                        <td className="right">
                          <strong>{money(p.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {detalle === 'clientes' && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>RIF</th>
                      <th className="right">Pedidos</th>
                      <th className="right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.clientes.length === 0 && (
                      <tr>
                        <td colSpan={4} className="empty">
                          Sin clientes en este rango.
                        </td>
                      </tr>
                    )}
                    {datos.clientes.map((c) => (
                      <tr key={`${c.cliente}-${c.rif}`}>
                        <td>
                          <strong>{c.cliente}</strong>
                        </td>
                        <td>{c.rif || '—'}</td>
                        <td className="right">{c.pedidos}</td>
                        <td className="right">
                          <strong>{money(c.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {detalle === 'estados' && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th className="right">Pedidos</th>
                      <th className="right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.estados.length === 0 && (
                      <tr>
                        <td colSpan={3} className="empty">
                          Sin pedidos en este rango.
                        </td>
                      </tr>
                    )}
                    {datos.estados.map((e) => (
                      <tr key={e.estado}>
                        <td>
                          <EstadoTag estado={e.estado} />
                        </td>
                        <td className="right">{e.pedidos}</td>
                        <td className="right">
                          <strong>{money(e.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {detalle === 'vendedores' && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th className="right">Pedidos</th>
                      <th className="right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.vendedores.length === 0 && (
                      <tr>
                        <td colSpan={3} className="empty">
                          Sin vendedores en este rango.
                        </td>
                      </tr>
                    )}
                    {datos.vendedores.map((v) => (
                      <tr key={v.vendedor}>
                        <td>
                          <strong>{v.vendedor}</strong>
                        </td>
                        <td className="right">{v.pedidos}</td>
                        <td className="right">
                          <strong>{money(v.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}

      {informe && datos && (
        <InformeReporte
          datos={datos}
          currency={cart.currency}
          agrupacion={agrupacion}
          tipo={tipo}
          desde={desde}
          hasta={hasta}
          usuario={user}
          onClose={() => setInforme(false)}
        />
      )}
    </div>
  );
}
