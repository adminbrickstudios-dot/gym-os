// F4/F5 · La lista de funciones nuevas con interruptor (sin nada del servidor: la usan la pantalla de Configuración y las pruebas).
// Las claves son las mismas que acepta `guardar_funcion_nueva` en la base (lo comprueba funciones-nuevas.test.ts).

export const FUNCIONES_NUEVAS = [
  { clave: "borrador_alta", titulo: "Borrador del alta de socio", ayuda: "Si se corta el alta a la mitad, al volver pregunta “¿Seguimos donde dejaste?”. Se guarda solo en esa computadora, por 7 días." },
  { clave: "panel_pago", titulo: "Más datos en el panel del socio", ayuda: "En la ficha rápida que abre la Entrada: cuándo le toca pagar y cuánto, desde cuándo debe, qué plan pagaría, y sus notas y etiquetas." },
  { clave: "horarios_pico", titulo: "Horarios pico por día de la semana", ayuda: "En Resultado: un cuadro con las entradas de las últimas 8 semanas por día y hora." },
] as const;

export type ClaveFuncionNueva = (typeof FUNCIONES_NUEVAS)[number]["clave"];
