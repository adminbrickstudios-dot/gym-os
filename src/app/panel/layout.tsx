import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { Aviso } from "@/components/panel/Marco";
import { Marco, type Abono, type DatosEntrada } from "@/components/panel/Marco";
import { RegistrarSesion } from "@/components/panel/RegistrarSesion";
import { CONFIG_ENTRADA_POR_DEFECTO, type ConfigEntrada } from "./entrada/config";
import { rutaDisponible } from "@/lib/panel/secciones";
import { sedeActiva } from "@/lib/panel/sede";
import { dominioPlataforma } from "@/lib/dominios";
import { normalizarHost } from "@/lib/host";
import { urlMarca } from "@/lib/landing";
import { contextoPanel, ErrorDatos, rpc } from "@/lib/panel/servidor";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const p = await contextoPanel();
    const icono = urlMarca(p.marca.favicon_path ?? p.marca.logo_path);
    return { title: { default: p.gimnasio.nombre, template: `%s · ${p.gimnasio.nombre}` }, icons: icono ? { icon: icono } : undefined, robots: { index: false, follow: false } };
  } catch {
    return { title: "Panel", robots: { index: false, follow: false } };
  }
}

export default async function LayoutPanel({ children }: { children: ReactNode }) {
  // En la dirección de la plataforma (sin subdominio) se puede volver a elegir gimnasio.
  const enPlataforma = normalizarHost((await headers()).get("host")) === dominioPlataforma();
  let panel;
  try {
    panel = await contextoPanel();
  } catch (e) {
    if (e instanceof ErrorDatos && e.sinPermiso) {
      return (
        <main className="min-h-dvh flex items-center px-4">
          <div className="mx-auto w-full max-w-xl">
            <Aviso emoji="🔒" titulo="No tenés acceso a este gimnasio">
              Tu usuario no es parte del equipo acá. Si debería serlo, pedile al dueño que te agregue.
              <div className="mt-6 flex flex-wrap gap-2">
                {enPlataforma && <Link href="/elegir" className="boton boton-principal">🔁 Elegir otro gimnasio</Link>}
                <form action="/salir" method="post"><button className="boton">🚪 Cerrar sesión</button></form>
              </div>
            </Aviso>
          </div>
        </main>
      );
    }
    throw e;
  }
  const atiende = (await cookies()).get("gymos_operador_nombre")?.value;
  // ADM-2/ADM-3: el abono de Gym OS (si falla la consulta, no se inventa un estado).
  const abono = await rpc<Abono>("estado_abono_panel", { p_gimnasio_id: panel.gimnasio.id }).catch(() => null);
  // VD-1: la ventana de Entrada vive en todas las pantallas (recepción, encargado y dueño; la profe no entra a la puerta).
  let entrada: DatosEntrada | null = null;
  if (panel.yo.rol !== "profe" && rutaDisponible("/panel/entrada", panel.yo.rol, panel.secciones_apagadas)) {
    try {
      const { sede, puedeCambiar } = sedeActiva(panel);
      const [config, formas] = await Promise.all([
        rpc<ConfigEntrada>("config_entrada", { p_gimnasio_id: panel.gimnasio.id }).catch(() => CONFIG_ENTRADA_POR_DEFECTO),
        rpc<string[]>("formas_de_entrada", { p_gimnasio_id: panel.gimnasio.id }).catch(() => [] as string[]),
      ]);
      entrada = {
        sedeId: sede.id, config, conQr: formas.includes("qr_socio"), conLlavero: formas.includes("nfc"),
        // VD-1b: el dueño con varias sedes elige en cuál anota; VD-6: el alta rápida cobra solo si Vender está disponible.
        sedes: puedeCambiar ? panel.sedes.map((s) => ({ id: s.id, nombre: s.nombre })) : [],
        puedeCobrar: rutaDisponible("/panel/vender", panel.yo.rol, panel.secciones_apagadas),
      };
    } catch { entrada = null; }   // sin sede activa: la pantalla de Entrada lo dice con todas las letras
  }
  return (
    <>
      <RegistrarSesion />
      <Marco panel={panel} enPlataforma={enPlataforma} atiende={atiende ?? null} abono={abono} entrada={entrada}>{children}</Marco>
    </>
  );
}
