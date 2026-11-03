// Los dominios configurados en Vercel, limpios: "https://Ejemplo.com/" → "ejemplo.com".
// Nunca se pasa la variable cruda a la base ni a un link.
import { normalizarHost } from "@/lib/host";

export const dominioBase = () => normalizarHost(process.env.NEXT_PUBLIC_DOMINIO_BASE);
export const dominioPlataforma = () => normalizarHost(process.env.NEXT_PUBLIC_DOMINIO_PLATAFORMA);

/** ¿Vercel da este subdominio? Los *.vercel.app no tienen comodín: cada gimnasio necesita su propia dirección. */
export const subdominiosFuncionan = (base = dominioBase()) => !!base && !base.endsWith(".vercel.app");
