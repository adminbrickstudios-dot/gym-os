import Image from "next/image";

/**
 * F0.5 · Logo de un gimnasio (o cualquier imagen chica de ancho libre). En producción pasa por el optimizador de Next (bucket público de
 * Supabase del despliegue): tamaño y formato justos para el celular. En la base local (http) o con otra dirección queda un <img> común.
 * El alto lo da `className` (por ejemplo `h-10 w-auto`); `ancho` y `alto` solo reservan el lugar y le dicen al optimizador qué tamaño pedir.
 */
export function LogoImagen({ src, alt = "", className = "", ancho = 160, alto = 80, prioridad = false }: {
  src: string; alt?: string; className?: string; ancho?: number; alto?: number; prioridad?: boolean;
}) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const optimizable = /^https:\/\//.test(base) && src.startsWith(`${base}/storage/v1/object/public/`) && !/localhost|127\.0\.0\.1/.test(base);
  if (optimizable) {
    return <Image src={src} alt={alt} width={ancho} height={alto} quality={80} priority={prioridad} className={className} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={ancho} height={alto} decoding="async" {...(prioridad ? { fetchPriority: "high" as const } : {})} className={className} />;
}
