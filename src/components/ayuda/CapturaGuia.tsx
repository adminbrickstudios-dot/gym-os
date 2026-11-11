"use client";
// C3 · La captura de un paso, si existe. Se pide a public/guias/<archivo>.png; si el archivo todavía no está (las genera
// scripts/e2e/guias-capturas.mjs), la imagen se esconde y el paso se lee igual, sin hueco ni ícono roto.
import { useEffect, useRef, useState } from "react";

export function CapturaGuia({ archivo, alt, celu = false }: { archivo: string; alt: string; celu?: boolean }) {
  const [hay, setHay] = useState(true);
  const img = useRef<HTMLImageElement>(null);
  // El error puede llegar antes de que React enganche el evento: se mira también al montar.
  useEffect(() => { const i = img.current; if (i && i.complete && i.naturalWidth === 0) setHay(false); }, []);
  if (!hay) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} src={`/guias/${archivo}.png`} alt={alt} loading="lazy" decoding="async" onError={() => setHay(false)} data-captura={archivo}
      className={`guia-captura block mt-3 w-full rounded-[var(--radio)] border border-[var(--borde)] bg-white ${celu ? "max-w-[260px]" : "max-w-2xl"}`} />
  );
}
