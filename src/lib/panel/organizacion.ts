// Pase 2.0 · organización (Mateo, 26/11 · DISENO.md § "Pase 2.0 · Organización", docs/base/pista/organizacion/menu-en-bloques.png).
// El menú baja de 29 entradas a 12, en cuatro bloques de tres. Lo que se usa junto va en una pantalla con PESTAÑAS (?pestana=): cada pestaña es
// una sección de siempre (secciones.ts), con sus roles y su "apagable". Nada se borra: cada pantalla de hoy sigue existiendo como pestaña,
// su dirección vieja lleva a su pestaña (el proxy, con la llave prendida) y Ctrl K la encuentra por su nombre viejo.
// Solo con la llave pase_2_organizacion: apagada, el menú es el de siempre.
import { DESTINO } from "./rutas";
import type { Grupo, Seccion } from "./secciones";

export type Pestana = { seccion: keyof typeof DESTINO; titulo: string };
export type Bloque = {
  clave: string;
  grupo: Grupo;
  emoji: string;
  titulo: string;
  /** Nombre corto para la grilla de "Más" del celular (si el título no entra). */
  corto?: string;
  /** La línea chica que explica qué es (DISENO.md: "Cada entrada del menú lleva su línea chica"). */
  linea: string;
  pestanas: Pestana[];
};

export const BLOQUES: Bloque[] = [
  // HOY
  { clave: "entrada", grupo: "Hoy", emoji: "puerta", titulo: "Entrada", linea: "Quién entra, y si no puede, por qué", pestanas: [{ seccion: "entrada", titulo: "Entrada" }] },
  { clave: "hoy", grupo: "Hoy", emoji: "ok", titulo: "Para hacer hoy", linea: "Cobrar, avisar, aprobar, contestar",
    pestanas: [{ seccion: "hoy", titulo: "Para hacer hoy" }, { seccion: "tareas", titulo: "Tareas" }, { seccion: "avisos", titulo: "Avisos de hoy" }, { seccion: "vencen_hoy", titulo: "Vencen y cobrar" },
      { seccion: "transferencias", titulo: "Transferencias" }, { seccion: "prospectos", titulo: "Interesados" }] },
  { clave: "clases", grupo: "Hoy", emoji: "calendario", titulo: "Clases", linea: "Cupos, reservas y presentes", pestanas: [{ seccion: "clases", titulo: "Clases" }] },
  // SOCIOS
  { clave: "socios", grupo: "Socios", emoji: "usuarios", titulo: "Socios", linea: "Todos, interesados, se están yendo",
    pestanas: [{ seccion: "socios", titulo: "Todos" }, { seccion: "retencion", titulo: "Dejaron de venir" }, { seccion: "prospectos", titulo: "Interesados" }] },
  { clave: "mensajes", grupo: "Socios", emoji: "mensaje", titulo: "Mensajes", linea: "Consultas y quejas, para contestar", pestanas: [{ seccion: "mensajes", titulo: "Mensajes" }] },
  { clave: "extras", grupo: "Socios", emoji: "objetivo", titulo: "Extras", linea: "PT, lockers, eventos",
    pestanas: [{ seccion: "pt", titulo: "Personal trainer" }, { seccion: "lockers", titulo: "Lockers" }, { seccion: "eventos", titulo: "Eventos" }] },
  // PLATA
  { clave: "caja", grupo: "Plata", emoji: "plata", titulo: "Caja y ventas", linea: "Caja, vender productos, stock",
    pestanas: [{ seccion: "caja", titulo: "Caja" }, { seccion: "vender", titulo: "Vender" }] },
  { clave: "resultado", grupo: "Plata", emoji: "tendencia", titulo: "Resultado del mes", corto: "Resultado", linea: "Ingresos, gastos, ganancia",
    pestanas: [{ seccion: "resultado", titulo: "Resultado" }, { seccion: "gastos", titulo: "Gastos" }, { seccion: "resumen", titulo: "Resumen del día" }] },
  { clave: "sueldos", grupo: "Plata", emoji: "recibo", titulo: "Equipo y sueldos", corto: "Sueldos", linea: "Horas y lo que se le debe",
    pestanas: [{ seccion: "horas", titulo: "Horas del equipo" }, { seccion: "profes", titulo: "Liquidación de profes" }] },
  // GIMNASIO
  { clave: "planes", grupo: "Gimnasio", emoji: "etiqueta", titulo: "Planes y precios", corto: "Planes", linea: "Lo que vendés y cuánto cuesta", pestanas: [{ seccion: "planes", titulo: "Planes y precios" }] },
  { clave: "sala", grupo: "Gimnasio", emoji: "pesa", titulo: "Sala y rutinas", corto: "Sala", linea: "Rutinas, máquinas, incidentes",
    pestanas: [{ seccion: "rutinas", titulo: "Rutinas" }, { seccion: "maquinas", titulo: "Máquinas" }, { seccion: "incidentes", titulo: "Incidentes" }] },
  { clave: "ajustes", grupo: "Gimnasio", emoji: "ajustes", titulo: "Ajustes", linea: "Marca, página, equipo, control",
    pestanas: [{ seccion: "configuracion", titulo: "Marca y reglas" }, { seccion: "pagina", titulo: "Tu página" }, { seccion: "equipo", titulo: "Equipo y permisos" }, { seccion: "control", titulo: "Control" }] },
];

/** Dirección de un bloque: la pantalla de siempre si tiene una sola pestaña; si no, la pantalla con pestañas. */
export const rutaBloque = (b: Bloque, pestana?: string) =>
  b.pestanas.length === 1 ? DESTINO[b.pestanas[0].seccion] : `/panel/bloque/${b.clave}${pestana ? `?pestana=${pestana}` : ""}`;

/**
 * La dirección vieja de cada pantalla que pasó a ser pestaña → su pestaña (la primera vez que aparece en el menú: Interesados queda en Socios,
 * donde estaba). Lo usa el proxy, solo con la llave prendida. Las de una sola pestaña no se mueven.
 */
export const REDIRECCION_BLOQUE: Record<string, string> = Object.fromEntries(
  BLOQUES.filter((b) => b.pestanas.length > 1).flatMap((b) => b.pestanas
    // "Interesados" está en Para hacer hoy y en Socios: su dirección vieja va a Socios (donde estaba en el menú de antes).
    .filter((p) => p.seccion !== "prospectos" || b.clave === "socios")
    .map((p) => [DESTINO[p.seccion], `/panel/bloque/${b.clave}?pestana=${p.seccion}`] as const)));

/** Las pestañas que esta persona ve (mismo criterio que el menú de siempre: su rol y lo que el gimnasio apagó). */
export function pestanasPara(b: Bloque, secciones: Pick<Seccion, "clave">[]): Pestana[] {
  const visibles = new Set(secciones.map((s) => s.clave));
  // La lista única de Para hacer hoy la ve quien ve Para hacer hoy (la sección "tareas").
  return b.pestanas.filter((p) => visibles.has(p.seccion) || (p.seccion === "hoy" && visibles.has("tareas")));
}

/** Los bloques que esta persona ve: un bloque sin pestañas visibles no aparece (DISENO.md, regla 4). */
export function bloquesPara(secciones: Pick<Seccion, "clave">[]): (Bloque & { visibles: Pestana[] })[] {
  return BLOQUES.map((b) => ({ ...b, visibles: pestanasPara(b, secciones) })).filter((b) => b.visibles.length > 0);
}

/** La barra de abajo del celular con la llave: Inicio · Entrada · Hoy · Socios · Más (DISENO.md). Solo los que el rol ve. */
export function barraCelular(secciones: Pick<Seccion, "clave">[]): { clave: string; ruta: string; emoji: string; titulo: string }[] {
  const bloques = bloquesPara(secciones);
  const de = (clave: string, titulo: string) => { const b = bloques.find((x) => x.clave === clave); return b ? [{ clave, ruta: rutaBloque(b), emoji: b.emoji, titulo }] : []; };
  return [{ clave: "inicio", ruta: "/panel", emoji: "inicio", titulo: "Inicio" }, ...de("entrada", "Entrada"), ...de("hoy", "Hoy"), ...de("socios", "Socios")];
}

/** Lo que el menú necesita de cada bloque (se arma en el servidor y viaja al menú): su dirección y las direcciones que lo marcan activo. */
export type BloqueMenu = { clave: string; grupo: Grupo; emoji: string; titulo: string; corto?: string; linea: string; ruta: string; secciones: string[]; rutas: string[] };
export function menuBloques(secciones: Pick<Seccion, "clave">[]): BloqueMenu[] {
  return bloquesPara(secciones).map((b) => ({
    clave: b.clave, grupo: b.grupo, emoji: b.emoji, titulo: b.titulo, corto: b.corto, linea: b.linea, ruta: rutaBloque(b),
    secciones: b.visibles.map((p) => p.seccion), rutas: [`/panel/bloque/${b.clave}`, ...b.visibles.map((p) => DESTINO[p.seccion])],
  }));
}
