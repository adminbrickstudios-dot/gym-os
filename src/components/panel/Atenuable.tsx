"use client";
import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * VD-47X · Filtros y búsquedas sin pantalla en blanco. Los links (a[data-transicion]) y el
 * formulario de búsqueda (form[data-transicion]) siguen siendo un <a> y un <form method=GET> comunes
 * (sin JavaScript andan igual); acá se los intercepta para navegar dentro de una transición: la lista
 * de antes queda a la vista, atenuada (aria-busy), hasta que llega la nueva. Si la navegación tarda
 * más de 10 s, se hace la navegación común de todos modos.
 * Lo que se atenúa es todo lo marcado con data-lista (ver globals.css).
 */
export function Atenuable({ children, className = "" }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const destino = useRef<string | null>(null);
  const escribiendo = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ir = (href: string) => {
    destino.current = href;
    empezar(() => { router.push(href); });
  };
  useEffect(() => {
    if (!pendiente) return;
    const espera = setTimeout(() => { if (destino.current) window.location.assign(destino.current); }, 10000);
    return () => clearTimeout(espera);
  }, [pendiente]);
  useEffect(() => () => { if (escribiendo.current) clearTimeout(escribiendo.current); }, []);

  const hrefDe = (f: HTMLFormElement) => {
    const u = new URLSearchParams();
    for (const [k, v] of new FormData(f).entries()) if (typeof v === "string" && v.trim()) u.set(k, v.trim());
    const base = new URL(f.action, window.location.href).pathname;
    const x = u.toString();
    return x ? `${base}?${x}` : base;
  };

  return (
    <div className={className} aria-busy={pendiente || undefined} data-atenuable={pendiente ? "pendiente" : "listo"}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = (e.target as Element).closest?.("a[data-transicion]") as HTMLAnchorElement | null;
        if (!a || a.target || a.hasAttribute("download")) return;
        const u = new URL(a.href, window.location.href);
        if (u.origin !== window.location.origin) return;
        e.preventDefault();
        ir(u.pathname + u.search);
      }}
      onSubmit={(e) => {
        const f = e.target as HTMLFormElement;
        if (!f.hasAttribute?.("data-transicion")) return;
        e.preventDefault();
        if (escribiendo.current) clearTimeout(escribiendo.current);
        ir(hrefDe(f));
      }}
      onInput={(e) => {
        // Buscar mientras se escribe, con una pausa para no pedir en cada letra.
        const t = e.target as HTMLElement;
        const f = t.closest?.("form[data-transicion]") as HTMLFormElement | null;
        if (!f || !t.matches("input[name=q]")) return;
        if (escribiendo.current) clearTimeout(escribiendo.current);
        escribiendo.current = setTimeout(() => ir(hrefDe(f)), 350);
      }}>
      {children}
    </div>
  );
}
