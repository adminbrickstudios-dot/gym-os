"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Vuelve a pedir la pantalla en el lugar (VD-47): cuando la base tardó más de lo debido. */
export function Reintentar() {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  return (
    <button type="button" className="boton boton-principal mt-6" disabled={pendiente} onClick={() => empezar(() => router.refresh())}>
      {pendiente ? "Reintentando…" : "🔄 Reintentar"}
    </button>
  );
}
