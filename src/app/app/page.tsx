import Link from "next/link";
import { colorVar } from "@/components/panel/Estado";
import { Aviso } from "@/components/panel/Marco";
import { fechaCorta, formatearPesos } from "@/lib/formato";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { CancelarReserva } from "./CancelarReserva";
import { Pagar } from "./Pagar";

const EMOJI: Record<string, string> = { verde: "✅", amarillo: "⚠️", naranja: "⚠️", rojo: "⛔", gris: "❔" };

export default async function AppSocio({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { g, yo } = await miSocio(pedido);
    if (yo.elegir) {
      return (
        <>
          <h1 className="titular text-5xl">¿Quién entrena hoy?</h1>
          <p className="texto-suave text-lg mt-2">Tu cuenta tiene varios socios.</p>
          <ul className="mt-8 space-y-2">{yo.socios.map((s) => (
            <li key={s.socio_id}><Link href={`/app?socio=${s.socio_id}`} className="boton w-full !justify-start text-lg">👤 {s.nombre}</Link></li>
          ))}</ul>
        </>
      );
    }
    const v = yo.acceso!; const s = yo.socio!;
    const zona = yo.zona!;
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const debePagar = !v.puede || v.color === "amarillo" || v.color === "naranja";
    const q = yo.socios.length > 1 ? `?socio=${s.socio_id}` : "";
    return (
      <div className="space-y-6">
        <header>
          <p className="texto-suave text-lg">Hola, {s.nombre} 👋</p>
          {yo.socios.length > 1 && <Link href="/app" className="text-sm texto-tenue">Cambiar de socio</Link>}
        </header>

        <section className="rounded-[var(--radio-grande)] p-6 border"
          style={{ background: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 82%)`, borderColor: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 55%)` }}>
          <p className="text-5xl" aria-hidden>{EMOJI[v.color] ?? "❔"}</p>
          <p className="titular text-5xl mt-4">{v.puede ? "Podés entrar" : "No podés entrar"}</p>
          <p className="text-xl mt-2 font-semibold">{v.texto}</p>
          {v.vence_en && v.puede && <p className="texto-suave mt-1">Cubierto hasta el {fechaCorta(new Date(new Date(v.vence_en).getTime() - 1), zona)}</p>}
          <p className="texto-tenue text-sm mt-4">Socio #{s.numero}</p>
        </section>

        {yo.pendiente && (
          <p className="pildora pildora-azul !rounded-2xl !px-4 !py-3 w-full">🧾 Informaste {formatearPesos(yo.pendiente.monto)}: el gimnasio lo está revisando.</p>
        )}
        {!yo.pendiente && debePagar && yo.transferencia && (
          <Pagar gimnasioId={g.id} socioId={s.socio_id} monto={yo.plan?.precio_transferencia ?? null} datos={yo.transferencia} />
        )}

        {yo.plan && (
          <section className="tarjeta p-5">
            <p className="texto-tenue text-sm">Tu plan</p>
            <p className="titulo text-2xl">🏷️ {yo.plan.nombre}</p>
          </section>
        )}
        {yo.packs?.map((p) => (
          <section key={p.plan} className="tarjeta p-5">
            <p className="titulo text-2xl">🎟️ {p.plan}</p>
            <p className="texto-suave">Te quedan {p.cantidad - p.usadas} de {p.cantidad} clases{p.vence_en ? ` · vence el ${fechaCorta(p.vence_en, zona)}` : ""}</p>
          </section>
        ))}

        {yo.modo_clases !== "ninguno" && (
          <section>
            <div className="flex items-end justify-between mb-3">
              <h2 className="titulo text-3xl">🗓️ Mis clases</h2>
              <Link href={`/app/clases${q}`} className="boton !min-h-11">➕ Reservar</Link>
            </div>
            {!yo.reservas?.length ? <p className="texto-suave">No tenés clases reservadas.</p> : (
              <ul className="space-y-2">{yo.reservas.map((r) => (
                <li key={r.reserva_id} className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="icono" aria-hidden>{r.emoji ?? "🗓️"}</span>
                  <span className="flex-1 min-w-0"><span className="block font-semibold">{r.actividad}</span>
                    <span className="block text-sm texto-suave first-letter:uppercase">{hora(r.inicio)}{r.estado === "espera" ? ` · ${r.posicion}° en espera` : ""}</span></span>
                  <CancelarReserva reservaId={r.reserva_id} />
                </li>
              ))}</ul>
            )}
          </section>
        )}
        {!v.puede && !yo.transferencia && <Aviso emoji="💬" titulo="Pasá por recepción">Para ponerte al día, pagá en el mostrador.</Aviso>}
      </div>
    );
  });
}
