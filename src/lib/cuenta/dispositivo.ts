/** VD-33b: un user agent hecho texto para una persona ("Chrome en Windows"). */
export function nombreDispositivo(ua: string | null | undefined): string {
  if (!ua) return "Dispositivo sin identificar";
  const so = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? "iPad" : "iPhone")
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac"
    : /Linux|X11/.test(ua) ? "Linux" : null;
  const nav = /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\/|CriOS/.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari" : null;
  if (nav && so) return `${nav} en ${so}`;
  return nav ?? so ?? "Dispositivo sin identificar";
}

export type SesionAbierta = { id: string; creada: string; actividad: string; user_agent: string | null; actual: boolean };
export type MiSeguridad = { tiene_contrasena: boolean; sesiones: SesionAbierta[] };
