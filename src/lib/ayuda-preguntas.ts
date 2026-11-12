// VD-63 · El centro de ayuda: preguntas cortas con su respuesta y el botón que lleva a hacerlo. Es un archivo de datos
// versionado (no vive en la base): para sumar una pregunta, una entrada acá. Nada de esto decide permisos ni plata: la
// pregunta solo APARECE si la persona ve la pantalla a la que lleva (el rol y las secciones apagadas por el gimnasio ya
// filtran las secciones del panel); quien llega al destino sin permiso recibe el error de la base, como siempre.
import type { Rol, Seccion } from "@/lib/panel/secciones";

/** Súbela cuando cambie el contenido (queda a la vista en el pie del centro de ayuda). */
export const VERSION_PREGUNTAS = "2026-11-07";

export type PreguntaAyuda = {
  /** Identificador estable: es lo que lleva el link `?p=` desde Ctrl+K. */
  id: string;
  ambito: "panel" | "app";
  /** La sección (clave de SECCIONES en el panel; "clases" o "rutina" en la app) de la que depende: si el gimnasio la apagó, la pregunta no aparece. */
  seccion?: string;
  /** Si falta, la ven todos los roles que ven la sección. */
  roles?: Rol[];
  /** Nombre de la pantalla donde se hace (agrupa en el centro de ayuda). */
  pantalla: string;
  pregunta: string;
  /** Dos o tres líneas, en voseo. */
  respuesta: string;
  /** A dónde lleva el botón y qué dice. */
  destino: { ruta: string; boton: string };
  /** Cómo la busca la gente (sin tildes da igual). */
  palabras?: string;
};

const MOSTRADOR: Rol[] = ["dueno", "encargado", "recepcion"];
const GESTION: Rol[] = ["dueno", "encargado"];

export const PREGUNTAS: PreguntaAyuda[] = [
  // ── Panel · Hoy
  { id: "entrada-dni", ambito: "panel", seccion: "entrada", roles: MOSTRADOR, pantalla: "Entrada",
    pregunta: "¿Cómo dejo pasar a un socio?",
    respuesta: "En Entrada tipeá el DNI o escaneá el QR. Verde pasa; si no puede, la pantalla dice por qué y desde ahí le cobrás.",
    destino: { ruta: "/panel/entrada", boton: "Ir a Entrada" }, palabras: "ingreso puerta dni qr verde rojo semaforo pasar entrar" },
  { id: "entrada-no-pasa", ambito: "panel", seccion: "entrada", roles: MOSTRADOR, pantalla: "Entrada",
    pregunta: "¿Por qué un socio no puede entrar?",
    respuesta: "La pantalla de Entrada siempre dice el motivo: cuota vencida, pausa, suspensión o sin clases. Es la misma cuenta que usa la app y el kiosco.",
    destino: { ruta: "/panel/entrada", boton: "Ir a Entrada" }, palabras: "rojo bloqueado vencido motivo no deja pasar al dia" },
  { id: "tareas-hoy", ambito: "panel", seccion: "tareas", pantalla: "Para hacer hoy",
    pregunta: "¿Cómo anoto algo para hacer?",
    respuesta: "En Para hacer hoy escribí qué, para quién y para cuándo. Tildá lo que vayas terminando; lo que sobra pasa a mañana. También: Ctrl+K y “tarea llamar a Pedro”.",
    destino: { ruta: "/panel/tareas", boton: "Ir a Para hacer hoy" }, palabras: "tarea pendiente recordatorio agenda" },
  { id: "vencen-hoy", ambito: "panel", seccion: "vencen_hoy", roles: MOSTRADOR, pantalla: "Vencen y cobrar",
    pregunta: "¿A quién le aviso que vence?",
    respuesta: "Vencen y cobrar lista a los que vencen hoy o ya vencieron. Tocá “Cobrar” cuando pasen por el mostrador o mandales el mensaje que ya está armado.",
    destino: { ruta: "/panel/vencen-hoy", boton: "Ir a Vencen y cobrar" }, palabras: "vencimiento cuota atrasado moroso aviso whatsapp recordar pago" },
  { id: "clases-reservas", ambito: "panel", seccion: "clases", pantalla: "Clases",
    pregunta: "¿Cómo veo quién reservó una clase?",
    respuesta: "En Clases abrí la clase: ves los cupos, los anotados y marcás los presentes. La grilla de la semana está en “Ver la grilla”.",
    destino: { ruta: "/panel/clases", boton: "Ir a Clases" }, palabras: "reserva cupo anotados presentes lista asistencia grilla horario" },
  { id: "incidente", ambito: "panel", seccion: "incidentes", pantalla: "Incidentes",
    pregunta: "¿Cómo anoto un accidente en la sala?",
    respuesta: "En Incidentes escribí qué pasó, cuándo y a quién. Solo lo que se vio, sin diagnósticos: acá no se guardan datos de salud.",
    destino: { ruta: "/panel/incidentes", boton: "Ir a Incidentes" }, palabras: "accidente lesion golpe caida ambulancia" },

  // ── Panel · Socios
  { id: "alta-socio", ambito: "panel", seccion: "socios", roles: MOSTRADOR, pantalla: "Socios",
    pregunta: "¿Cómo doy de alta a un socio?",
    respuesta: "En Socios tocá “Nuevo socio”, completá nombre, DNI y celular, elegí el plan y cobrale. Desde Ctrl+K: escribí “nuevo socio”.",
    destino: { ruta: "/panel/socios/nuevo", boton: "Dar de alta un socio" }, palabras: "nuevo socio inscribir registrar crear anotar alta" },
  { id: "buscar-socio", ambito: "panel", seccion: "socios", roles: MOSTRADOR, pantalla: "Socios",
    pregunta: "¿Cómo busco a un socio?",
    respuesta: "Escribí nombre, DNI o teléfono en Socios (o en Ctrl+K). Tocá al socio para ver su ficha: plan, pagos, asistencia y notas.",
    destino: { ruta: "/panel/socios", boton: "Ir a Socios" }, palabras: "buscar encontrar ficha dni telefono nombre" },
  { id: "pausar-socio", ambito: "panel", seccion: "socios", roles: MOSTRADOR, pantalla: "Socios",
    pregunta: "¿Cómo pauso a un socio?",
    respuesta: "Abrí la ficha del socio y andá a Pausas: elegí desde cuándo vuelve. El dueño o el encargado la dan en el momento; si sos de recepción, queda como pedido para que la apruebe uno de ellos.",
    destino: { ruta: "/panel/socios", boton: "Buscar al socio" }, palabras: "pausa congelar congelamiento vacaciones viaje lesion frenar membresia licencia" },
  { id: "baja-socio", ambito: "panel", seccion: "socios", roles: GESTION, pantalla: "Socios",
    pregunta: "¿Cómo doy de baja a un socio?",
    respuesta: "En la ficha del socio usá “Dar de baja” y elegí el motivo. No se borra nada: queda el historial y se lo puede volver a dar de alta.",
    destino: { ruta: "/panel/socios", boton: "Buscar al socio" }, palabras: "baja eliminar borrar sacar desactivar se fue" },
  { id: "mensajes-socios", ambito: "panel", seccion: "mensajes", roles: MOSTRADOR, pantalla: "Mensajes",
    pregunta: "¿Dónde contesto lo que escriben los socios?",
    respuesta: "En Mensajes están las consultas y quejas que mandan desde la app. Abrí una, contestá y marcala como resuelta.",
    destino: { ruta: "/panel/mensajes", boton: "Ir a Mensajes" }, palabras: "consulta queja reclamo responder chat" },
  { id: "retencion", ambito: "panel", seccion: "retencion", roles: MOSTRADOR, pantalla: "Retención y números",
    pregunta: "¿Cómo sé quién se está yendo?",
    respuesta: "Retención y números lista a los que dejaron de venir o no renovaron, con el mensaje armado para escribirles.",
    destino: { ruta: "/panel/retencion", boton: "Ir a Retención" }, palabras: "bajas churn dejaron de venir ausentes recuperar riesgo" },

  // ── Panel · Plata
  { id: "cobrar-cuota", ambito: "panel", seccion: "socios", roles: MOSTRADOR, pantalla: "Cobrar",
    pregunta: "¿Cómo cobro una cuota?",
    respuesta: "Buscá al socio y tocá “Cobrar”: elegí el plan, el medio de pago y confirmá. Con Ctrl+K es más rápido: “cobrar juan”.",
    destino: { ruta: "/panel/socios", boton: "Buscar al socio" }, palabras: "cobro cuota pagar efectivo transferencia tarjeta renovar membresia" },
  { id: "anular-cobro", ambito: "panel", seccion: "socios", roles: MOSTRADOR, pantalla: "Socios",
    pregunta: "¿Cómo anulo un cobro?",
    respuesta: "En la ficha del socio, pestaña Pagos, tocá “Anular” en la venta y poné el motivo. El dueño o el encargado anulan; la recepción lo pide y ellos lo aprueban. No se borra: queda quién y por qué.",
    destino: { ruta: "/panel/socios", boton: "Buscar al socio" }, palabras: "anular cobro venta error devolver deshacer cancelar pago equivocado" },
  { id: "vender-producto", ambito: "panel", seccion: "vender", roles: MOSTRADOR, pantalla: "Productos y stock",
    pregunta: "¿Cómo vendo un producto o un pase?",
    respuesta: "En Productos y stock tocá lo que vendés, elegí el medio de pago y cobrá. Si es para un socio, buscalo primero para que quede en su ficha.",
    destino: { ruta: "/panel/vender", boton: "Ir a Productos y stock" }, palabras: "venta producto pase diario pack barrita agua suplemento stock" },
  { id: "caja-turno", ambito: "panel", seccion: "caja", roles: MOSTRADOR, pantalla: "Caja",
    pregunta: "¿Cómo abro y cierro la caja?",
    respuesta: "En Caja abrí el turno al empezar y cerralo al terminar, contando la plata. Todo lo que cobrás en el medio queda anotado en tu turno.",
    destino: { ruta: "/panel/caja", boton: "Ir a Caja" }, palabras: "caja turno arqueo cierre apertura contar plata efectivo" },
  { id: "transferencias", ambito: "panel", seccion: "transferencias", roles: MOSTRADOR, pantalla: "Transferencias",
    pregunta: "¿Cómo apruebo el comprobante de un socio?",
    respuesta: "En Transferencias abrí el comprobante, mirá que el monto y el alias coincidan y tocá aprobar. Si no coincide, rechazalo y el socio ve el motivo.",
    destino: { ruta: "/panel/transferencias", boton: "Ir a Transferencias" }, palabras: "comprobante transferencia aprobar rechazar pago banco" },
  { id: "gasto", ambito: "panel", seccion: "gastos", roles: GESTION, pantalla: "Gastos",
    pregunta: "¿Cómo cargo un gasto?",
    respuesta: "En Gastos tocá “Cargar gasto”, poné el monto y el rubro. Los fijos del mes se repiten con un toque y así ves la ganancia real.",
    destino: { ruta: "/panel/gastos", boton: "Ir a Gastos" }, palabras: "gasto egreso alquiler sueldo luz factura costo" },
  { id: "control", ambito: "panel", seccion: "control", roles: GESTION, pantalla: "Control",
    pregunta: "¿Cómo reviso qué pasó con la plata y la puerta?",
    respuesta: "Control muestra, en orden y con quién lo hizo, cada cobro, anulación y entrada. Filtrá por día o por persona para revisar algo puntual.",
    destino: { ruta: "/panel/control", boton: "Ir a Control" }, palabras: "auditoria historial quien hizo log revisar anulaciones" },

  // ── Panel · Gimnasio
  { id: "dia-fijo", ambito: "panel", seccion: "configuracion", roles: GESTION, pantalla: "Configuración",
    pregunta: "¿Qué es el día fijo?",
    respuesta: "Es cuando todos los socios vencen el mismo día del mes y pagan en una ventana (por ejemplo del 1 al 10). En Configuración, Cobros, elegís cómo paga el que se suma a mitad de mes.",
    destino: { ruta: "/panel/configuracion?pestana=cobros", boton: "Ver las reglas de cobro" }, palabras: "dia fijo vencimiento ciclo mensual mismo dia proporcional mes entero ventana" },
  { id: "cambiar-precio", ambito: "panel", seccion: "planes", roles: GESTION, pantalla: "Planes y servicios",
    pregunta: "¿Cómo cambio el precio de un plan?",
    respuesta: "En Planes y servicios tocá el plan y cambiá el precio. Los socios que ya lo tienen no se tocan; si querés un aumento general, está “Aumento de precios”.",
    destino: { ruta: "/panel/planes", boton: "Ir a Planes y servicios" }, palabras: "precio plan aumento subir cuota tarifa" },
  { id: "pagina-publica", ambito: "panel", seccion: "pagina", roles: GESTION, pantalla: "Tu página",
    pregunta: "¿Cómo cambio lo que ve la gente en mi página?",
    respuesta: "En Tu página editás la portada, los textos, las fotos y las preguntas. Publicala cuando esté lista: la gente la ve y se puede anotar sola.",
    destino: { ruta: "/panel/pagina", boton: "Ir a Tu página" }, palabras: "pagina web landing fotos portada publicar sitio" },
  { id: "equipo-acceso", ambito: "panel", seccion: "equipo", roles: GESTION, pantalla: "Equipo",
    pregunta: "¿Cómo le doy acceso a alguien del equipo?",
    respuesta: "En Equipo sumá a la persona con su rol y tocá “Dar acceso”: se crea su cuenta y una contraseña provisoria que se muestra una sola vez.",
    destino: { ruta: "/panel/equipo", boton: "Ir a Equipo" }, palabras: "equipo empleado recepcion profe acceso usuario cuenta contraseña permiso rol" },
  { id: "secciones-apagar", ambito: "panel", seccion: "configuracion", roles: GESTION, pantalla: "Configuración",
    pregunta: "¿Cómo apago una sección que no uso?",
    respuesta: "En Configuración, Secciones, apagá lo que no uses (por ejemplo Clases): desaparece de todos los paneles y de la app, sin perder lo cargado.",
    destino: { ruta: "/panel/configuracion?pestana=secciones", boton: "Ir a Secciones" }, palabras: "apagar prender secciones ocultar menu clases rutinas caja" },

  // ── Panel · Para todos
  { id: "pin-atiende", ambito: "panel", pantalla: "PIN",
    pregunta: "¿Cómo cambio de persona en la compu de recepción?",
    respuesta: "Tocá “Cambiar” en la barra “Atiende …” y poné tu PIN: lo que hagas queda a tu nombre, sin cerrar la sesión. Tu PIN lo elegís en Mi cuenta.",
    destino: { ruta: "/panel/pin", boton: "Poner mi PIN" }, palabras: "pin cambiar persona turno quien atiende operador mostrador" },
  { id: "mi-contrasena", ambito: "panel", pantalla: "Mi cuenta",
    pregunta: "¿Cómo cambio mi contraseña?",
    respuesta: "En Mi cuenta elegís una contraseña nueva. Si no te acordás de la actual, en la pantalla de ingreso tocá “¿Te olvidaste la contraseña?”.",
    destino: { ruta: "/panel/cuenta", boton: "Ir a Mi cuenta" }, palabras: "contraseña clave password cambiar olvide cuenta dos pasos seguridad" },

  // ── App del socio
  { id: "app-qr", ambito: "app", pantalla: "Inicio",
    pregunta: "¿Cómo entro al gimnasio con mi celular?",
    respuesta: "En Inicio tenés tu código QR. Mostralo en la entrada, o decí tu DNI en recepción. Si no te deja pasar, la pantalla dice por qué.",
    destino: { ruta: "/app", boton: "Ver mi QR" }, palabras: "qr entrar entrada puerta codigo dni" },
  { id: "app-pagar", ambito: "app", pantalla: "Yo",
    pregunta: "¿Cómo pago mi cuota?",
    respuesta: "En Yo tocá “Pagar”: transferís al alias del gimnasio y subís el comprobante, o pagás en recepción. Cuando lo aprueban, ya estás al día.",
    destino: { ruta: "/app/yo", boton: "Ir a Yo" }, palabras: "pagar cuota transferencia comprobante alias mercadopago vence" },
  { id: "app-plan", ambito: "app", pantalla: "Plan",
    pregunta: "¿Cómo cambio de plan?",
    respuesta: "En Plan elegís el que querés y seguís los pasos. Si algo no se puede cambiar desde la app, escribile al gimnasio desde Mensajes.",
    destino: { ruta: "/app/plan", boton: "Ver los planes" }, palabras: "plan cambiar membresia pase comprar" },
  { id: "app-reservar", ambito: "app", seccion: "clases", pantalla: "Clases",
    pregunta: "¿Cómo reservo una clase?",
    respuesta: "En Clases elegí el día y tocá “Reservar”. Si no podés ir, cancelá a tiempo para no perder el cupo.",
    destino: { ruta: "/app/clases", boton: "Ir a Clases" }, palabras: "reservar clase cupo anotarme cancelar turno" },
  { id: "app-rutina", ambito: "app", seccion: "rutina", pantalla: "Rutina",
    pregunta: "¿Cómo anoto el peso que levanté?",
    respuesta: "En Rutina abrí el ejercicio, escribí el peso y marcá cuando terminás. Así ves cómo progresás semana a semana.",
    destino: { ruta: "/app/rutina", boton: "Ir a Rutina" }, palabras: "peso rutina ejercicio progreso entrenamiento serie" },
  { id: "app-pausa", ambito: "app", pantalla: "Yo",
    pregunta: "¿Cómo pauso mi membresía?",
    respuesta: "En Yo entrá a Mi membresía y pedí la pausa: elegí desde cuándo y hasta cuándo. El gimnasio la aprueba y la ves reflejada ahí mismo.",
    destino: { ruta: "/app/cuenta", boton: "Ir a Mi membresía" }, palabras: "pausa congelar vacaciones viaje lesion frenar" },
  { id: "app-mensaje", ambito: "app", pantalla: "Mensajes",
    pregunta: "¿Cómo le escribo al gimnasio?",
    respuesta: "En Mensajes mandá tu consulta o queja; te contestan ahí mismo. Para algo urgente, usá el WhatsApp de Info del gimnasio.",
    destino: { ruta: "/app/mensajes/nuevo", boton: "Escribir un mensaje" }, palabras: "mensaje consulta queja escribir contacto whatsapp" },
  { id: "app-info", ambito: "app", pantalla: "Info del gimnasio",
    pregunta: "¿Dónde veo los horarios, el reglamento y cómo llegar?",
    respuesta: "En Info del gimnasio: horarios y feriados, reglamento, contacto y WhatsApp, cómo llegar y las preguntas frecuentes.",
    destino: { ruta: "/app/info", boton: "Ver Info del gimnasio" }, palabras: "horarios feriados reglamento direccion mapa contacto whatsapp llegar abierto cierra" },
];

const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Las preguntas que esta persona ve. Panel: solo las de una sección que su rol ve y el gimnasio no apagó
 * (`secciones` ya viene filtrada por `seccionesPara`), y las que no dependen de ninguna. App: las de clases o
 * rutina solo si el gimnasio las tiene (`seccionesApp`).
 */
export function preguntasPara(ambito: "panel" | "app", opciones: { rol?: Rol; secciones?: Pick<Seccion, "clave">[]; seccionesApp?: string[] }): PreguntaAyuda[] {
  const claves = new Set((opciones.secciones ?? []).map((s) => s.clave));
  const app = new Set(opciones.seccionesApp ?? []);
  return PREGUNTAS.filter((p) => {
    if (p.ambito !== ambito) return false;
    if (ambito === "panel" && opciones.rol && p.roles && !p.roles.includes(opciones.rol)) return false;
    if (p.seccion && (ambito === "panel" ? !claves.has(p.seccion) : !app.has(p.seccion))) return false;
    return true;
  });
}

/** Busca por lo escrito (sin tildes ni mayúsculas, todas las palabras): primero las que lo tienen en la pregunta. */
export function buscarPreguntas(lista: PreguntaAyuda[], texto: string, tope = 6): PreguntaAyuda[] {
  const palabras = sinAcentos(texto).replace(/[¿?¡!.,]/g, " ").split(/\s+/).filter((w) => w.length >= 2 && !RELLENO.has(w));
  if (!palabras.length) return [];
  const puntuar = (p: PreguntaAyuda) => {
    const t = sinAcentos(p.pregunta), r = sinAcentos(`${p.respuesta} ${p.palabras ?? ""} ${p.pantalla}`);
    let pts = 0;
    for (const w of palabras) {
      if (coincide(t, w)) pts += 3; else if (coincide(r, w)) pts += 1; else return 0;   // cada palabra tiene que estar
    }
    return pts;
  };
  return lista.map((p) => ({ p, pts: puntuar(p) })).filter((x) => x.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, tope).map((x) => x.p);
}
/** "anular" encuentra "anulo" y "pausar" encuentra "pauso": desde 5 letras se compara la raíz (sin las dos últimas). */
const coincide = (texto: string, w: string) => texto.includes(w.length >= 5 ? w.slice(0, Math.max(4, w.length - 2)) : w);
const RELLENO = new Set(["como", "que", "es", "el", "la", "los", "las", "un", "una", "de", "del", "a", "al", "en", "mi", "me", "se", "lo", "y", "o", "para", "por", "donde", "puedo", "hago", "hacer"]);
