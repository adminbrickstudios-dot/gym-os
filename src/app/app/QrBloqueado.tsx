"use client";
// L3 (Mateo, 14/11) · Mi QR bloqueado hasta que pague. Se ve el lugar del QR difuminado, con un candado y "Tu QR se activa cuando pagues".
// Nunca se muestra un QR que la puerta va a rechazar. Apenas la recepción cobra (o llega el pago online) el QR se activa solo, sin recargar:
// mientras está bloqueado y la pantalla a la vista se pregunta cada 8 s si ya puede entrar (la pregunta es la misma de siempre: `mi_socio`,
// que sale de `calcular_acceso`; acá no se decide nada) y al volver a la app se pregunta en el momento. Cuando puede, se recarga el Inicio.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { puedoEntrar } from "./acciones";
import { Icono } from "@/components/ui/Icono";

const CADA_MS = 8000;

export function QrBloqueado({ socioId, titulo, detalle }: { socioId: string; titulo: string; detalle: string }) {
  const router = useRouter();
  useEffect(() => {
    let vivo = true, enVuelo = false;
    const preguntar = async () => {
      if (!vivo || enVuelo || document.visibilityState !== "visible") return;
      enVuelo = true;
      try { if (await puedoEntrar(socioId)) { if (vivo) router.refresh(); } } finally { enVuelo = false; }
    };
    const t = setInterval(preguntar, CADA_MS);
    const alVolver = () => { if (document.visibilityState === "visible") void preguntar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", alVolver); };
  }, [socioId, router]);

  return (
    <section className="tarjeta p-6 text-center" data-qr-bloqueado aria-label="Mi QR bloqueado">
      <div className="relative mx-auto size-48 rounded-[var(--radio)] overflow-hidden bg-[var(--tarjeta)] border border-[var(--borde)]">
        {/* Un dibujo de QR que no es un código: solo da la forma, difuminada. */}
        <div aria-hidden className="absolute inset-0 grid grid-cols-8 gap-1 p-4 blur-[6px] opacity-60">
          {Array.from({ length: 64 }).map((_, i) => <span key={i} className={((i * 7 + (i % 5)) % 3 === 0) ? "bg-[var(--texto)] rounded-[2px]" : ""} />)}
        </div>
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid place-items-center size-16 rounded-full bg-[var(--fondo)] border border-[var(--borde)] text-3xl"><Icono nombre="candado" /></span>
        </div>
      </div>
      <p className="titulo text-2xl mt-4" data-qr-bloqueado-titulo>{titulo}</p>
      <p className="texto-suave mt-1">{detalle}</p>
    </section>
  );
}
