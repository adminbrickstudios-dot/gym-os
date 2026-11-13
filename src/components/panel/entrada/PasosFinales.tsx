"use client";
// E4 · Los dos pasos que cierran la ventana grande: "Entró 19:42" y "Chau Juan, estuviste 1 h 20".
import type { EventoHoy, ResultadoSalida } from "@/app/panel/entrada/acciones";
import type { ResultadoSocio } from "@/app/panel/acciones";
import { Icono } from "@/components/ui/Icono";
import { Mensaje } from "@/components/ui/Mensaje";
import { Tilde } from "@/components/ui/Tilde";
import { EventosHoyEntrada } from "../EventosHoyEntrada";
import type { Hecho } from "./comun";

export function PasoAnotado({ hecho, eventosHoy, error, ocupado, elegido, cerrarSolaSeg, onDeshacer, onSalida, onSiguiente }: {
  hecho: Hecho; eventosHoy: EventoHoy[]; error: string | null; ocupado: boolean; elegido: ResultadoSocio | null; cerrarSolaSeg: number;
  onDeshacer: () => void; onSalida: (s: ResultadoSocio) => void; onSiguiente: () => void;
}) {
  return (
    <div className="p-8 text-center space-y-4" data-ventana-hecho={hecho.resultado} role="status">
      <div className="flex justify-center text-6xl" aria-hidden>{hecho.resultado === "rechazado" ? <Icono nombre="prohibido" /> : hecho.alerta_prestamo ? <Icono nombre="alerta" /> : <Tilde tamano={72} />}</div>
      <p className="titular text-4xl break-words">{hecho.nombre}</p>
      <p className="text-xl font-semibold">
        {hecho.repetido ? (hecho.texto ?? "Ya estaba anotado hace un momento")
          : hecho.resultado === "forzado" ? `Entrada anotada a las ${hecho.hora} (lo dejaste pasar)`
          : hecho.resultado === "rechazado" ? "Anotado que no pudo entrar"
          : `Entró ${hecho.hora}`}
      </p>
      <div className="flex justify-center"><EventosHoyEntrada key={hecho.socioId} socioId={hecho.socioId} eventos={eventosHoy} /></div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="flex flex-wrap justify-center gap-2">
        {!hecho.repetido && <button type="button" className="boton" disabled={ocupado} onClick={onDeshacer}><Icono nombre="deshacer" /> Deshacer</button>}
        {hecho.repetido && hecho.puede_salir && elegido && (
          <button type="button" className={`boton ${hecho.avisar_salida ? "boton-principal" : ""}`} disabled={ocupado} onClick={() => onSalida(elegido)} data-ventana-salida-boton><Icono nombre="salir" /> Marcar salida <kbd className="text-xs opacity-70 font-sans">S</kbd></button>
        )}
        <button type="button" className={`boton ${hecho.avisar_salida ? "" : "boton-principal"}`} onClick={onSiguiente}>Siguiente</button>
      </div>
      <p className="texto-tenue text-sm">{cerrarSolaSeg ? `Se cierra sola en ${cerrarSolaSeg} s · ` : ""}escribí un número para el próximo</p>
    </div>
  );
}

export function PasoSalio({ salio, error, cerrarSolaSeg, onSiguiente }: {
  salio: ResultadoSalida & { nombre: string }; error: string | null; cerrarSolaSeg: number; onSiguiente: () => void;
}) {
  return (
    <div className="p-8 text-center space-y-4" data-ventana-salida={salio.registrada ? "registrada" : "sin-entrada"} role="status">
      <div className="flex justify-center text-6xl" aria-hidden>{salio.registrada ? <Icono nombre="ok" /> : <Icono nombre="info" />}</div>
      {salio.registrada ? <p className="titular text-4xl break-words">{salio.texto}</p> : (
        <>
          <p className="titular text-4xl break-words">{salio.nombre}</p>
          <p className="text-xl font-semibold">{salio.texto}</p>
        </>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="boton boton-principal" onClick={onSiguiente}>Siguiente</button>
      </div>
      <p className="texto-tenue text-sm">{cerrarSolaSeg ? `Se cierra sola en ${cerrarSolaSeg} s · ` : ""}escribí un número para el próximo</p>
    </div>
  );
}
