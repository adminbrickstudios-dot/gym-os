"use client";
// Pase 2.0 · organización (26/11 · organizacion/para-hacer-hoy.png): la lista de Para hacer hoy. Filtros arriba con su número, cada fila con su
// acción (Cobrar en la hoja encima, WhatsApp con el mensaje listo, Aprobar, Escribir, Ver), y "Hecho hoy" al costado con quién y a qué hora.
// Lo que sale de un hecho (cobrado, aprobado, avisado, tarea hecha) se tilda solo cuando ese hecho existe: acá solo se tildan a mano los
// interesados ("ya les escribí"). "Avisar a los N" abre los wa.me de a uno, con el mensaje listo: nunca un envío automático.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BotonCobrar } from "@/components/panel/cobrar/BotonCobrar";
import { Icono } from "@/components/ui/Icono";
import { formatearPesos } from "@/lib/formato";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import { marcarAvisado } from "../avisos/acciones";
import { aprobar } from "../transferencias/acciones";
import { marcarTarea } from "../tareas/acciones";
import { deshacerUltimoHecho, tildarHecho } from "./acciones";

export type FilaHoy = {
  clave: string; tipo: "cobrar" | "vencen" | "transferencias" | "interesados" | "tareas"; titulo: string; linea: string; monto: number;
  socioId?: string; telefono?: string | null; mensaje?: string | null; avisoClave?: string; avisoReferencia?: string | null; cobrar?: boolean;
  pagoId?: string; coincide?: boolean; tareaId?: string; manual?: boolean;
};
export type HechoHoy = { referencia: string; texto: string; en: string; quien: string | null; manual: boolean; puedo_deshacer: boolean };

const FILTROS: [FilaHoy["tipo"] | "todo", string, string][] = [
  ["todo", "Todo", "lista"], ["cobrar", "Cobrar", "plata"], ["vencen", "Vencen hoy", "reloj-arena"], ["transferencias", "Transferencias", "banco"],
  ["interesados", "Interesados", "hoja"], ["tareas", "Tareas", "lista"],
];
const ICONO: Record<FilaHoy["tipo"], string> = { cobrar: "plata", vencen: "reloj-arena", transferencias: "banco", interesados: "hoja", tareas: "lista" };

export function ListaHoy({ filas, total, hechos, zona }: { filas: FilaHoy[]; total: number; hechos: HechoHoy[]; zona: string }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<FilaHoy["tipo"] | "todo">("todo");
  const [msj, setMsj] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const [avisando, setAvisando] = useState<number | null>(null);
  const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  const cuenta = (t: FilaHoy["tipo"] | "todo") => (t === "todo" ? filas.length : filas.filter((f) => f.tipo === t).length);
  const vistas = filtro === "todo" ? filas : filas.filter((f) => f.tipo === filtro);
  const resueltas = hechos.length;
  const entraron = useMemo(() => hechos.filter((h) => h.referencia.startsWith("pago:")).length, [hechos]);
  // "Avisar a los N": los que vencen hoy con teléfono, de a uno.
  const aAvisar = filas.filter((f) => f.tipo === "vencen" && linkWhatsappSocio(f.telefono, f.mensaje));
  const hacer = (fn: () => Promise<{ error?: string }>) => empezar(async () => { setMsj(null); const r = await fn(); if (r.error) setMsj(r.error); else router.refresh(); });
  const avisar = (f: FilaHoy) => {
    const link = linkWhatsappSocio(f.telefono, f.mensaje);
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
    // El aviso queda como hecho (y se tilda solo) recién cuando la persona lo abrió: lo registra la base.
    if (f.socioId && f.avisoReferencia) hacer(() => marcarAvisado(f.socioId!, f.avisoClave ?? "por_vencer", f.avisoReferencia!));
  };
  const deshacible = hechos.find((h) => h.puedo_deshacer);

  return (
    <div className="space-y-5" data-para-hacer-hoy>
      <section className="tarjeta p-5 flex flex-wrap items-center gap-5" aria-label="En juego hoy" data-en-juego={total}>
        <div>
          <p className="etiqueta">En juego hoy</p>
          <p className="numero text-5xl leading-none" style={{ color: "var(--atencion)" }}>{formatearPesos(total)}</p>
        </div>
        <div className="flex-1 min-w-40 h-3 rounded-full bg-[var(--tarjeta-alta)] overflow-hidden" aria-hidden>
          <div className="h-full" style={{ width: `${filas.length + resueltas ? Math.round((resueltas / (filas.length + resueltas)) * 100) : 0}%`, background: "var(--ok)" }} />
        </div>
        <p className="text-right"><span className="numero text-4xl" style={{ color: "var(--ok)" }} data-resueltas={resueltas}>{resueltas} de {filas.length + resueltas}</span>
          <span className="block texto-suave text-sm">resueltas{entraron ? ` · ${entraron} ${entraron === 1 ? "cobro" : "cobros"}` : ""}</span></p>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar" data-filtros-hoy>
        {FILTROS.filter(([t]) => t === "todo" || cuenta(t) > 0).map(([t, nombre, icono]) => (
          <button key={t} type="button" className="pestana" aria-pressed={filtro === t} aria-current={filtro === t ? "page" : undefined} onClick={() => setFiltro(t)} data-filtro-hoy={t}>
            <Icono nombre={icono} /> {nombre} <span className="texto-suave">{cuenta(t)}</span>
          </button>
        ))}
      </nav>
      {msj && <p role="alert" className="mensaje mensaje-error">{msj}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section aria-label="Lo que falta" className="space-y-2">
          {aAvisar.length > 1 && (filtro === "todo" || filtro === "vencen") && (
            <div className="tarjeta p-4 flex flex-wrap items-center gap-3" data-avisar-varios={aAvisar.length}>
              <span className="flex-1 min-w-48"><strong>Vencen hoy: {aAvisar.length}</strong> <span className="texto-suave block text-sm">El mensaje ya está escrito, se abre uno por uno.</span></span>
              {avisando == null
                ? <button type="button" className="boton boton-principal" onClick={() => { setAvisando(0); avisar(aAvisar[0]); }}>Avisar a los {aAvisar.length}</button>
                : avisando + 1 < aAvisar.length
                  ? <button type="button" className="boton boton-principal" onClick={() => { const i = avisando + 1; setAvisando(i); avisar(aAvisar[i]); }} data-avisar-siguiente>Siguiente: {aAvisar[avisando + 1].titulo.replace(/ vence hoy$/, "")} ({avisando + 2} de {aAvisar.length})</button>
                  : <span className="pildora pildora-verde">Listo: los {aAvisar.length} avisados</span>}
            </div>
          )}
          {vistas.length === 0 ? <p className="vacio texto-suave text-lg" data-hoy-vacio>Nada por hacer acá. <Icono nombre="estrella" /></p> : (
            <ul className="space-y-2">
              {vistas.map((f) => {
                const wa = linkWhatsappSocio(f.telefono, f.mensaje);
                return (
                  <li key={f.clave} className="tarjeta fila flex flex-wrap items-center gap-3 px-4 py-3 min-h-[68px]" data-fila-hoy={f.tipo}>
                    {f.manual
                      ? <input type="checkbox" className="size-6 flex-none" aria-label={`Hecho: ${f.titulo}`} disabled={ocupado} onChange={() => hacer(() => tildarHecho(f.clave, `Escrito: ${f.titulo.replace(/ quiere probar$/, "")}`))} data-tildar />
                      : <span className="size-6 flex-none" aria-hidden />}
                    <span className="text-2xl" aria-hidden><Icono nombre={ICONO[f.tipo]} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-lg">{f.titulo}</span>
                      {f.linea && <span className={`block text-sm ${f.coincide === false ? "font-semibold" : "texto-suave"}`} style={f.coincide === false ? { color: "var(--atencion)" } : undefined} data-coincide={f.coincide === undefined ? undefined : f.coincide ? "si" : "no"}>{f.linea}</span>}
                    </span>
                    {f.monto > 0 && <span className="numero text-xl">{formatearPesos(f.monto)}</span>}
                    {(f.tipo === "cobrar" || f.tipo === "vencen") && f.socioId && f.cobrar && <BotonCobrar socioId={f.socioId} origen="otro" cuota className="boton boton-principal">Cobrar</BotonCobrar>}
                    {(f.tipo === "cobrar" || f.tipo === "vencen") && wa && <button type="button" className="boton" onClick={() => avisar(f)} data-whatsapp-hoy>WhatsApp</button>}
                    {f.tipo === "transferencias" && f.pagoId && (f.coincide
                      ? <button type="button" className="boton boton-principal" disabled={ocupado} onClick={() => hacer(() => aprobar(f.pagoId!))} data-aprobar-hoy>Aprobar</button>
                      : <Link href="/panel/bloque/hoy?pestana=transferencias" className="boton" data-revisar-hoy>Revisar</Link>)}
                    {f.tipo === "interesados" && wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton boton-principal">Escribir</a>}
                    {f.tipo === "tareas" && f.tareaId && <button type="button" className="boton" disabled={ocupado} onClick={() => hacer(() => marcarTarea(f.tareaId!, true))} data-tarea-hecha>Hecha</button>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-3">
          <section className="tarjeta p-4 space-y-2" aria-labelledby="hecho-hoy" data-hecho-hoy={hechos.length}>
            <h2 id="hecho-hoy" className="titulo text-2xl"><Icono nombre="ok" /> Hecho hoy</h2>
            {hechos.length === 0 ? <p className="texto-suave">Todavía nada.</p> : (
              <ul className="space-y-1.5">
                {hechos.slice(0, 12).map((h) => (
                  <li key={`${h.referencia}-${h.en}`} className="rounded-[var(--radio)] bg-[var(--tarjeta-alta)] px-3 py-2 flex items-center gap-2 text-[15px]">
                    <span className="min-w-0 flex-1 truncate">{h.texto}</span>
                    <span className="texto-suave text-sm flex-none">{h.quien ?? "—"} · {hora(h.en)}</span>
                  </li>
                ))}
              </ul>
            )}
            {deshacible && <button type="button" className="boton w-full" disabled={ocupado} onClick={() => hacer(deshacerUltimoHecho)} data-deshacer-ultimo>Deshacer el último</button>}
          </section>
          <section className="tarjeta p-4" aria-labelledby="como-se-arma">
            <h2 id="como-se-arma" className="titulo text-xl">Cómo se arma</h2>
            <p className="texto-suave">Junta lo que estaba en Avisos de hoy, Vencen y cobrar, Transferencias, Interesados y tus tareas. Primero lo que deja plata. Cada uno ve lo de su rol.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
