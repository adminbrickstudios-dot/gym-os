// C6 · La compu compartida de la recepción. Dos cosas que viven en este navegador (no en el gimnasio):
//  - si esta compu la usa todo el equipo, el formulario de ingreso no deja que el navegador guarde la contraseña;
//  - un tope de pruebas para el cierre por inactividad (solo puede acortarlo, nunca alargarlo).

export const CLAVE_COMPU_COMPARTIDA = "gymos.compu-compartida";
export const CLAVE_INACTIVIDAD_PRUEBA_SEG = "gymos.entrada.inactividad-seg";
export const CLAVE_ACTIVIDAD = "gymos.actividad";

export function leerCompuCompartida(): boolean {
  try { return localStorage.getItem(CLAVE_COMPU_COMPARTIDA) === "si"; } catch { return false; }
}
export function guardarCompuCompartida(si: boolean) {
  try { if (si) localStorage.setItem(CLAVE_COMPU_COMPARTIDA, "si"); else localStorage.removeItem(CLAVE_COMPU_COMPARTIDA); } catch { /* sin almacenamiento: queda como estaba */ }
}

/**
 * Los milisegundos de inactividad hasta el cierre: lo que dice el gimnasio, o menos si esta compu lo acorta (pruebas).
 * 0 = no se cierra. El valor de esta compu nunca alarga lo del gimnasio.
 */
export function limiteInactividadMs(minutosGimnasio: number): number {
  if (!minutosGimnasio || minutosGimnasio < 1) return 0;
  const base = minutosGimnasio * 60_000;
  try {
    const prueba = Number(localStorage.getItem(CLAVE_INACTIVIDAD_PRUEBA_SEG));
    if (Number.isFinite(prueba) && prueba > 0) return Math.min(base, prueba * 1000);
  } catch { /* sin almacenamiento */ }
  return base;
}
