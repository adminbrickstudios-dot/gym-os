"use client";
import { PantallaError } from "@/components/ui/PantallaError";

// Un error de Personal trainer: se dice qué pasó, con el texto de la base, y siempre hay salida.
export default function ErrorPt({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaError error={error} reset={reset} inicio="/panel" />;
}
