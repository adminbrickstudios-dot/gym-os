"use client";
import { useRouter } from "next/navigation";

/** El "Volver" de una página que no existe (404): vuelve a donde estaba la persona. Si no hay a dónde (abrió la dirección directo), lleva a la raíz. */
export function VolverAtras({ className = "boton" }: { className?: string }) {
  const router = useRouter();
  return (
    <button type="button" className={className} onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }}>
      ← Volver
    </button>
  );
}
