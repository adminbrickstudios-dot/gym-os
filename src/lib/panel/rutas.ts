// VD-11 · El mapa central de rutas del menú. Cada sección del menú nuevo
// (doc 03 §1) apunta a la pantalla que existe HOY; cuando una pantalla nueva
// nazca (VD-13 Para hacer hoy, VD-15 Interesados en Socios, VD-18 Productos y
// stock), solo se cambia el destino acá. Nada más del menú se toca.
//
// Regla: toda ruta vieja sigue andando o redirige. Los accesos rápidos
// guardados se guardan por CLAVE (no por ruta), así que cambiar un destino no
// rompe ninguno. Si una pantalla nueva ocupa una ruta nueva, la vieja se
// agrega a REDIRECCIONES (y se redirige desde su page.tsx con redirect()).

/** Destino de cada sección del menú, por clave. Un solo lugar para cambiarlo. */
export const DESTINO = {
  entrada: "/panel/entrada",
  clases: "/panel/clases",
  avisos: "/panel/avisos",
  tareas: "/panel/tareas",              // VD-13: "Para hacer hoy"
  vencen_hoy: "/panel/vencen-hoy",      // "Vencen y cobrar"
  socios: "/panel/socios",
  retencion: "/panel/retencion",        // "Retención y números"
  rutinas: "/panel/rutinas",
  eventos: "/panel/eventos",
  prospectos: "/panel/prospectos",      // VD-15: "Interesados" dentro de Socios
  mensajes: "/panel/mensajes",          // VD-38: lo que los socios le escriben al gimnasio
  vender: "/panel/vender",              // VD-18: "Productos y stock" (D21)
  caja: "/panel/caja",
  transferencias: "/panel/transferencias",
  resultado: "/panel/resultado",
  gastos: "/panel/gastos",
  control: "/panel/control",
  resumen: "/panel/resumen",
  planes: "/panel/planes",
  pagina: "/panel/pagina",
  equipo: "/panel/equipo",
  configuracion: "/panel/configuracion",
  nuevo_socio: "/panel/socios/nuevo",
} as const;

/**
 * Rutas que existieron antes del menú nuevo y tienen que seguir abriendo (o
 * redirigir). Las usan el barrido y el e2e de VD-11: ninguna se puede perder.
 */
export const RUTAS_VIEJAS: string[] = [
  "/panel/tareas", "/panel/avisos", "/panel/vencen-hoy", "/panel/retencion", "/panel/prospectos",
  "/panel/vender", "/panel/planes", "/panel/resumen", "/panel/resultado", "/panel/transferencias",
  "/panel/caja", "/panel/clases", "/panel/entrada", "/panel/socios", "/panel/rutinas", "/panel/eventos",
];

/** Ruta vieja → ruta nueva, cuando una pantalla se muda. Hoy ninguna se mudó. */
export const REDIRECCIONES: Record<string, string> = {};

/** A dónde lleva hoy una ruta (la nueva si se mudó, la misma si no). */
export const rutaActual = (ruta: string): string => REDIRECCIONES[ruta] ?? ruta;
