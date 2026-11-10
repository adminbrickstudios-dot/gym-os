import type { CSSProperties, ReactNode } from "react";

/**
 * D38 · El componente de íconos de Base: un set propio de línea (trazo 1,75, 24x24, `currentColor`), sin dependencias.
 * Se pide por nombre (`<Icono nombre="candado" />`): para cambiar el set se cambia este archivo y nada más.
 * Mide 1,15 em: escala con el tamaño del texto donde está. Va siempre con su texto al lado o con `titulo` (nunca solo color).
 *
 * Si `nombre` no es un ícono de la lista se muestra como texto: es lo que pasa con un emoji que escribió el dueño en un dato suyo
 * (la actividad "🚴" de una clase) y se respeta. Los íconos propios de Base nunca son emoji.
 */
const D = (...p: string[]) => p;
export const ICONOS = {
  alerta: D("M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"),
  "alerta-circulo": D("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 8v4", "M12 16h.01"),
  ok: D("M22 11.08V12a10 10 0 1 1-5.93-9.14", "M22 4 12 14.01l-3-3"),
  cerrar: D("M18 6 6 18", "M6 6l12 12"),
  mas: D("M5 12h14", "M12 5v14"),
  menos: D("M5 12h14"),
  plata: D("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v12", "M15 9.5a2.5 2 0 0 0-2.5-1.5h-1.5a2.5 2 0 0 0 0 4h2a2.5 2 0 0 1 0 4h-1.5A2.5 2 0 0 1 9 14.5"),
  mensaje: D("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"),
  deshacer: D("M3 7v6h6", "M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"),
  etiqueta: D("M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z", "M7.5 7.5h.01"),
  puerta: D("M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4", "M10 17l5-5-5-5", "M15 12H3"),
  regalo: D("M20 12v10H4V12", "M2 7h20v5H2z", "M12 22V7", "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z", "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"),
  persona: D("M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"),
  usuarios: D("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"),
  recibo: D("M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z", "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8", "M12 17.5v-11"),
  prohibido: D("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M4.9 4.9l14.2 14.2"),
  reloj: D("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"),
  "reloj-arena": D("M5 22h14", "M5 2h14", "M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22", "M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"),
  salir: D("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"),
  lista: D("M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "M9 2h6v4H9z", "M9 12h6", "M9 16h6"),
  pesa: D("M6.5 6.5v11", "M17.5 6.5v11", "M3 9v6", "M21 9v6", "M6.5 12h11"),
  repetir: D("M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5"),
  tarjeta: D("M2 5h20v14H2z", "M2 10h20"),
  camara: D("M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"),
  calendario: D("M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"),
  candado: D("M5 11h14v10H5z", "M7 11V7a5 5 0 0 1 10 0v4"),
  "candado-abierto": D("M5 11h14v10H5z", "M7 11V7a5 5 0 0 1 9.9-1"),
  celular: D("M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z", "M12 18h.01"),
  ticket: D("M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z", "M13 5v2", "M13 11v2", "M13 17v2"),
  buscar: D("M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"),
  lapiz: D("M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"),
  estrella: D("M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"),
  llave: D("M21 2l-2 2", "M11.39 11.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777z", "M11.39 11.61 15.5 7.5", "M15.5 7.5l3 3L22 7l-3-3"),
  ubicacion: D("M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z", "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"),
  ajustes: D("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"),
  web: D("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"),
  campana: D("M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9", "M13.73 21a2 2 0 0 1-3.46 0"),
  calculadora: D("M4 2h16v20H4z", "M8 6h8", "M8 10h.01", "M12 10h.01", "M16 10h.01", "M8 14h.01", "M12 14h.01", "M16 14h.01", "M8 18h.01", "M12 18h.01", "M16 18h.01"),
  carrito: D("M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"),
  ojo: D("M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"),
  caja: D("M16.5 9.4 7.5 4.21", "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z", "M3.27 6.96 12 12.01l8.73-5.05", "M12 22.08V12"),
  chincheta: D("M12 17v5", "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"),
  banco: D("M3 22h18", "M6 18v-7", "M10 18v-7", "M14 18v-7", "M18 18v-7", "M12 2 3 7h18z"),
  corazon: D("M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"),
  guardar: D("M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z", "M17 21v-8H7v8", "M7 3v5h8"),
  pausa: D("M6 4h4v16H6z", "M14 4h4v16h-4z"),
  escudo: D("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"),
  fuego: D("M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"),
  descargar: D("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"),
  subir: D("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"),
  documento: D("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"),
  inicio: D("M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"),
  grafico: D("M12 20V10", "M18 20V4", "M6 20v-4"),
  tendencia: D("M22 7l-8.5 8.5-5-5L2 17", "M16 7h6v6"),
  "tendencia-baja": D("M22 17l-8.5-8.5-5 5L2 7", "M16 17h6v-6"),
  papelera: D("M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"),
  objetivo: D("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z", "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"),
  corona: D("M2 20h20", "M3 7l4.5 5L12 4l4.5 8L21 7l-2 13H5z"),
  trofeo: D("M6 9H4.5a2.5 2.5 0 0 1 0-5H6", "M18 9h1.5a2.5 2.5 0 0 0 0-5H18", "M4 22h16", "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22", "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22", "M18 2H6v7a6 6 0 0 0 12 0V2z"),
  pantalla: D("M2 3h20v14H2z", "M8 21h8", "M12 17v4"),
  mail: D("M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M22 6l-10 7L2 6"),
  enlace: D("M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"),
  sede: D("M3 21h18", "M5 21V7l8-4v18", "M19 21V11l-6-4", "M9 9h.01", "M9 12h.01", "M9 15h.01", "M9 18h.01"),
  hoja: D("M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z", "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"),
  grilla: D("M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"),
  rayo: D("M13 2 3 14h9l-1 8 10-12h-9z"),
  luna: D("M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"),
  imagen: D("M3 3h18v18H3z", "M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M21 15l-5-5L5 21"),
  telefono: D("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"),
  senal: D("M5 12.55a11 11 0 0 1 14.08 0", "M1.42 9a16 16 0 0 1 21.16 0", "M8.53 16.11a6 6 0 0 1 6.95 0", "M12 20h.01"),
  ayuda: D("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01"),
  info: D("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 16v-4", "M12 8h.01"),
  derecha: D("M5 12h14", "M12 5l7 7-7 7"),
  izquierda: D("M19 12H5", "M12 19l-7-7 7-7"),
  arriba: D("M12 19V5", "M5 12l7-7 7 7"),
  abajo: D("M12 5v14", "M19 12l-7 7-7-7"),
  menu: D("M3 6h18", "M3 12h18", "M3 18h18"),
  sol: D("M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "M12 1v2", "M12 21v2", "M4.22 4.22l1.42 1.42", "M18.36 18.36l1.42 1.42", "M1 12h2", "M21 12h2", "M4.22 19.78l1.42-1.42", "M18.36 5.64l1.42-1.42"),
} satisfies Record<string, string[]>;

export type NombreIcono = keyof typeof ICONOS;
/** Los cuatro puntos del semáforo y el gris: círculo lleno del color de ESE estado (siempre con su texto al lado). */
const PUNTOS = { "punto-verde": "var(--verde)", "punto-amarillo": "var(--amarillo)", "punto-rojo": "var(--rojo)", "punto-naranja": "var(--naranja)", "punto-gris": "var(--texto-tenue)" } as const;

export function esIcono(nombre: string): boolean {
  return nombre in ICONOS || nombre in PUNTOS;
}

export function Icono({ nombre, titulo, className, style }: { nombre: string | null | undefined; titulo?: string; className?: string; style?: CSSProperties }): ReactNode {
  if (!nombre) return null;
  const aria = titulo ? { role: "img" as const, "aria-label": titulo } : { "aria-hidden": true as const };
  if (nombre in PUNTOS) {
    return (
      <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" className={`icono-svg ${className ?? ""}`} style={style} {...aria}>
        <circle cx="12" cy="12" r="6" fill={PUNTOS[nombre as keyof typeof PUNTOS]} />
      </svg>
    );
  }
  if (!(nombre in ICONOS)) return <span className={className} style={style} {...aria}>{nombre}</span>;   // un emoji escrito por el dueño en un dato suyo
  return (
    <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      className={`icono-svg ${className ?? ""}`} style={style} {...aria}>
      {ICONOS[nombre as NombreIcono].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
