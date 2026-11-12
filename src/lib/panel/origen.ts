// VD-28 · Navegación con memoria: el ORIGEN es la lista de la que se salió hacia una ficha o detalle
// (ruta + query + scroll). Vive en sessionStorage (por pestaña), lo escribe OrigenPanel (en el Marco) y lo
// leen VolverAlOrigen y la hoja Cobrar para volver adonde estabas. Solo se usa en el navegador.

/** Las pantallas-lista que recuerdan su query y su scroll. `propia`: la pantalla monta su propia memoria (Socios, con filtros). */
export const LISTAS: Record<string, { nombre: string; propia?: boolean }> = {
  "/panel/socios": { nombre: "Socios", propia: true },
  "/panel/vencen-hoy": { nombre: "Vencen hoy" },
  "/panel/retencion": { nombre: "Retención" },
  "/panel/transferencias": { nombre: "Transferencias" },
  "/panel/caja": { nombre: "Caja" },
  "/panel/clases": { nombre: "Clases" },
  "/panel/eventos": { nombre: "Eventos" },
  "/panel/planes": { nombre: "Planes y servicios" },
  "/panel/tareas": { nombre: "Para hacer hoy" },
  "/panel/campana": { nombre: "Novedades" },
};

export type MemoriaDeLista = { q: string; y: number; t: number };
export type Origen = { ruta: string; q: string; y: number; nombre: string; destino: string; t: number };

const VIGENCIA_MS = 8 * 60 * 60 * 1000;
export const CLAVE_ORIGEN = "gymos.origen";
const CLAVE_AVISO = "gymos.origen.aviso";
export const EVENTO_ORIGEN = "gymos:origen";
/** La de Socios conserva su clave de VD-15. */
export const claveLista = (ruta: string) => (ruta === "/panel/socios" ? "gymos.socios.lista" : `gymos.lista.${ruta}`);

function leerJson<T>(clave: string): T | null {
  try { return JSON.parse(sessionStorage.getItem(clave) ?? "null") as T | null; } catch { return null; }
}
function escribir(clave: string, valor: unknown) {
  try { sessionStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: anda igual, sin memoria */ }
}

export function leerLista(ruta: string): MemoriaDeLista | null {
  const g = leerJson<MemoriaDeLista>(claveLista(ruta));
  return g && typeof g.q === "string" && Date.now() - g.t < VIGENCIA_MS ? g : null;
}
export const guardarLista = (ruta: string, g: MemoriaDeLista) => escribir(claveLista(ruta), g);

export function leerOrigen(): Origen | null {
  const o = leerJson<Origen>(CLAVE_ORIGEN);
  return o && typeof o.ruta === "string" && typeof o.destino === "string" && Date.now() - o.t < VIGENCIA_MS ? o : null;
}
export function guardarOrigen(o: Origen | null) {
  try { if (o) sessionStorage.setItem(CLAVE_ORIGEN, JSON.stringify(o)); else sessionStorage.removeItem(CLAVE_ORIGEN); } catch { /* idem */ }
  window.dispatchEvent(new Event(EVENTO_ORIGEN));
}

/** El pathname está dentro de la pantalla a la que se fue desde la lista (la ficha y sus subpantallas). */
export const dentroDe = (o: Origen, pathname: string) => pathname === o.destino || pathname.startsWith(`${o.destino}/`);

/** El origen, si vale para esta pantalla. `crudo` es el texto ya leído del storage (si no, se lee). */
export function origenPara(pathname: string, crudo: string | null = null): Origen | null {
  let o: Origen | null = null;
  try { o = JSON.parse(crudo ?? sessionStorage.getItem(CLAVE_ORIGEN) ?? "null") as Origen | null; } catch { o = null; }
  return o && typeof o.ruta === "string" && typeof o.destino === "string" && Date.now() - o.t < VIGENCIA_MS && dentroDe(o, pathname) ? o : null;
}

/** Un aviso para mostrar al llegar al origen ("Cobro registrado"). */
export const guardarAviso = (texto: string) => escribir(CLAVE_AVISO, texto);
export function tomarAviso(): string | null {
  const a = leerJson<string>(CLAVE_AVISO);
  try { sessionStorage.removeItem(CLAVE_AVISO); } catch { /* idem */ }
  return typeof a === "string" ? a : null;
}

/** Vuelve a la posición `y`, esperando a que la lista termine de cargar (el esqueleto es más bajo). Devuelve cómo cancelar. */
export function restaurarScroll(y: number): () => void {
  if (y <= 0) return () => {};
  let n = 0; let corte = false; let id: ReturnType<typeof setTimeout> | null = null;
  const parar = () => { corte = true; if (id) clearTimeout(id); };
  // Si la persona mueve la lista sola, no se le pelea.
  const opciones = { once: true, passive: true } as const;
  window.addEventListener("wheel", parar, opciones); window.addEventListener("touchstart", parar, opciones); window.addEventListener("keydown", parar, opciones);
  const paso = () => {
    if (corte) return;
    const alcanza = document.documentElement.scrollHeight - window.innerHeight >= y;
    if (alcanza || n++ > 40) { window.scrollTo({ top: y, behavior: "instant" }); return; }
    id = setTimeout(paso, 100);
  };
  requestAnimationFrame(paso);
  return () => { parar(); window.removeEventListener("wheel", parar); window.removeEventListener("touchstart", parar); window.removeEventListener("keydown", parar); };
}
