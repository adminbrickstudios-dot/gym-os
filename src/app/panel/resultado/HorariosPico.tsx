// Detalle 68 · Horarios pico: entradas de las últimas semanas por día de la semana y hora (función nueva, apagada por defecto).
// Solo lectura: lo calcula `ingresos_por_hora_y_dia`. Cada celda lleva su número en el título y en el texto para lector de pantalla.
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export type IngresosPorHoraYDia = { semanas: number; celdas: number[][] };

export function HorariosPico({ datos }: { datos: IngresosPorHoraYDia }) {
  const maximo = Math.max(0, ...datos.celdas.flat());
  let mejor = { d: 0, h: 0, n: 0 };
  datos.celdas.forEach((fila, d) => fila.forEach((n, h) => { if (n > mejor.n) mejor = { d, h, n }; }));
  // Solo las horas en que alguna vez entró alguien, para que el cuadro no sea un desierto de ceros.
  const horas = Array.from({ length: 24 }, (_, h) => h).filter((h) => datos.celdas.some((f) => f[h] > 0));
  return (
    <section aria-labelledby="pico" data-horarios-pico>
      <h2 id="pico" className="titulo text-2xl mb-1">Horarios pico por día</h2>
      <p className="texto-suave mb-3" data-horarios-pico-texto>
        {maximo
          ? `En las últimas ${datos.semanas} semanas, lo más lleno fue el ${DIAS[mejor.d].toLowerCase()} de ${mejor.h} a ${mejor.h + 1} h (${mejor.n} entradas).`
          : `Sin entradas registradas en las últimas ${datos.semanas} semanas.`}
      </p>
      {maximo > 0 && (
        <div className="tarjeta p-4 overflow-x-auto">
          <table className="text-xs border-separate border-spacing-[2px]" aria-label="Entradas por día de la semana y hora">
            <thead>
              <tr><th className="text-left font-normal texto-tenue pr-2" scope="col">Día</th>{horas.map((h) => <th key={h} scope="col" className="font-normal texto-tenue min-w-6">{h}</th>)}</tr>
            </thead>
            <tbody>
              {DIAS.map((dia, d) => (
                <tr key={dia}>
                  <th scope="row" className="text-left font-normal texto-suave pr-2 whitespace-nowrap">{dia}</th>
                  {horas.map((h) => {
                    const n = datos.celdas[d]?.[h] ?? 0;
                    return (
                      <td key={h} title={`${dia} ${h} h: ${n}`} data-celda={`${d + 1}-${h}`} data-n={n}
                        className="rounded-sm text-center min-w-6 h-6" style={{ background: n ? "var(--acento)" : "var(--borde)", opacity: n ? 0.25 + 0.75 * (n / maximo) : 0.4 }}>
                        <span className="sr-only">{n}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
