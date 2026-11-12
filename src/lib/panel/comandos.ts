// VD-29 · Ctrl+K con acciones: el intérprete de lo que se escribe ("cobrar juan", "entrada 12345678",
// "nuevo socio", "tarea llamar a pedro"…). Es puro y sin permisos: solo dice QUÉ pidió la persona.
// Qué se le ofrece de verdad lo decide `verbosPermitidos` con las secciones que su rol ve (datos, no
// un listado aparte), y las reglas de acceso las sigue calculando la base (acá no se reimplementan).

export type Verbo = "cobrar" | "entrada" | "ficha" | "vender" | "nuevo_socio" | "abrir_turno" | "cerrar_turno" | "tarea" | "gasto";

export type Comando = { verbo: Verbo; arg: string };

export const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Cada verbo con sus formas de decirlo (sin acentos, minúscula). Las más largas ganan. */
const FRASES: Record<Verbo, string[]> = {
  cobrar: ["cobrar", "cobrarle", "cobrale", "cobra", "cobro", "cobrar a", "cobrarle a", "cobrale a"],
  entrada: ["entrada", "entra", "entrar", "ingreso", "ingresar", "dejar entrar", "dar entrada", "anotar entrada", "registrar entrada", "marcar entrada", "checkin", "check in"],
  ficha: ["ficha", "ficha de", "ver ficha", "ver ficha de", "abrir ficha", "abrir ficha de", "perfil", "perfil de", "ver socio", "abrir socio", "socio"],
  vender: ["vender", "venderle", "vender a", "venta", "nueva venta", "vendo", "vendele"],
  nuevo_socio: ["nuevo socio", "nueva socia", "socio nuevo", "alta", "alta de socio", "dar de alta", "dar de alta socio", "agregar socio", "crear socio", "anotar socio", "inscribir", "inscribir socio", "registrar socio", "nuevo alumno", "nuevo cliente"],
  abrir_turno: ["abrir turno", "abrir caja", "abrir la caja", "iniciar turno", "empezar turno", "comenzar turno", "abrir mi turno"],
  cerrar_turno: ["cerrar turno", "cerrar caja", "cerrar la caja", "terminar turno", "cerrar mi turno", "arqueo", "hacer arqueo", "contar la caja"],
  tarea: ["tarea", "nueva tarea", "agregar tarea", "crear tarea", "anotar tarea", "recordar", "recordame", "recordarme", "recordatorio", "pendiente", "anotame"],
  gasto: ["gasto", "nuevo gasto", "cargar gasto", "anotar gasto", "agregar gasto", "registrar gasto"],
};

/** Verbos que necesitan algo atrás para hacer algo ("cobrar" solo no cobra a nadie). */
export const NECESITA_ARG: Verbo[] = ["cobrar", "entrada", "ficha", "tarea"];

const TABLA: { verbo: Verbo; frase: string }[] = (Object.keys(FRASES) as Verbo[])
  .flatMap((verbo) => FRASES[verbo].map((frase) => ({ verbo, frase })))
  .sort((a, b) => b.frase.length - a.frase.length);

/** "a ", "al ", "a la ", "de " que sobran entre el verbo y el nombre ("cobrar a juan"). */
const RELLENO = /^(?:a\s+la|a\s+el|al|a|de\s+la|de\s+el|del|de|para)\s+/;

/**
 * Qué pidió la persona, o null si es una búsqueda común (un nombre, un DNI, una pantalla).
 * `arg` conserva mayúsculas y acentos tal como se escribieron.
 */
export function interpretar(texto: string): Comando | null {
  const crudo = texto.replace(/\s+/g, " ").trim();
  if (!crudo) return null;
  const norm = sinAcentos(crudo);
  for (const { verbo, frase } of TABLA) {
    if (norm !== frase && !norm.startsWith(`${frase} `)) continue;
    // sinAcentos no cambia el largo de las letras base: se corta el texto original en el mismo punto.
    let arg = crudo.slice(frase.length).trim();
    if (verbo !== "tarea" && verbo !== "gasto") {
      let previo = "";
      while (previo !== arg) { previo = arg; arg = arg.replace(new RegExp(RELLENO.source, "i"), ""); }
    }
    return { verbo, arg: arg.trim() };
  }
  return null;
}

/** Un DNI o número a medio camino: 6 a 11 cifras, con o sin puntos. */
export const pareceDni = (s: string) => /^\d{1,3}(?:[.\s]?\d{3}){1,3}$/.test(s.trim()) || /^\d{6,11}$/.test(s.trim());

/** Sacar el "ir a / abrir / ver" de una búsqueda de pantallas: "ir a caja" busca "caja". */
export function sinVerboIr(texto: string): string {
  return texto.replace(/^\s*(?:ir\s+a\s+(?:la\s+|el\s+|los\s+|las\s+)?|ir\s+|abrir\s+(?:la\s+|el\s+|los\s+|las\s+)?|ver\s+(?:la\s+|el\s+|los\s+|las\s+)?|mostrar\s+|anda\s+a\s+|andá\s+a\s+|llevame\s+a\s+)/i, "").trim();
}

type SeccionMinima = { clave: string };

/**
 * Qué acciones se le ofrecen a esta persona: salen de las secciones que ya filtró su rol y lo que el
 * gimnasio tiene prendido (una sección apagada o de otro rol no está en `secciones`, y sus acciones
 * tampoco). La recepción no ve gastos; la profe solo tareas; sin Vender no hay cobro.
 */
export function verbosPermitidos(secciones: SeccionMinima[], opciones: { puedeCobrar: boolean; soloVer: boolean }): Set<Verbo> {
  const tiene = (c: string) => secciones.some((s) => s.clave === c);
  const v = new Set<Verbo>();
  if (!opciones.soloVer) {
    if (opciones.puedeCobrar) v.add("cobrar");
    if (tiene("entrada")) v.add("entrada");
    if (tiene("socios")) { v.add("ficha"); v.add("nuevo_socio"); }
    if (tiene("vender")) v.add("vender");
    if (tiene("caja")) { v.add("abrir_turno"); v.add("cerrar_turno"); }
    if (tiene("gastos")) v.add("gasto");
  }
  if (tiene("tareas")) v.add("tarea");
  return v;
}

/** El comando, solo si la persona puede hacerlo (si no, es una búsqueda común). */
export function comandoPermitido(texto: string, permitidos: Set<Verbo>): Comando | null {
  const c = interpretar(texto);
  return c && permitidos.has(c.verbo) ? c : null;
}

export type Accion =
  | { id: string; verbo: Verbo; emoji: string; titulo: string; detalle?: string; tipo: "ir"; ruta: string }
  | { id: string; verbo: Verbo; emoji: string; titulo: string; detalle?: string; tipo: "cobrar" | "entrada" | "tarea"; socioId?: string; texto?: string };

type SocioCorto = { socio_id: string; nombre: string; dado_de_baja?: boolean };

/**
 * Las acciones para lo que se escribió, en orden (la primera queda preseleccionada).
 * `socios` son los que devolvió buscar_socios para el argumento del comando.
 */
export function accionesPara(texto: string, c: Comando | null, permitidos: Set<Verbo>, socios: SocioCorto[]): Accion[] {
  const salida: Accion[] = [];
  const q = sinAcentos(texto.trim());

  if (c) {
    const { verbo, arg } = c;
    const porSocio = socios.filter((s) => !s.dado_de_baja);
    if (verbo === "cobrar" && arg) {
      for (const s of porSocio) salida.push({ id: `cobrar:${s.socio_id}`, verbo, tipo: "cobrar", emoji: "plata", titulo: `Cobrar a ${s.nombre}`, socioId: s.socio_id });
    } else if (verbo === "ficha" && arg) {
      for (const s of socios) salida.push({ id: `ficha:${s.socio_id}`, verbo, tipo: "ir", emoji: "", titulo: `Ficha de ${s.nombre}`, ruta: `/panel/socios/${s.socio_id}` });
    } else if (verbo === "entrada" && arg) {
      salida.push({ id: "entrada", verbo, tipo: "entrada", emoji: "puerta", titulo: pareceDni(arg) ? `Entrada del DNI ${arg}` : `Entrada de ${arg}`, detalle: "Abre la ventana de Entrada", texto: arg });
    } else if (verbo === "entrada") {
      salida.push({ id: "entrada", verbo, tipo: "entrada", emoji: "puerta", titulo: "Abrir la Entrada", detalle: "Después tipeá un DNI", texto: "" });
    } else if (verbo === "vender") {
      for (const s of porSocio) salida.push({ id: `vender:${s.socio_id}`, verbo, tipo: "ir", emoji: "carrito", titulo: `Vender a ${s.nombre}`, ruta: `/panel/vender?socio=${s.socio_id}` });
      salida.push({ id: "vender", verbo, tipo: "ir", emoji: "carrito", titulo: "Vender", detalle: arg ? `Productos, pases y packs (${arg})` : "Productos, pases y packs", ruta: "/panel/vender" });
    } else if (verbo === "nuevo_socio") {
      // VD-29D: "nuevo socio María" abre el alta con el nombre ya cargado (el alta valida el texto).
      const nombre = /^[\p{L} '.-]{2,60}$/u.test(arg) ? arg : "";
      salida.push({ id: "nuevo_socio", verbo, tipo: "ir", emoji: "mas", titulo: nombre ? `Nuevo socio: ${nombre}` : "Nuevo socio", detalle: "Dar de alta, con plan y cobro", ruta: nombre ? `/panel/socios/nuevo?nombre=${encodeURIComponent(nombre)}` : "/panel/socios/nuevo" });
    } else if (verbo === "abrir_turno") {
      salida.push({ id: "abrir_turno", verbo, tipo: "ir", emoji: "candado-abierto", titulo: "Abrir turno", detalle: "Caja: contar lo que hay y arrancar", ruta: "/panel/caja" });
    } else if (verbo === "cerrar_turno") {
      salida.push({ id: "cerrar_turno", verbo, tipo: "ir", emoji: "candado", titulo: "Cerrar turno", detalle: "Caja: contar y cerrar", ruta: "/panel/caja?accion=cerrar" });
    } else if (verbo === "gasto") {
      salida.push({ id: "gasto", verbo, tipo: "ir", emoji: "calculadora", titulo: "Cargar un gasto", detalle: "Gastos del mes", ruta: "/panel/gastos" });
    } else if (verbo === "tarea" && arg) {
      salida.push({ id: "tarea", verbo, tipo: "tarea", emoji: "ok", titulo: `Tarea para hoy: ${arg}`, detalle: "Se anota para vos, hoy", texto: arg });
    }
    return salida;
  }

  // Sin verbo: las acciones que se llaman parecido a lo escrito ("nuev" → Nuevo socio, "abrir t" → Abrir turno).
  if (q.length >= 3) {
    const sinArg: [Verbo, Accion][] = [
      ["nuevo_socio", { id: "nuevo_socio", verbo: "nuevo_socio", tipo: "ir", emoji: "mas", titulo: "Nuevo socio", detalle: "Dar de alta, con plan y cobro", ruta: "/panel/socios/nuevo" }],
      ["abrir_turno", { id: "abrir_turno", verbo: "abrir_turno", tipo: "ir", emoji: "candado-abierto", titulo: "Abrir turno", detalle: "Caja: contar lo que hay y arrancar", ruta: "/panel/caja" }],
      ["cerrar_turno", { id: "cerrar_turno", verbo: "cerrar_turno", tipo: "ir", emoji: "candado", titulo: "Cerrar turno", detalle: "Caja: contar y cerrar", ruta: "/panel/caja?accion=cerrar" }],
    ];
    for (const [verbo, a] of sinArg) {
      if (permitidos.has(verbo) && FRASES[verbo].some((f) => f.startsWith(q))) salida.push(a);
    }
  }
  return salida;
}

/** Un ejemplo de lo que se puede escribir, para el campo vacío (solo de lo que esta persona puede hacer). */
export function ejemplosDe(permitidos: Set<Verbo>): string[] {
  const todos: [Verbo, string][] = [
    ["cobrar", "cobrar Juan"], ["entrada", "entrada 12345678"], ["nuevo_socio", "nuevo socio"],
    ["abrir_turno", "abrir turno"], ["tarea", "tarea llamar a Pedro"], ["vender", "vender"],
  ];
  return todos.filter(([v]) => permitidos.has(v)).map(([, e]) => e);
}
