"use client";
import { useEffect, useState } from "react";
import { estadoTv, type ClaseTv, type EstadoTv } from "./acciones";
import { Icono } from "@/components/ui/Icono";

const CADA_MS = 15000;

/**
 * La pantalla grande. Modo "clases": la clase de ahora con los anotados, su WOD y la que sigue. Modo "entradas": las últimas entradas en vivo.
 * En los dos, la gente que hay adentro como número. Pregunta cada 15 segundos. Nunca muestra el estado de pago de nadie.
 */
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
  const entradas = e.modo === "entradas";
  return (
    <main className="min-h-dvh p-8 lg:p-12 flex flex-col gap-8" data-tv="lista" data-tv-modo={e.modo ?? "clases"}>
      <header className="flex items-baseline justify-between gap-6">
        <p className="titulo text-3xl">{e.gimnasio}{e.sede ? ` · ${e.sede}` : ""}</p>
        <div className="flex items-baseline gap-8">
          {typeof e.ocupacion === "number" && (
            <p className="texto-suave text-2xl" data-tv-ocupacion={e.ocupacion}>
              <Icono nombre="usuarios" /> <span className="numero text-5xl text-[var(--texto)]">{e.ocupacion}</span> {e.ocupacion === 1 ? "persona adentro" : "personas adentro"}
            </p>
          )}
          <p className="numero text-5xl" aria-label="Hora">{hora(reloj)}</p>
        </div>
      </header>
      {entradas ? <Entradas e={e} hora={hora} /> : e.ahora ? <Ahora c={e.ahora} hora={hora} /> : (
        <section className="grow grid place-items-center text-center" data-tv-ahora="ninguna">
          <div><p className="text-7xl" aria-hidden><Icono nombre="reloj" /></p><p className="titular text-5xl mt-4">No hay clase ahora</p></div>
        </section>
      )}
      {!entradas && e.proxima && (
        <footer className="tarjeta p-6 flex flex-wrap items-baseline gap-x-6 gap-y-2" data-tv-proxima>
          <span className="texto-suave text-2xl">Después</span>
          <span className="numero text-4xl">{hora(e.proxima.inicio)}</span>
          <span className="titulo text-3xl"><Icono nombre={e.proxima.emoji ?? "calendario"} sistema /> {e.proxima.actividad}</span>
          {e.proxima.profe && <span className="texto-suave text-2xl">{e.proxima.profe}</span>}
          <span className="texto-suave text-2xl">{e.proxima.anotados.length} {e.proxima.anotados.length === 1 ? "anotado" : "anotados"}</span>
        </footer>
      )}
      {sinConexion && <p className="pildora pildora-amarillo self-start" role="status"><Icono nombre="alerta" /> Sin conexión: se muestra lo último que llegó</p>}
    </main>
  );
}

function Entradas({ e, hora }: { e: EstadoTv; hora: (m: string) => string }) {
  const lista = e.entradas ?? [];
  return (
    <section className="grow min-w-0" data-tv-entradas={lista.length}>
      <h1 className="titular text-6xl lg:text-7xl">Bienvenidos</h1>
      {lista.length === 0 ? <p className="texto-suave text-3xl mt-8" data-tv-sin-entradas>Todavía no entró nadie.</p> : (
        <ul className="mt-8 space-y-4">
          {lista.map((x, i) => (
            <li key={`${x.momento}-${i}`} className="flex items-baseline gap-6 border-b border-[var(--borde)] pb-3" data-tv-entrada>
              <span className="numero text-4xl lg:text-5xl texto-suave">{hora(x.momento)}</span>
              <span className={`font-semibold truncate ${i === 0 ? "text-6xl lg:text-7xl" : "text-4xl lg:text-5xl"}`}>{x.nombre}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Ahora({ c, hora }: { c: ClaseTv; hora: (m: string) => string }) {
  return (
    <section className="grow grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" data-tv-ahora={c.clase_id}>
      <div className="min-w-0">
        <p className="texto-suave text-2xl">{new Date(c.inicio) > new Date() ? "Empieza" : "Ahora"} · {hora(c.inicio)} a {hora(c.fin)}{c.profe ? ` · ${c.profe}` : ""}</p>
        <h1 className="titular text-7xl lg:text-8xl mt-2"><Icono nombre={c.emoji ?? "calendario"} sistema /> {c.actividad}</h1>
        <p className="texto-suave text-2xl mt-4">{c.anotados.length}{c.cupo != null ? ` de ${c.cupo}` : ""} {c.anotados.length === 1 ? "anotado" : "anotados"}</p>
        <ul className="mt-6 grid grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-3" data-tv-anotados={c.anotados.length}>
          {c.anotados.map((a, i) => <li key={`${a.nombre}-${i}`} className="text-4xl lg:text-5xl font-semibold truncate">{a.presente ? <><Icono nombre="ok" /> </> : null}{a.nombre}</li>)}
        </ul>
      </div>
      {c.wod && (
        <aside className="tarjeta p-8 min-w-0" data-tv-wod>
          <p className="titulo text-3xl mb-4"><Icono nombre="pesa" /> WOD</p>
          <p className="text-3xl lg:text-4xl whitespace-pre-line leading-snug">{c.wod}</p>
        </aside>
      )}
    </section>
  );
}
