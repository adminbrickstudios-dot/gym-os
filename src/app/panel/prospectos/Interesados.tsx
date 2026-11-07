// VD-15 · Interesados (ex-Prospectos, D22) dentro de Socios: la misma lista y las mismas acciones,
// con la página publicada para armar el WhatsApp. /panel/prospectos redirige a Socios → Interesados.
import { headers } from "next/headers";
import { traerLanding } from "@/lib/landing";
import { direccionPagina } from "@/lib/panel/direccion-pagina";
import { rpc, type PanelGimnasio } from "@/lib/panel/servidor";
import type { Prospecto } from "./Prospectos";

export async function cargarInteresados(panel: PanelGimnasio, conPagina = true) {
  const host = conPagina ? (await headers()).get("x-gimnasio-host") : null;
  const [lista, landing] = await Promise.all([
    rpc<Prospecto[]>("prospectos_panel", { p_gimnasio_id: panel.gimnasio.id }),
    host ? traerLanding(host).catch(() => null) : null,
  ]);
  // REV-1b: el WhatsApp al interesado lleva la página, si está publicada (si no, el link mostraría "Próximamente").
  const pagina = landing?.publicada ? await direccionPagina(panel.gimnasio.slug) : null;
  return { lista, pagina };
}
