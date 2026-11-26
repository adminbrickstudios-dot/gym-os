// Pista Semáforo (24/11) · ¿esta pantalla se dibuja con el diseño Semáforo? Lo mismo que pone el <html data-semaforo> del layout:
// su llave pista_semaforo, que el proxy ya resolvió con la dirección (no es un viaje más a la base).
// Solo para las pantallas que cambian su forma (no solo sus colores): el Inicio, el kiosco y la barra del celular.
import { headers } from "next/headers";

export async function conSemaforo(): Promise<boolean> {
  const h = await headers();
  return h.get("x-gimnasio-semaforo") === "si";
}
