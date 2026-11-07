// VD-31 · Los textos de ayuda de cada pantalla, todos en este archivo (castellano rioplatense, una o dos
// líneas, que digan qué hacer). El globo sale la primera vez que una persona abre la pantalla; qué ya vio
// se guarda en la base, por usuario (ayudas_vistas / marcar_ayuda). Para sumar una pantalla: una entrada
// acá (la clave es lo que se guarda) y la ruta en RUTAS_PANEL o RUTAS_APP.
import type { Rol } from "@/lib/panel/secciones";

export type TextoAyuda = { emoji: string; titulo: string; texto: string };
type Ayuda = TextoAyuda & { porRol?: Partial<Record<Rol, string>> };

/** Pantalla del panel (ruta sin barra final) → clave de ayuda. */
export const RUTAS_PANEL: Record<string, string> = {
  "/panel": "inicio",
  "/panel/entrada": "entrada",
  "/panel/socios": "socios",
  "/panel/vencen-hoy": "vencen_hoy",
  "/panel/caja": "caja",
  "/panel/vender": "cobrar",
  "/panel/tareas": "tareas",
  "/panel/planes": "planes",
  "/panel/configuracion": "configuracion",
  "/panel/control": "control",
};

/** Pantalla de la app del socio → clave. */
export const RUTAS_APP: Record<string, string> = {
  "/app": "app_inicio",
  "/app/clases": "app_clases",
  "/app/rutina": "app_rutina",
  "/app/yo": "app_yo",
};

export const AYUDAS: Record<string, Ayuda> = {
  // VD-63: una línea que dice qué es y qué hacer. Sin repetir el título ni llenar.
  inicio: {
    emoji: "🏠", titulo: "Tu inicio",
    texto: "Así viene el día y lo que falta hacer. Tocá un número o un acceso para ir directo.",
    porRol: {
      recepcion: "Quién vence hoy y lo pendiente del mostrador. Tocá un acceso para ir directo.",
      profe: "Tus clases de hoy y tus socios. Tocá un acceso para ir directo.",
    },
  },
  entrada: {
    emoji: "🚪", titulo: "Entrada",
    texto: "Tipeá el DNI o escaneá el QR: verde pasa, rojo se frena y dice por qué.",
    porRol: { recepcion: "Tipeá el DNI de quien llega: te dice si pasa y por qué; si no pasa, cobrale desde acá." },
  },
  socios: {
    emoji: "👥", titulo: "Socios",
    texto: "Buscá por nombre, DNI o teléfono y tocá al socio: desde su ficha cobrás, anotás y escribís.",
    porRol: { recepcion: "Buscá al socio y tocalo: desde su ficha cobrás y anotás. Para uno nuevo, “Nuevo socio”." },
  },
  vencen_hoy: {
    emoji: "⏰", titulo: "Vencen y cobrar",
    texto: "A quién avisarle y cobrarle antes de que se vaya: tocá “Cobrar” o mandale el mensaje listo.",
    porRol: { recepcion: "Los que vencen hoy o ya vencieron: cobrales en el mostrador o mandales el aviso." },
  },
  caja: {
    emoji: "💵", titulo: "Caja",
    texto: "Abrí la caja al empezar el turno y cerrala contando la plata: todo lo que cobrás queda anotado.",
    porRol: { recepcion: "Abrí tu turno al llegar y cerralo al irte contando lo que hay: lo que cobrás queda a tu nombre." },
  },
  cobrar: {
    emoji: "🛒", titulo: "Productos y cobros",
    texto: "Vendé productos, pases y packs. Para cobrar una cuota, buscá al socio y tocá “Cobrar”.",
  },
  tareas: {
    emoji: "✅", titulo: "Para hacer hoy",
    texto: "Lo que hay que hacer hoy, con quién y para cuándo: tildá lo terminado y lo que sobra pasa a mañana.",
  },
  planes: {
    emoji: "🏷️", titulo: "Planes y servicios",
    texto: "Lo que vendés y cuánto cuesta: tocá un plan para cambiar precio o reglas (los socios que ya lo tienen no se tocan).",
  },
  configuracion: {
    emoji: "⚙️", titulo: "Configuración",
    texto: "Tu marca, horarios, reglas de cobro y secciones. Escribí arriba lo que buscás.",
  },
  control: {
    emoji: "🛡️", titulo: "Control",
    texto: "Todo lo que pasó con la plata y la puerta, y quién lo hizo. Filtrá por día o por persona.",
  },
  app_inicio: {
    emoji: "👋", titulo: "Tu inicio",
    texto: "Si estás al día y qué te toca hoy. Tu QR para entrar está más abajo.",
  },
  app_clases: {
    emoji: "🗓️", titulo: "Clases",
    texto: "Elegí una clase y tocá “Reservar”. Si no podés ir, cancelá a tiempo para no perder el cupo.",
  },
  app_rutina: {
    emoji: "💪", titulo: "Tu rutina",
    texto: "Tu rutina del día: anotá el peso de cada ejercicio y marcá cuando terminás.",
  },
  app_yo: {
    emoji: "🙋", titulo: "Yo",
    texto: "Tu plan, tus pagos y tus datos. Desde acá también pagás, cambiás de plan o le escribís al gimnasio.",
  },
};

/** La ruta del panel o de la app → su clave de ayuda (o null si esa pantalla no lleva globo). */
export function claveDeRuta(ruta: string, ambito: "panel" | "app"): string | null {
  const limpia = ruta.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return (ambito === "panel" ? RUTAS_PANEL : RUTAS_APP)[limpia] ?? null;
}

/** El texto de una ayuda para este rol (la recepción ve el suyo). */
export function textoAyuda(clave: string, rol?: Rol): TextoAyuda | null {
  const a = AYUDAS[clave];
  if (!a) return null;
  return { emoji: a.emoji, titulo: a.titulo, texto: (rol && a.porRol?.[rol]) || a.texto };
}
