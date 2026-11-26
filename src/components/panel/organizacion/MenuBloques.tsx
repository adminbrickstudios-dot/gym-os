"use client";
// Pase 2.0 · organización (26/11 · menu-en-bloques.png y celular-mas.png): el menú de 12 en cuatro bloques, con su línea chica, y "Más" del
// celular en grilla de botones grandes. Lo baja Navegacion con next/dynamic, solo con la llave prendida.
import Link from "next/link";
import type { Grupo } from "@/lib/panel/secciones";
import type { BloqueMenu } from "@/lib/panel/organizacion";
import type { Pendientes } from "@/lib/panel/pendientes";
import { Icono } from "@/components/ui/Icono";
import { Item, Numero, bloqueActivo, claveNumero, numeroBloque } from "../Navegacion";

export function MenuBloques({ bloques, grupos, actual, alElegir, pendientes }: { bloques: BloqueMenu[]; grupos: Grupo[]; actual: string; alElegir?: () => void; pendientes: Pendientes | null }) {
  return (
    <nav aria-label="Secciones" className="space-y-6" data-menu-bloques>
      <Item s={{ ruta: "/panel", emoji: "inicio", titulo: "Inicio" }} actual={actual} alElegir={alElegir} />
      {grupos.map((g) => {
        const items = bloques.filter((b) => b.grupo === g);
        if (!items.length) return null;
        return (
          <div key={g} data-grupo={g}>
            <p className="titulo-grupo px-3 mb-1.5">{g}</p>
            <div className="space-y-0.5">
              {items.map((b) => {
                const on = bloqueActivo(actual, b);
                const n = numeroBloque(pendientes, b);
                return (
                  <Link key={b.clave} href={b.ruta} onClick={alElegir} aria-current={on ? "page" : undefined} data-bloque-menu={b.clave}
                    className={`flex items-center gap-3 rounded-[var(--radio)] px-3 min-h-12 py-2 transition-colors ${on ? "bg-[var(--tarjeta-alta)]" : "hover:bg-[var(--tarjeta)]"}`}>
                    <span className={`text-xl w-7 text-center ${on ? "text-[var(--acento)]" : "texto-suave"}`} aria-hidden><Icono nombre={b.emoji} sistema /></span>
                    <span className="min-w-0">
                      <span className={`block font-semibold leading-tight ${on ? "" : "text-[var(--texto)]"}`}>{b.titulo}</span>
                      <span className="block text-[13px] texto-tenue leading-snug" data-linea-bloque>{b.linea}</span>
                    </span>
                    <Numero clave={claveNumero(pendientes, b)} n={n} />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="space-y-0.5"><Item s={{ ruta: "/panel/ayuda", emoji: "ayuda", titulo: "Ayuda", descripcion: "Preguntas cortas y cómo se hace" }} actual={actual} alElegir={alElegir} /></div>
    </nav>
  );
}

/** Pase 2.0 · organización: "Más" en el celular, los cuatro bloques en grilla de botones grandes (organizacion/celular-mas.png). */
export function MasEnBloques({ bloques, grupos, alElegir, pendientes }: { bloques: BloqueMenu[]; grupos: Grupo[]; alElegir: () => void; pendientes: Pendientes | null }) {
  return (
    <nav aria-label="Más" className="space-y-5" data-mas-bloques>
      {grupos.map((g) => {
        const items = bloques.filter((b) => b.grupo === g);
        if (!items.length) return null;
        return (
          <div key={g} data-grupo={g}>
            <p className="titulo-grupo mb-2">{g}</p>
            <div className="grid grid-cols-3 gap-2.5">
              {items.map((b) => (
                <Link key={b.clave} href={b.ruta} onClick={alElegir} data-bloque-mas={b.clave}
                  className="tarjeta relative flex flex-col items-center justify-center gap-1.5 min-h-24 px-2 py-3 text-center font-semibold leading-tight">
                  <span className="text-3xl" aria-hidden><Icono nombre={b.emoji} sistema /></span>
                  <span className="text-[15px]">{b.corto ?? b.titulo}</span>
                  {numeroBloque(pendientes, b) > 0 && <span className="absolute top-2 right-2"><Numero clave={claveNumero(pendientes, b)} n={numeroBloque(pendientes, b)} /></span>}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
