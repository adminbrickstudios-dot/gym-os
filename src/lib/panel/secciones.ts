// Las secciones del panel: dónde están, para quién y qué son. La
// descripción es la línea que explica cada cosa en el menú.
// Solo se listan las que existen: lo vacío está vacío.

export type Rol = "dueno" | "encargado" | "recepcion" | "profe";
export type Grupo = "Hoy" | "Socios" | "Plata" | "Gimnasio";

export type Seccion = {
  clave: string;
  ruta: string;
  emoji: string;
  titulo: string;
  descripcion: string;
  grupo: Grupo;
  roles: Rol[];
  /** Clave en configuracion_gimnasio.secciones_apagadas, si el gimnasio la puede apagar. */
  apagable?: string;
};

const TODOS: Rol[] = ["dueno", "encargado", "recepcion", "profe"];
const MOSTRADOR: Rol[] = ["dueno", "encargado", "recepcion"];
const GESTION: Rol[] = ["dueno", "encargado"];

export const SECCIONES: Seccion[] = [
  { clave: "entrada", ruta: "/panel/entrada", emoji: "🚪", titulo: "Entrada", descripcion: "Quién entra, y si no puede, por qué", grupo: "Hoy", roles: MOSTRADOR, apagable: "entrada" },
  { clave: "clases", ruta: "/panel/clases", emoji: "🗓️", titulo: "Clases de hoy", descripcion: "Cupos, reservas y presentes", grupo: "Hoy", roles: TODOS, apagable: "clases" },
  { clave: "avisos", ruta: "/panel/avisos", emoji: "📬", titulo: "Avisos de hoy", descripcion: "A quién escribirle hoy, con el mensaje listo", grupo: "Hoy", roles: MOSTRADOR },
  { clave: "vencen_hoy", ruta: "/panel/vencen-hoy", emoji: "⏰", titulo: "Vencen hoy", descripcion: "A quién avisarle antes de que se vaya", grupo: "Hoy", roles: MOSTRADOR, apagable: "vencen_hoy" },
  { clave: "socios", ruta: "/panel/socios", emoji: "👥", titulo: "Socios", descripcion: "Buscar, dar de alta y ver su ficha", grupo: "Socios", roles: MOSTRADOR, apagable: "socios" },
  { clave: "retencion", ruta: "/panel/retencion", emoji: "📉", titulo: "Retención", descripcion: "Los que se están yendo, con el mensaje armado", grupo: "Socios", roles: MOSTRADOR, apagable: "retencion" },
  { clave: "rutinas", ruta: "/panel/rutinas", emoji: "💪", titulo: "Rutinas", descripcion: "Ejercicios y rutinas para los socios", grupo: "Socios", roles: ["dueno", "encargado", "profe"], apagable: "rutinas" },
  { clave: "prospectos", ruta: "/panel/prospectos", emoji: "🌱", titulo: "Prospectos", descripcion: "Los que quieren probar, para escribirles", grupo: "Socios", roles: MOSTRADOR },
  { clave: "vender", ruta: "/panel/vender", emoji: "🛒", titulo: "Vender", descripcion: "Cuotas, pases, packs y productos", grupo: "Plata", roles: MOSTRADOR, apagable: "vender" },
  { clave: "caja", ruta: "/panel/caja", emoji: "💵", titulo: "Caja", descripcion: "Abrir, cerrar y contar la plata", grupo: "Plata", roles: MOSTRADOR, apagable: "caja" },
  { clave: "resultado", ruta: "/panel/resultado", emoji: "📈", titulo: "Resultado", descripcion: "La plata del mes: cuánto entró, de dónde y contra el anterior", grupo: "Plata", roles: GESTION },
  { clave: "resumen", ruta: "/panel/resumen", emoji: "📊", titulo: "Resumen", descripcion: "El día y la semana: quién cobró, caja, altas y bajas", grupo: "Plata", roles: GESTION },
  { clave: "transferencias", ruta: "/panel/transferencias", emoji: "🧾", titulo: "Transferencias", descripcion: "Comprobantes de socios para aprobar", grupo: "Plata", roles: MOSTRADOR, apagable: "transferencias" },
  { clave: "planes", ruta: "/panel/planes", emoji: "🏷️", titulo: "Planes y precios", descripcion: "Lo que vendés y cuánto cuesta", grupo: "Gimnasio", roles: GESTION },
  { clave: "pagina", ruta: "/panel/pagina", emoji: "🌐", titulo: "Tu página", descripcion: "Lo que ve la gente antes de hacerse socio", grupo: "Gimnasio", roles: GESTION },
  { clave: "equipo", ruta: "/panel/equipo", emoji: "🧑‍🤝‍🧑", titulo: "Equipo", descripcion: "Quién trabaja y qué puede hacer", grupo: "Gimnasio", roles: GESTION },
  { clave: "configuracion", ruta: "/panel/configuracion", emoji: "⚙️", titulo: "Configuración", descripcion: "Marca, reglas y secciones que usás", grupo: "Gimnasio", roles: GESTION },
];

export const GRUPOS: Grupo[] = ["Hoy", "Socios", "Plata", "Gimnasio"];

/** Accesos rápidos del inicio: las secciones más una acción directa. */
export type Acceso = { clave: string; ruta: string; emoji: string; titulo: string; roles: Rol[]; apagable?: string };
export const ACCESOS: Acceso[] = [
  ...SECCIONES.map(({ clave, ruta, emoji, titulo, roles, apagable }) => ({ clave, ruta, emoji, titulo, roles, apagable })),
  { clave: "nuevo_socio", ruta: "/panel/socios/nuevo", emoji: "➕", titulo: "Nuevo socio", roles: MOSTRADOR, apagable: "socios" },
];

const ACCESOS_INICIALES: Record<Rol, string[]> = {
  dueno: ["entrada", "vender", "nuevo_socio", "socios", "caja", "retencion"],
  encargado: ["entrada", "vender", "nuevo_socio", "socios", "caja", "retencion"],
  recepcion: ["entrada", "vender", "nuevo_socio", "socios", "caja", "clases"],
  profe: ["clases", "rutinas"],
};

// Una sección sin "apagable" igual se oculta si la base la manda apagada para esta persona
// (EQU-1: el Resultado del encargado sin permiso).
const visible = (roles: Rol[], apagable: string | undefined, rol: Rol, apagadas: string[], clave?: string) =>
  roles.includes(rol) && !apagadas.includes(apagable ?? clave ?? "");

export function seccionesPara(rol: Rol, apagadas: string[]): Seccion[] {
  return SECCIONES.filter((s) => visible(s.roles, s.apagable, rol, apagadas, s.clave));
}

export function accesosDisponibles(rol: Rol, apagadas: string[]): Acceso[] {
  return ACCESOS.filter((a) => visible(a.roles, a.apagable, rol, apagadas, a.clave));
}

/**
 * Los accesos de la grilla del inicio: los que eligió la persona, o los
 * iniciales de su rol. Uno guardado que ya no existe o que su rol ya no
 * puede usar se informa aparte (no desaparece en silencio).
 */
export function accesosElegidos(rol: Rol, apagadas: string[], guardados: string[] | null | undefined) {
  const disponibles = accesosDisponibles(rol, apagadas);
  const claves = guardados?.length ? guardados : ACCESOS_INICIALES[rol];
  const elegidos = claves.map((c) => disponibles.find((a) => a.clave === c)).filter((a): a is Acceso => !!a);
  const perdidos = guardados?.length ? guardados.filter((c) => !disponibles.some((a) => a.clave === c)) : [];
  return { elegidos, perdidos };
}

/** Navegación inferior del celular: cuatro principales + menú. */
export function principalesCelular(rol: Rol, apagadas: string[]): Acceso[] {
  const inicio: Acceso = { clave: "inicio", ruta: "/panel", emoji: "🏠", titulo: "Inicio", roles: [rol] };
  const orden = rol === "profe" ? ["clases"] : ["entrada", "socios", "vender"];
  const resto = accesosDisponibles(rol, apagadas);
  return [inicio, ...orden.map((c) => resto.find((a) => a.clave === c)).filter((a): a is Acceso => !!a)].slice(0, 4);
}

export const NOMBRE_ROL: Record<Rol, string> = { dueno: "Dueño", encargado: "Encargado", recepcion: "Recepción", profe: "Profe" };

/**
 * ¿Esta ruta del panel la puede abrir este rol con estas secciones apagadas?
 * Se busca la sección dueña de la ruta (el prefijo más largo); una ruta que
 * no es de ninguna sección (Inicio, Mi cuenta) siempre está. Sirve para no
 * mostrar un botón que lleva a una pantalla apagada o que el rol no ve.
 */
export function rutaDisponible(ruta: string, rol: Rol, apagadas: string[]): boolean {
  const camino = ruta.split(/[?#]/)[0];
  const duena = [...ACCESOS].sort((a, b) => b.ruta.length - a.ruta.length)
    .find((s) => camino === s.ruta || camino.startsWith(`${s.ruta}/`));
  return !duena || visible(duena.roles, duena.apagable, rol, apagadas, duena.clave);
}
