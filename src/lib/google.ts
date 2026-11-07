// VD-22 · Entrar con Google (D23). El botón y las rutas /auth/* existen solo si el dueño de la plataforma
// prendió Google: sin la variable, nada cambia (el botón no aparece y las rutas mandan al ingreso).

/** ENTRAR_CON_GOOGLE=1 en el servidor, después de activar Google en Supabase Auth con las credenciales de Google Cloud. */
export const googleActivo = (env: Record<string, string | undefined> = process.env) => env.ENTRAR_CON_GOOGLE === "1";

/** El origen (esquema + dirección) al que Supabase tiene que devolver a la persona: el de la dirección que está usando. */
export function origenDe(cabeceras: { get(n: string): string | null }): string {
  const host = (cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "").split(",")[0].trim();
  const local = /^(localhost|127\.0\.0\.1|[\w-]+\.localhost)(:\d+)?$/.test(host);
  const proto = cabeceras.get("x-forwarded-proto")?.split(",")[0].trim() ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

/** Avisos que el ingreso muestra cuando Google no terminó bien (?google=…). */
export const AVISOS_GOOGLE: Record<string, string> = {
  cancelado: "Cancelaste el ingreso con Google. Podés probar de nuevo o entrar con tu celular o tu mail.",
  error: "No pudimos terminar el ingreso con Google. Probá de nuevo o entrá con tu celular o tu mail.",
  equipo: "Esa cuenta de Google es del equipo del gimnasio: entrá desde “Soy del equipo”.",
};
