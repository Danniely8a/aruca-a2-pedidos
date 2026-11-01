import { useEffect, useState } from 'react';

const W = 900;
const M = 44;
const CONTENT = W - M * 2;
const SCALE = 2;
const AZUL = '#0d387c';
const TEXTO = '#16202e';
const MUTED = '#545f70';
const BORDE = '#e3e8f0';
const FONDO = '#f7f9ff';

const money = (currency, value) => `${currency}${Number(value || 0).toFixed(2)}`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function fitText(ctx, text, maxWidth) {
  let value = String(text || '');
  if (ctx.measureText(value).width <= maxWidth) return value;
  while (value.length && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

function cargarLogo() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/logo-aruca.png';
  });
}

function fechaPedido(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' });
}

async function crearImagen({ pedido, empresa, currency }) {
  const items = pedido?.detalles || [];
  const descX = 136;
  const descW = 400;

  const probe = document.createElement('canvas').getContext('2d');
  probe.font = '13px "Segoe UI", Arial, sans-serif';
  const filas = items.map((item) => {
    const lineas = wrapLines(
      probe,
      item.producto?.descripcion || `Producto ${item.producto?.codigo || ''}`,
      descW
    );
    return { ...item, lineas, alto: Math.max(38, lineas.length * 17 + 20) };
  });

  const headerAlto = 158;
  const clienteAlto = 132;
  const tablaAlto = 34 + filas.reduce((acc, f) => acc + f.alto, 0);
  const totalesAlto = 150;
  const footerAlto = 84;

  const yCliente = headerAlto + 22;
  const yTabla = yCliente + clienteAlto + 24;
  const yTotales = yTabla + tablaAlto + 22;
  const yFooter = yTotales + totalesAlto + 20;
  const H = yFooter + footerAlto;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // ---------------------------------------------------------- Membrete
  ctx.fillStyle = AZUL;
  ctx.fillRect(0, 0, W, 8);

  const logo = await cargarLogo();
  if (logo?.width) {
    const box = 62;
    const escala = Math.min(box / logo.width, box / logo.height);
    const lw = logo.width * escala;
    const lh = logo.height * escala;
    ctx.drawImage(logo, M + (box - lw) / 2, 32 + (box - lh) / 2, lw, lh);
  }

  const empresaNombre = empresa?.descripcion || 'ARUCA';
  ctx.fillStyle = TEXTO;
  ctx.font = '700 23px "Segoe UI", Arial, sans-serif';
  ctx.fillText(fitText(ctx, empresaNombre, 430), 120, 58);

  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = MUTED;
  const rif = empresa?.idfiscal ? `RIF: ${empresa.idfiscal}` : '';
  const codigo = empresa?.codigo ? `Código: ${empresa.codigo}` : '';
  ctx.fillText([rif, codigo].filter(Boolean).join('   ·   '), 120, 77);

  const dirLineas = wrapLines(ctx, empresa?.direccion || '', 430).slice(0, 2);
  dirLineas.forEach((linea, i) => ctx.fillText(linea, 120, 95 + i * 15));

  const contacto = [empresa?.telefono1, empresa?.email].filter(Boolean).join('   ·   ');
  ctx.fillText(fitText(ctx, contacto, 430), 120, 95 + dirLineas.length * 15);

  ctx.textAlign = 'right';
  ctx.fillStyle = MUTED;
  ctx.font = '700 10.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText(
    pedido?.tipo === 9 ? 'PRESUPUESTO' : 'COMPROBANTE DE PEDIDO',
    W - M,
    40
  );
  ctx.fillStyle = AZUL;
  ctx.font = '700 22px "Segoe UI", Arial, sans-serif';
  ctx.fillText(pedido?.numero || '', W - M, 68);
  ctx.fillStyle = MUTED;
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillText(fechaPedido(pedido?.fecha), W - M, 89);
  ctx.fillText(`Estado: ${pedido?.estado || 'enviado'}`, W - M, 107);
  ctx.textAlign = 'left';

  ctx.strokeStyle = BORDE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, 136);
  ctx.lineTo(W - M, 136);
  ctx.stroke();

  // ------------------------------------------------------------- Cliente
  ctx.fillStyle = FONDO;
  ctx.strokeStyle = BORDE;
  roundRect(ctx, M, yCliente, CONTENT, clienteAlto, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = AZUL;
  ctx.font = '700 10.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText('DATOS DEL CLIENTE', M + 16, yCliente + 22);

  const cliente = pedido?.cliente || {};
  const columnas = [M + 16, M + 286, M + 556];
  const campos = [
    ['Nombre', cliente.nombre || '—'],
    ['RIF', cliente.rif || '—'],
    ['Teléfono', cliente.telefono || '—'],
    ['Dirección', cliente.direccion || '—'],
    ['Correo', cliente.correo || '—'],
    ['Vendedor', pedido?.vendedor?.nombre || '—']
  ];

  campos.forEach(([etiqueta, valor], i) => {
    const col = i % 3;
    const fila = Math.floor(i / 3);
    const x = columnas[col];
    const y = yCliente + 48 + fila * 38;
    const ancho = col === 2 ? CONTENT - 556 - 20 : 252;
    ctx.fillStyle = MUTED;
    ctx.font = '9.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText(etiqueta.toUpperCase(), x, y);
    ctx.fillStyle = TEXTO;
    ctx.font = '12.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText(fitText(ctx, valor, ancho), x, y + 16);
  });

  // ------------------------------------------------------------- Artículos
  ctx.fillStyle = AZUL;
  ctx.fillRect(M, yTabla, CONTENT, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 10.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText('CÓDIGO', M + 12, yTabla + 21);
  ctx.fillText('DESCRIPCIÓN', descX, yTabla + 21);
  ctx.textAlign = 'center';
  ctx.fillText('CANT.', 570, yTabla + 21);
  ctx.textAlign = 'right';
  ctx.fillText('PRECIO', 700, yTabla + 21);
  ctx.fillText('TOTAL', W - M - 12, yTabla + 21);
  ctx.textAlign = 'left';

  let y = yTabla + 34;
  filas.forEach((item, index) => {
    if (index % 2 === 1) {
      ctx.fillStyle = '#f8faff';
      ctx.fillRect(M, y, CONTENT, item.alto);
    }

    const centro = y + item.alto / 2;
    ctx.fillStyle = MUTED;
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillText(fitText(ctx, item.producto?.codigo || '—', 76), M + 12, centro + 4);

    ctx.fillStyle = TEXTO;
    ctx.font = '13px "Segoe UI", Arial, sans-serif';
    const inicioTexto = centro - ((item.lineas.length - 1) * 17) / 2 + 4;
    item.lineas.forEach((linea, i) => {
      ctx.fillText(linea, descX, inicioTexto + i * 17);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = TEXTO;
    ctx.font = '12.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText(String(Number(item.cantidad) || 0), 570, centro + 4);

    ctx.textAlign = 'right';
    ctx.font = '12.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText(money(currency, item.precio), 700, centro + 4);
    ctx.font = '700 12.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText(money(currency, item.subtotal), W - M - 12, centro + 4);
    ctx.textAlign = 'left';

    ctx.strokeStyle = BORDE;
    ctx.beginPath();
    ctx.moveTo(M, y + item.alto);
    ctx.lineTo(W - M, y + item.alto);
    ctx.stroke();

    y += item.alto;
  });

  // -------------------------------------------------------------- Totales
  const tx = W - M - 310;
  const tw = 310;
  ctx.fillStyle = FONDO;
  ctx.strokeStyle = BORDE;
  roundRect(ctx, tx, yTotales, tw, 132, 12);
  ctx.fill();
  ctx.stroke();

  const filasTotales = [
    ['Subtotal', money(currency, pedido?.subtotal)],
    ['Descuentos', `-${money(currency, pedido?.descuento)}`],
    ['Impuestos', money(currency, pedido?.impuestos)]
  ];
  filasTotales.forEach(([etiqueta, valor], i) => {
    const ty = yTotales + 26 + i * 24;
    ctx.fillStyle = MUTED;
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(etiqueta, tx + 16, ty);
    ctx.textAlign = 'right';
    ctx.fillStyle = TEXTO;
    ctx.font = '12.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText(valor, tx + tw - 16, ty);
    ctx.textAlign = 'left';
  });

  ctx.fillStyle = AZUL;
  roundRect(ctx, tx, yTotales + 92, tw, 40, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
  ctx.fillText('TOTAL', tx + 16, yTotales + 117);
  ctx.textAlign = 'right';
  ctx.font = '700 17px "Segoe UI", Arial, sans-serif';
  ctx.fillText(money(currency, pedido?.total), tx + tw - 16, yTotales + 118);
  ctx.textAlign = 'left';

  const observacion = String(pedido?.observacion || '').trim();
  if (observacion) {
    ctx.fillStyle = MUTED;
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Observaciones:', M, yTotales + 30);
    ctx.fillStyle = TEXTO;
    wrapLines(ctx, observacion, tx - M - 24)
      .slice(0, 3)
      .forEach((linea, i) => ctx.fillText(linea, M, yTotales + 48 + i * 15));
  }

  // --------------------------------------------------------------- Pie
  ctx.strokeStyle = BORDE;
  ctx.beginPath();
  ctx.moveTo(M, yFooter);
  ctx.lineTo(W - M, yFooter);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = '10.5px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    [empresaNombre, empresa?.telefono1, empresa?.email].filter(Boolean).join('   ·   '),
    W / 2,
    yFooter + 26
  );
  ctx.fillText(
    'Comprobante generado automáticamente por la plataforma A2 Pedidos',
    W / 2,
    yFooter + 44
  );
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

export default function ComprobantePedido({ pedido, empresa, currency = '$' }) {
  const [imagen, setImagen] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    setImagen('');
    setError('');
    crearImagen({ pedido, empresa, currency })
      .then((url) => {
        if (!cancel) setImagen(url);
      })
      .catch((e) => {
        if (!cancel) setError(e.message || 'No se pudo generar la imagen');
      });
    return () => {
      cancel = true;
    };
  }, [pedido, empresa, currency]);

  const archivo = `${pedido?.tipo === 9 ? 'presupuesto' : 'pedido'}-${String(
    pedido?.numero || 'a2'
  ).replace(/[^\w.-]+/g, '-')}.png`;

  const compartir = async () => {
    try {
      const blob = await (await fetch(imagen)).blob();
      const file = new File([blob], archivo, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${pedido?.tipo === 9 ? 'Presupuesto' : 'Pedido'} ${pedido?.numero || ''}`
        });
      }
    } catch {
      // el usuario canceló o el navegador no permite compartir
    }
  };

  return (
    <section className="card comprobante">
      <div className="card-head">
        <div>
          <h2>
            Comprobante del {pedido?.tipo === 9 ? 'presupuesto' : 'pedido'}
          </h2>
          <p className="muted">Imagen con membrete de ARUCA, artículos y total</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!imagen && !error && <p className="empty">Generando imagen…</p>}

      {imagen && (
        <>
          <img
            className="comprobante-preview"
            src={imagen}
            alt={`${pedido?.tipo === 9 ? 'Presupuesto' : 'Pedido'} ${pedido?.numero}`}
          />
          <div className="actions">
            <a className="btn btn-primary" href={imagen} download={archivo}>
              Descargar imagen
            </a>
            {typeof navigator !== 'undefined' && navigator.share && (
              <button className="btn btn-ghost" type="button" onClick={compartir}>
                Compartir
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
