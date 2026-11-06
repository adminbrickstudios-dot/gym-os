"use client";
// VD-4 · Pone una pantalla al día apenas entra alguien por la puerta (QR, tablet u otra compu), sin recargar
// a mano. Usa el mismo "oído" que los avisos: no agrega pedidos.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { escucharEntradas } from "./entradas-vivo";

export function RefrescarAlEntrar({ gimnasioId }: { gimnasioId: string }) {
  const router = useRouter();
  useEffect(() => escucharEntradas(gimnasioId, () => router.refresh()), [gimnasioId, router]);
  return null;
}
