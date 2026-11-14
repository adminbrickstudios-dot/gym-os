import "server-only";
import { rutaDisponible } from "@/lib/panel/secciones";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { gimnasioActual } from "@/lib/supabase/servidor";

export type ItemCampana = { clave: string; emoji: string; titulo: string; detalle: string | null; href: string; en: string | null; leido: boolean; tipo: string | null };
export type PreferenciaAviso = { tipo: string; app: boolean };

/**
 * AVI-5 / VD-37: la campana de quien mira, ya unida por la base (la de siempre + la del Control, sin los tipos
 * que apagó) y sin lo que lleva a una pantalla apagada o que su rol no ve. Las alertas del Control (VD-10) las
 * decide la base: solo las ve quien ve el Control.
 */
/**
 * E8: con `ctx` (el rol y las secciones apagadas, que el navegador ya tiene) no se vuelve a pedir el contexto del panel: el número de la
 * campana se pide al abrir cada pantalla y ese viaje de más era uno por pantalla. `ctx` solo decide qué se muestra en el número; lo que
 * se puede ver lo sigue decidiendo la base en cada función. Sin `ctx` (la página de Novedades) se pide como siempre.
 */
export async function traerCampana(ctx?: { rol: string; apagadas: string[] }) {
  const panel = ctx ? null : await contextoPanel();
  const gimnasioId = ctx ? (await gimnasioActual()).id : panel!.gimnasio.id;
  const rol = ctx?.rol ?? panel!.yo.rol;
  const apagadas = ctx?.apagadas ?? panel!.secciones_apagadas;
  // VD-46A: lo que MercadoPago devolvió o contracargó (lo calcula la base, solo para dueño y encargado). No se redefine
  // campana_panel: se suma acá. Si esta consulta falla no se rompe la campana entera: se muestra lo demás. Los dos van en el mismo viaje.
  const [c, mpRes] = await Promise.all([
    rpc<{ items: ItemCampana[] }>("campana_panel", { p_gimnasio_id: gimnasioId }),
    rol === "dueno" || rol === "encargado"
      ? rpc<{ items: Omit<ItemCampana, "tipo">[] }>("avisos_pagos_mp", { p_gimnasio_id: gimnasioId }, { lectura: true }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const mp: ItemCampana[] = (mpRes?.items ?? []).map((i) => ({ ...i, tipo: null }));
  const items = [...c.items, ...mp]
    .sort((a, b) => (Date.parse(b.en ?? "") || 0) - (Date.parse(a.en ?? "") || 0))
    .map((i) => ({ ...i, href: i.href === "/" ? "/panel" : `/panel${i.href}` }))
    .filter((i) => rutaDisponible(i.href, rol as Parameters<typeof rutaDisponible>[1], apagadas));
  return { panel, gimnasioId, items, sinLeer: items.filter((i) => !i.leido).length };
}

export async function traerPreferencias() {
  const panel = await contextoPanel();
  return rpc<PreferenciaAviso[]>("preferencias_aviso_panel", { p_gimnasio_id: panel.gimnasio.id });
}
