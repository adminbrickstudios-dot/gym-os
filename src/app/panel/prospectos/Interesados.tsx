// VD-15 · Interesados (ex-Prospectos, D22) dentro de Socios: la misma lista y las mismas acciones,
// con la página publicada para armar el WhatsApp. /panel/prospectos redirige a Socios → Interesados.
import { headers } from "next/headers";
import { traerLanding } from "@/lib/landing";
import { direccionPagina } from "@/lib/panel/direccion-pagina";
import { lectura, rpcLote, type PanelGimnasio } from "@/lib/panel/servidor";
import type { Prospecto } from "./Prospectos";
import type { InvitadoSinSeguir } from "./InvitadosPorSeguir";

export async function cargarInteresados(panel: PanelGimnasio, conPagina = true) {
  const host = conPagina ? (await headers()).get("x-gimnasio-host") : null;
  // Cacería (18/11): la lista, los invitados sin seguimiento y las funciones prendidas en UN viaje (lote_lecturas); los invitados son opcionales (si fallan, la lista sigue).
  const g = { p_gimnasio_id: panel.gimnasio.id };
  const [[lista, invitados, activas], landing] = await Promise.all([
    rpcLote(lectura<Prospecto[]>("prospectos_panel", g), lectura<InvitadoSinSeguir[] | null>("invitados_sin_seguimiento", g, true), lectura<string[]>("funciones_nuevas_activas", g)),
    host ? traerLanding(host).catch(() => null) : null,
  ]);
  // REV-1b: el WhatsApp al interesado lleva la página, si está publicada (si no, el link mostraría "Próximamente").
  const pagina = landing?.publicada ? await direccionPagina(panel.gimnasio.slug) : null;
  return { lista, pagina, invitados: invitados ?? [], activas };
}
