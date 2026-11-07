"use client";
import Link from "next/link";
import { Mensaje } from "@/components/ui/Mensaje";

/** VD-61 · Si algo falla al abrir el ingreso (o se cortó internet en medio de un pedido), nunca queda una pantalla en blanco: dice qué pasó y deja reintentar. */
export default function ErrorIngreso({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-dvh flex items-center px-4 py-10" data-pantalla-error data-ingreso-error>
      <div className="mx-auto w-full max-w-sm space-y-4">
        <h1 className="titular text-3xl">No pudimos abrir el ingreso</h1>
        <Mensaje tipo="error">Puede ser que se haya cortado tu internet. Revisalo y probá de nuevo.</Mensaje>
        <button type="button" onClick={reset} className="boton boton-principal text-lg w-full">🔄 Probar de nuevo</button>
        <p className="text-center"><Link href="/" className="underline underline-offset-4 texto-suave inline-flex items-center min-h-11">Ir al inicio</Link></p>
      </div>
    </main>
  );
}
