// Pista Semáforo (24/11) · EL mapa de emojis: cada ícono de línea que en el diseño (docs/base/pista/semaforo) va con emoji.
// Es el único lugar del código con estos emojis. Con la llave pista_semaforo, el layout convierte este mapa en reglas de CSS
// (`reglasEmojis`) y cada <Icono> muestra su emoji en vez del dibujo de línea; sin la llave no baja nada y se ven los de línea.
// Siempre aria-hidden: el texto de al lado dice lo mismo. Los íconos de control (cerrar, más, buscar, flechas, menú) siguen de línea.
import type { NombreIcono } from "@/components/ui/Icono";

export const EMOJIS: Partial<Record<NombreIcono, string>> = {
  inicio: "🏠", puerta: "🚪", ok: "✅", reloj: "⏰", "reloj-arena": "⏳", calendario: "🗓️",
  usuarios: "👥", persona: "👤", "tendencia-baja": "📉", tendencia: "📈", grafico: "📊", mensaje: "💬",
  plata: "💵", carrito: "🛒", recibo: "🧾", tarjeta: "💳", banco: "🏦", ticket: "🎟️",
  alerta: "⚠️", "alerta-circulo": "🚨", prohibido: "⛔", info: "💡", estrella: "⭐", fuego: "🔥",
  pesa: "🏋️", trofeo: "🏆", objetivo: "🎯", corona: "👑", regalo: "🎁", etiqueta: "🏷️",
  lista: "📋", chincheta: "📌", documento: "📄", caja: "📦", ajustes: "⚙️", llave: "🔑",
  candado: "🔒", "candado-abierto": "🔓", celular: "📱", telefono: "📞", mail: "✉️", camara: "📷",
  ubicacion: "📍", sede: "🏢", web: "🌐", pantalla: "📺", calculadora: "🧮", guardar: "💾",
  pausa: "⏸️", escudo: "🛡️", repetir: "🔁", papelera: "🗑️", hoja: "🌱", grilla: "🧩",
  rayo: "⚡", luna: "🌙", sol: "☀️", imagen: "🖼️", senal: "📶", salir: "👋", corazon: "💚",
};

/** Las reglas de CSS que muestran cada emoji (y esconden su dibujo de línea). Solo las pide el layout con la llave prendida. */
export function reglasEmojis(): string {
  return Object.entries(EMOJIS)
    .map(([n, e]) => `html[data-semaforo="si"] .icono-e[data-e="${n}"]::before{content:"${e}"}html[data-semaforo="si"] .icono-e[data-e="${n}"]+.icono-svg{display:none}`)
    .join("");
}
