"use client";
// VD-28 · "← Volver a Socios": lleva a donde estabas (la lista con su búsqueda, filtros y scroll), no a una ruta
// fija. Si no hay origen (se abrió la pantalla directo), cae en el link de siempre. Con <Link>, nunca router.push.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { CLAVE_ORIGEN, EVENTO_ORIGEN, origenPara } from "@/lib/panel/origen";

const suscribir = (cb: () => void) => { window.addEventListener(EVENTO_ORIGEN, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVENTO_ORIGEN, cb); window.removeEventListener("storage", cb); }; };
const leer = () => { try { return sessionStorage.getItem(CLAVE_ORIGEN) ?? ""; } catch { return ""; } };

/** `href`/`texto`: adónde sube sin origen (“← Socios”). */
export function VolverAlOrigen({ href, texto, className = "inline-block texto-suave hover:text-[var(--texto)] mb-4" }: { href: string; texto: string; className?: string }) {
  const pathname = usePathname();
  const crudo = useSyncExternalStore(suscribir, leer, () => "");
  const origen = useMemo(() => (crudo ? origenPara(pathname, crudo) : null), [crudo, pathname]);
  return origen
    ? <Link href={`${origen.ruta}${origen.q}`} className={className} data-volver-origen={origen.ruta}>← Volver a {origen.nombre}</Link>
    : <Link href={href} className={className} data-volver-origen="">← {texto}</Link>;
}
