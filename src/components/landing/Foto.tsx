import Image from "next/image";

/**
 * Foto de la página pública (VD-25). Va dentro de un contenedor `relative` con tamaño reservado (nada salta al
 * cargar). En producción pasa por el optimizador de Next (tamaño y formato justos para cada celular); en la base
 * local (http) o con una dirección que no es de Supabase queda un <img> común.
 */
export function Foto({ src, alt, sizes, prioridad = false, className = "" }: { src: string; alt: string; sizes: string; prioridad?: boolean; className?: string }) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const optimizable = /^https:\/\//.test(base) && src.startsWith(`${base}/storage/v1/object/public/`) && !/localhost|127\.0\.0\.1/.test(base);
  if (optimizable) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={prioridad} quality={72} className={`object-cover ${className}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} sizes={sizes} loading={prioridad ? "eager" : "lazy"} decoding="async" {...(prioridad ? { fetchPriority: "high" as const } : {})}
    className={`absolute inset-0 w-full h-full object-cover ${className}`} />;
}
