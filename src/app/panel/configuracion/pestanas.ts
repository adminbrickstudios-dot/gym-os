// Las pestañas de Configuración. Archivo aparte (no "use client") para que la
// página del servidor pueda validar ?pestana= sin importar el componente.
export const PESTANAS = [
  { clave: "gimnasio", texto: "Gimnasio", emoji: "inicio" },
  { clave: "marca", texto: "Marca", emoji: "imagen" },
  { clave: "pagina", texto: "Página", emoji: "web" },
  { clave: "cobros", texto: "Cobros", emoji: "plata" },
  { clave: "reglas", texto: "Reglas", emoji: "grafico" },
  { clave: "entrada", texto: "Entrada", emoji: "puerta" },
  { clave: "horarios", texto: "Horarios", emoji: "reloj" },
  { clave: "mensajes", texto: "Mensajes", emoji: "mensaje" },
  { clave: "clases", texto: "Clases", emoji: "calendario" },
  { clave: "secciones", texto: "Secciones", emoji: "grilla" },
  { clave: "direccion", texto: "Dirección", emoji: "enlace" },
  { clave: "cambios", texto: "Cambios", emoji: "reloj" },
] as const;
export type ClavePestana = (typeof PESTANAS)[number]["clave"];
