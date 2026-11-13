"use client";
import { useRouter } from "next/navigation";
import type { ResultadoSocio } from "@/app/panel/acciones";
import { CLAVE_FICHA, CLAVE_VOLVER } from "./comun";

/** VD-1b · El "Volver" de la ficha abierta desde la Entrada: regresa a donde estabas y la ventana se reabre con el mismo socio. */
export function VolverAEntrada({ socioId, nombre }: { socioId: string; nombre: string }) {
  const router = useRouter();
  return (
    <button type="button" className="boton boton-principal" data-volver-entrada
      onClick={() => {
        let socio: ResultadoSocio = { socio_id: socioId, numero: null, nombre, color: "gris", texto: "", puede: false, dado_de_baja: false };
        try {
          const guardado = JSON.parse(sessionStorage.getItem(CLAVE_FICHA) ?? "null");
          if (guardado?.socio?.socio_id === socioId) socio = guardado.socio;
          sessionStorage.setItem(CLAVE_VOLVER, JSON.stringify({ socio, ts: Date.now() }));
        } catch { /* sin almacenamiento: vuelve igual, sin reabrir */ }
        if (window.history.length > 1) router.back(); else router.push("/panel");
      }}>
      ← Volver a la Entrada con {nombre.split(" ")[0]}
    </button>
  );
}
