const numero = (v) => Number(v) || 0;

const lunesDe = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
};

const acumular = (mapa, clave, fila) => {
  const actual = mapa.get(clave) || { periodo: clave, pedidos: 0, items: 0, total: 0 };
  actual.pedidos += numero(fila.pedidos);
  actual.items += numero(fila.items);
  actual.total = Math.round((actual.total + numero(fila.total)) * 100) / 100;
  mapa.set(clave, actual);
};

// Recibe las filas diarias y devuelve las series diaria, semanal y mensual.
export function agruparSeries(diarias = []) {
  const dias = new Map();
  const semanas = new Map();
  const meses = new Map();

  diarias.forEach((fila) => {
    const periodo = String(fila.periodo).slice(0, 10);
    const normalizada = {
      periodo,
      pedidos: numero(fila.pedidos),
      items: numero(fila.items),
      total: numero(fila.total)
    };
    acumular(dias, periodo, normalizada);
    acumular(semanas, lunesDe(periodo), normalizada);
    acumular(meses, periodo.slice(0, 7), normalizada);
  });

  const ordenar = (mapa) =>
    [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));

  return {
    dia: ordenar(dias),
    semana: ordenar(semanas),
    mes: ordenar(meses)
  };
}

export function resumenDesdeSeries(series) {
  const base = series.reduce(
    (acc, fila) => {
      acc.pedidos += numero(fila.pedidos);
      acc.items += numero(fila.items);
      acc.total = Math.round((acc.total + numero(fila.total)) * 100) / 100;
      return acc;
    },
    { pedidos: 0, items: 0, total: 0 }
  );
  return base;
}

export const aNumero = numero;
