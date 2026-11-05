import { headers } from "next/headers";
import Link from "next/link";
import { colorVar } from "@/components/panel/Estado";
import { Aviso } from "@/components/panel/Marco";
import { fechaCorta, formatearPesos } from "@/lib/formato";
import { miSocio } from "@/lib/app/socio";
import { traerAgenda } from "@/lib/landing";
import { textoCierre } from "@/lib/horarios";
import { intentar } from "@/lib/panel/intentar";
import { CancelarReserva } from "./CancelarReserva";
import { Pagar } from "./Pagar";
import { PagarOnline } from "./PagarOnline";
import { Instalar } from "./Instalar";
import { MiQR } from "./MiQR";
import { EscanearEntrada } from "./EscanearEntrada";
import { Invitar, type MisInvitados } from "./Invitar";
import { rpc } from "@/lib/panel/servidor";

const EMOJI: Record<string, string> = { verde: "✅", amarillo: "⚠️", naranja: "⚠️", rojo: "⛔", gris: "❔" };

export default async function AppSocio({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const host = (await headers()).get("x-gimnasio-host");
    const [{ g, yo }, agenda] = await Promise.all([miSocio(pedido), host ? traerAgenda(host) : null]);
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
    // El QR solo si el gimnasio lo usa (si no, la base dice que no y no se muestra).
    const [qr, qrPared, invitados, campana, online, racha] = await Promise.all([
      rpc<{ codigo: string; vence_en: string }>("mi_qr", { p_gimnasio_id: g.id, p_socio_id: s.socio_id }).catch(() => null),
      rpc<boolean>("usa_qr_pared", { p_gimnasio_id: g.id }).catch(() => false),
      rpc<MisInvitados>("mis_invitados", { p_gimnasio_id: g.id, p_socio_id: s.socio_id }).catch(() => null),
      // AVI-5: cuántas novedades sin ver (si falla, no se muestra un cero que no es).
      rpc<{ sin_leer: number }>("campana_socio", { p_gimnasio_id: g.id, p_socio_id: s.socio_id }).catch(() => null),
      // PAY-1: si el gimnasio conectó MercadoPago, cuánto sale pagar ahora.
      rpc<{ disponible: boolean; monto?: number; descripcion?: string }>("pago_online_disponible", { p_socio_id: s.socio_id }).catch(() => null),
      // APP-7: cuántas veces vino este mes y cuántas semanas seguidas.
      rpc<{ semanas_seguidas: number; entradas_mes: number; entradas_mes_anterior: number; vino_esta_semana: boolean }>("racha_socio", { p_socio_id: s.socio_id }).catch(() => null),
    ]);
    const q = yo.socios.length > 1 ? `?socio=${s.socio_id}` : "";
    return (
      <div className="space-y-6">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="texto-suave text-lg">Hola, {s.nombre} 👋</p>
            {yo.socios.length > 1 && <Link href="/app" className="text-sm texto-tenue">Cambiar de socio</Link>}
          </div>
          {campana && (
            <Link href={`/app/novedades?socio=${s.socio_id}`} data-campana={campana.sin_leer}
              aria-label={campana.sin_leer ? `Novedades: ${campana.sin_leer} sin ver` : "Novedades"}
              className="relative grid place-items-center size-11 flex-none rounded-full border border-[var(--borde)] bg-[var(--tarjeta)] text-xl active:scale-95 transition">
              <span aria-hidden>🔔</span>
              {campana.sin_leer > 0 && (
                <span aria-hidden className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-xs font-bold grid place-items-center text-white" style={{ background: "var(--rojo)" }}>
                  {campana.sin_leer > 99 ? "99+" : campana.sin_leer}
                </span>
              )}
            </Link>
          )}
        </header>

        <section className="rounded-[var(--radio-grande)] p-6 border"
          style={{ background: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 82%)`, borderColor: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 55%)` }}>
          <p className="text-5xl" aria-hidden>{EMOJI[v.color] ?? "❔"}</p>
          <p className="titular text-5xl mt-4">{v.puede ? "Podés entrar" : "No podés entrar"}</p>
          <p className="text-xl mt-2 font-semibold">{v.texto}</p>
          {v.vence_en && v.puede && <p className="texto-suave mt-1">Cubierto hasta el {fechaCorta(new Date(new Date(v.vence_en).getTime() - 1), zona)}</p>}
          <p className="texto-tenue text-sm mt-4">Socio #{s.numero}</p>
        </section>

        {racha && (racha.entradas_mes > 0 || racha.semanas_seguidas > 0) && (
          <section className="grid grid-cols-2 gap-3" data-racha>
            <div className="tarjeta p-4"><p className="numero text-4xl">{racha.entradas_mes}</p><p className="texto-suave text-sm">{racha.entradas_mes === 1 ? "vez" : "veces"} este mes{racha.entradas_mes_anterior ? ` · ${racha.entradas_mes_anterior} el anterior` : ""}</p></div>
            <div className="tarjeta p-4"><p className="numero text-4xl">{racha.semanas_seguidas >= 2 ? "🔥 " : ""}{racha.semanas_seguidas}</p><p className="texto-suave text-sm">{racha.semanas_seguidas === 1 ? "semana" : "semanas"} seguidas{racha.semanas_seguidas > 0 && !racha.vino_esta_semana ? " · vení esta semana para seguir" : ""}</p></div>
          </section>
        )}

        {qrPared && <EscanearEntrada gimnasioId={g.id} socioId={s.socio_id} />}
        {qr && <MiQR gimnasioId={g.id} socioId={s.socio_id} inicial={qr} />}

        {agenda && (agenda.cierres.length > 0 || agenda.sedes.some((x) => x.texto)) && (
          <section className="space-y-2" aria-label="Horarios del gimnasio" data-agenda-app>
            {agenda.sedes.filter((x) => x.texto).map((x) => (
              <p key={x.sede_id} className="flex items-center gap-2 texto-suave">
                <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: x.abierto ? "var(--verde)" : "var(--texto-tenue)" }} />
                {agenda.sedes.length > 1 ? `${x.sede}: ` : "Hoy: "}{x.texto}
              </p>
            ))}
            {agenda.cierres.slice(0, 3).map((c) => (
              <p key={`${c.desde}-${c.sede ?? ""}`} className="mensaje mensaje-aviso" data-cierre>🚫 Cerrado {textoCierre(c)}{c.sede ? ` (${c.sede})` : ""}: {c.motivo}</p>
            ))}
          </section>
        )}

        {yo.pendiente && (
          <p className="pildora pildora-azul !rounded-2xl !px-4 !py-3 w-full">🧾 Informaste {formatearPesos(yo.pendiente.monto)}: el gimnasio lo está revisando.</p>
        )}
        {!yo.pendiente && online?.disponible && <PagarOnline socioId={s.socio_id} monto={online.monto!} descripcion={online.descripcion!} adelantar={!debePagar} />}
        {!yo.pendiente && debePagar && yo.transferencia && (
          <Pagar gimnasioId={g.id} socioId={s.socio_id} monto={yo.plan?.precio_transferencia ?? null} datos={yo.transferencia} secundario={!!online?.disponible} />
        )}

        {invitados && v.puede && <Invitar gimnasioId={g.id} socioId={s.socio_id} datos={invitados} />}
        <p className="text-center"><Link href={`/app/historial${yo.socios.length > 1 ? `?socio=${s.socio_id}` : ""}`} className="texto-suave underline" data-link-historial>🧾 Mis pagos y cuándo vine</Link></p>
        <Instalar />

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
