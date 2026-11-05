// RUT-3: la marca de cada ejercicio y un gráfico chico de lo que fue anotando.
// Sirve para la app del socio y para el panel (el profe). Sin librerías: un SVG.
export type Progreso = { socio: string; ejercicios: { ejercicio_id: string; ejercicio: string; grupo: string;
  marca: { peso: number; repeticiones: number | null; momento: string } | null;
  registros: { peso: number | null; repeticiones: number | null; momento: string }[] }[] };

const kg = (n: number) => `${String(Number(n)).replace(".", ",")} kg`;

function Linea({ puntos }: { puntos: number[] }) {
  if (puntos.length < 2) return null;
  const w = 160, h = 40, min = Math.min(...puntos), max = Math.max(...puntos), r = max - min || 1;
  const xy = puntos.map((p, i) => `${((i / (puntos.length - 1)) * (w - 8) + 4).toFixed(1)},${(h - 4 - ((p - min) / r) * (h - 8)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`Progreso: de ${kg(puntos[0])} a ${kg(puntos[puntos.length - 1])}`} className="flex-none">
      <polyline points={xy.join(" ")} fill="none" stroke="var(--acento)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xy[xy.length - 1].split(",")[0]} cy={xy[xy.length - 1].split(",")[1]} r="3.5" fill="var(--acento)" />
    </svg>
  );
}

export function MarcasProgreso({ datos, zona }: { datos: Progreso; zona: string }) {
  const fecha = (m: string) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "numeric", timeZone: zona }).format(new Date(m));
  if (datos.ejercicios.length === 0) return <p className="texto-suave">Cuando anote sus pesos, acá aparecen las marcas y cómo vienen.</p>;
  return (
    <ul className="space-y-2" data-marcas>{datos.ejercicios.map((e) => {
      const pesos = e.registros.filter((r) => r.peso != null).map((r) => Number(r.peso));
      return (
        <li key={e.ejercicio_id} className="tarjeta flex flex-wrap items-center gap-4 px-4 py-3">
          <span className="flex-1 min-w-0">
            <span className="block font-semibold">{e.ejercicio}</span>
            <span className="block texto-suave text-sm">{e.marca ? <>🏆 {kg(e.marca.peso)}{e.marca.repeticiones ? ` × ${e.marca.repeticiones}` : ""} · {fecha(e.marca.momento)}</> : `${e.registros.length} registros sin peso`}</span>
          </span>
          <Linea puntos={pesos} />
        </li>
      );
    })}</ul>
  );
}
