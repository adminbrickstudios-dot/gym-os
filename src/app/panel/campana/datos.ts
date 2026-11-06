import "server-only";
import { rutaDisponible } from "@/lib/panel/secciones";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type ItemCampana = { clave: string; emoji: string; titulo: string; detalle: string | null; href: string; en: string | null; leido: boolean; tipo: string | null };
export type PreferenciaAviso = { tipo: string; app: boolean };

/**
 * AVI-5 / VD-37: la campana de quien mira, ya unida por la base (la de siempre + la del Control, sin los tipos
 * que apagó) y sin lo que lleva a una pantalla apagada o que su rol no ve. Las alertas del Control (VD-10) las
 * decide la base: solo las ve quien ve el Control.
 */
export async function traerCampana() {
  const panel = await contextoPanel();
  const c = await rpc<{ items: ItemCampana[] }>("campana_panel", { p_gimnasio_id: panel.gimnasio.id });
  const items = c.items
    .map((i) => ({ ...i, href: i.href === "/" ? "/panel" : `/panel${i.href}` }))
    .filter((i) => rutaDisponible(i.href, panel.yo.rol, panel.secciones_apagadas));
  return { panel, items, sinLeer: items.filter((i) => !i.leido).length };
}

export async function traerPreferencias() {
  const panel = await contextoPanel();
  return rpc<PreferenciaAviso[]>("preferencias_aviso_panel", { p_gimnasio_id: panel.gimnasio.id });
}
