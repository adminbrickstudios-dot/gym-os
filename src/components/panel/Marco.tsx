import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { propsMarca } from "@/lib/marca";
import { urlMarca } from "@/lib/url-marca";
import { GRUPOS, NOMBRE_ROL, principalesCelular, rutaDisponible, seccionesPara, type Acceso } from "@/lib/panel/secciones";
import type { BloqueMenu } from "@/lib/panel/organizacion";
import type { PanelGimnasio } from "@/lib/panel/servidor";
import { Navegacion } from "./Navegacion";
import { Campana } from "./Campana";
import { ProveedorSecciones } from "./LinkPanel";
import { SinConexion } from "@/components/ui/SinConexion";
import { VersionNueva } from "@/components/ui/VersionNueva";
import { VentanaEntrada } from "./VentanaEntrada";
import { PanelSocioLateral } from "./PanelSocioLateral";
import { AbrirEnLateral } from "./organizacion/AbrirEnLateral";
import { AvisosEntrada } from "./AvisosEntrada";
import { OrigenPanel } from "./OrigenPanel";
import { VolverAlOrigen } from "./VolverAlOrigen";
import { CobrarHost } from "./cobrar/CobrarHost";
import { sedeActiva } from "@/lib/panel/sede";
import type { ConfigEntrada } from "@/app/panel/entrada/config";
import { Icono } from "@/components/ui/Icono";
import { ATAJOS_PANEL, AtajosAyuda } from "@/components/ui/AtajosAyuda";
import { NOMBRE_PRODUCTO } from "@/lib/producto";

/** El esqueleto de todas las pantallas del panel: marca del gimnasio, menú y contenido. */
/** ADM-2/ADM-3: el abono del gimnasio con BRIK (los montos, solo para el dueño). */
export type Abono = { estado: "sin_abono" | "al_dia" | "por_vencer" | "vencido"; plan?: string; precio_mensual?: number; pagado_hasta?: string; dias?: number };

/** VD-1: lo que necesita la ventana de Entrada que vive en todas las pantallas (null = este rol o este gimnasio no la usa). */
export type DatosEntrada = { sedeId: string; config: ConfigEntrada; conQr: boolean; conLlavero: boolean; sedes?: { id: string; nombre: string }[]; puedeCobrar?: boolean };

/** Pase 2.0 · organización: el menú en bloques ya armado (lo arma el layout del panel, en el servidor: así organizacion.ts no viaja al navegador). */
export type MenuOrganizacion = { bloques: BloqueMenu[]; barra: Omit<Acceso, "roles">[] };
export function Marco({ panel, children, enPlataforma = false, atiende = null, abono = null, entrada = null, organizacion = null }: { panel: PanelGimnasio; children: ReactNode; enPlataforma?: boolean; atiende?: string | null; abono?: Abono | null; entrada?: DatosEntrada | null; organizacion?: MenuOrganizacion | null }) {
  const { rol } = panel.yo;
  const secciones = seccionesPara(rol, panel.secciones_apagadas);
  // Pase 2.0 · organización (llave pase_2_organizacion): el menú en bloques y la barra Inicio · Entrada · Hoy · Socios · Más. Sin la llave, lo de siempre.
  const bloques = organizacion?.bloques;
  const principales: Acceso[] = organizacion ? organizacion.barra.map((b) => ({ ...b, roles: [rol] })) : principalesCelular(rol, panel.secciones_apagadas);
  // Fichar sale del menú: queda el botón Fichar arriba, junto a la campana (solo para quien ficha).
  const fichar = organizacion && secciones.some((s) => s.clave === "fichar");
  // VD-5: la hoja Cobrar vive acá una sola vez; solo donde Vender está prendido y la persona cobra.
  let sedeCobro: string | null = null;
  if (rutaDisponible("/panel/vender", rol, panel.secciones_apagadas)) {
    try { sedeCobro = sedeActiva(panel).sede.id; } catch { sedeCobro = null; }
  }
  return (
    <div {...propsMarca(panel.marca)} className="min-h-dvh con-barra">
      <Navegacion
        gimnasio={panel.gimnasio.nombre}
        logo={urlMarca(panel.marca.logo_path)}
        persona={panel.yo.nombre}
        rol={NOMBRE_ROL[rol]}
        rolClave={rol}
        apagadas={panel.secciones_apagadas}
        secciones={secciones}
        grupos={GRUPOS}
        principales={principales}
        buscaSocios={!panel.secciones_apagadas.includes("socios")}
        soloVerSocios={rol === "profe"}
        puedeCobrar={!!sedeCobro && !panel.secciones_apagadas.includes("socios")}
        cambiarGimnasio={enPlataforma}
        bloques={bloques}
      />
      {/* VD-28: el origen (de qué lista venís) y la memoria de scroll de las listas. */}
      <Suspense fallback={null}><OrigenPanel /></Suspense>
      {sedeCobro && <CobrarHost sedeId={sedeCobro} />}
      <AtajosAyuda atajos={ATAJOS_PANEL} />
      {entrada && <AvisosEntrada gimnasioId={panel.gimnasio.id} sedeId={entrada.sedeId} puedeCobrar={entrada.puedeCobrar ?? false} conVentana ahora={new Date().toISOString()} />}
      {entrada && <PanelSocioLateral sedeId={entrada.sedeId} zona={panel.gimnasio.zona_horaria} />}
      {/* Pase 2.0 · organización: tocar un socio en cualquier lista abre el panel lateral (ver sin entrar). */}
      {entrada && organizacion && <AbrirEnLateral />}
      {entrada && <VentanaEntrada gimnasioId={panel.gimnasio.id} sedeId={entrada.sedeId} zona={panel.gimnasio.zona_horaria} config={entrada.config} conQr={entrada.conQr} conLlavero={entrada.conLlavero} sedes={entrada.sedes ?? []} puedeCobrar={entrada.puedeCobrar ?? false} esRecepcion={rol === "recepcion"} />}
      <div className="lg:pl-72">
        <main className="relative mx-auto max-w-5xl px-4 sm:px-8 pt-6 sm:pt-10 pb-44 lg:pb-16">
          {/* AVI-5: la campana, arriba a la derecha en todas las pantallas. */}
          <div className="absolute right-4 sm:right-8 top-4 sm:top-8 z-10 flex items-center gap-2">
            {fichar && <Link href="/panel/fichar" className="boton boton-chico" data-boton-fichar-arriba><Icono nombre="reloj" /> Fichar</Link>}
            <Campana rol={panel.yo.rol} apagadas={panel.secciones_apagadas} />
          </div>
          <SinConexion />
          <VersionNueva />
          {abono?.estado === "vencido" && (
            <p className="mensaje mensaje-error mb-6 pr-14" data-solo-lectura><Icono nombre="candado" /> El abono de {NOMBRE_PRODUCTO} está vencido: el panel quedó en <strong>solo lectura</strong> (no vende ni edita). La puerta, la app de los socios y la página siguen andando.{panel.yo.rol === "dueno" ? " Hablá con BRIK para regularizarlo." : " Avisale al dueño."}</p>
          )}
          {abono?.estado === "por_vencer" && panel.yo.rol === "dueno" && (
            <p className="mensaje mensaje-aviso mb-6 pr-14" data-abono-por-vencer><Icono nombre="reloj" /> Tu abono de {NOMBRE_PRODUCTO}{abono.plan ? ` (${abono.plan})` : ""} vence {abono.dias === 0 ? "hoy" : abono.dias === 1 ? "mañana" : `en ${abono.dias} días`}. Si vence, el panel queda en solo lectura (la puerta sigue andando).</p>
          )}
          {/* CAJ-3: en esta compu alguien puso su PIN: lo que se haga queda a su nombre. */}
          {atiende && (
            // VD-61: fija arriba mientras se scrollea: cambiar de persona (con el PIN, sin cerrar sesión) siempre a un toque.
            <p className="pildora mb-6 !text-base sticky top-2 z-30 !pr-1" data-atiende={atiende}><Icono nombre="persona" /> Atiende {atiende} · <Link href="/panel/pin" className="underline inline-flex items-center min-h-11 px-3" data-cambiar-persona>Cambiar</Link></p>
          )}
          <ProveedorSecciones rol={rol} apagadas={panel.secciones_apagadas}>{children}</ProveedorSecciones>
        </main>
      </div>
    </div>
  );
}

/** Encabezado de una pantalla: ícono, título grande y una línea que explica qué es. */
/** `volver`: el link para subir un nivel (“← Socios”), arriba de todo. `volverAlOrigen` (VD-28): si se llegó desde una lista, ese link pasa a “← Volver a <esa lista>” con su búsqueda y scroll. */
export function Encabezado({ icono, emoji, titulo, bajada, accion, volver, volverAlOrigen = false }: { icono?: string; /** Antes: un emoji. Lo siguen pasando pantallas de otros carriles; se muestra igual. */ emoji?: string; titulo: string; bajada?: ReactNode; accion?: ReactNode; volver?: { href: string; texto: string }; volverAlOrigen?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6" data-encabezado>
      <div className="min-w-0 pr-14 lg:pr-0 enc-texto">
        {volver && (volverAlOrigen
          ? <VolverAlOrigen href={volver.href} texto={volver.texto} />
          : <Link href={volver.href} className="inline-block texto-suave hover:text-[var(--texto)] mb-4">← {volver.texto}</Link>)}
        {/* DISENO: título de pantalla de 28 px; el ícono va al lado, del tamaño del título y en el acento (no 36 px arriba). */}
        <h1 className="titular text-[28px] flex items-center gap-2.5">
          {(icono ?? emoji) && <span className="text-[var(--acento)] flex-none enc-icono" aria-hidden><Icono nombre={icono ?? emoji} sistema /></span>}
          <span className="min-w-0">{titulo}</span>
        </h1>
        {bajada && <p className="texto-suave text-[15px] mt-1.5 enc-bajada">{bajada}</p>}
      </div>
      {/* La campana de Novedades flota arriba a la derecha: el botón de acción se corre para no quedar debajo de ella (auditoría 18/11). */}
      {accion && <div className="min-w-0 max-w-full sm:mr-14">{accion}</div>}
    </div>
  );
}

/** Cuando algo falla o no hay permiso: se dice qué pasó, nunca una pantalla vacía. */
export function Aviso({ icono, emoji, titulo, children }: { icono?: string; emoji?: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="tarjeta p-6 sm:p-8 max-w-xl">
      <p className="text-4xl mb-4" aria-hidden><Icono nombre={icono ?? emoji ?? "alerta"} sistema /></p>
      <p className="titulo text-3xl">{titulo}</p>
      {children && <div className="texto-suave text-lg mt-2">{children}</div>}
    </div>
  );
}
