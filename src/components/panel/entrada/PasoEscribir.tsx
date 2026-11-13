"use client";
// E4 · El paso "escribir" de la ventana grande: el campo del DNI, las coincidencias y el "no hay nadie con ese DNI".
import Link from "next/link";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { ResultadoSocio } from "@/app/panel/acciones";
import type { DetectorLector } from "@/app/panel/entrada/lector";
import type { RegistrarSalida } from "@/app/panel/entrada/ventana-acciones";
import { urlDarDeAlta } from "@/lib/panel/alta-url";
import { Icono } from "@/components/ui/Icono";
import { Mensaje } from "@/components/ui/Mensaje";
import { PuntoEstado } from "../Estado";
import { conPuntos, sinPuntos } from "./comun";

export default function PasoEscribir({ campo, detector, enterPendiente, texto, setTexto, setNadie, setError, setMarcado, setAnulada, anulada, error, nadie, dni, socios, hayLista, marcado, ocupado, sedes, sedeId, elegirSede, sonido, alternarSonido, conQr, abrirCamara, pruebaModo, salidaModo, leer, resolver, elegir, iniciarAlta, iniciarPrueba, salirConDni }: {
  campo: RefObject<HTMLInputElement | null>; detector: MutableRefObject<DetectorLector>; enterPendiente: MutableRefObject<boolean>;
  texto: string; setTexto: (t: string) => void; setNadie: (n: string | null) => void; setError: (e: string | null) => void; setMarcado: Dispatch<SetStateAction<number>>; setAnulada: (a: string | null) => void;
  anulada: string | null; error: string | null; nadie: string | null; dni: string | null;
  socios: ResultadoSocio[]; hayLista: boolean; marcado: number; ocupado: boolean;
  sedes: { id: string; nombre: string }[]; sedeId: string; elegirSede: (id: string) => void;
  sonido: boolean; alternarSonido: () => void; conQr: boolean; abrirCamara: () => void;
  pruebaModo: "no" | "dia" | "clase" | null; salidaModo: RegistrarSalida | null;
  leer: (crudo: string) => void; resolver: (crudo: string) => void; elegir: (s: ResultadoSocio) => void;
  iniciarAlta: (dni: string) => void; iniciarPrueba: (dni: string) => void; salirConDni: (dni: string) => void;
}) {
  return (
    <div className="p-6 sm:p-8 space-y-4">
      <p className="titulo text-2xl text-center"><Icono nombre="puerta" /> Entrada</p>
      {anulada && <p role="status" className="pildora pildora-verde whitespace-normal justify-center" data-ventana-anulada><Icono nombre="ok" /> {anulada}</p>}
      {/* VD-1b: el dueño con varias sedes elige en cuál anota (queda en esta compu). */}
      {sedes.length > 1 && (
        <div role="group" aria-label="Sede" className="flex flex-wrap justify-center gap-2" data-ventana-sedes>
          {sedes.map((s) => (
            <button key={s.id} type="button" aria-pressed={s.id === sedeId} data-sede={s.id} onClick={() => { elegirSede(s.id); setTimeout(() => campo.current?.focus(), 0); }}
              className={`pestana ${s.id === sedeId ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`}><Icono nombre="ubicacion" /> {s.nombre}</button>
          ))}
        </div>
      )}
      <input ref={campo} data-ventana-campo value={conPuntos(texto)} autoComplete="off" aria-label="Buscar socio: DNI, número o nombre"
        onChange={(e) => { setTexto(sinPuntos(e.target.value)); setNadie(null); setError(null); setMarcado(0); setAnulada(null); }}
        onKeyDown={(e) => {
          detector.current.tecla(e.key, e.timeStamp);
          // C5: tipeo de corrido terminado en Enter = lectura del lector. Se toma lo que hay en el campo (no el estado, que puede ir un render atrás).
          if (e.key === "Enter" && detector.current.enter(e.timeStamp)) { e.preventDefault(); leer(e.currentTarget.value); return; }
          if (e.code === "NumpadDecimal") { e.preventDefault(); return; }   // el punto del teclado numérico no va en un DNI
          if (e.key.toLowerCase() === "a" && !e.ctrlKey && !e.metaKey && !e.altKey && dni) { e.preventDefault(); iniciarAlta(nadie!); }
          else if (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.metaKey && !e.altKey && dni && pruebaModo && pruebaModo !== "no") { e.preventDefault(); iniciarPrueba(nadie!); }
          else if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey && !e.altKey && salidaModo && salidaModo !== "no" && /^\d{6,9}$/.test(sinPuntos(texto).trim())) {
            e.preventDefault(); if (!ocupado) salirConDni(sinPuntos(texto).trim());
          }
          else if (e.key === "ArrowDown" && hayLista) { e.preventDefault(); setMarcado((m) => Math.min(m + 1, Math.min(socios.length, 3) - 1)); }
          else if (e.key === "ArrowUp" && hayLista) { e.preventDefault(); setMarcado((m) => Math.max(m - 1, 0)); }
          else if (e.key === "Enter") {
            e.preventDefault();
            // Si todavía está terminando una búsqueda, el Enter no se pierde: queda anotado y corre apenas termina.
            if (ocupado) { enterPendiente.current = true; return; }
            if (hayLista) elegir(socios[Math.min(marcado, socios.length - 1)]); else resolver(texto);
          }
        }}
        placeholder="30.123.456" className="campo !min-h-24 !text-5xl sm:!text-6xl text-center font-bold tracking-wide numero" />
      <p className="texto-tenue text-center text-sm">Enter para buscar · Esc para cerrar · también por nombre</p>
      {/* D50: el sonido se prende o apaga por compu (es del mostrador, no del gimnasio). */}
      <div className="flex justify-center">
        <button type="button" aria-pressed={sonido} data-sonido-ventana={sonido ? "si" : "no"} className="min-h-11 px-3 rounded-[var(--radio)] text-sm texto-suave active:opacity-60"
          onClick={() => { alternarSonido(); campo.current?.focus(); }}>
          <Icono nombre="campana" /> {sonido ? "Con sonido" : "Sin sonido"}
        </button>
      </div>
      {conQr && <div className="flex justify-center"><button type="button" className="boton" onClick={abrirCamara}><Icono nombre="camara" /> Leer QR</button></div>}

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {ocupado && !hayLista && <div className="h-16 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto" aria-hidden />}

      {hayLista && (
        <ul className="space-y-2" aria-label="Coincidencias">
          {socios.slice(0, 3).map((s, i) => (
            <li key={s.socio_id}>
              <button type="button" onClick={() => elegir(s)} aria-current={i === marcado} className={`fila ${i === marcado ? "!border-[var(--acento)]" : ""}`}>
                <PuntoEstado color={s.color} grande />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-lg truncate">{s.nombre} {s.numero != null && <span className="texto-tenue font-normal">#{s.numero}</span>}</span>
                  <span className="block texto-suave truncate">{s.texto}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {nadie && !error && (
        <div className="tarjeta p-5 space-y-3" data-ventana-nadie>
          <p className="text-lg font-semibold">{dni ? `No hay nadie con ${dni}` : `No encontramos a “${nadie}”`}</p>
          <div className="flex flex-wrap gap-2">
            {dni
              ? <button type="button" className="boton boton-principal" data-ventana-alta onClick={() => iniciarAlta(nadie!)}><Icono nombre="mas" /> Darlo de alta <kbd className="text-xs opacity-70 font-sans">A</kbd></button>
              : <Link href={urlDarDeAlta(nadie)} className="boton boton-principal"><Icono nombre="mas" /> Darlo de alta</Link>}
            {dni && pruebaModo && pruebaModo !== "no" && (
              <button type="button" className="boton" data-ventana-prueba onClick={() => iniciarPrueba(nadie!)}><Icono nombre="regalo" /> Dar prueba gratis <kbd className="text-xs opacity-70 font-sans">P</kbd></button>
            )}
            {dni && <Link href={urlDarDeAlta(nadie)} className="boton" data-ventana-alta-completa>Alta completa</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
