"use client";
// FA-17 · "¿Seguimos donde dejaste?" Se pone DENTRO de un <form> largo: guarda lo escrito en el dispositivo (ver borrador.ts) y,
// si al volver hay un borrador, lo ofrece. Con `borrar` (cuando el envío salió bien) saca el borrador. No toca los campos
// ocultos ni las contraseñas, y no guarda nada en la base.
import { useEffect, useRef, useState } from "react";
import { borrarBorrador, guardarBorrador, leerBorrador, type Borrador } from "./borrador";

const SIN_GUARDAR = new Set(["hidden", "password", "checkbox", "radio", "file", "submit", "button"]);
const almacen = () => { try { return window.localStorage; } catch { return null; } };

function campos(form: HTMLFormElement): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || !el.name) continue;
    if (el instanceof HTMLInputElement && SIN_GUARDAR.has(el.type)) continue;
    salida[el.name] = el.value;
  }
  return salida;
}

/** Escribe el valor como si lo hubiera tipeado la persona, para que React (campos controlados) se entere. */
function poner(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, valor: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, valor);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function BorradorAutomatico({ clave, borrar = false }: { clave: string; borrar?: boolean }) {
  const marca = useRef<HTMLSpanElement>(null);
  const [pendiente, setPendiente] = useState<Borrador | null>(null);

  useEffect(() => {
    if (borrar) { borrarBorrador(almacen(), clave); return; }
    const form = marca.current?.closest("form");
    if (!form) return;
    // Lo que había de antes, solo si el formulario está vacío (no se pisa lo que ya escribió).
    const previo = leerBorrador(almacen(), clave);
    if (previo && Object.values(campos(form)).every((v) => v.trim() === "")) setPendiente(previo);
    let espera: ReturnType<typeof setTimeout> | undefined;
    const alEscribir = () => { clearTimeout(espera); espera = setTimeout(() => guardarBorrador(almacen(), clave, campos(form)), 500); };
    form.addEventListener("input", alEscribir);
    return () => { clearTimeout(espera); form.removeEventListener("input", alEscribir); };
  }, [clave, borrar]);

  const seguir = () => {
    const form = marca.current?.closest("form");
    if (form && pendiente) {
      for (const [nombre, valor] of Object.entries(pendiente.campos)) {
        const el = form.elements.namedItem(nombre);
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) poner(el, valor);
      }
    }
    setPendiente(null);
  };
  const empezarDeNuevo = () => { borrarBorrador(almacen(), clave); setPendiente(null); };

  return (
    <span ref={marca} className="contents">
      {pendiente && (
        <div className="tarjeta p-4 space-y-3" role="region" aria-label="Borrador guardado" data-borrador>
          <p className="font-semibold">¿Seguimos donde dejaste?</p>
          <p className="texto-suave text-sm">Quedó guardado lo que habías escrito en este dispositivo.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton boton-principal !min-h-11" onClick={seguir} data-borrador-seguir>Seguir</button>
            <button type="button" className="boton !min-h-11" onClick={empezarDeNuevo} data-borrador-descartar>Empezar de nuevo</button>
          </div>
        </div>
      )}
    </span>
  );
}
