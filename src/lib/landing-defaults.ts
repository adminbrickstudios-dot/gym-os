// VD-62 · Textos por defecto de la página del gimnasio. Si el dueño no cargó el texto de una sección, la página
// no muestra un hueco: pone un texto sensato según el tipo de gimnasio. El tipo se deduce de lo que el gimnasio
// ya cargó (actividades y planes), no se hardcodea nada de un gimnasio en particular. Los textos no afirman
// cifras, precios ni servicios concretos: son lo que sirve para cualquier gimnasio de ese tipo. Lo que el dueño
// escribe siempre manda.
import type { LandingPublicada, Seccion } from "@/lib/landing";

export type TipoGimnasio = "funcional" | "mente_cuerpo" | "lucha" | "general";

const PISTAS: [TipoGimnasio, RegExp][] = [
  ["lucha", /box|muay|kick|jiu|mma|judo|karate|lucha/i],
  ["funcional", /crossfit|funcional|hiit|functional|cross|wod/i],
  ["mente_cuerpo", /yoga|pilates|stretch|barre|movilidad|meditaci/i],
];

/** Deduce el tipo de gimnasio por los nombres de sus actividades y planes. Sin pistas: general. */
export function tipoDeGimnasio(landing: Pick<LandingPublicada, "secciones" | "planes">): TipoGimnasio {
  const nombres: string[] = [];
  for (const s of landing.secciones) if (s.tipo === "actividades") for (const a of s.contenido.items ?? []) nombres.push(a.nombre);
  for (const p of landing.planes) nombres.push(p.nombre);
  const texto = nombres.join(" ");
  for (const [tipo, re] of PISTAS) if (re.test(texto)) return tipo;
  return "general";
}

const SOBRE: Record<TipoGimnasio, (n: string) => string> = {
  general: (n) => `${n}: abajo están los planes, los horarios y cómo llegar. Si es tu primera vez, pasá por el gimnasio y te explicamos cómo arrancar.`,
  funcional: (n) => `${n} da clases en grupo. Abajo están los horarios y los planes. Si es tu primera vez, avisá y te explican cómo arrancar.`,
  mente_cuerpo: (n) => `${n} da clases para moverte mejor. Abajo están los horarios y los planes. Si es tu primera vez, avisá y te explican cómo arrancar.`,
  lucha: (n) => `${n} da clases de técnica y entrenamiento. Abajo están los horarios y los planes. Podés empezar de cero: avisá que es tu primera vez.`,
};

const BAJADA: Record<TipoGimnasio, string> = {
  general: "Planes, horarios y cómo llegar.",
  funcional: "Clases en grupo. Mirá los horarios y los planes.",
  mente_cuerpo: "Clases para moverte mejor. Mirá los horarios y los planes.",
  lucha: "Clases de técnica y entrenamiento. Mirá los horarios y los planes.",
};

const PROBAR_TEXTO = "Dejanos tu nombre y tu WhatsApp, o elegí una clase, y coordinamos tu clase de prueba.";

type Pregunta = { pregunta: string; respuesta: string };

function preguntasPorDefecto(tipo: TipoGimnasio, hayProbar: boolean, hayPlanes: boolean, hayAltas = false): Pregunta[] {
  const q: Pregunta[] = [
    { pregunta: "¿Necesito experiencia previa?", respuesta: tipo === "lucha" || tipo === "funcional"
      ? "No. Podés empezar desde cero: avisá que es tu primera vez y el profe te indica cómo hacer cada ejercicio."
      : "No. Podés empezar desde cero: avisá que es tu primera vez y te explican cómo arrancar." },
    { pregunta: "¿Qué tengo que llevar?", respuesta: tipo === "mente_cuerpo"
      ? "Ropa cómoda, una botella de agua y ganas de moverte. Si necesitás algo más para una clase, te avisamos."
      : "Ropa cómoda, zapatillas, una toalla y agua. Si necesitás algo más para una clase, te avisamos." },
  ];
  if (hayProbar) q.push({ pregunta: "¿Puedo probar antes de anotarme?", respuesta: "Sí. Dejanos tus datos en “Probá gratis” y coordinamos tu primera clase." });
  if (hayPlanes) q.push({ pregunta: "¿Cómo me anoto y cómo pago?", respuesta: hayAltas
      ? "Tocá “Quiero ser socio”, elegí tu plan y creá tu cuenta. Después pagás en el gimnasio o por los medios que te muestre la app, y desde ese momento entrás con tu DNI."
      : "Elegí tu plan más abajo y escribinos por WhatsApp o pasá por el gimnasio: te decimos los medios de pago y empezás ese mismo día." });
  q.push({ pregunta: "¿En qué días y horarios puedo ir?", respuesta: "Depende de tu plan: algunos son libres y otros tienen días u horarios. Abajo están los planes y los horarios del gimnasio y de cada clase." });
  return q;
}

/** La misma landing, pero sin secciones vacías: lo que el dueño no cargó se completa con un texto sensato. */
export function conTextosPorDefecto(landing: LandingPublicada): LandingPublicada {
  const tipo = tipoDeGimnasio(landing);
  const nombre = landing.marca.nombre;
  const hayProbar = landing.secciones.some((s) => s.tipo === "probar");
  const hayPlanes = landing.planes.length > 0;
  const secciones = landing.secciones.map((s): Seccion => {
    if (s.tipo === "sobre_nosotros" && !s.contenido.texto?.trim()) return { ...s, contenido: { texto: SOBRE[tipo](nombre) } };
    if (s.tipo === "preguntas" && !(s.contenido.items ?? []).length) return { ...s, contenido: { items: preguntasPorDefecto(tipo, hayProbar, hayPlanes, !!landing.altas_online) } };
    if (s.tipo === "probar" && !s.contenido.texto?.trim()) return { ...s, contenido: { texto: PROBAR_TEXTO } };
    return s;
  });
  const bajada = landing.portada.bajada?.trim() ? landing.portada.bajada : BAJADA[tipo];
  return { ...landing, secciones, portada: { ...landing.portada, bajada } };
}
