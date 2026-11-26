"use client";
// Pase 2.0 · organización (26/11): las pestañas arriba de una entrada del menú que junta varias pantallas (/panel/bloque/<entrada>?pestana=).
// La pantalla de cada pestaña es la de siempre: el proxy reescribe la dirección por dentro (la del navegador queda como pestaña, así andan
// Atrás y los links), y acá solo se dibuja la fila de pestañas mirando la dirección. Las pestañas que llegan ya son las que el rol ve.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type PestanasDeBloque = { clave: string; titulo: string; pestanas: { seccion: string; titulo: string }[] };

export function PestanasBloque({ bloques }: { bloques: PestanasDeBloque[] }) {
  const ruta = usePathname();
  const sp = useSearchParams();
  const clave = /^\/panel\/bloque\/([a-z]+)$/.exec(ruta ?? "")?.[1];
  const bloque = bloques.find((b) => b.clave === clave);
  if (!bloque || bloque.pestanas.length < 2) return null;
  const pedida = sp.get("pestana");
  const activa = bloque.pestanas.find((p) => p.seccion === pedida)
    ?? (sp.get("vista") === "interesados" ? bloque.pestanas.find((p) => p.seccion === "prospectos") : undefined)
    ?? bloque.pestanas[0];
  return (
    <nav aria-label={bloque.titulo} className="flex flex-wrap gap-2 mb-5" data-pestanas-bloque data-bloque={bloque.clave} data-pestana-activa={activa.seccion}>
      {bloque.pestanas.map((p) => (
        <Link key={p.seccion} href={`/panel/bloque/${bloque.clave}?pestana=${p.seccion}`} className="pestana" data-transicion data-pestana-bloque={p.seccion}
          aria-current={p.seccion === activa.seccion ? "page" : undefined}>{p.titulo}</Link>
      ))}
    </nav>
  );
}
