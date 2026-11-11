"use client";
import { PantallaError } from "@/components/ui/PantallaError";

/** Regla 15: un error en "Quiero ser socio" tiene su propia pantalla, con Reintentar e Ir al inicio (la página del gimnasio). */
export default function ErrorAlta({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PantallaError error={error} reset={reset} inicio="/" />;
}
