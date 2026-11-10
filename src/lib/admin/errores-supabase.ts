// U1: los errores de la clave de servicio y de la API de administración de Supabase, en palabras y con qué hacer.
// Nunca se le muestra a nadie "Invalid API key" pelado: no dice qué pasó ni quién lo arregla.

const DONDE = "En Vercel → Settings → Environment Variables";

// El orden importa: la primera que coincide gana (la de "falta" va primero porque el nombre de la variable contiene "service_role").
const REGLAS: { cuando: RegExp; texto: string; clave: boolean }[] = [
  {
    cuando: /falta (la variable (de entorno )?)?supabase_service_role_key|supabase_service_role_key.*(falta|missing)/i,
    texto: `Falta la clave de servicio en Vercel. ${DONDE}, cargá SUPABASE_SERVICE_ROLE_KEY (la "service_role" del proyecto) en Production y redeployá.`,
    clave: true,
  },
  {
    cuando: /invalid api key|invalid apikey|no api key|apikey.*(invalid|missing)/i,
    texto: `La clave de servicio de Supabase no es válida. ${DONDE}, cargá SUPABASE_SERVICE_ROLE_KEY con la clave "service_role" (o "secret") del MISMO proyecto que usa NEXT_PUBLIC_SUPABASE_URL, y redeployá. Mientras tanto no se pueden crear cuentas.`,
    clave: true,
  },
  {
    cuando: /invalid jwt|jwt (expired|malformed)|invalid token|signature|bad_jwt/i,
    texto: `La clave de servicio no corresponde a este proyecto de Supabase (o está vencida). ${DONDE}, copiá otra vez la service_role del proyecto correcto en SUPABASE_SERVICE_ROLE_KEY y redeployá.`,
    clave: true,
  },
  {
    cuando: /user not allowed|not_admin|not allowed|forbidden/i,
    texto: `La clave que está cargada como SUPABASE_SERVICE_ROLE_KEY no tiene permiso de administrador: seguramente es la clave "anon" o la publicable. ${DONDE}, poné la "service_role" (o "secret") y redeployá.`,
    clave: true,
  },
  {
    cuando: /fetch failed|enotfound|econnrefused|etimedout|network|getaddrinfo|socket/i,
    texto: `No se pudo conectar con Supabase. Revisá que NEXT_PUBLIC_SUPABASE_URL sea la dirección correcta del proyecto (${DONDE}) y que el proyecto no esté pausado.`,
    clave: false,
  },
];

/** Traduce un error de la clave de servicio o de la API de administración; lo que no reconoce lo deja como vino. */
export function traducirErrorSupabase(mensaje: string | undefined | null): string {
  const m = String(mensaje ?? "").trim();
  if (!m) return "Supabase no devolvió ningún detalle.";
  for (const r of REGLAS) if (r.cuando.test(m)) return r.texto;
  return m;
}

/** ¿El error es de la clave de servicio (y no de los datos de la cuenta)? */
export function esErrorDeClave(mensaje: string | undefined | null): boolean {
  const m = String(mensaje ?? "");
  return REGLAS.some((r) => r.clave && r.cuando.test(m));
}
