// Los dominios configurados en Vercel, limpios: "https://Ejemplo.com/" → "ejemplo.com".
// Nunca se pasa la variable cruda a la base ni a un link.
import { normalizarHost } from "@/lib/host";

export const dominioBase = () => normalizarHost(process.env.NEXT_PUBLIC_DOMINIO_BASE);
export const dominioPlataforma = () => normalizarHost(process.env.NEXT_PUBLIC_DOMINIO_PLATAFORMA);

/** ¿Vercel da este subdominio? Los *.vercel.app no tienen comodín: cada gimnasio necesita su propia dirección. */
export const subdominiosFuncionan = (base = dominioBase()) => !!base && !base.endsWith(".vercel.app");

/**
 * D1: las direcciones viejas (por ejemplo gym-os-pied.vercel.app) que redirigen para siempre a la plataforma, con la misma ruta y los mismos
 * parámetros. LISTA EXPLÍCITA en NEXT_PUBLIC_DOMINIOS_VIEJOS (separada por comas), no un fallback: un host que no está acá ni en la tabla de
 * direcciones sigue dando "gimnasio no encontrado". Sirve para que el QR impreso con la dirección vieja siga andando al cambiar de dominio.
 */
export const dominiosViejos = () => (process.env.NEXT_PUBLIC_DOMINIOS_VIEJOS ?? "").split(",").map((h) => normalizarHost(h)).filter(Boolean);
