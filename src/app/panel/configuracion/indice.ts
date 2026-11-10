// VD-21 · El índice de Configuración: una fila por opción, con la pestaña donde vive, el ancla
// (`data-opcion` en la pantalla), palabras para encontrarla, una línea de qué hace y el valor recomendado.
// Es la única lista de opciones: el buscador la usa y el e2e verifica que cada ancla exista.
import type { ClavePestana } from "./pestanas";

export type Opcion = {
  /** Ancla: el `data-opcion` del elemento en la pantalla. */
  id: string;
  titulo: string;
  pestana: ClavePestana;
  /** Palabras con las que la gente la busca (sin tildes da igual). */
  claves: string;
  /** Una línea: qué hace. */
  explicacion: string;
  /** Lo recomendado, si tiene (también lo que hace “Restablecer”). */
  recomendado?: string;
};

export const OPCIONES: Opcion[] = [
  // ── Gimnasio
  { id: "datos-gimnasio", titulo: "Nombre, WhatsApp, Instagram y mail", pestana: "gimnasio", claves: "nombre whatsapp instagram mail correo contacto telefono", explicacion: "Lo que ve la gente en tu página y en la app del socio." },
  { id: "sedes", titulo: "Sedes y dirección", pestana: "gimnasio", claves: "sede sucursal direccion mapa telefono ubicacion donde queda", explicacion: "La dirección, el teléfono y el mapa salen en tu página; cada sede tiene su caja y su entrada." },
  { id: "zona-horaria", titulo: "Zona horaria", pestana: "gimnasio", claves: "zona horaria hora huso", explicacion: "Con ella se calcula cuándo empieza y termina cada día; la cambia soporte BRIK." },
  { id: "exportar-datos", titulo: "Descargar todos los datos", pestana: "gimnasio", claves: "exportar descargar datos excel backup copia", explicacion: "Todo lo de tu gimnasio, un archivo por tema, para abrir con Excel." },
  // ── Marca
  { id: "logo", titulo: "Logo", pestana: "marca", claves: "logo imagen marca", explicacion: "Sale en tu página, arriba en el panel y en la app del socio." },
  { id: "favicon", titulo: "Ícono de la pestaña", pestana: "marca", claves: "icono favicon pestana navegador", explicacion: "El dibujito chico de la pestaña del navegador; si no subís uno se usa el logo." },
  { id: "colores", titulo: "Colores (fondo y color principal)", pestana: "marca", claves: "color colores fondo acento paleta diseno tema", explicacion: "Se ven en tu página, en el panel y en la app del socio." },
  // ── Página
  { id: "publicar-pagina", titulo: "Publicar tu página", pestana: "pagina", claves: "pagina publicar borrador web link compartir whatsapp sitio", explicacion: "Tu página se ve desde que creás el gimnasio, con lo que tengas cargado. Si la ocultás, la gente ve solo tu portada con tu marca y los botones." },
  { id: "registro-abierto", titulo: "Registro abierto (anotarse solo)", pestana: "pagina", claves: "registro anotarse solo autoservicio alta web inscripcion", explicacion: "La gente se anota sola desde tu página y entra cuando paga.", recomendado: "Cerrado" },
  { id: "compras-app", titulo: "Cambiar de plan y comprar pases desde la app", pestana: "pagina", claves: "compras app plan pase autoservicio comprar mercadopago", explicacion: "El socio elige otro plan o un pase y paga desde su app.", recomendado: "Prendido" },
  { id: "fotos", titulo: "Fotos de la página", pestana: "pagina", claves: "fotos imagenes galeria portada", explicacion: "Las que ve la gente en tu página; la primera es la que más se ve." },
  { id: "prueba-social", titulo: "Prueba social, textos y secciones de la página", pestana: "pagina", claves: "prueba social opiniones testimonios textos secciones editar pagina", explicacion: "Se editan en Tu página (botón “Editar textos y secciones”)." },
  // ── Cobros
  { id: "que-cobras", titulo: "Qué cobrás: membresía, pase diario, packs", pestana: "cobros", claves: "cobrar membresia pase diario pack clases venta", explicacion: "Lo que no cobrás no aparece al vender; tiene que quedar al menos uno.", recomendado: "Membresía y pase diario prendidos, packs apagados" },
  { id: "medios-pago", titulo: "Medios de pago", pestana: "cobros", claves: "medios pago efectivo transferencia debito credito tarjeta mercado pago posnet", explicacion: "Con qué te pueden pagar; lo que apagues no se ofrece en Vender ni en la app.", recomendado: "Efectivo, transferencia, débito y crédito" },
  { id: "transferencias", titulo: "Alias, CBU, titular y banco", pestana: "cobros", claves: "alias cbu cvu titular banco transferencia cuenta billetera", explicacion: "Lo que ve el socio para pagarte por transferencia." },
  { id: "recargo", titulo: "Recargo por pagar tarde", pestana: "cobros", claves: "recargo mora atraso pagar tarde interes porcentaje", explicacion: "Apagado, nadie paga de más; prendido, Vender lo suma solo a la cuota.", recomendado: "Sin recargo (a los 10 días de atraso si lo prendés)" },
  { id: "fiado", titulo: "Fiar (cuenta corriente)", pestana: "cobros", claves: "fiado fiar cuenta corriente a cuenta deuda debe tope", explicacion: "Prendido, en Vender aparece “A cuenta” hasta un tope por socio.", recomendado: "Apagado, sin tope" },
  { id: "vencimiento", titulo: "Cómo vencen las cuotas", pestana: "cobros", claves: "vencimiento vencen cuota dia fijo continua renovacion proporcional redondeo primera cuota", explicacion: "Desde el día que paga, continua o con día fijo; vale para los cobros nuevos.", recomendado: "Desde el día que paga" },
  { id: "dejar-pasar", titulo: "Dejar pasar sin pagar", pestana: "cobros", claves: "dejar pasar sin pagar mañana pago promesa pin recepcion autorizar", explicacion: "Quién puede dejar entrar a alguien que debe y hasta cuántos días de promesa.", recomendado: "La recepción hasta 3 días" },
  { id: "doble-cobro", titulo: "Aviso de doble cobro", pestana: "cobros", claves: "doble cobro dos veces misma cuota cobrada duplicado avisar frenar minutos confirmar motivo", explicacion: "Si dos personas cobran la misma cuota casi a la vez, la segunda frena y pide un motivo; acá se elige cuántos minutos (0 lo apaga).", recomendado: "2 minutos" },
  { id: "mercado-pago", titulo: "Mercado Pago", pestana: "cobros", claves: "mercado pago mp link qr online cobro", explicacion: "Cobrar con link o QR que se acredita solo." },
  { id: "caja", titulo: "Caja: por turno o una por día, billetes, fondo fijo, corte", pestana: "cobros", claves: "caja turno dia billetes arqueo fondo fijo hora corte horas maximas cierre", explicacion: "Cómo se abre y se cierra la caja y qué pasa con la que queda abierta.", recomendado: "Caja por turno, sin pedir billetes, fondo 0, corte 00:00, 14 horas" },
  // ── Reglas
  { id: "tolerancia-dias", titulo: "Días de gracia al vencer", pestana: "reglas", claves: "gracia tolerancia vencer vencimiento dias de gracia", explicacion: "Cuántos días más puede entrar cuando se le termina la cuota mientras paga.", recomendado: "5 días" },
  { id: "dias-aviso", titulo: "Avisar que vence (días antes)", pestana: "reglas", claves: "aviso avisar vence vencer amarillo anticipo", explicacion: "Desde cuántos días antes aparece en amarillo en la entrada.", recomendado: "3 días" },
  { id: "descuento-max", titulo: "Descuento máximo de la recepción", pestana: "reglas", claves: "descuento maximo recepcion porcentaje autorizar", explicacion: "Más que ese porcentaje lo autoriza el dueño.", recomendado: "10 %" },
  { id: "invitados", titulo: "Invitados por socio por mes", pestana: "reglas", claves: "invitados invitado amigo traer pase gratis mes", explicacion: "Cuántos invitados puede traer cada socio al día; en 0 no se reciben.", recomendado: "2 por mes" },
  { id: "tope-dejar-pasar", titulo: "Dejar pasar: tope por día de la recepción", pestana: "reglas", claves: "tope dejar pasar recepcion dia limite", explicacion: "Cuántas personas por día puede dejar pasar la recepción; en 0 ninguna.", recomendado: "5 por día" },
  { id: "pausa-dias", titulo: "Pausa: máximo de días por año", pestana: "reglas", claves: "pausa congelar congelamiento vacaciones licencia dias por anio", explicacion: "Cuántos días de pausa puede tener cada socio por año; en 0 no se dan.", recomendado: "30 días" },
  { id: "reingreso", titulo: "Volver a entrar el mismo día gasta otra entrada", pestana: "reglas", claves: "reingreso reentrada volver a entrar mismo dia otra entrada pack pase diario consume", explicacion: "Si alguien con pack vuelve a entrar el mismo día, se le descuenta otra clase o no.", recomendado: "Apagado: no gasta otra" },
  { id: "pide-apto", titulo: "Pedir apto físico", pestana: "reglas", claves: "apto fisico medico certificado vigencia", explicacion: "En la ficha se anota si presentó el apto y hasta cuándo vale; no frena la entrada.", recomendado: "Apagado" },
  { id: "retencion-ausencia", titulo: "“No viene” después de (días)", pestana: "reglas", claves: "retencion no viene ausencia ausente dias", explicacion: "Paga pero no aparece: pasado ese tiempo entra en la lista “No viene”.", recomendado: "14 días" },
  { id: "retencion-nuevo", titulo: "Socio nuevo durante (días)", pestana: "reglas", claves: "retencion nuevo socio nuevo primeros dias", explicacion: "Si no viene en sus primeros días, va a “Nuevo que no viene”.", recomendado: "28 días" },
  { id: "meta-primer-mes", titulo: "Meta del primer mes (entradas)", pestana: "reglas", claves: "meta primer mes socio nuevo riesgo entradas", explicacion: "La ficha del socio nuevo muestra cuánto lleva de esta meta.", recomendado: "8 entradas" },
  { id: "retencion-vencido", titulo: "Vencido pasa a “se fue” después de (días)", pestana: "reglas", claves: "retencion vencido se fue vencio baja dias", explicacion: "Mientras tanto está en “Venció”, para cobrarle.", recomendado: "30 días" },
  { id: "retencion-se-fue", titulo: "Los que se fueron se muestran durante (días)", pestana: "reglas", claves: "retencion se fue perdidos recuperar lista dias", explicacion: "Pasado ese tiempo dejan de aparecer en “Se fue”.", recomendado: "90 días" },
  { id: "acceso-qr", titulo: "QR del socio", pestana: "reglas", claves: "qr socio acceso app camara lector", explicacion: "El socio ve en su app un QR que cambia cada 30 segundos y Entrada lo lee." },
  { id: "acceso-kiosco", titulo: "Tablet en la puerta", pestana: "reglas", claves: "tablet kiosco puerta dni autoingreso acceso", explicacion: "Una tablet autorizada donde el socio escribe su DNI y, si puede, entra solo." },
  { id: "acceso-qr-pared", titulo: "QR en la tablet", pestana: "reglas", claves: "qr tablet pared escanear", explicacion: "La tablet muestra un QR que el socio escanea desde su app." },
  { id: "kiosco-habituales", titulo: "Los habituales de esta hora en la tablet", pestana: "reglas", claves: "habituales tablet nombres hora kiosco", explicacion: "La tablet muestra a los que suelen venir a esta hora; ponen los últimos 3 del DNI.", recomendado: "Apagado" },
  { id: "acceso-nfc", titulo: "Llavero o tarjeta", pestana: "reglas", claves: "llavero tarjeta nfc lector usb acceso", explicacion: "Se asigna un llavero a cada socio y el lector USB lo deja entrar directo." },
  { id: "meta-visitas", titulo: "Meta de visitas del mes", pestana: "reglas", claves: "meta visitas mes barra progreso app inicio", explicacion: "Cuántas veces al mes queremos que venga cada socio; lo ve en su app.", recomendado: "12 visitas" },
  { id: "cierres-suma-dias", titulo: "Días cerrados (¿se suman al vencimiento?)", pestana: "reglas", claves: "feriado feriados cierre cierres vacaciones dias cerrados sumar vencimiento devolver dias compensar puente", explicacion: "Si los días en que el gimnasio cierra se suman al vencimiento de los socios. Una regla para todos; la cambia solo el dueño y vale para los cierres que se carguen después.", recomendado: "No suma días (se suma solo si el gimnasio lo promete)" },
  { id: "prueba-gratis", titulo: "Prueba gratis (no / 1 día / 1 clase)", pestana: "reglas", claves: "prueba gratis clase de prueba dia interesado probar pase gratis regalo", explicacion: "Una prueba por DNI: 1 día o 1 clase gratis, desde la Entrada o reservando en la página. Cuenta como entrada pero no como socio. La prende solo el dueño.", recomendado: "Apagada (se prende para sumar socios nuevos)" },
  { id: "plan-familiar", titulo: "Plan familiar y corporativo", pestana: "reglas", claves: "plan familiar corporativo titular paga vinculados empresa grupo", explicacion: "Un titular paga y los demás del grupo entran con su plan; si el titular no paga, se explica a cada uno.", recomendado: "apagado hasta que lo uses" },
  { id: "beneficios", titulo: "Cortesías, descuentos y devoluciones", pestana: "reglas", claves: "cortesia cortesias descuento descuentos tope topes motivo motivos devolucion devoluciones baja regalo", explicacion: "Cuánto puede dar cada rol, los motivos permitidos para un descuento o una cortesía y qué se devuelve al dar de baja con cuota adelantada.", recomendado: "Topes bajos y motivos de la lista" },
  { id: "documentos", titulo: "Documentos para firmar", pestana: "reglas", claves: "documentos firmar reglamento deslinde menores consentimiento", explicacion: "Los textos que firman los socios viven en su propia pantalla." },
  { id: "avisar-sin-bloquear", titulo: "Primeros días: avisar sin frenar", pestana: "reglas", claves: "primeros dias avisar sin bloquear frenar aviso arranque carga socios", explicacion: "Los primeros días la entrada muestra el aviso pero deja pasar a todos; después vuelve sola a la regla normal.", recomendado: "Apagado (prendelo al arrancar con socios cargados a medias)" },
  { id: "foto-socio", titulo: "Foto del socio desde su app", pestana: "reglas", claves: "foto socio app subir selfie reconocer puerta", explicacion: "Deja que el socio suba su propia foto; la recepción la ve marcada hasta confirmarla.", recomendado: "Apagado" },
  { id: "datos-personales", titulo: "Datos personales (política de privacidad)", pestana: "reglas", claves: "datos personales privacidad politica ley 25326 borrar corregir ver datos aaip", explicacion: "La política de privacidad del gimnasio y los pedidos de los socios de ver, corregir o borrar sus datos." },
  // ── Entrada
  { id: "entrada-abrir-al-tipear", titulo: "Abrir la Entrada al tipear un número", pestana: "entrada", claves: "entrada abrir tipear numero dni teclado atajo", explicacion: "Si no estás escribiendo en un campo, tocar un número abre la Entrada.", recomendado: "Prendido" },
  { id: "entrada-barra-fija", titulo: "Barra fija a la derecha", pestana: "entrada", claves: "barra fija derecha mostrador entrada ultimas", explicacion: "En pantallas anchas: el campo DNI siempre a la vista y las últimas 5 entradas.", recomendado: "Apagado" },
  { id: "entrada-solo-verde", titulo: "Anotar solo cuando está en verde", pestana: "entrada", claves: "enter verde amarillo naranja anotar semaforo entrada", explicacion: "Enter anota solo si el socio está en verde; en los otros colores hay que tocar el botón.", recomendado: "Apagado" },
  { id: "entrada-cerrar-sola", titulo: "Cerrar sola después de anotar", pestana: "entrada", claves: "cerrar sola segundos ventana entrada despues de anotar", explicacion: "Cuántos segundos queda la ventana de Entrada antes de cerrarse.", recomendado: "4 segundos" },
  { id: "visita-horas", titulo: "Reingreso: una visita dura (horas), volver a entrar no cuenta otra", pestana: "entrada", claves: "reingreso visita horas volver a entrar doble toque otra entrada gasta clase", explicacion: "Si pasa de nuevo dentro de ese tiempo, no se cuenta otra entrada ni se gasta otra clase.", recomendado: "5 horas" },
  { id: "antiprestamo", titulo: "Avisar si vuelve a entrar por otra vía (minutos)", pestana: "entrada", claves: "prestamo antiprestamo qr tablet otra via aviso amarillo control puerta compartir", explicacion: "Detecta que prestaron el QR: aviso amarillo y queda en Control de la puerta; 0 = apagado.", recomendado: "60 minutos" },
  { id: "registrar-salida", titulo: "Registrar la salida (no / opcional / obligatoria)", pestana: "entrada", claves: "salida registrar salir me voy adentro ahora chau visita tecla s", explicacion: "Si el socio marca que se va (DNI + S, Me voy en la tablet o en la app), Adentro ahora es exacto; si no, la visita se cierra sola. Nunca cambia quién puede entrar.", recomendado: "No (se prende si querés saber quién está adentro)" },
  { id: "avisar-en-vivo", titulo: "Avisar las entradas por QR o tablet en todas las pantallas", pestana: "entrada", claves: "avisar en vivo aviso entradas qr tablet pantalla notificacion", explicacion: "Un aviso chiquito arriba a la derecha cuando alguien entra por QR o tablet.", recomendado: "Prendido" },
  { id: "entrada-esta-compu", titulo: "Pisar la Entrada solo en esta compu", pestana: "entrada", claves: "esta compu navegador pisar mostrador tablet local", explicacion: "Cambia lo del gimnasio solo en este navegador; no se restablece desde acá." },
  // ── Horarios
  { id: "horarios", titulo: "Horarios de apertura", pestana: "horarios", claves: "horarios apertura abrir cerrar dias semana franja", explicacion: "Cuándo abre tu gimnasio; sale en tu página y en la app." },
  { id: "cierres", titulo: "Días que cerrás (feriados y vacaciones)", pestana: "horarios", claves: "cierres feriados vacaciones cerrado dia especial", explicacion: "Los días que no abrís; los puede cargar también el encargado." },
  // ── Mensajes
  { id: "link-resena", titulo: "Link de reseña", pestana: "mensajes", claves: "resena google opinion encuesta link estrellas", explicacion: "A dónde mandar a los socios contentos a dejar una reseña." },
  { id: "mensajes", titulo: "Textos de los mensajes", pestana: "mensajes", claves: "mensajes textos whatsapp plantillas avisos bienvenida vencimiento cobranza", explicacion: "Lo que se le escribe al socio en cada situación; con tus palabras." },
  // ── Clases
  { id: "modo-clases", titulo: "Cómo se anota la gente a clases", pestana: "clases", claves: "clases reserva cupo sin reserva modo anotar asistencia", explicacion: "Con reserva y cupo, o sin reserva con asistencia del profe." },
  { id: "reserva-dias", titulo: "Se reserva con hasta (días)", pestana: "clases", claves: "reserva dias anticipacion antes abrir reserva", explicacion: "Cuántos días antes se abre la reserva.", recomendado: "7 días" },
  { id: "cancelacion-horas", titulo: "Cancelar hasta (horas antes)", pestana: "clases", claves: "cancelar cancelacion horas limite reserva cuenta igual", explicacion: "Después de ese límite la reserva cuenta igual.", recomendado: "2 horas" },
  { id: "falta-politica", titulo: "Si reserva y no viene", pestana: "clases", claves: "falta faltar no viene no show bloquear descontar pack reserva", explicacion: "Qué pasa cuando reserva y no cancela: nada, se descuenta del pack o no puede reservar unos días.", recomendado: "No pasa nada (7 días si lo bloqueás)" },
  { id: "turnos-fijos", titulo: "Turnos fijos", pestana: "clases", claves: "turnos fijos lugar fijo habitual clase semanal", explicacion: "Que un socio tenga su lugar fijo en una clase todas las semanas." },
  // ── Secciones
  { id: "secciones", titulo: "Secciones prendidas y apagadas", pestana: "secciones", claves: "secciones apagar prender menu entrada vencen hoy socios retencion vender caja control transferencias gastos mensajes clases", explicacion: "Apagá lo que no usás: desaparece de todos los paneles.", recomendado: "Todo prendido" },
  // ── Dirección y Cambios
  { id: "direccion", titulo: "Dirección y dominio propio", pestana: "direccion", claves: "direccion dominio propio url host link tugimnasio", explicacion: "Dónde se abren tu página, tu panel y la app de tus socios." },
  { id: "historial", titulo: "Historial de cambios", pestana: "cambios", claves: "historial cambios quien cambio auditoria registro", explicacion: "Quién cambió cada opción y cuándo." },
];

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Las opciones que responden a lo escrito: todas las palabras tienen que aparecer; el título pesa más. */
export function buscarOpciones(texto: string, visible: (o: Opcion) => boolean = () => true, limite = 8): Opcion[] {
  const palabras = sinTildes(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  return OPCIONES.filter(visible)
    .map((o) => {
      const t = sinTildes(o.titulo), resto = sinTildes(`${o.claves} ${o.explicacion} ${o.recomendado ?? ""}`);
      if (!palabras.every((p) => t.includes(p) || resto.includes(p))) return null;
      return { o, puntos: palabras.reduce((s, p) => s + (t.includes(p) ? 3 : 0) + (sinTildes(o.claves).includes(p) ? 2 : 0), 0) };
    })
    .filter((x): x is { o: Opcion; puntos: number } => x !== null)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, limite)
    .map((x) => x.o);
}
