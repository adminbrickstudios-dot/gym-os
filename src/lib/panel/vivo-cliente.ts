"use client";
// E8 · El menú y la campana piden al montar lo mismo y casi a la vez: se comparten UN pedido (y una respuesta de hasta 1,5 s de vida).
// Cuando algo se resuelve (cobrar, aprobar) se pide de nuevo con `fresco`.
import { traerVivo, type Vivo } from "@/app/panel/vivo-acciones";

type Ctx = { rol: string; apagadas: string[] };
let enVuelo: Promise<Vivo | null> | null = null;
let guardado: { v: Vivo | null; en: number } | null = null;

export function pedirVivo(ctx: Ctx, fresco = false): Promise<Vivo | null> {
  if (enVuelo) return enVuelo;
  if (!fresco && guardado && Date.now() - guardado.en < 1500) return Promise.resolve(guardado.v);
  enVuelo = traerVivo(ctx)
    .then((v) => { guardado = { v, en: Date.now() }; return v; })
    .finally(() => { enVuelo = null; });
  return enVuelo;
}
