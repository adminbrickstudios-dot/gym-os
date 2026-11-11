// C3 · Las guías de uso por rol (recepción, dueño, profe, socio): una página por rol, hasta 10 pasos cada una.
// Es un archivo de datos versionado, como las preguntas de la ayuda (ayuda-preguntas.ts). Cada paso dice algo que la app hace de verdad:
// los nombres de botones y pantallas salen del código. Nada de esto decide permisos ni plata: un paso APARECE solo si el gimnasio no
// apagó la sección a la que lleva (`seccion`, con las claves de lib/panel/secciones.ts); quien llega a la pantalla sin permiso recibe el
// error de la base, como siempre. Las capturas de cada paso las genera scripts/e2e/guias-capturas.mjs a partir de guias-capturas.json
// y quedan en public/guias/<archivo>.png; si todavía no están, la página se lee igual.
import capturas from "./guias-capturas.json";

export type RolGuia = "recepcion" | "dueno" | "profe" | "socio";

export type PasoGuia = {
  id: string;
  titulo: string;
  /** Dos o tres frases cortas, en voseo. */
  texto: string;
  /** Clave de la sección del panel de la que depende: si el gimnasio la apagó, el paso no aparece. */
  seccion?: string;
  /** A dónde lleva el botón del paso y qué dice. */
  destino?: { ruta: string; boton: string };
  /** Nombre del archivo de la captura (sin extensión) en public/guias/. Tiene que estar en guias-capturas.json. */
  captura?: string;
};

export type Guia = {
  rol: RolGuia;
  /** "panel" si los pasos se hacen en el panel del equipo; "app" si se hacen en la app del socio. */
  ambito: "panel" | "app";
  titulo: string;
  paraQuien: string;
  bajada: string;
  pasos: PasoGuia[];
};

/** Súbela cuando cambie el contenido. */
export const VERSION_GUIAS = "2026-11-11";
export const MAXIMO_PASOS = 10;

export const GUIAS: Guia[] = [
  {
    rol: "recepcion", ambito: "panel", titulo: "Guía de recepción", paraQuien: "Para quien atiende el mostrador",
    bajada: "Lo que se hace en un turno, en el orden en que pasa.",
    pasos: [
      { id: "entrar", titulo: "Entrá con tu usuario",
        texto: "Abrí la dirección que te pasó el dueño y escribí tu mail y tu contraseña. Si te olvidaste la contraseña, en esa misma pantalla tocá “¿Te olvidaste la contraseña?”." },
      { id: "pin", titulo: "Poné tu PIN si compartís la compu",
        texto: "Tocá “Cambiar” en la barra “Atiende …” y escribí tu PIN. Lo que hagas queda a tu nombre y no se cierra la sesión de nadie. Tu PIN lo elegís en Mi cuenta.",
        destino: { ruta: "/panel/pin", boton: "Poner mi PIN" } },
      { id: "caja-abrir", titulo: "Abrí tu turno de caja", seccion: "caja", captura: "recepcion-caja-abrir",
        texto: "En Caja tocá “Abrir mi turno” y escribí con cuánta plata arrancás. Todo lo que cobres en el turno queda anotado a tu nombre.",
        destino: { ruta: "/panel/caja", boton: "Ir a Caja" } },
      { id: "entrada", titulo: "Buscá al socio en Entrada", seccion: "entrada", captura: "recepcion-entrada",
        texto: "Escribí el DNI, el nombre o el número del socio. Desde cualquier pantalla se abre con F2 o Ctrl+E. Verde: puede pasar, y Enter anota la entrada.",
        destino: { ruta: "/panel/entrada", boton: "Ir a Entrada" } },
      { id: "lector", titulo: "Si tu gimnasio usa QR o llavero", seccion: "entrada",
        texto: "Pasalo por el lector: Entrada se abre sola con ese socio. Sin lector, tocá “Leer QR” y usá la cámara." },
      { id: "no-pasa", titulo: "Si no puede entrar, mirá el motivo", seccion: "entrada",
        texto: "La pantalla dice por qué: cuota vencida, pausa o suspensión. Tocá “Cobrar” y lo regularizás ahí mismo. “Dejar pasar igual” pide un motivo y queda anotado; a un socio suspendido o dado de baja lo deja pasar el dueño o el encargado." },
      { id: "alta", titulo: "Dá de alta a un socio nuevo", seccion: "socios", captura: "recepcion-alta",
        texto: "En Socios tocá “Nuevo socio”. Completá nombre, DNI y celular, elegí el plan y cobrale.",
        destino: { ruta: "/panel/socios/nuevo", boton: "Dar de alta un socio" } },
      { id: "vencen", titulo: "Cobrá a los que vencen", seccion: "vencen_hoy", captura: "recepcion-vencen",
        texto: "Vencen y cobrar lista a los que vencen hoy o ya vencieron. Tocá “Cobrar” cuando pasen por el mostrador, o mandales el mensaje que ya está armado.",
        destino: { ruta: "/panel/vencen-hoy", boton: "Ir a Vencen y cobrar" } },
      { id: "vender", titulo: "Vendé un producto o un pase", seccion: "vender", captura: "recepcion-vender",
        texto: "En Productos y stock tocá lo que vendés, elegí el medio de pago y cobrá. Si es para un socio, buscalo primero para que quede en su ficha.",
        destino: { ruta: "/panel/vender", boton: "Ir a Productos y stock" } },
      { id: "caja-cerrar", titulo: "Cerrá tu turno", seccion: "caja",
        texto: "Al terminar, en Caja contá la plata del cajón, escribí cuánto hay y cerrá el turno.",
        destino: { ruta: "/panel/caja", boton: "Ir a Caja" } },
    ],
  },
  {
    rol: "dueno", ambito: "panel", titulo: "Guía del dueño", paraQuien: "Para quien arma y maneja el gimnasio",
    bajada: "Lo que conviene hacer la primera semana y lo que se mira cada día.",
    pasos: [
      { id: "marca", titulo: "Poné tu logo y tu color", seccion: "configuracion", captura: "dueno-marca",
        texto: "En Configuración, Marca, subí el logo y elegí el color. Lo ven tus socios en la app, en tu página y en los carteles.",
        destino: { ruta: "/panel/configuracion?pestana=marca", boton: "Ir a Marca" } },
      { id: "secciones", titulo: "Apagá lo que no usás", seccion: "configuracion", captura: "dueno-secciones",
        texto: "En Configuración, Secciones, apagá lo que no uses (por ejemplo Clases). Desaparece de todos los paneles y de la app, y no se pierde lo cargado.",
        destino: { ruta: "/panel/configuracion?pestana=secciones", boton: "Ir a Secciones" } },
      { id: "planes", titulo: "Cargá tus planes y precios", seccion: "planes", captura: "dueno-planes",
        texto: "En Planes y servicios cargá lo que vendés y cuánto cuesta. Un aumento se programa con fecha y no toca lo ya cobrado.",
        destino: { ruta: "/panel/planes", boton: "Ir a Planes y servicios" } },
      { id: "equipo", titulo: "Sumá a tu equipo", seccion: "equipo", captura: "dueno-equipo",
        texto: "En Equipo agregá a cada persona con su rol y tocá “Dar acceso”. Se crea su cuenta con una contraseña provisoria que se muestra una sola vez.",
        destino: { ruta: "/panel/equipo", boton: "Ir a Equipo" } },
      { id: "accesos", titulo: "Elegí cómo entra la gente", seccion: "configuracion", captura: "dueno-accesos",
        texto: "En Configuración, Reglas, “Cómo entra la gente”: prendé el QR del socio, la tablet en la puerta o el llavero. La recepción siempre está prendida.",
        destino: { ruta: "/panel/configuracion?pestana=reglas", boton: "Ir a Reglas" } },
      { id: "socios", titulo: "Cargá a tus socios", seccion: "socios", captura: "dueno-socios",
        texto: "En Socios tocá “Importar de un Excel” para cargar la lista que ya tenés, o dalos de alta de a uno con “Nuevo socio”.",
        destino: { ruta: "/panel/socios", boton: "Ir a Socios" } },
      { id: "pagina", titulo: "Armá tu página", seccion: "pagina", captura: "dueno-pagina",
        texto: "En Tu página editás la portada, los textos y las fotos. Publicala cuando esté lista: la gente la ve y se puede anotar sola.",
        destino: { ruta: "/panel/pagina", boton: "Ir a Tu página" } },
      { id: "carteles", titulo: "Imprimí los carteles", captura: "dueno-carteles",
        texto: "Hay dos hojas A4 con tu logo y tu color: una para la puerta y otra con el QR para descargar la app. Se guardan como PDF desde el navegador.",
        destino: { ruta: "/panel/ayuda/carteles", boton: "Ir a los carteles" } },
      { id: "tareas", titulo: "Cada día, mirá Para hacer hoy", seccion: "tareas", captura: "dueno-tareas",
        texto: "Ahí está lo que se calcula solo, el checklist y las tareas que anotás vos. Tildá lo que vayas terminando.",
        destino: { ruta: "/panel/tareas", boton: "Ir a Para hacer hoy" } },
      { id: "plata", titulo: "Mirá la plata", seccion: "resultado", captura: "dueno-resultado",
        texto: "Resultado muestra cuánto entró y de dónde, contra el mes anterior. En Control ves cada cobro, anulación y entrada con quién lo hizo.",
        destino: { ruta: "/panel/resultado", boton: "Ir a Resultado" } },
    ],
  },
  {
    rol: "profe", ambito: "panel", titulo: "Guía del profe", paraQuien: "Para quien da clases en la sala",
    bajada: "Lo que ves en tu panel y lo que se hace con cada cosa.",
    pasos: [
      { id: "entrar", titulo: "Entrá con tu usuario",
        texto: "Abrí la dirección que te pasó el dueño y escribí tu mail y tu contraseña. Vas a ver solo lo que tu rol puede usar." },
      { id: "fichar", titulo: "Fichá al llegar y al irte", seccion: "fichar", captura: "profe-fichar",
        texto: "En Fichar y mis horas marcá tu entrada al llegar y tu salida al irte. Si te olvidás la salida, esa entrada no suma horas hasta que el dueño la corrija.",
        destino: { ruta: "/panel/fichar", boton: "Ir a Fichar" } },
      { id: "clases", titulo: "Mirá tus clases de hoy", seccion: "clases", captura: "profe-clases",
        texto: "En Clases elegí el día y tocá una clase: ves los cupos y los anotados. La grilla de la semana está en “Ver la grilla”.",
        destino: { ruta: "/panel/clases", boton: "Ir a Clases" } },
      { id: "presente", titulo: "Tomá presente", seccion: "clases",
        texto: "Con la clase abierta, marcá “Presente” a cada uno que vino." },
      { id: "rutinas", titulo: "Armá y asigná rutinas", seccion: "rutinas", captura: "profe-rutinas",
        texto: "En Rutinas tocá “Nueva rutina”, armala con los ejercicios del gimnasio y asignala a uno o a varios socios.",
        destino: { ruta: "/panel/rutinas", boton: "Ir a Rutinas" } },
      { id: "incidente", titulo: "Anotá un accidente", seccion: "incidentes", captura: "profe-incidentes",
        texto: "En Incidentes escribí qué pasó, cuándo y a quién. Solo lo que se vio, sin diagnóstico: acá no se guardan datos de salud.",
        destino: { ruta: "/panel/incidentes", boton: "Ir a Incidentes" } },
      { id: "maquina", titulo: "Avisá de una máquina rota", seccion: "maquinas", captura: "profe-maquinas",
        texto: "En Máquinas marcá la que está fuera de servicio. El dueño o el encargado la cierran cuando se arregla.",
        destino: { ruta: "/panel/maquinas", boton: "Ir a Máquinas" } },
      { id: "tareas", titulo: "Mirá Para hacer hoy", seccion: "tareas", captura: "profe-tareas",
        texto: "Lo que te toca hacer hoy, con quién y para cuándo. Tildá lo que termines.",
        destino: { ruta: "/panel/tareas", boton: "Ir a Para hacer hoy" } },
    ],
  },
  {
    rol: "socio", ambito: "app", titulo: "Guía del socio", paraQuien: "Para quien entrena en el gimnasio",
    bajada: "Todo desde tu celular: entrar, pagar, reservar y escribirle al gimnasio.",
    pasos: [
      { id: "entrar", titulo: "Entrá a la app",
        texto: "Abrí la página de tu gimnasio y tocá “Soy socio”. Entrás con tu mail y tu contraseña, o con tu celular: te llega un código." },
      { id: "instalar", titulo: "Ponela en tu pantalla de inicio",
        texto: "En Android tocá “Instalar”. En iPhone, desde Safari, tocá Compartir y después “Agregar a inicio”. Así la abrís como cualquier app." },
      { id: "qr", titulo: "Entrá con tu QR", captura: "socio-inicio",
        texto: "En Inicio está tu código QR. Mostralo en la entrada. Cambia cada 30 segundos, así que una captura vieja no sirve. Sin celular, decí tu DNI en recepción." },
      { id: "qr-tablet", titulo: "Si hay una tablet en la puerta",
        texto: "En Inicio tocá “Escanear el QR de la entrada” y apuntá la cámara al QR de la tablet. La pantalla te dice si pasás o por qué no." },
      { id: "pagar", titulo: "Pagá tu cuota", captura: "socio-pagar",
        texto: "En Yo tocá “Pagar”: transferís al alias del gimnasio y subís el comprobante, o pagás en recepción. Cuando lo aprueban, ya estás al día." },
      { id: "clases", titulo: "Reservá una clase", seccion: "clases", captura: "socio-clases",
        texto: "En Clases elegí el día y tocá “Reservar”. Si no podés ir, cancelá a tiempo para no perder el cupo." },
      { id: "rutina", titulo: "Anotá el peso que levantaste", seccion: "rutinas", captura: "socio-rutina",
        texto: "En Rutina abrí el ejercicio, escribí el peso y marcá cuando terminás. Así ves cómo progresás semana a semana." },
      { id: "pausa", titulo: "Pedí una pausa", captura: "socio-membresia",
        texto: "En Yo entrá a Mi membresía y pedí la pausa: elegí desde cuándo y hasta cuándo. El gimnasio la aprueba y la ves ahí mismo." },
      { id: "mensaje", titulo: "Escribile al gimnasio", captura: "socio-mensajes",
        texto: "En Mensajes mandá tu consulta o queja y te contestan ahí mismo. Para algo urgente, usá el WhatsApp de Info del gimnasio." },
      { id: "info", titulo: "Mirá horarios y reglamento", captura: "socio-info",
        texto: "En Info del gimnasio están los horarios y feriados, el reglamento, el contacto, cómo llegar y las preguntas frecuentes." },
    ],
  },
];

export const ROLES_GUIA: RolGuia[] = GUIAS.map((g) => g.rol);
export const esRolGuia = (x: string): x is RolGuia => (ROLES_GUIA as string[]).includes(x);
export const guiaDe = (rol: RolGuia): Guia => GUIAS.find((g) => g.rol === rol)!;

/** Las capturas que existen en la lista (el script las genera; la página las pide por este nombre). */
export const CAPTURAS: { archivo: string; rol: RolGuia; ruta: string; pantalla: "compu" | "celu" }[] = capturas as never;
export const rutaCaptura = (archivo: string) => `/guias/${archivo}.png`;

/**
 * Los pasos que se ven: se saca el que lleva a una sección que el gimnasio apagó (`visibles` son las claves de secciones
 * del panel que están prendidas para ese rol). Con `conLinks` falso se sacan los botones (ej.: la guía del socio abierta desde el panel).
 */
export function pasosVisibles(guia: Guia, visibles: Set<string>, conLinks: boolean): PasoGuia[] {
  return guia.pasos
    .filter((p) => !p.seccion || visibles.has(p.seccion))
    .map((p) => (conLinks ? p : { ...p, destino: undefined }));
}

/** Qué guías puede abrir cada rol del panel: el dueño y el encargado, todas; la recepción, la suya y la del socio; el profe, la suya. */
export function guiasDeRolPanel(rol: "dueno" | "encargado" | "recepcion" | "profe"): RolGuia[] {
  if (rol === "dueno" || rol === "encargado") return ["recepcion", "dueno", "profe", "socio"];
  if (rol === "recepcion") return ["recepcion", "socio"];
  return ["profe"];
}
