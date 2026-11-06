"use client";
// VD-28 · Vive una sola vez en el Marco. (1) Anota el ORIGEN: al salir de una lista hacia una ficha o detalle,
// guarda de dónde (ruta + query + scroll) para que "← Volver a Socios" y Cobrar vuelvan ahí. (2) Monta la
// memoria de scroll de las listas que no tienen la suya. (3) Muestra el aviso de lo que se hizo al volver.
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Mensaje } from "@/components/ui/Mensaje";
import { MemoriaLista } from "./MemoriaLista";
import { LISTAS, dentroDe, guardarOrigen, leerLista, leerOrigen, tomarAviso } from "@/lib/panel/origen";

export function OrigenPanel() {
  const pathname = usePathname();
  const params = useSearchParams().toString();
  const q = params ? `?${params}` : "";
  const previo = useRef<{ ruta: string; q: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const antes = previo.current;
    previo.current = { ruta: pathname, q };
    if (antes && antes.ruta === pathname) return;   // solo cambió la query: es la misma pantalla
    const a = tomarAviso();
    let cierre: ReturnType<typeof setTimeout> | undefined;
    if (a) { setAviso(a); cierre = setTimeout(() => setAviso(null), 6000); }
    if (LISTAS[pathname]) {
      guardarOrigen(null);
    } else if (antes && LISTAS[antes.ruta]) {
      // Se salió de una lista hacia una ficha o detalle: ese es el origen.
      const g = leerLista(antes.ruta);
      guardarOrigen({ ruta: antes.ruta, q: antes.q, y: g && g.q === antes.q ? g.y : 0, nombre: LISTAS[antes.ruta].nombre, destino: pathname, t: Date.now() });
    } else {
      const o = leerOrigen();
      if (o && !dentroDe(o, pathname)) guardarOrigen(null);   // se fue a otro lado: el origen ya no vale
    }
    return () => { if (cierre) clearTimeout(cierre); };
  }, [pathname, q]);

  const lista = LISTAS[pathname];
  return (
    <>
      {lista && !lista.propia && <MemoriaLista key={pathname} ruta={pathname} actual={q} />}
      {aviso && (
        <div className="fixed inset-x-4 bottom-24 lg:bottom-6 lg:left-80 z-50 mx-auto max-w-md" data-aviso-origen>
          <Mensaje tipo="exito">{aviso}</Mensaje>
        </div>
      )}
    </>
  );
}
