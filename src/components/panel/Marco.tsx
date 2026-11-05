import Link from "next/link";
import type { ReactNode } from "react";
import { propsMarca } from "@/lib/marca";
import { urlMarca } from "@/lib/url-marca";
import { GRUPOS, NOMBRE_ROL, principalesCelular, seccionesPara } from "@/lib/panel/secciones";
import type { PanelGimnasio } from "@/lib/panel/servidor";
import { Navegacion } from "./Navegacion";
import { ProveedorSecciones } from "./LinkPanel";

/** El esqueleto de todas las pantallas del panel: marca del gimnasio, menú y contenido. */
export function Marco({ panel, children, enPlataforma = false }: { panel: PanelGimnasio; children: ReactNode; enPlataforma?: boolean }) {
  const { rol } = panel.yo;
  const secciones = seccionesPara(rol, panel.secciones_apagadas);
  return (
    <div {...propsMarca(panel.marca)} className="min-h-dvh">
      <Navegacion
        gimnasio={panel.gimnasio.nombre}
        logo={urlMarca(panel.marca.logo_path)}
        persona={panel.yo.nombre}
        rol={NOMBRE_ROL[rol]}
        secciones={secciones}
        grupos={GRUPOS}
        principales={principalesCelular(rol, panel.secciones_apagadas)}
        buscaSocios={rol !== "profe" && !panel.secciones_apagadas.includes("socios")}
        cambiarGimnasio={enPlataforma}
      />
      <div className="lg:pl-72">
        <main className="mx-auto max-w-5xl px-4 sm:px-8 pt-6 sm:pt-10 pb-28 lg:pb-16">
          <ProveedorSecciones rol={rol} apagadas={panel.secciones_apagadas}>{children}</ProveedorSecciones>
        </main>
      </div>
    </div>
  );
}

/** Encabezado de una pantalla: emoji, título grande y una línea que explica qué es. */
/** `volver`: el link para subir un nivel (“← Socios”), arriba de todo. */
export function Encabezado({ emoji, titulo, bajada, accion, volver }: { emoji: string; titulo: string; bajada?: ReactNode; accion?: ReactNode; volver?: { href: string; texto: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div className="min-w-0">
        {volver && <Link href={volver.href} className="inline-block texto-suave hover:text-[var(--texto)] mb-4">← {volver.texto}</Link>}
        <p className="text-4xl mb-3" aria-hidden>{emoji}</p>
        <h1 className="titular text-5xl sm:text-6xl">{titulo}</h1>
        {bajada && <p className="texto-suave text-lg mt-2">{bajada}</p>}
      </div>
      {accion}
    </div>
  );
}

/** Cuando algo falla o no hay permiso: se dice qué pasó, nunca una pantalla vacía. */
export function Aviso({ emoji = "⚠️", titulo, children }: { emoji?: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="tarjeta p-6 sm:p-8 max-w-xl">
      <p className="text-4xl mb-4" aria-hidden>{emoji}</p>
      <p className="titulo text-3xl">{titulo}</p>
      {children && <div className="texto-suave text-lg mt-2">{children}</div>}
    </div>
  );
}
