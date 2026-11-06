"use client";
// VD-36: las pestañas de abajo de la app del socio. Cuáles hay lo decide la base
// (pestanas_app): sin clases no hay pestaña Clases; con la sección apagada, tampoco Rutina.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Pestana = { clave: string; ruta: string; emoji: string; titulo: string; activa: (p: string) => boolean };

export function NavSocio({ clases, rutina }: { clases: boolean; rutina: boolean }) {
  const ruta = usePathname();
  const socio = useSearchParams().get("socio");
  const q = socio ? `?socio=${encodeURIComponent(socio)}` : "";
  const todas: (Pestana | false)[] = [
    { clave: "inicio", ruta: "/app", emoji: "🏠", titulo: "Inicio", activa: (p) => p === "/app" },
    clases && { clave: "clases", ruta: "/app/clases", emoji: "🗓️", titulo: "Clases", activa: (p) => p.startsWith("/app/clases") },
    rutina && { clave: "rutina", ruta: "/app/rutina", emoji: "💪", titulo: "Rutina", activa: (p) => p.startsWith("/app/rutina") },
    { clave: "yo", ruta: "/app/yo", emoji: "👤", titulo: "Yo", activa: (p) => /^\/app\/(yo|historial|cuenta|novedades|pago)/.test(p) },
  ];
  const pestanas = todas.filter((x): x is Pestana => !!x);
  return (
    <nav aria-label="Secciones de la app" data-nav-socio={pestanas.map((x) => x.clave).join(",")}
      className="fixed bottom-0 inset-x-0 z-30 border-t border-[var(--borde)] backdrop-blur-md bg-[color-mix(in_oklab,var(--fondo)_90%,transparent)] pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto max-w-lg px-2 h-16 flex">
        {pestanas.map((x) => {
          const activa = x.activa(ruta);
          return (
            <li key={x.clave} className="flex-1 min-w-0">
              <Link href={`${x.ruta}${q}`} aria-current={activa ? "page" : undefined} data-pestana={x.clave}
                className={`h-full flex flex-col items-center justify-center gap-0.5 rounded-xl transition active:scale-95 ${activa ? "text-[var(--acento)] font-semibold" : "texto-suave"}`}>
                <span className="text-2xl leading-none" aria-hidden>{x.emoji}</span>
                <span className="text-xs">{x.titulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
