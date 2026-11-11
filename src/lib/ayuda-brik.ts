/**
 * H6: el link de WhatsApp a BRIK que arma el botón "¿Necesitás ayuda?" del panel.
 * Lleva la pantalla, quién escribe (nombre y rol del equipo) y el último error que vio la persona.
 * Nunca lleva datos de socios: los ids de la dirección se tapan (`:id`) y el error se recorta.
 * El número sale de los datos (contacto_plataforma_publico), nunca del código.
 */
export type ContextoAyuda = { gimnasio: string; nombre: string; rol: string; pantalla: string; ultimoError: string | null };

const ETIQUETA_ROL: Record<string, string> = { dueno: "dueño", encargado: "encargado", recepcion: "recepción", profe: "profe" };

/** La dirección sin ids ni parámetros: lo único que importa es en qué pantalla estaba. */
export function pantallaSinIds(ruta: string): string {
  return ruta.split(/[?#]/)[0].replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id").slice(0, 120);
}

export function textoAyuda(c: ContextoAyuda): string {
  const lineas = [
    "Hola BRIK, necesito ayuda con Base.",
    `Gimnasio: ${c.gimnasio}`,
    `Quién: ${c.nombre} (${ETIQUETA_ROL[c.rol] ?? c.rol})`,
    `Pantalla: ${pantallaSinIds(c.pantalla)}`,
    `Último error: ${c.ultimoError?.trim() ? c.ultimoError.trim().replace(/\s+/g, " ").slice(0, 200) : "ninguno"}`,
  ];
  return lineas.join("\n");
}

/** Sin número cargado por BRIK no hay link (el botón no se muestra): nunca un número inventado. */
export function linkAyudaWhatsapp(whatsapp: string | null | undefined, c: ContextoAyuda): string | null {
  const digitos = String(whatsapp ?? "").replace(/\D/g, "");
  if (digitos.length < 8) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(textoAyuda(c))}`;
}
