// Las pestañas de Configuración. Archivo aparte (no "use client") para que la
// página del servidor pueda validar ?pestana= sin importar el componente.
export const PESTANAS = [
  { clave: "gimnasio", texto: "Gimnasio", emoji: "🏠" },
  { clave: "marca", texto: "Marca", emoji: "🎨" },
  { clave: "pagina", texto: "Página", emoji: "🌐" },
  { clave: "cobros", texto: "Cobros", emoji: "💵" },
  { clave: "reglas", texto: "Reglas", emoji: "📏" },
  { clave: "entrada", texto: "Entrada", emoji: "🚪" },
  { clave: "horarios", texto: "Horarios", emoji: "⏰" },
  { clave: "mensajes", texto: "Mensajes", emoji: "💬" },
  { clave: "clases", texto: "Clases", emoji: "🗓️" },
  { clave: "secciones", texto: "Secciones", emoji: "🧩" },
  { clave: "direccion", texto: "Dirección", emoji: "🔗" },
  { clave: "cambios", texto: "Cambios", emoji: "🕓" },
] as const;
export type ClavePestana = (typeof PESTANAS)[number]["clave"];
