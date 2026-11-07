// Las secciones del panel: dónde están, para quién y qué son. La
// descripción es la línea que explica cada cosa en el menú.
// Solo se listan las que existen: lo vacío está vacío.
// VD-11: nombres y orden del doc 03 §1; las rutas salen de rutas.ts.

import { DESTINO } from "./rutas";

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
  /** Nombre corto para la barra de abajo del celular (si el título no entra). */
  corto?: string;
  /** Nombres viejos y sinónimos: el buscador (Ctrl+K) los encuentra igual. */
  tambien?: string;
};

const TODOS: Rol[] = ["dueno", "encargado", "recepcion", "profe"];
const MOSTRADOR: Rol[] = ["dueno", "encargado", "recepcion"];
const GESTION: Rol[] = ["dueno", "encargado"];

// Las claves NO cambian (los accesos rápidos guardados van por clave); cambian títulos, orden y destino.
export const SECCIONES: Seccion[] = [
  // HOY
  { clave: "entrada", ruta: DESTINO.entrada, emoji: "🚪", titulo: "Entrada", descripcion: "Quién entra, y si no puede, por qué", grupo: "Hoy", roles: MOSTRADOR, apagable: "entrada" },
  { clave: "tareas", ruta: DESTINO.tareas, emoji: "✅", titulo: "Para hacer hoy", descripcion: "Lo que hay que hacer, para quién y para cuándo", grupo: "Hoy", roles: TODOS, tambien: "tareas pendientes" },
  { clave: "avisos", ruta: DESTINO.avisos, emoji: "📬", titulo: "Avisos de hoy", descripcion: "A quién escribirle hoy, con el mensaje listo", grupo: "Hoy", roles: MOSTRADOR },
  { clave: "vencen_hoy", ruta: DESTINO.vencen_hoy, emoji: "⏰", titulo: "Vencen y cobrar", descripcion: "A quién avisarle y cobrarle antes de que se vaya", grupo: "Hoy", roles: MOSTRADOR, apagable: "vencen_hoy", tambien: "vencen hoy vencimientos" },
  { clave: "clases", ruta: DESTINO.clases, emoji: "🗓️", titulo: "Clases de hoy", descripcion: "Cupos, reservas y presentes", grupo: "Hoy", roles: TODOS, apagable: "clases" },
  // VD-46I: todo el equipo anota; el dueño y el encargado ven todos (lo exige la base).
  { clave: "incidentes", ruta: DESTINO.incidentes, emoji: "🩹", titulo: "Incidentes", descripcion: "Lo que pasó en la sala, sin diagnóstico", grupo: "Hoy", roles: TODOS, apagable: "incidentes", tambien: "accidente caída mareo" },
  // SOCIOS
  { clave: "socios", ruta: DESTINO.socios, emoji: "👥", titulo: "Socios", descripcion: "Buscar, dar de alta y ver su ficha", grupo: "Socios", roles: MOSTRADOR, apagable: "socios" },
  { clave: "prospectos", ruta: DESTINO.prospectos, emoji: "🌱", titulo: "Interesados", descripcion: "Los que quieren probar, para escribirles", grupo: "Socios", roles: MOSTRADOR, tambien: "prospectos" },
  // "mensajes": para la recepción lo saca contextoPanel si el dueño no se lo prendió (VD-38); el contador de pendientes lo suma VD-37.
  { clave: "mensajes", ruta: DESTINO.mensajes, emoji: "💬", titulo: "Mensajes", descripcion: "Consultas y quejas de los socios, para contestar", grupo: "Socios", roles: MOSTRADOR, apagable: "mensajes", tambien: "consultas quejas objetos perdidos" },
  { clave: "retencion", ruta: DESTINO.retencion, emoji: "📉", titulo: "Retención y números", descripcion: "Los que se están yendo, con el mensaje armado", grupo: "Socios", roles: MOSTRADOR, apagable: "retencion", tambien: "retencion" },
  { clave: "rutinas", ruta: DESTINO.rutinas, emoji: "💪", titulo: "Rutinas", descripcion: "Ejercicios y rutinas para los socios", grupo: "Socios", roles: ["dueno", "encargado", "profe"], apagable: "rutinas" },
  { clave: "eventos", ruta: DESTINO.eventos, emoji: "🎟️", titulo: "Eventos", descripcion: "Seminarios y clases especiales con cupo y precio", grupo: "Socios", roles: MOSTRADOR },
  // PLATA
  { clave: "caja", ruta: DESTINO.caja, emoji: "💵", titulo: "Caja", descripcion: "Abrir, cerrar y contar la plata", grupo: "Plata", roles: MOSTRADOR, apagable: "caja" },
  { clave: "vender", ruta: DESTINO.vender, emoji: "🛒", titulo: "Productos y stock", corto: "Productos", descripcion: "Vender productos, pases y packs; el stock que queda", grupo: "Plata", roles: MOSTRADOR, apagable: "vender", tambien: "vender cobrar cuotas" },
  { clave: "transferencias", ruta: DESTINO.transferencias, emoji: "🧾", titulo: "Transferencias", descripcion: "Comprobantes de socios para aprobar", grupo: "Plata", roles: MOSTRADOR, apagable: "transferencias" },
  { clave: "resultado", ruta: DESTINO.resultado, emoji: "📈", titulo: "Resultado", descripcion: "La plata del mes: cuánto entró, de dónde y contra el anterior", grupo: "Plata", roles: GESTION },
  // "gastos" lo apaga panel_gimnasio para el encargado sin permiso (VD-41b); "control" lo apaga contextoPanel (VD-10).
  { clave: "gastos", ruta: DESTINO.gastos, emoji: "🧮", titulo: "Gastos", descripcion: "Lo que gastás, los fijos del mes y la ganancia", grupo: "Plata", roles: GESTION, apagable: "gastos" },
  { clave: "profes", ruta: DESTINO.profes, emoji: "🧑‍🏫", titulo: "Liquidación de profes", corto: "Profes", descripcion: "Lo que se le debe a cada profe y sus pagos", grupo: "Plata", roles: GESTION, tambien: "profesores pago sueldo liquidacion" },
  { clave: "control", ruta: DESTINO.control, emoji: "🛡️", titulo: "Control", descripcion: "Todo lo que pasó con la plata y la puerta, en una línea de tiempo", grupo: "Plata", roles: GESTION, apagable: "control", tambien: "auditoria" },
  { clave: "resumen", ruta: DESTINO.resumen, emoji: "📊", titulo: "Resumen", descripcion: "El día y la semana: quién cobró, caja, altas y bajas", grupo: "Plata", roles: GESTION },
  // GIMNASIO
  { clave: "planes", ruta: DESTINO.planes, emoji: "🏷️", titulo: "Planes y servicios", descripcion: "Lo que vendés, cuánto cuesta y el stock", grupo: "Gimnasio", roles: GESTION, tambien: "planes y precios productos stock" },
  { clave: "pagina", ruta: DESTINO.pagina, emoji: "🌐", titulo: "Tu página", descripcion: "Lo que ve la gente antes de hacerse socio", grupo: "Gimnasio", roles: GESTION },
  { clave: "equipo", ruta: DESTINO.equipo, emoji: "🧑‍🤝‍🧑", titulo: "Equipo", descripcion: "Quién trabaja y qué puede hacer", grupo: "Gimnasio", roles: GESTION },
  { clave: "configuracion", ruta: DESTINO.configuracion, emoji: "⚙️", titulo: "Configuración", descripcion: "Marca, reglas y secciones que usás", grupo: "Gimnasio", roles: GESTION },
];

export const GRUPOS: Grupo[] = ["Hoy", "Socios", "Plata", "Gimnasio"];

/** Accesos rápidos del inicio: las secciones más una acción directa. */
export type Acceso = { clave: string; ruta: string; emoji: string; titulo: string; roles: Rol[]; apagable?: string; corto?: string };
export const ACCESOS: Acceso[] = [
  ...SECCIONES.map(({ clave, ruta, emoji, titulo, roles, apagable, corto }) => ({ clave, ruta, emoji, titulo, roles, apagable, corto })),
  { clave: "nuevo_socio", ruta: DESTINO.nuevo_socio, emoji: "➕", titulo: "Nuevo socio", roles: MOSTRADOR, apagable: "socios" },
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
