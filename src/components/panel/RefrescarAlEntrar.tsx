"use client";
// VD-4 · Pone una pantalla al día apenas entra alguien por la puerta (QR, tablet u otra compu), sin recargar
// a mano. Usa el mismo "oído" que los avisos: no agrega pedidos.
// Varias entradas seguidas (o los 2 o 3 eventos de una misma) hacen un solo refresco: cada refresco aborta los pedidos
// de servidor que la pantalla tenga en vuelo en ese momento (una búsqueda, los planes del alta).
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { escucharEntradas } from "./entradas-vivo";

export function RefrescarAlEntrar({ gimnasioId }: { gimnasioId: string }) {
  const router = useRouter();
  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | null = null;
    const quitar = escucharEntradas(gimnasioId, () => {
      if (espera) clearTimeout(espera);
      espera = setTimeout(() => { espera = null; router.refresh(); }, 700);
    });
    return () => { if (espera) clearTimeout(espera); quitar(); };
  }, [gimnasioId, router]);
  return null;
}
