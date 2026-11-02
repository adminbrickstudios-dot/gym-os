import type { PanelGimnasio } from "@/lib/panel/servidor";

/** La sede en la que se trabaja: la de la persona, o la elegida (?sede=), o la principal. */
export function sedeActiva(panel: PanelGimnasio, pedida?: string | null) {
  const fija = panel.yo.sede_id;
  const id = fija ?? (panel.sedes.some((s) => s.id === pedida) ? pedida! : panel.sedes[0]?.id);
  const sede = panel.sedes.find((s) => s.id === id);
  if (!sede) throw new Error("Este gimnasio no tiene ninguna sede activa");
  return { sede, puedeCambiar: !fija && panel.sedes.length > 1 };
}
