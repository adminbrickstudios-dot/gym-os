"use client";
// E8 · El menú y la campana piden al montar lo mismo y casi a la vez: se comparten UN pedido (y una respuesta de hasta 1,5 s de vida).
// Cuando algo se resuelve (cobrar, aprobar, contestar un mensaje) se pide de nuevo con `fresco`: ese pedido NUNCA reusa uno que ya estaba
// en vuelo ni una respuesta guardada (podrían ser anteriores a lo que se acaba de hacer: el número del menú quedaba viejo hasta el próximo minuto).
import { traerVivo, type Vivo } from "@/app/panel/vivo-acciones";

type Ctx = { rol: string; apagadas: string[] };
let enVuelo: Promise<Vivo | null> | null = null;
let guardado: { v: Vivo | null; en: number } | null = null;
let ultimo = 0;

export function pedirVivo(ctx: Ctx, fresco = false): Promise<Vivo | null> {
  if (!fresco) {
    if (enVuelo) return enVuelo;
    if (guardado && Date.now() - guardado.en < 1500) return Promise.resolve(guardado.v);
  }
  const mio = ++ultimo;
  const p: Promise<Vivo | null> = traerVivo(ctx)
    .then((v) => {
      // Si mientras tanto salió un pedido más nuevo, vale ese (esta respuesta es más vieja): nunca pisa a la fresca.
      if (mio !== ultimo) return enVuelo ?? (guardado ? guardado.v : v);
      guardado = { v, en: Date.now() };
      return v;
    })
    .finally(() => { if (mio === ultimo) enVuelo = null; });
  enVuelo = p;
  return p;
}
