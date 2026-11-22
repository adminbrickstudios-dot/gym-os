/**
 * Vuelta final (22/11) · seguridad: las opciones de las cookies de sesión de Supabase. @supabase/ssr no les pone Secure por
 * defecto; con Supabase en https (producción) van Secure, así nunca viajan por http. SameSite=Lax corta el envío desde otros
 * sitios en pedidos que cambian algo. HttpOnly no se puede: el cliente del navegador lee la sesión (lo pide @supabase/ssr).
 * En la base local (http://127.0.0.1, e2e) quedan sin Secure para que el navegador de prueba las guarde.
 */
export function opcionesCookieSesion(supabaseUrl: string | undefined) {
  return { path: "/", sameSite: "lax" as const, secure: (supabaseUrl ?? "").startsWith("https:") };
}
