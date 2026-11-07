"use client";
import { PantallaError } from "@/components/ui/PantallaError";

// Un error de una pantalla del panel: se dice qué pasó, con el texto de la base, y siempre hay salida.
export default function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaError error={error} reset={reset} inicio="/panel" />;
}
