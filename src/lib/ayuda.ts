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
  inicio: {
    emoji: "🏠", titulo: "Tu inicio",
    texto: "Acá ves cómo viene el día y lo que hay que hacer. Tocá un número o un acceso para ir directo.",
    porRol: {
      recepcion: "Lo primero que necesitás para el mostrador: quién vence hoy y lo pendiente. Tocá un acceso para ir directo.",
      profe: "Tus clases de hoy y tus socios, al alcance. Tocá un acceso para ir directo.",
    },
  },
  entrada: {
    emoji: "🚪", titulo: "Entrada",
    texto: "Tipeá el DNI o escaneá el QR: la pantalla dice si pasa y, si no, por qué. Verde pasa, rojo se frena.",
    porRol: { recepcion: "Cuando llega alguien, tipeá su DNI: te dice si pasa y por qué. Si no pasa, desde acá le cobrás." },
  },
  socios: {
    emoji: "👥", titulo: "Socios",
    texto: "Buscá por nombre, DNI o teléfono. Tocá un socio para ver su ficha, cobrarle o escribirle.",
    porRol: { recepcion: "Escribí nombre, DNI o teléfono y tocá al socio: desde su ficha cobrás y anotás. Para uno nuevo, “Nuevo socio”." },
  },
  vencen_hoy: {
    emoji: "⏰", titulo: "Vencen y cobrar",
    texto: "Esta es la lista de a quién avisarle y cobrarle antes de que se vaya. Tocá “Cobrar” en cada uno o mandale el mensaje listo.",
    porRol: { recepcion: "Los que vencen hoy o ya vencieron. Tocá “Cobrar” cuando pasen por el mostrador, o mandales el aviso." },
  },
  caja: {
    emoji: "💵", titulo: "Caja",
    texto: "Abrí la caja al empezar el turno y cerrala al terminar, contando la plata. Todo lo que cobrás queda anotado acá.",
    porRol: { recepcion: "Abrí tu turno al llegar y cerralo al irte, contando lo que hay. Lo que cobrás queda a tu nombre." },
  },
  cobrar: {
    emoji: "🛒", titulo: "Productos y cobros",
    texto: "Vendé productos, pases y packs. Para cobrar una cuota, buscá al socio y tocá “Cobrar”.",
  },
  tareas: {
    emoji: "✅", titulo: "Para hacer hoy",
    texto: "Lo que hay que hacer hoy, con quién y para cuándo. Tildá lo que vayas terminando; lo que sobra pasa a mañana.",
  },
  planes: {
    emoji: "🏷️", titulo: "Planes y servicios",
    texto: "Lo que vendés y cuánto cuesta. Tocá un plan para cambiar precio o reglas; los socios que ya lo tienen no se tocan.",
  },
  configuracion: {
    emoji: "⚙️", titulo: "Configuración",
    texto: "Tu marca, tus horarios, las reglas de cobro y qué secciones usás. Si buscás algo, escribilo arriba.",
  },
  control: {
    emoji: "🛡️", titulo: "Control",
    texto: "Todo lo que pasó con la plata y la puerta, en orden y con quién lo hizo. Filtrá por día o por persona para revisar algo puntual.",
  },
  app_inicio: {
    emoji: "👋", titulo: "Tu inicio",
    texto: "Acá ves si estás al día y qué te toca hoy. Tu código QR para entrar está abajo.",
  },
  app_clases: {
    emoji: "🗓️", titulo: "Clases",
    texto: "Elegí una clase y tocá “Reservar”. Si no podés ir, cancelá a tiempo para no perder el cupo.",
  },
  app_rutina: {
    emoji: "💪", titulo: "Tu rutina",
    texto: "Tu rutina del día. Anotá el peso de cada ejercicio y marcá cuando terminás: así ves cómo progresás.",
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
