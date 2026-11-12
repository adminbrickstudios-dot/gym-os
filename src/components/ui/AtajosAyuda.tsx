"use client";
import { useEffect, useState } from "react";
import { Hoja } from "@/components/ui/Hoja";

export type Atajo = { teclas: string[]; texto: string };

/** Los atajos del panel: solo los que existen de verdad (cada uno se prueba en el e2e `atajos.mjs`). */
export const ATAJOS_PANEL: Atajo[] = [
  { teclas: ["Ctrl", "K"], texto: "Buscar un socio o ir a una pantalla" },
  { teclas: ["F2"], texto: "Abrir la Entrada (o llevar el cursor a la barra del DNI)" },
  { teclas: ["/"], texto: "Abrir la Entrada, fuera de un campo de texto" },
  { teclas: ["Enter"], texto: "Confirmar lo que está abierto (por ejemplo, Cobrar)" },
  { teclas: ["Esc"], texto: "Cerrar la hoja o el panel que está abierto" },
  { teclas: ["?"], texto: "Ver esta lista" },
];

/** Los atajos de /admin (el panel de la plataforma). */
export const ATAJOS_ADMIN: Atajo[] = [
  { teclas: ["Ctrl", "K"], texto: "Buscar un gimnasio o una acción" },
  { teclas: ["Esc"], texto: "Cerrar la búsqueda" },
  { teclas: ["?"], texto: "Ver esta lista" },
];

const escribiendo = (t: EventTarget | null) => {
  const e = t as HTMLElement | null;
  return !!e && (e.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.tagName));
};

/**
 * La tecla "?" abre la lista de atajos (fuera de los campos de texto y sin otra hoja abierta encima).
 * También se puede abrir con el botón "Atajos" del menú (evento `gymos:atajos`).
 */
export function AtajosAyuda({ atajos }: { atajos: Atajo[] }) {
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey || escribiendo(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([data-atajos])')) return;
      e.preventDefault();
      setAbierta((a) => !a);
    };
    const abrir = () => setAbierta(true);
    window.addEventListener("keydown", tecla);
    window.addEventListener("gymos:atajos", abrir);
    return () => { window.removeEventListener("keydown", tecla); window.removeEventListener("gymos:atajos", abrir); };
  }, []);
  return (
    <Hoja abierta={abierta} alCerrar={() => setAbierta(false)} etiqueta="Atajos del teclado">
      <div className="p-5 sm:p-6 pr-14" data-atajos>
        <p className="titulo text-2xl">Atajos del teclado</p>
        <ul className="mt-4 divide-y divide-[var(--borde)]">
          {atajos.map((a) => (
            <li key={a.texto} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-[15px]">{a.texto}</span>
              <span className="flex gap-1 flex-none">{a.teclas.map((t) => <kbd key={t} className="min-w-8 text-center px-2 py-1 rounded-[var(--radio-campo)] border border-[var(--borde)] bg-[var(--tarjeta-alta)] text-[13px] font-semibold">{t}</kbd>)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Hoja>
  );
}
