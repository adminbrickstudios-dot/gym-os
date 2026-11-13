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
  // E8: las dos consultas salen a la vez (antes, una detrás de la otra: un viaje de más en cada pantalla).
  // VD-46A: lo que MercadoPago devolvió o contracargó (lo calcula la base, solo para dueño y encargado). No se redefine
  // campana_panel: se suma acá. Si esta consulta falla no se rompe la campana entera: se muestra lo demás.
  const mpP: Promise<ItemCampana[]> = (panel.yo.rol === "dueno" || panel.yo.rol === "encargado")
    ? rpc<{ items: Omit<ItemCampana, "tipo">[] }>("avisos_pagos_mp", { p_gimnasio_id: panel.gimnasio.id }, { lectura: true }).then((r) => r.items.map((i) => ({ ...i, tipo: null })), () => [])
    : Promise.resolve([]);
  const c = await rpc<{ items: ItemCampana[] }>("campana_panel", { p_gimnasio_id: panel.gimnasio.id });
  const mp = await mpP;
  const items = [...c.items, ...mp]
    .sort((a, b) => (Date.parse(b.en ?? "") || 0) - (Date.parse(a.en ?? "") || 0))
    .map((i) => ({ ...i, href: i.href === "/" ? "/panel" : `/panel${i.href}` }))
    .filter((i) => rutaDisponible(i.href, panel.yo.rol, panel.secciones_apagadas));
  return { panel, items, sinLeer: items.filter((i) => !i.leido).length };
}

export async function traerPreferencias() {
  const panel = await contextoPanel();
  return rpc<PreferenciaAviso[]>("preferencias_aviso_panel", { p_gimnasio_id: panel.gimnasio.id });
}
