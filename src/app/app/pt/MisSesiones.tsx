"use client";
// VD-58: lo que ve el socio de su PT: cuántas sesiones le quedan, sus turnos (con cancelar dentro del plazo) y los horarios libres.
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import type { PtSocio } from "@/app/panel/pt/acciones";
import { cancelarMiSesion, reservarMiSesion } from "./acciones";
import { Icono } from "@/components/ui/Icono";

const hora = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
const dia = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long", day: "numeric", month: "long" }).format(new Date(m));
const clave = (m: string, zona: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date(m));
/** El último día del pack: "vence_en" es la medianoche siguiente, así que se resta un instante. */
const diaCorto = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "numeric", month: "short" }).format(new Date(new Date(m).getTime() - 1));
const corto = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));

export function MisSesiones({ socioId, datos, zona }: { socioId: string; datos: PtSocio; zona: string }) {
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const ahora = Date.now();
  const proximas = (datos.sesiones ?? []).filter((s) => s.estado === "reservada" && new Date(s.fin).getTime() > ahora).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const pasadas = (datos.sesiones ?? []).filter((s) => !proximas.includes(s) && s.estado !== "cancelada").slice(0, 5);
  const gimCancelo = (datos.sesiones ?? []).filter((s) => s.estado === "cancelada" && s.cancelada_origen !== "socio" && new Date(s.inicio).getTime() > ahora - 7 * 86400_000);
  const porDia = new Map<string, NonNullable<PtSocio["libres"]>>();
  for (const l of datos.libres ?? []) { const k = clave(l.inicio, zona); porDia.set(k, [...(porDia.get(k) ?? []), l]); }
  const correr = async (fn: () => Promise<{ error?: string }>, ok: string | null) => { setError(null); setListo(null); const r = await fn(); if (r.error) setError(r.error); else setListo(ok); };
  return (
    <div className="space-y-6">
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {listo && <Mensaje tipo="exito"><span data-pt-ok>{listo}</span></Mensaje>}

      <section className="space-y-2" aria-label="Mis sesiones">
        {(datos.packs ?? []).length === 0 ? (
          <div className="tarjeta p-5" data-sin-pack><p className="titulo text-2xl">Todavía no tenés un pack</p><p className="texto-suave">Pedíselo en la recepción y después reservás tus horarios acá.</p></div>
        ) : (datos.packs ?? []).map((p) => (
          <div key={p.venta_item_id} className="tarjeta p-5" data-pack-socio>
            <p className="titulo text-2xl"><Icono nombre="ticket" /> {p.nombre}</p>
            <p className="texto-suave" data-pack-restantes={p.restantes}>
              {p.vigente ? `Te quedan ${p.restantes} de ${p.total} ${p.total === 1 ? "sesión" : "sesiones"}` : p.restantes <= 0 ? `Usaste las ${p.total} sesiones` : "Este pack venció"}
              {p.vence_en && p.vigente ? ` · hasta el ${diaCorto(p.vence_en, zona)}` : ""}
              {p.entrenador ? ` · con ${p.entrenador}` : ""}
            </p>
          </div>
        ))}
      </section>

      {gimCancelo.map((s) => (
        <p key={s.sesion_id} className="mensaje mensaje-aviso" data-sesion-cancelada-gym><span aria-hidden><Icono nombre="punto-amarillo" /></span><span>Se canceló tu turno del {corto(s.inicio, zona)} con {s.entrenador}{s.cancelada_motivo ? ` (${s.cancelada_motivo})` : ""}. La sesión se te devolvió.</span></p>
      ))}

      <section className="space-y-2" aria-labelledby="mis-turnos">
        <h2 id="mis-turnos" className="titulo text-2xl">Mis turnos</h2>
        {proximas.length === 0 && <p className="texto-suave" data-sin-turnos>No tenés turnos reservados.</p>}
        <ul className="space-y-2">
          {proximas.map((s) => (
            <li key={s.sesion_id} className="tarjeta p-4 space-y-2" data-mi-sesion={s.sesion_id}>
              <p className="font-semibold first-letter:uppercase">{dia(s.inicio, zona)} · {hora(s.inicio, zona)}–{hora(s.fin, zona)}</p>
              <p className="texto-suave text-sm">Con {s.entrenador}{s.sede ? ` · ${s.sede}` : ""}</p>
              {s.puede_cancelar
                ? <BotonAccion className="boton" ocupadoTexto="Cancelando…" data-cancelar-mi-sesion onClick={() => correr(() => cancelarMiSesion(s.sesion_id), "Turno cancelado: la sesión se te devolvió.")}>Cancelar el turno</BotonAccion>
                : <p className="texto-tenue text-sm" data-fuera-de-plazo>Ya no se puede cancelar (hasta {datos.horas_cancelar} h antes). Si no podés venir, avisale al gimnasio.</p>}
            </li>
          ))}
        </ul>
        {pasadas.length > 0 && (
          <details className="texto-suave text-sm"><summary className="cursor-pointer">Anteriores</summary>
            <ul className="mt-2 space-y-1">{pasadas.map((s) => <li key={s.sesion_id}>{corto(s.inicio, zona)} · {s.entrenador} · {s.estado === "dictada" ? <><Icono nombre="ok" /> la diste</> : s.estado === "ausente" ? <><Icono nombre="prohibido" /> no viniste</> : "a confirmar"}</li>)}</ul></details>
        )}
      </section>

      {datos.tiene_saldo && (
        <section className="space-y-3" aria-labelledby="horarios-libres">
          <h2 id="horarios-libres" className="titulo text-2xl">Reservar un horario</h2>
          <p className="texto-tenue text-sm">Cada turno gasta una sesión de tu pack. Cancelás hasta {datos.horas_cancelar} horas antes y se te devuelve.</p>
          {porDia.size === 0 && <p className="texto-suave" data-sin-libres>No hay horarios libres por ahora. Probá más tarde.</p>}
          {[...porDia.entries()].map(([k, ls]) => (
            <div key={k} className="space-y-2" data-libres-dia={k}>
              <h3 className="font-semibold first-letter:uppercase">{dia(ls[0].inicio, zona)}</h3>
              <ul className="grid grid-cols-2 gap-2">
                {ls.map((l) => (
                  <li key={l.franja_id}>
                    <BotonAccion className="boton w-full !min-h-14 flex-col" ocupadoTexto="Reservando…" data-reservar-franja={l.franja_id}
                      onClick={() => correr(() => reservarMiSesion(socioId, l.franja_id), `Listo: turno reservado el ${corto(l.inicio, zona)} con ${l.entrenador}.`)}>
                      <span className="numero text-lg">{hora(l.inicio, zona)}</span><span className="text-[13px] texto-suave">{l.entrenador}</span>
                    </BotonAccion>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
