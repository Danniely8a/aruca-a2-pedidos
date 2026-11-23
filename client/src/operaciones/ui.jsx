import { useEffect, useState } from 'react';

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) {
    return '—';
  }
  const s = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(seg).padStart(2, '0')}s`;
  return `${seg}s`;
}

export function formatFecha(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatFechaHora(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-VE', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

export function EstadoOps({ estado, parcial = false }) {
  if (parcial) {
    return (
      <span className="ops-status ops-status-parcial">Armado parcial</span>
    );
  }
  const labels = {
    pendiente: 'Por asignar',
    asignado: 'Asignado',
    en_proceso: 'En proceso',
    armado: 'Armado'
  };
  return (
    <span className={`ops-status ops-status-${estado || 'pendiente'}`}>
      {labels[estado] || estado}
    </span>
  );
}

export function FaltanteTag({ count = 0 }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return (
    <span className="ops-status ops-status-faltante">
      {n} faltante{n === 1 ? '' : 's'}
    </span>
  );
}

export function DuracionPedido({ iniciado_en, finalizado_en, duracion_segundos }) {
  const activo = Boolean(iniciado_en && !finalizado_en);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!activo) return undefined;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [activo]);

  if (!iniciado_en) return <span className="ops-timer muted">—</span>;
  const segundos = activo
    ? Math.max(0, Math.floor((Date.now() - new Date(iniciado_en).getTime()) / 1000))
    : Number(duracion_segundos || 0);
  return (
    <span className={`ops-timer ${activo ? 'ops-timer-activo' : ''}`}>
      {formatDuration(segundos)}
    </span>
  );
}

export function Progreso({ total, validados }) {
  const n = Number(total) || 0;
  const v = Number(validados) || 0;
  const pct = n > 0 ? Math.min(100, Math.round((v / n) * 100)) : 0;
  return (
    <div className="ops-progress-wrap">
      <div className="ops-progress">
        <div className="ops-progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <span>
        {v} de {n} ítems
      </span>
    </div>
  );
}
