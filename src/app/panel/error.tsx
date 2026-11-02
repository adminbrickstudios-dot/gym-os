"use client";
import { Aviso } from "@/components/panel/Marco";

// Un error de una pantalla del panel: se dice qué pasó, con el texto de la base.
export default function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const sinPermiso = /permiso|acceso/i.test(error.message);
  return (
    <Aviso emoji={sinPermiso ? "🔒" : "⚠️"} titulo={sinPermiso ? "No tenés acceso a esta pantalla" : "No se pudo cargar esta pantalla"}>
      <p>{error.message}</p>
      {!sinPermiso && <button type="button" onClick={reset} className="boton mt-6">🔄 Probar de nuevo</button>}
    </Aviso>
  );
}
