/**
 * VD-46H: detector de datos de salud en los campos libres (notas, mensajes, motivos de pausa, tareas).
 * Regla del proyecto: no se guardan datos de salud. Es un aviso para reescribir, no un filtro perfecto:
 * detecta lo evidente ("operado de rodilla", "tiene diabetes") y deja pasar lo cotidiano ("operación de caja").
 */

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Prefijos de palabra (se buscan al comienzo de una palabra). "operado/a" va en las frases para no tomar "operación".
const PALABRAS = [
  "diabet", "hipertens", "hipotens", "asmatic", "asma", "epilep", "convulsion", "cancer", "tumor", "quimioterapia",
  "cardiac", "cardiopat", "infarto", "arritmia", "marcapaso", "soplo", "trombosis", "anemia", "colesterol", "tiroid",
  "hernia", "fractur", "esguince", "desgarr", "tendinitis", "tendinopat", "artrosis", "artritis", "escoliosis",
  "lesion", "lumbalgia", "ciatica", "fibromialgia", "osteoporosis", "luxacion", "protesis",
  "embaraz", "postparto", "depresion", "ansiedad", "bipolar", "esquizofren", "anorexia", "bulimia",
  "enfermedad", "enfermo", "diagnostic", "patologia", "alergi", "medicacion", "medicamento", "tratamiento medico",
  "cirugia", "postoperatori", "covid", "hiv", "vih", "hepatitis",
];
const FRASES = [
  /\boperad[oa]s? (de|del|en|la|el|por)\b/,
  /\b(me|le) (operaron|operaran)\b/,
  /\bpresion (alta|baja)\b/, /\b(me|le|nos) (duele|duelen|dolio)\b/,
  /\bdolor (de|en|cronico|lumbar|cervical)\b/,
  /\bproblemas? (de|del|en|con) (el |la |los |las )?(rodilla|espalda|columna|corazon|cadera|hombro|tobillo|cervical|lumbar|pulmon|rinon|higado|presion|azucar)\b/,
  /\b(rotura|ruptura) (de|del) (ligamento|menisco|tendon|fibras?|cruzado)\b/,
];
const REGEX_PALABRAS = new RegExp(`(^|[^a-z])(${PALABRAS.join("|")})`);

/** La palabra o frase que parece un dato de salud, o null si el texto está limpio. */
export function detectarSalud(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const t = sinTildes(texto);
  const p = REGEX_PALABRAS.exec(t);
  if (p) return p[2];
  for (const f of FRASES) { const m = f.exec(t); if (m) return m[0]; }
  return null;
}

/** Lo que se le dice a quien escribió algo que parece un dato de salud. */
export const AVISO_REESCRIBIR = "Esto parece un dato de salud y acá no se guardan (lesiones, enfermedades, operaciones, medicación). Reescribilo sin eso: por ejemplo “conviene que lo vea el profe antes de entrenar”.";

/** Para las acciones del servidor: devuelve el error a mostrar, o null si todos los textos están limpios. */
export function errorSiHaySalud(...textos: (string | null | undefined)[]): string | null {
  return textos.some((t) => detectarSalud(t)) ? AVISO_REESCRIBIR : null;
}
