"use client";
// "hace 5 s" que se actualiza solo (cada 5 s el primer minuto, después cada 30 s). El servidor dibuja el primero.
import { useEffect, useState } from "react";
import { haceRato } from "@/lib/formato";

export function Hace({ desde }: { desde: string }) {
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    const tic = () => setAhora(new Date());
    tic();
    const cada = Date.now() - new Date(desde).getTime() < 60_000 ? 5_000 : 30_000;
    const id = setInterval(tic, cada);
    return () => clearInterval(id);
  }, [desde]);
  return <time dateTime={desde} suppressHydrationWarning data-hace>{haceRato(desde, ahora ?? new Date())}</time>;
}
