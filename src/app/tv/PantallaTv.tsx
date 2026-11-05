"use client";
import { useEffect, useState } from "react";
import { estadoTv, type ClaseTv, type EstadoTv } from "./acciones";

const CADA_MS = 15000;

/** La pantalla grande: la clase de ahora con los anotados, su WOD y la que sigue. Pregunta cada 15 segundos. */
export function PantallaTv({ inicial }: { inicial: EstadoTv }) {
  const [e, setE] = useState(inicial);
  const [sinConexion, setSinConexion] = useState(false);
  const [reloj, setReloj] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await estadoTv();
        if (r.estado) { setE(r.estado); setSinConexion(false); } else setSinConexion(true);
      } catch { setSinConexion(true); }
    }, CADA_MS);
    const t = setInterval(() => setReloj(new Date()), 1000 * 20);
    return () => { clearInterval(id); clearInterval(t); };
  }, []);
  const hora = (m: string | Date) => new Intl.DateTimeFormat("es-AR", { timeZone: e.zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  return (
    <main className="min-h-dvh p-8 lg:p-12 flex flex-col gap-8" data-tv="lista">
      <header className="flex items-baseline justify-between gap-6">
        <p className="titulo text-3xl">{e.gimnasio}{e.sede ? ` · ${e.sede}` : ""}</p>
        <p className="numero text-5xl" aria-label="Hora">{hora(reloj)}</p>
      </header>
      {e.ahora ? <Ahora c={e.ahora} hora={hora} /> : (
        <section className="grow grid place-items-center text-center" data-tv-ahora="ninguna">
          <div><p className="text-7xl" aria-hidden>🕐</p><p className="titular text-5xl mt-4">No hay clase ahora</p></div>
        </section>
      )}
      {e.proxima && (
        <footer className="tarjeta p-6 flex flex-wrap items-baseline gap-x-6 gap-y-2" data-tv-proxima>
          <span className="texto-suave text-2xl">Después</span>
          <span className="numero text-4xl">{hora(e.proxima.inicio)}</span>
          <span className="titulo text-3xl">{e.proxima.emoji ?? "🗓️"} {e.proxima.actividad}</span>
          {e.proxima.profe && <span className="texto-suave text-2xl">{e.proxima.profe}</span>}
          <span className="texto-suave text-2xl">{e.proxima.anotados.length} {e.proxima.anotados.length === 1 ? "anotado" : "anotados"}</span>
        </footer>
      )}
      {sinConexion && <p className="pildora pildora-amarillo self-start" role="status">⚠️ Sin conexión: se muestra lo último que llegó</p>}
    </main>
  );
}

function Ahora({ c, hora }: { c: ClaseTv; hora: (m: string) => string }) {
  return (
    <section className="grow grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" data-tv-ahora={c.clase_id}>
      <div className="min-w-0">
        <p className="texto-suave text-2xl">{new Date(c.inicio) > new Date() ? "Empieza" : "Ahora"} · {hora(c.inicio)} a {hora(c.fin)}{c.profe ? ` · ${c.profe}` : ""}</p>
        <h1 className="titular text-7xl lg:text-8xl mt-2">{c.emoji ?? "🗓️"} {c.actividad}</h1>
        <p className="texto-suave text-2xl mt-4">{c.anotados.length}{c.cupo != null ? ` de ${c.cupo}` : ""} {c.anotados.length === 1 ? "anotado" : "anotados"}</p>
        <ul className="mt-6 grid grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-3" data-tv-anotados={c.anotados.length}>
          {c.anotados.map((a, i) => <li key={`${a.nombre}-${i}`} className="text-4xl lg:text-5xl font-semibold truncate">{a.presente ? "✅ " : ""}{a.nombre}</li>)}
        </ul>
      </div>
      {c.wod && (
        <aside className="tarjeta p-8 min-w-0" data-tv-wod>
          <p className="titulo text-3xl mb-4">🏋️ WOD</p>
          <p className="text-3xl lg:text-4xl whitespace-pre-line leading-snug">{c.wod}</p>
        </aside>
      )}
    </section>
  );
}
