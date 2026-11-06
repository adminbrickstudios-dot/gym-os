import Link from "next/link";
import { CancelarReserva } from "../CancelarReserva";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { Reservar } from "./Reservar";
import { ElegirLugar } from "./ElegirLugar";
import type { MapaLugares } from "@/lib/clases/lugares";
import { TurnosFijos, type HorarioLibre, type Turno } from "@/components/TurnosFijos";

type Clase = { clase_id: string; actividad: string; emoji: string | null; inicio: string; profe: string | null; cupo: number | null;
  confirmadas: number; cancelada: boolean; mi_reserva: string | null; mi_posicion: number | null };

export default async function ClasesSocio({ searchParams }: { searchParams: Promise<{ socio?: string; dia?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const { yo } = await miSocio(sp.socio);
    if (yo.elegir || !yo.socio) return <Link href="/app" className="boton">Elegí el socio</Link>;
    const ZONA = yo.zona!;
    // AUD-11: con "sin reserva" se muestran los horarios, sin botones de reservar.
    const reserva = yo.modo_clases === "reserva";
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
    const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
    const dia = dias.includes(sp.dia ?? "") ? sp.dia! : dias[0];
    const sede = yo.sedes?.[0];
    if (!sede) throw new Error("El gimnasio no tiene sedes activas");
    const [todas, politica, turnos, horarios, wods] = await Promise.all([
      rpc<Clase[]>("clases_del_dia", { p_sede_id: sede.sede_id, p_dia: dia, p_socio_id: yo.socio.socio_id }),
      // CLA-1: las reglas (cancelar, faltas) y si hoy no puede reservar por una falta.
      rpc<{ reglas: string[]; bloqueo: { texto: string } | null }>("politica_reservas", { p_socio_id: yo.socio.socio_id }),
      // CLA-2: sus turnos fijos (si el gimnasio los usa) y los horarios para elegir.
      rpc<{ prendido: boolean; turnos: Turno[] }>("turnos_socio", { p_socio_id: yo.socio.socio_id }),
      rpc<HorarioLibre[]>("horarios_para_turno", { p_socio_id: yo.socio.socio_id }),
      // CLA-4: el WOD de las clases que reservó.
      rpc<{ clase_id: string; wod: string }[]>("wods_socio", { p_socio_id: yo.socio.socio_id }),
    ]);
    const wodDe = new Map(wods.map((w) => [w.clase_id, w.wod]));
    const clases = todas.filter((c) => !c.cancelada && new Date(c.inicio) > new Date());
    // COM-12: en las clases que tiene confirmadas, el mapa de la sala si está numerada.
    const mapas = new Map((await Promise.all(clases.filter((c) => reserva && c.mi_reserva === "confirmada")
      .map(async (c) => [c.clase_id, await rpc<MapaLugares | null>("lugares_clase", { p_clase_id: c.clase_id, p_socio_id: yo.socio!.socio_id })] as const)))
      .filter((x): x is readonly [string, MapaLugares] => x[1] != null));
    // VD-44: "Profe: Ana" con su foto, solo si el dueño mostró al equipo (la base devuelve vacío si no).
    const profes = new Map((clases.length ? await rpc<{ clase_id: string; equipo_id: string; nombre: string; tiene_foto: boolean }[]>("profes_de_clases", { p_clase_ids: clases.map((c) => c.clase_id) }, { lectura: true }) : [])
      .map((p) => [p.clase_id, p] as const));
    const reservaDe = new Map((yo.reservas ?? []).map((r) => [r.clase_id, r.reserva_id]));
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const q = (d: string) => `/app/clases?dia=${d}${yo.socios.length > 1 ? `&socio=${yo.socio!.socio_id}` : ""}`;
    return (
      <>
        <Link href={`/app${yo.socios.length > 1 ? `?socio=${yo.socio.socio_id}` : ""}`} className="texto-suave">← Volver</Link>
        <h1 className="titular text-5xl mt-4">{reserva ? "Reservar" : "Clases"}</h1>
        {!reserva && <p className="texto-suave text-lg mt-2" data-sin-reserva>No hace falta reservar: vení directo.</p>}
        <nav className="flex gap-2 overflow-x-auto -mx-4 px-4 py-4">
          {dias.map((d, i) => (
            <Link key={d} href={q(d)} className={`boton !min-h-11 whitespace-nowrap ${d === dia ? "!border-[var(--acento)]" : "opacity-70"}`}>
              {i === 0 ? "Hoy" : i === 1 ? "Mañana" : new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))}
            </Link>
          ))}
        </nav>
        {reserva && politica.bloqueo && <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3 w-full mb-4" data-bloqueo-reservas>⛔ {politica.bloqueo.texto}</p>}
        {clases.length === 0 ? <p className="texto-suave">No quedan clases este día.</p> : (
          <ul className="space-y-2">{clases.map((c) => (
            <li key={c.clase_id} className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="numero text-2xl w-14">{hora(c.inicio)}</span>
              <span className="text-2xl" aria-hidden>{c.emoji ?? "🗓️"}</span>
              <span className="grow basis-36 min-w-0"><span className="block font-semibold">{c.actividad}</span>
                <span className="block text-sm texto-suave">{reserva ? (c.cupo != null ? `${Math.max(c.cupo - c.confirmadas, 0)} lugares` : "Sin cupo") : ""}{c.profe && !profes.get(c.clase_id) ? `${reserva ? " · " : ""}${c.profe}` : ""}</span>
                {profes.get(c.clase_id) && (
                  <span className="flex items-center gap-2 mt-1 text-sm" data-profe-clase={profes.get(c.clase_id)!.nombre}>
                    {profes.get(c.clase_id)!.tiene_foto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/foto-equipo/${profes.get(c.clase_id)!.equipo_id}`} alt={`Foto de ${profes.get(c.clase_id)!.nombre}`} className="size-8 rounded-full object-cover" />
                    )}
                    <span>Profe: {profes.get(c.clase_id)!.nombre}</span>
                  </span>
                )}</span>
              {!reserva ? null : c.mi_reserva && reservaDe.get(c.clase_id)
                ? <><span className="pildora pildora-verde">{c.mi_reserva === "espera" ? `${c.mi_posicion}° en espera` : "✅ Reservada"}</span><CancelarReserva reservaId={reservaDe.get(c.clase_id)!} /></>
                : <Reservar claseId={c.clase_id} socioId={yo.socio!.socio_id} lleno={c.cupo != null && c.confirmadas >= c.cupo} />}
              {mapas.get(c.clase_id) && <ElegirLugar mapa={mapas.get(c.clase_id)!} />}
              {wodDe.get(c.clase_id) && <p className="basis-full text-[15px] whitespace-pre-line" data-wod-socio>🏋️ {wodDe.get(c.clase_id)}</p>}
            </li>
          ))}</ul>
        )}
        {reserva && turnos.prendido && <div className="mt-8"><TurnosFijos socioId={yo.socio.socio_id} turnos={turnos.turnos} horarios={horarios} /></div>}
        {reserva && politica.reglas.length > 0 && <ul className="mt-6 space-y-1 text-sm texto-suave" data-reglas-reservas>{politica.reglas.map((r) => <li key={r}>ℹ️ {r}</li>)}</ul>}
      </>
    );
  });
}
