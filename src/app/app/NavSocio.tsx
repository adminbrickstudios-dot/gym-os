"use client";
// VD-36: las pestañas de abajo de la app del socio. Cuáles hay lo decide la base
// (pestanas_app): sin clases no hay pestaña Clases; con la sección apagada, tampoco Rutina.
// FA-18: al cambiar de pestaña la pantalla se funde con View Transitions (solo si el navegador las tiene y el socio no pidió
// "reducir movimiento"); si algo falla, se navega igual que siempre, sin efecto.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type MouseEvent } from "react";
import "./transiciones.css";
import { Icono } from "@/components/ui/Icono";

type Pestana = { clave: string; ruta: string; emoji: string; titulo: string; activa: (p: string) => boolean };
type ConTransicion = Document & { startViewTransition?: (cb: () => Promise<void> | void) => unknown };

export function NavSocio({ clases, rutina }: { clases: boolean; rutina: boolean }) {
  const ruta = usePathname();
  const router = useRouter();
  const socio = useSearchParams().get("socio");
  const q = socio ? `?socio=${encodeURIComponent(socio)}` : "";
  const terminar = useRef<(() => void) | null>(null);
  // Cuando la ruta cambió, la pantalla nueva ya está: ahí termina la transición.
  useEffect(() => { terminar.current?.(); terminar.current = null; }, [ruta]);

  const alTocar = (e: MouseEvent<HTMLAnchorElement>, destino: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const doc = document as ConTransicion;
    if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (destino.split("?")[0] === ruta) return;
    e.preventDefault();
    doc.startViewTransition(() => new Promise<void>((resolver) => {
      terminar.current = resolver;
      setTimeout(resolver, 1200);   // si la pantalla nueva tarda, la transición no se queda colgada
      router.push(destino);
    }));
  };

  const todas: (Pestana | false)[] = [
    { clave: "inicio", ruta: "/app", emoji: "inicio", titulo: "Inicio", activa: (p) => p === "/app" },
    clases && { clave: "clases", ruta: "/app/clases", emoji: "calendario", titulo: "Clases", activa: (p) => p.startsWith("/app/clases") },
    rutina && { clave: "rutina", ruta: "/app/rutina", emoji: "pesa", titulo: "Rutina", activa: (p) => p.startsWith("/app/rutina") },
    { clave: "yo", ruta: "/app/yo", emoji: "persona", titulo: "Yo", activa: (p) => /^\/app\/(yo|historial|cuenta|novedades|pago|mensajes|info|ayuda|resumen|pedir-datos)/.test(p) },
  ];
  const pestanas = todas.filter((x): x is Pestana => !!x);
  return (
    <nav aria-label="Secciones de la app" data-nav-socio={pestanas.map((x) => x.clave).join(",")}
      className="nav-socio fixed bottom-0 inset-x-0 z-30 border-t border-[var(--borde)] backdrop-blur-md bg-[color-mix(in_oklab,var(--fondo)_90%,transparent)] pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto max-w-lg px-2 h-16 flex">
        {pestanas.map((x) => {
          const activa = x.activa(ruta);
          const destino = `${x.ruta}${q}`;
          return (
            <li key={x.clave} className="flex-1 min-w-0">
              <Link href={destino} onClick={(e) => alTocar(e, destino)} aria-current={activa ? "page" : undefined} data-pestana={x.clave}
                className={`h-full flex flex-col items-center justify-center gap-0.5 rounded-xl transition active:scale-95 ${activa ? "text-[var(--acento)] font-semibold" : "texto-suave"}`}>
                <span className="text-2xl leading-none" aria-hidden><Icono nombre={x.emoji} /></span>
                <span className="text-xs">{x.titulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
