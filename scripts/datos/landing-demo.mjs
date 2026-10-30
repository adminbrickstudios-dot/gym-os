// Contenido de landing para los gimnasios demo. Datos ficticios:
// teléfonos +549000…, mails @ejemplo.invalid, sin cuentas de Instagram.

export const LANDING_DEMO = {
  portada: {
    titulo: "Entrená cerca de casa, a tu ritmo",
    bajada: "Musculación, funcional y spinning. Profes que te conocen por tu nombre y un lugar donde dan ganas de volver.",
    boton_texto: "Quiero empezar",
    whatsapp: "+5490000111222",
    email_contacto: "hola@ejemplo.invalid",
  },
  sede: { direccion: "Calle Ficticia 123, Ciudad Demo", mapa_url: "https://www.google.com/maps/search/?api=1&query=Ciudad+Demo" },
  secciones: {
    sobre_nosotros: { texto: "Somos un gimnasio de barrio con equipamiento completo y clases todos los días. Te armamos una rutina a medida en tu primera semana y te acompañamos para que no abandones." },
    actividades: { items: [
      { emoji: "🏋️", nombre: "Musculación", descripcion: "Sala completa con rutina personalizada." },
      { emoji: "🔥", nombre: "Funcional", descripcion: "Grupos chicos, de lunes a sábado." },
      { emoji: "🚴", nombre: "Spinning", descripcion: "Clases con música, todos los niveles." },
      { emoji: "🧘", nombre: "Estiramiento", descripcion: "Para cerrar la semana sin dolores." },
    ] },
    horarios: { filas: [
      { dias: "Lunes a viernes", horas: "7:00 a 23:00" },
      { dias: "Sábados", horas: "9:00 a 18:00" },
      { dias: "Domingos y feriados", horas: "Cerrado" },
    ] },
    equipo: { personas: [
      { nombre: "Profe Demo Uno", rol: "Musculación" },
      { nombre: "Profe Demo Dos", rol: "Funcional y spinning" },
    ] },
    preguntas: { items: [
      { pregunta: "¿Puedo probar antes de pagar?", respuesta: "Sí, la primera clase es gratis. Escribinos y te reservamos un horario." },
      { pregunta: "¿Necesito apto físico?", respuesta: "Te lo pedimos al empezar. Si no lo tenés, te decimos dónde hacerlo." },
      { pregunta: "¿Cómo pago?", respuesta: "Efectivo, transferencia o MercadoPago. En efectivo tenés precio especial." },
      { pregunta: "¿Puedo congelar si me voy de viaje?", respuesta: "Sí, avisanos y te guardamos los días." },
    ] },
  },
};

// Siembra la landing de un gimnasio ya creado.
export async function sembrarLanding(db, gimnasioId, datos = LANDING_DEMO) {
  const p = datos.portada;
  await db.query(
    `update public.landing_gimnasio set publicada = true, titulo = $2, bajada = $3, boton_texto = $4, whatsapp = $5, email_contacto = $6
      where gimnasio_id = $1`,
    [gimnasioId, p.titulo, p.bajada, p.boton_texto, p.whatsapp, p.email_contacto]);
  await db.query(`update public.sedes set direccion = $2, mapa_url = $3 where gimnasio_id = $1 and es_principal`,
    [gimnasioId, datos.sede.direccion, datos.sede.mapa_url]);
  for (const [tipo, contenido] of Object.entries(datos.secciones)) {
    const r = await db.query(`update public.landing_secciones set contenido = $3 where gimnasio_id = $1 and tipo = $2`,
      [gimnasioId, tipo, JSON.stringify(contenido)]);
    if (r.rowCount !== 1) throw new Error(`No se pudo cargar la sección ${tipo}`);
  }
}
