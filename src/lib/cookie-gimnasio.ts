// El gimnasio elegido al usar Gym OS desde la dirección de la plataforma
// (sin subdominio). Solo dice qué gimnasio mostrar: NO da permisos; cada
// pantalla los valida en la base.
export const COOKIE_GIMNASIO = "gymos_gimnasio";
export const OPCIONES_COOKIE_GIMNASIO = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
};
