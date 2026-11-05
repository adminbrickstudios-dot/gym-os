import "server-only";
import { rutaDisponible } from "@/lib/panel/secciones";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type ItemCampana = { clave: string; emoji: string; titulo: string; detalle: string | null; href: string; en: string | null; leido: boolean };

/** AVI-5: la campana de quien mira, sin lo que lleva a una pantalla apagada o que su rol no ve. */
export async function traerCampana() {
  const panel = await contextoPanel();
  const c = await rpc<{ items: ItemCampana[] }>("campana", { p_gimnasio_id: panel.gimnasio.id });
  const items = c.items
    .map((i) => ({ ...i, href: i.href === "/" ? "/panel" : `/panel${i.href}` }))
    .filter((i) => rutaDisponible(i.href, panel.yo.rol, panel.secciones_apagadas));
  return { panel, items, sinLeer: items.filter((i) => !i.leido).length };
}
