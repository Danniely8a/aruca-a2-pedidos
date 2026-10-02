import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const ETIQUETAS = {
  ok: 'Conectado con a2',
  down: 'Sin conexión con a2',
  check: 'Verificando conexión…'
};

export default function ServerStatus({ className = '' }) {
  const [estado, setEstado] = useState('check');

  useEffect(() => {
    let vivo = true;

    const ping = async () => {
      try {
        const h = await api('/api/health', { auth: false });
        if (vivo) setEstado(h.ok && h.connected ? 'ok' : 'down');
      } catch {
        if (vivo) setEstado('down');
      }
    };

    ping();
    const id = setInterval(ping, 30000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  return (
    <span
      className={`server-status server-status-${estado} ${className}`.trim()}
      title={ETIQUETAS[estado]}
    >
      <i className="server-status-dot" aria-hidden="true" />
      {ETIQUETAS[estado]}
    </span>
  );
}
