import type { CSSProperties, ReactNode } from "react";
import { NOMBRES_ICONO, VERSION_ICONOS } from "./iconos-nombres";

/**
 * D38 · El componente de íconos de Base: un set propio de línea (trazo 1,75, 24x24, `currentColor`), sin dependencias.
 * Se pide por nombre (`<Icono nombre="candado" />`): para cambiar el set se cambia este archivo y nada más.
 * Mide 1,15 em: escala con el tamaño del texto donde está. Va siempre con su texto al lado o con `titulo` (nunca solo color).
 *
 * Si `nombre` no es un ícono de la lista se muestra como texto: es lo que pasa con un emoji que escribió el dueño en un dato suyo
 * (la actividad "" de una clase) y se respeta. Los íconos propios de Base nunca son emoji.
 */
// Cierre para vender (25/11): los trazos ya no viajan en el JS de cada pantalla. Viven en iconos.json y salen en el sprite public/iconos.svg
// (lo arma scripts/datos/iconos-sprite.mjs); acá solo quedan los nombres. Cada <Icono> es un <use> del sprite, que se baja una vez y queda en caché.
const NOMBRES = new Set<string>(NOMBRES_ICONO);
const SPRITE = `/iconos.svg?v=${VERSION_ICONOS}`;

export type NombreIcono = (typeof NOMBRES_ICONO)[number];
/** Los cuatro puntos del semáforo y el gris: círculo lleno del color de ESE estado (siempre con su texto al lado). */
const PUNTOS = { "punto-verde": "var(--verde)", "punto-amarillo": "var(--amarillo)", "punto-rojo": "var(--rojo)", "punto-naranja": "var(--naranja)", "punto-gris": "var(--texto-tenue)" } as const;


/**
 * Los datos que arma la BASE (íconos de Primeros pasos, de la Campana, de la guía de la Entrada, de los números de Inicio) todavía traen un emoji.
 * Con `sistema` se traducen al ícono de línea que corresponde; sin `sistema` (un dato del dueño) se respeta tal cual.
 */
const A_ICONO: Record<string, string> = {};
const poner = (nombre: string, ...lista: string[]) => lista.forEach((e) => { A_ICONO[e] = nombre; });
poner("alerta", "⚠"); poner("ok", "✅", "✔", "☑"); poner("cerrar", "❌", "✖"); poner("mas", "➕"); poner("menos", "➖");
poner("plata", "💵", "💲", "💸", "💰", "🪙"); poner("mensaje", "💬", "🗨"); poner("deshacer", "↩", "↪"); poner("etiqueta", "🏷"); poner("puerta", "🚪");
poner("regalo", "🎁"); poner("persona", "👤", "🙋", "🙂", "😕", "🧑", "👧", "🧒", "👍", "🙌", "🙈", "🎓", "🧑‍🏫"); poner("usuarios", "👥", "🤝", "🧑‍🤝‍🧑", "👨‍👩‍👧", "👨‍👧");
poner("recibo", "🧾"); poner("prohibido", "🚫", "⛔", "🔕", "📴", "📵"); poner("reloj", "⏰", "⏱", "🕓", "🕐", "🕒", "🕘"); poner("reloj-arena", "⏳", "⌛");
poner("salir", "👋", "🚶"); poner("lista", "📋", "📝"); poner("pesa", "💪", "🏋", "🥋", "🏃", "🚴"); poner("repetir", "🔁", "🔄"); poner("tarjeta", "💳");
poner("camara", "📷", "📸"); poner("calendario", "🗓", "📅", "🎂"); poner("candado", "🔒", "🔐"); poner("candado-abierto", "🔓"); poner("celular", "📱", "📲");
poner("ticket", "🎟", "🎫"); poner("buscar", "🔍", "🔎"); poner("lapiz", "✏", "✍"); poner("estrella", "⭐", "★", "✨", "🎉", "🆕", "🚀", "🎬"); poner("trofeo", "🏆");
poner("llave", "🔑"); poner("ubicacion", "📍", "🗺", "🧭"); poner("ajustes", "⚙", "🛠", "🔧"); poner("web", "🌐"); poner("campana", "🔔", "🛎", "📣", "📢", "🔊", "🔇");
poner("calculadora", "🧮", "🔢", "➗"); poner("carrito", "🛒"); poner("ojo", "👀", "👁"); poner("caja", "📦", "🧱"); poner("chincheta", "📌"); poner("banco", "🏦");
poner("sede", "🏢"); poner("corazon", "🩺", "🩹", "💚"); poner("guardar", "💾"); poner("pausa", "⏸"); poner("escudo", "🛡"); poner("fuego", "🔥");
poner("alerta-circulo", "🚨", "🆘"); poner("ayuda", "❓", "❔"); poner("info", "ℹ", "💡"); poner("descargar", "⬇", "📥"); poner("subir", "⬆", "📤");
poner("documento", "📄", "📜", "📎"); poner("inicio", "🏠"); poner("grafico", "📊", "📐", "📏"); poner("tendencia", "📈"); poner("tendencia-baja", "📉");
poner("papelera", "🗑"); poner("objetivo", "🎯"); poner("corona", "👑"); poner("pantalla", "📺", "🖥"); poner("derecha", "▶", "↗"); poner("izquierda", "◀"); poner("menu", "☰");
poner("mail", "📧", "✉", "📨", "📬"); poner("enlace", "🔗"); poner("hoja", "🌱", "🌿"); poner("grilla", "🧩", "🔳", "🗂"); poner("rayo", "⚡"); poner("luna", "🌙");
poner("imagen", "🖼", "🎨"); poner("telefono", "📞"); poner("senal", "📶", "📡");
poner("punto-verde", "🟢"); poner("punto-amarillo", "🟡"); poner("punto-rojo", "🔴"); poner("punto-naranja", "🟠"); poner("punto-gris", "⚪");
export const iconoDeEmoji = (e: string): string | null => A_ICONO[e.replace(/\uFE0F/g, "")] ?? null;

export function esIcono(nombre: string): boolean {
  return NOMBRES.has(nombre) || nombre in PUNTOS;
}

/** Con `linea` queda siempre el dibujo de línea (los botones redondos del encabezado en Pista Semáforo); sin `linea`, con la llave
 *  pista_semaforo se ve el emoji del mapa único (src/lib/emojis.ts) y sin la llave, el dibujo de línea. */
export function Icono({ nombre: pedido, titulo, className, style, sistema = false, linea = false }: { nombre: string | null | undefined; titulo?: string; className?: string; style?: CSSProperties; sistema?: boolean; linea?: boolean }): ReactNode {
  if (!pedido) return null;
  const nombre = sistema && !esIcono(pedido) ? (iconoDeEmoji(pedido) ?? pedido) : pedido;
  const aria = titulo ? { role: "img" as const, "aria-label": titulo } : { "aria-hidden": true as const };
  if (nombre in PUNTOS) {
    return (
      <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" className={`icono-svg ${className ?? ""}`} style={style} {...aria}>
        <circle cx="12" cy="12" r="6" fill={PUNTOS[nombre as keyof typeof PUNTOS]} />
      </svg>
    );
  }
  if (!NOMBRES.has(nombre)) return <span className={className} style={style} {...aria}>{nombre}</span>;   // un emoji escrito por el dueño en un dato suyo
  const svg = (
    <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      className={`icono-svg ${className ?? ""}`} style={style} {...aria}>
      <use href={`${SPRITE}#${nombre}`} />
    </svg>
  );
  // Pista Semáforo: un lugar vacío para el emoji (lo llena el CSS que pone el layout solo con la llave). Sin la llave no se ve ni ocupa lugar.
  if (linea || titulo) return svg;
  return <><span className={`icono-e ${className ?? ""}`} data-e={nombre} aria-hidden="true" />{svg}</>;
}
