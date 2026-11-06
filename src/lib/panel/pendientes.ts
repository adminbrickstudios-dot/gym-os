// VD-37 · Los números del menú. La base los calcula (pendientes_panel) y acá solo se decide cómo se ven.
// Regla del rojo (docs/v2/12): rojo = algo que se pierde si no se actúa hoy. El resto, neutro.
// Nunca en Inicio ni en secciones que siempre tienen algo.

export type Pendientes = Partial<Record<"tareas" | "vencen_hoy" | "transferencias" | "prospectos" | "caja" | "socios" | "control" | "mensajes", number>>;

/** Claves de sección (secciones.ts) que llevan número, y cuáles se pintan en rojo. */
export const CON_NUMERO = ["tareas", "vencen_hoy", "transferencias", "prospectos", "caja", "socios", "control", "mensajes"] as const;
export const ROJOS: ReadonlySet<string> = new Set(["vencen_hoy", "transferencias", "caja"]);

/** Más de 9 → "9+". */
export const textoNumero = (n: number) => (n > 9 ? "9+" : String(n));

/** El número de una sección del menú, o 0 si no lleva o no hay nada. */
export const numeroDe = (p: Pendientes | null, clave: string): number =>
  (CON_NUMERO as readonly string[]).includes(clave) ? (p?.[clave as keyof Pendientes] ?? 0) : 0;

/** ¿Algo pide acción hoy? (para el punto del botón Menú del celular). */
export const hayRojo = (p: Pendientes | null) => [...ROJOS].some((c) => numeroDe(p, c) > 0);
export const hayAlgo = (p: Pendientes | null) => CON_NUMERO.some((c) => numeroDe(p, c) > 0);

/** Aviso a la barra: algo cambió (se resolvió un pendiente), volvé a pedir los números. */
export const EVENTO_PENDIENTES = "gymos:pendientes";
export const refrescarPendientes = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_PENDIENTES)); };
