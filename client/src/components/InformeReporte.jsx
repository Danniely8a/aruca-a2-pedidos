import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const etiquetaPeriodo = (periodo, agrupacion) => {
  if (agrupacion === 'mes') {
    return new Date(`${periodo}-01T00:00:00`).toLocaleDateString('es-VE', {
      month: 'long',
      year: 'numeric'
    });
  }
  return new Date(`${periodo}T00:00:00`).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const fechaLarga = (valor) => {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

const NOMBRE_GRUPO = { dia: 'Diario', semana: 'Semanal', mes: 'Mensual' };

export default function InformeReporte({
  datos,
  currency = '$',
  agrupacion = 'dia',
  tipo = '10',
  desde,
  hasta,
  usuario,
  onClose
}) {
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const alTeclear = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', alTeclear);

    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', alTeclear);
    };
  }, [onClose]);

  if (!datos) return null;

  const empresa = datos.empresa || {};
  const resumen = datos.resumen || {};
  const serie = datos.series?.[agrupacion] || [];
  const money = (n) => `${currency}${Number(n || 0).toFixed(2)}`;
  const generado = new Date().toLocaleString('es-VE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return createPortal(
    <div
      className="informe-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="informe-shell">
        <div className="informe-toolbar">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cerrar
          </button>
          <button className="btn btn-primary" type="button" onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </button>
        </div>

        <article className="informe">
          <header className="informe-head">
            <div className="informe-brand">
              <img src="/logo-aruca.png" alt="ARUCA" />
              <div>
                <strong>{empresa.descripcion || 'ARUCA'}</strong>
                <span>
                  {empresa.idfiscal ? `RIF: ${empresa.idfiscal}` : ''}
                  {empresa.codigo ? ` · Código: ${empresa.codigo}` : ''}
                </span>
                <span>{empresa.direccion || ''}</span>
                <span>
                  {[empresa.telefono1, empresa.email].filter(Boolean).join(' · ')}
                </span>
              </div>
            </div>
            <div className="informe-meta">
              <span className="informe-kicker">
                {tipo === '9'
                  ? 'Informe de presupuestos'
                  : tipo === 'todos'
                    ? 'Informe de pedidos y presupuestos'
                    : 'Informe de pedidos'}
              </span>
              <strong>
                {fechaLarga(desde)} — {fechaLarga(hasta)}
              </strong>
              <span>Agrupación: {NOMBRE_GRUPO[agrupacion] || agrupacion}</span>
              <span>Generado: {generado}</span>
              {usuario?.nombre && <span>Usuario: {usuario.nombre}</span>}
            </div>
          </header>

          <section className="informe-resumen">
            <div>
              <span>Pedidos</span>
              <strong>{resumen.pedidos || 0}</strong>
            </div>
            <div>
              <span>Items vendidos</span>
              <strong>{resumen.items || 0}</strong>
            </div>
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
          </section>

          <section className="informe-section">
            <h2>Evolución {NOMBRE_GRUPO[agrupacion]?.toLowerCase()}</h2>
            <table>
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th className="right">Pedidos</th>
                  <th className="right">Items</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {serie.length === 0 && (
                  <tr>
                    <td colSpan={4}>Sin pedidos en el periodo.</td>
                  </tr>
                )}
                {serie.map((f) => (
                  <tr key={f.periodo}>
                    <td>{etiquetaPeriodo(f.periodo, agrupacion)}</td>
                    <td className="right">{f.pedidos}</td>
                    <td className="right">{f.items}</td>
                    <td className="right">{money(f.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="right">{resumen.pedidos || 0}</td>
                  <td className="right">{resumen.items || 0}</td>
                  <td className="right">{money(resumen.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="informe-section">
            <h2>Ventas por producto</h2>
            <table>
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
                    <td colSpan={5}>Sin productos en el periodo.</td>
                  </tr>
                )}
                {datos.productos.map((p) => (
                  <tr key={p.codigo}>
                    <td>{p.codigo}</td>
                    <td>{p.descripcion}</td>
                    <td className="right">{p.cantidad}</td>
                    <td className="right">{p.pedidos}</td>
                    <td className="right">{money(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="informe-section">
            <h2>Ventas por cliente</h2>
            <table>
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
                    <td colSpan={4}>Sin clientes en el periodo.</td>
                  </tr>
                )}
                {datos.clientes.map((c) => (
                  <tr key={`${c.cliente}-${c.rif}`}>
                    <td>{c.cliente}</td>
                    <td>{c.rif || '—'}</td>
                    <td className="right">{c.pedidos}</td>
                    <td className="right">{money(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="informe-dos">
            <section className="informe-section">
              <h2>Por estado</h2>
              <table>
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
                      <td colSpan={3}>Sin datos.</td>
                    </tr>
                  )}
                  {datos.estados.map((e) => (
                    <tr key={e.estado}>
                      <td className="capitalize">{e.estado}</td>
                      <td className="right">{e.pedidos}</td>
                      <td className="right">{money(e.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="informe-section">
              <h2>Por vendedor</h2>
              <table>
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
                      <td colSpan={3}>Sin datos.</td>
                    </tr>
                  )}
                  {datos.vendedores.map((v) => (
                    <tr key={v.vendedor}>
                      <td>{v.vendedor}</td>
                      <td className="right">{v.pedidos}</td>
                      <td className="right">{money(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <footer className="informe-foot">
            <span>
              {[empresa.descripcion, empresa.telefono1, empresa.email]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span>Informe generado automáticamente por la plataforma A2 Pedidos</span>
          </footer>
        </article>
      </div>
    </div>,
    document.body
  );
}
