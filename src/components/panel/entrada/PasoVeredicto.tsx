"use client";
// E4 · El paso "veredicto" de la ventana grande: color, foto, nombre, lo que dice la base y los botones que dice la guía.
// No calcula nada: todo (v, guia, apto, firmar) viene de estado_acceso / guia_entrada.
import Link from "next/link";
import type { RefObject } from "react";
import type { ResultadoSocio } from "@/app/panel/acciones";
import type { CupoDejarPasar, EventoHoy, Guia, PromesaPago, Veredicto } from "@/app/panel/entrada/acciones";
import { Icono } from "@/components/ui/Icono";
import { Mensaje } from "@/components/ui/Mensaje";
import type { RegistrarSalida } from "@/app/panel/entrada/ventana-acciones";
import { formatearPesos } from "@/lib/formato";
import { colorVar } from "../Estado";
import { EventosHoyEntrada } from "../EventosHoyEntrada";
import { hayHojaCobrar } from "../cobrar/evento";
import { ComprobanteCobro, FormDejarPasar } from "./cargas";
import { CLAVE_FICHA, EMOJI } from "./comun";

function Iniciales({ nombre }: { nombre: string }) {
  const [a, b] = nombre.trim().split(/\s+/);
  return <>{(a?.[0] ?? "?").toUpperCase()}{(b?.[0] ?? "").toUpperCase()}</>;
}

export default function PasoVeredicto({ elegido, v, guia, apto, firmar, eventosHoy, error, cobrado, esRecepcion, ocupado, forzando, cupo, motivo, setMotivo, pruebaModo, salidaModo, puedeAnotarConEnter, cobrarRef, fichaRef, anotar, dejar, volvioAntes, volverAlta, cobrarAhora, darPruebaAlSocio, marcarSalida, reiniciar }: {
  elegido: ResultadoSocio; v: Veredicto | null; guia: Guia | null; apto: string | null; firmar: string | null; eventosHoy: EventoHoy[];
  error: string | null; cobrado: { ventaId: string; total: number } | null; esRecepcion: boolean; ocupado: boolean;
  forzando: boolean; cupo: CupoDejarPasar | null; motivo: string; setMotivo: (m: string) => void;
  pruebaModo: "no" | "dia" | "clase" | null; salidaModo: RegistrarSalida | null; puedeAnotarConEnter: boolean;
  cobrarRef: RefObject<HTMLAnchorElement | null>; fichaRef: RefObject<HTMLAnchorElement | null>;
  anotar: (forzar?: string, promesa?: PromesaPago) => void; dejar: () => void; volvioAntes: () => void; volverAlta: () => void;
  cobrarAhora: () => void; darPruebaAlSocio: (s: ResultadoSocio) => void; marcarSalida: (s: ResultadoSocio) => void; reiniciar: () => void;
}) {
  // VD-2: el botón principal (y el segundo) lo dice la base según la situación; acá solo se dibujan.
  const bloqueadoParaRecepcion = !!v && !v.puede && esRecepcion && (!!guia?.solo_encargado || v.motivo === "suspendido" || v.motivo === "se_fue");
  const principal = guia?.boton ?? (v?.puede ? "anotar" : "cobrar");
  const segundo = guia?.segundo ?? null;
  const avisosSueltos = (v?.avisos ?? []).filter((a) => !guia || !(a === "Cumple años hoy" || /^Debe .+ a cuenta$/.test(a)));
  const boton = (clave: string, esPrincipal: boolean) => {
    if (!v) return null;
    const clase = `boton ${esPrincipal ? "boton-principal text-lg px-8" : ""}`;
    switch (clave) {
      case "anotar":
        // VD-46M: con la puerta en emergencia, al que no podía entrar se lo anota igual (queda marcado); un clic a propósito, sin Enter.
        if (!v.puede && guia?.emergencia) return <button key={clave} type="button" disabled={ocupado} onClick={() => anotar()} className={clase} data-ventana-anotar data-anotar-emergencia><Icono nombre="alerta-circulo" /> Anotar entrada (emergencia)</button>;
        return v.puede ? <button key={clave} type="button" disabled={ocupado} onClick={() => anotar()} className={clase} data-ventana-anotar><Icono nombre="ok" /> Anotar entrada <kbd className="text-xs opacity-70 font-sans">Enter</kbd></button> : null;
      case "cobrar":
      case "cobrar_pack":
        return <Link key={clave} ref={cobrarRef} href={`/panel/vender?socio=${elegido.socio_id}${v.para_regularizar ? "&cuota=1" : ""}&desde=entrada`} className={clase} data-ventana-cobrar
          onClick={(e) => { if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !hayHojaCobrar()) return; e.preventDefault(); cobrarAhora(); }}>{guia?.boton_texto && clave === principal ? guia.boton_texto : clave === "cobrar_pack" ? "Cobrar un pack" : "Cobrar"} <kbd className="text-xs opacity-70 font-sans">C</kbd></Link>;
      case "dejar_pasar":
        if (v.puede || forzando) return null;
        return bloqueadoParaRecepcion ? null : <button key={clave} type="button" onClick={dejar} className={clase} data-ventana-dejar><Icono nombre="usuarios" /> Dejar pasar <kbd className="text-xs opacity-70 font-sans">D</kbd></button>;
      case "volver_antes":
        return v.puede ? null : <button key={clave} type="button" disabled={ocupado} onClick={volvioAntes} className={clase} data-ventana-volvio><Icono nombre="pesa" /> Volvió antes: terminar la pausa</button>;
      case "volver_alta":
        return <button key={clave} type="button" disabled={ocupado} onClick={volverAlta} className={clase} data-ventana-volver-alta><Icono nombre="deshacer" /> Volver a dar de alta</button>;
      default:
        return null;
    }
  };

  return (
    <div data-ventana-veredicto={v?.color ?? "cargando"} aria-live="polite">
      {!v ? <div className="p-8"><div className="h-64 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto" aria-hidden /></div> : (<>
        <div className="px-6 sm:px-8 py-5" style={{ background: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 55%)` }}>
          <p className="text-2xl sm:text-3xl font-bold leading-tight"><span aria-hidden><Icono nombre={EMOJI[v.color] ?? "ayuda"} /></span> {v.texto}</p>
        </div>
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-4">
            <span className="relative size-24 sm:size-32 flex-none rounded-[var(--radio)] bg-[var(--tarjeta-alta)] flex items-center justify-center text-4xl font-bold overflow-hidden">
              <Iniciales nombre={elegido.nombre} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={elegido.socio_id} src={`/panel/socios/${elegido.socio_id}/foto`} alt={`Foto de ${elegido.nombre}`} data-foto-ventana
                className="absolute inset-0 size-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </span>
            <div className="min-w-0">
              <p className="titular text-4xl sm:text-5xl break-words">{elegido.nombre}</p>
              <p className="texto-suave text-lg">{elegido.numero != null ? `Socio #${elegido.numero}` : ""}</p>
            </div>
          </div>

          {/* VD-2: lo que hay que decirle, cuánto le falta y los avisos (todo lo calcula la base). */}
          {guia?.falta && <p className="text-xl font-semibold" data-ventana-falta>{guia.falta}</p>}
          {guia?.decile && <p className="text-xl leading-snug" data-ventana-decile><Icono nombre="mensaje" /> {guia.decile}</p>}
          {(guia?.chips.length || avisosSueltos.length || apto || (firmar && !guia)) ? (
            <ul className="flex flex-wrap gap-2" data-ventana-chips>
              {guia?.chips.map((c) => <li key={c.clave} data-chip={c.clave} className="pildora whitespace-normal"><span aria-hidden><Icono nombre={c.emoji} sistema /></span> {c.href ? <Link href={c.href.startsWith("/panel") ? c.href : `/panel${c.href}`} className="underline">{c.texto}</Link> : c.texto}</li>)}
              {avisosSueltos.map((a) => <li key={a} className="pildora whitespace-normal">{a}</li>)}
              {apto && <li className="pildora pildora-amarillo whitespace-normal" data-aviso-apto>{apto}</li>}
              {firmar && !guia && <li className="pildora pildora-amarillo whitespace-normal" data-aviso-firmar>{firmar}</li>}
            </ul>
          ) : null}
          <EventosHoyEntrada key={elegido.socio_id} socioId={elegido.socio_id} eventos={eventosHoy} />
          {v.para_regularizar ? <p className="texto-suave">Para ponerse al día: <strong className="text-[var(--texto)]">{formatearPesos(v.para_regularizar)}</strong></p> : null}
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          {cobrado && (
            <Mensaje tipo="exito"><span data-ventana-cobrado={cobrado.total}>Cobrado {formatearPesos(cobrado.total)}.</span> <ComprobanteCobro ventaId={cobrado.ventaId} className="mt-2" /></Mensaje>
          )}

          <div className="flex flex-wrap gap-2">
            {[principal, segundo].map((clave, i) => clave && boton(clave, i === 0))}
            {!v.puede && !forzando && principal !== "dejar_pasar" && !bloqueadoParaRecepcion && (
              <button type="button" onClick={dejar} className="boton" data-ventana-dejar><Icono nombre="usuarios" /> Dejar pasar <kbd className="text-xs opacity-70 font-sans">D</kbd></button>
            )}
            {!v.puede && bloqueadoParaRecepcion && <p className="basis-full texto-suave"><Icono nombre="candado" /> A este socio lo deja pasar el dueño o el encargado.</p>}
            <Link ref={fichaRef} href={`/panel/socios/${elegido.socio_id}?desde=entrada`} className="boton" data-ventana-ficha
              onClick={() => { try { sessionStorage.setItem(CLAVE_FICHA, JSON.stringify({ socio: elegido, ts: Date.now() })); } catch { /* sin almacenamiento */ } }}><Icono nombre="persona" /> Ficha <kbd className="text-xs opacity-70 font-sans">F</kbd></Link>
            {pruebaModo && pruebaModo !== "no" && v.motivo === "sin_plan" && (
              <button type="button" onClick={() => darPruebaAlSocio(elegido)} disabled={ocupado} className="boton" data-ventana-prueba><Icono nombre="regalo" /> Dar prueba gratis</button>
            )}
            {salidaModo && salidaModo !== "no" && (
              <button type="button" onClick={() => marcarSalida(elegido)} disabled={ocupado} className="boton" data-ventana-salida-boton><Icono nombre="salir" /> Salida <kbd className="text-xs opacity-70 font-sans">S</kbd></button>
            )}
            <button type="button" onClick={() => reiniciar()} className="boton-texto px-3">Otro socio</button>
          </div>

          {forzando && (
            <FormDejarPasar motivo={motivo} setMotivo={setMotivo} cupo={cupo} ocupado={ocupado} porPlata={!!v.para_regularizar} alConfirmar={(pr) => anotar(motivo, pr)} />
          )}
          <p className="text-sm texto-tenue">{puedeAnotarConEnter ? "Enter anota · " : ""}Esc cierra · escribí un número para buscar a otro</p>
        </div>
      </>)}
    </div>
  );
}
