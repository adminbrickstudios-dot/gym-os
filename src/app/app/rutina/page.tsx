import type { Metadata } from "next";
import Link from "next/link";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { Anotar } from "./Anotar";

export const metadata: Metadata = { title: "Mi rutina" };
export type MiRutina = { nombre: string; descripcion: string | null;
  items: { dia: number; ejercicio_id: string; ejercicio: string; video_url: string | null; series: number; repeticiones: string; nota: string | null;
    ultimo: { peso: number | null; repeticiones: number | null; momento: string } | null }[] };

/** RUT-2: la rutina del socio, día por día, con lo último que anotó. */
export default async function RutinaSocio({ searchParams }: { searchParams: Promise<{ socio?: string; dia?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const { yo } = await miSocio(sp.socio);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const s = yo.socio;
    const q = (extra = "") => { const p = new URLSearchParams(); if (yo.socios.length > 1) p.set("socio", s.socio_id); if (extra) p.set("dia", extra); const x = p.toString(); return x ? `?${x}` : ""; };
    const r = await rpc<MiRutina | null>("rutina_de_socio", { p_socio_id: s.socio_id });
    if (!r) return (<><Link href={`/app${q()}`} className="texto-suave">← Volver</Link><h1 className="titular text-5xl mt-4">Mi rutina</h1>
      <p className="texto-suave text-lg mt-4">Todavía no tenés una rutina. Pedísela a tu profe.</p></>);
    const dias = [...new Set(r.items.map((x) => x.dia))].sort();
    const dia = dias.includes(Number(sp.dia)) ? Number(sp.dia) : dias[0];
    const fecha = (m: string) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "numeric", timeZone: yo.zona! }).format(new Date(m));
    return (
      <div className="space-y-6">
        <Link href={`/app${q()}`} className="texto-suave">← Volver</Link>
        <div><h1 className="titular text-5xl">💪 {r.nombre}</h1>{r.descripcion && <p className="texto-suave text-lg mt-2">{r.descripcion}</p>}</div>
        {dias.length > 1 && (
          <nav className="flex gap-2 overflow-x-auto -mx-4 px-4" aria-label="Día de la rutina">
            {dias.map((d) => <Link key={d} href={`/app/rutina${q(String(d))}`} className={`boton !min-h-11 whitespace-nowrap ${d === dia ? "!border-[var(--acento)]" : "opacity-70"}`}>Día {d}</Link>)}
          </nav>
        )}
        <ul className="space-y-2" data-rutina-dia={dia}>{r.items.filter((x) => x.dia === dia).map((x) => (
          <li key={`${x.dia}-${x.ejercicio_id}-${x.series}-${x.repeticiones}`} className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-lg">{x.ejercicio}</span>
              <span className="block texto-suave">{x.series} × {x.repeticiones}{x.nota ? ` · ${x.nota}` : ""}</span>
              {x.ultimo && <span className="block text-sm texto-tenue" data-ultimo>Última: {x.ultimo.peso != null ? `${String(x.ultimo.peso).replace(".", ",")} kg` : ""}{x.ultimo.peso != null && x.ultimo.repeticiones ? " × " : ""}{x.ultimo.repeticiones ?? ""}{x.ultimo.repeticiones && x.ultimo.peso == null ? " reps" : ""} · {fecha(x.ultimo.momento)}</span>}
            </span>
            {x.video_url && <a href={x.video_url} target="_blank" rel="noopener noreferrer" className="boton boton-chico">▶️</a>}
            <Anotar socioId={s.socio_id} ejercicioId={x.ejercicio_id} nombre={x.ejercicio} />
          </li>
        ))}</ul>
      </div>
    );
  });
}
