import Link from "next/link";
import type { ReactNode } from "react";
import { propsMarca } from "@/lib/marca";
import { urlMarca } from "@/lib/url-marca";
import { GRUPOS, NOMBRE_ROL, principalesCelular, seccionesPara } from "@/lib/panel/secciones";
import type { PanelGimnasio } from "@/lib/panel/servidor";
import { Navegacion } from "./Navegacion";
import { Campana } from "./Campana";
import { ProveedorSecciones } from "./LinkPanel";

/** El esqueleto de todas las pantallas del panel: marca del gimnasio, menú y contenido. */
/** ADM-2/ADM-3: el abono del gimnasio con BRIK (los montos, solo para el dueño). */
export type Abono = { estado: "sin_abono" | "al_dia" | "por_vencer" | "vencido"; plan?: string; precio_mensual?: number; pagado_hasta?: string; dias?: number };

export function Marco({ panel, children, enPlataforma = false, atiende = null, abono = null }: { panel: PanelGimnasio; children: ReactNode; enPlataforma?: boolean; atiende?: string | null; abono?: Abono | null }) {
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
        buscaSocios={!panel.secciones_apagadas.includes("socios")}
        soloVerSocios={rol === "profe"}
        cambiarGimnasio={enPlataforma}
      />
      <div className="lg:pl-72">
        <main className="relative mx-auto max-w-5xl px-4 sm:px-8 pt-6 sm:pt-10 pb-28 lg:pb-16">
          {/* AVI-5: la campana, arriba a la derecha en todas las pantallas. */}
          <div className="absolute right-4 sm:right-8 top-4 sm:top-8 z-10"><Campana /></div>
          {abono?.estado === "vencido" && (
            <p className="mensaje mensaje-error mb-6 pr-14" data-solo-lectura>🔒 El abono de Gym OS está vencido: el panel quedó en <strong>solo lectura</strong> (no vende ni edita). La puerta, la app de los socios y la página siguen andando.{panel.yo.rol === "dueno" ? " Hablá con BRIK para regularizarlo." : " Avisale al dueño."}</p>
          )}
          {abono?.estado === "por_vencer" && panel.yo.rol === "dueno" && (
            <p className="mensaje mensaje-aviso mb-6 pr-14" data-abono-por-vencer>⏰ Tu abono de Gym OS{abono.plan ? ` (${abono.plan})` : ""} vence {abono.dias === 0 ? "hoy" : abono.dias === 1 ? "mañana" : `en ${abono.dias} días`}. Si vence, el panel queda en solo lectura (la puerta sigue andando).</p>
          )}
          {/* CAJ-3: en esta compu alguien puso su PIN: lo que se haga queda a su nombre. */}
          {atiende && (
            <p className="pildora mb-6 !text-base" data-atiende={atiende}>👤 Atiende {atiende} · <Link href="/panel/pin" className="underline">Cambiar</Link></p>
          )}
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
