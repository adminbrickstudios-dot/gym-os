"use client";
import { PantallaError } from "@/components/ui/PantallaError";

// Un error de Máquinas: se dice qué pasó, con el texto de la base, y siempre hay salida.
export default function ErrorMaquinas({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaError error={error} reset={reset} inicio="/panel" />;
}
