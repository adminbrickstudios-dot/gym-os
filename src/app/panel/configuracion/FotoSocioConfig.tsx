"use client";
import { useEffect, useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarFotoSocioPermitida, leerFotoSocioPermitida } from "./acciones";

/** FA-16 (D57): el socio sube su foto desde la app solo si se prende acá (apagado por defecto). La recepción la ve marcada hasta confirmarla. */
export function FotoSocioConfig({ puedeEditar }: { puedeEditar: boolean }) {
  const [permitida, setPermitida] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    let vivo = true;
    void leerFotoSocioPermitida().then((r) => { if (!vivo) return; if (r.permitida === undefined) setError(r.error ?? "No se pudo leer."); else setPermitida(r.permitida); });
    return () => { vivo = false; };
  }, []);
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-foto-socio={permitida === null ? "cargando" : permitida ? "si" : "no"}>
      <p className="titulo text-2xl">Foto del socio desde su app</p>
      {permitida === null && !error ? <div className="esqueleto h-12" aria-hidden /> : permitida !== null && (
        <Interruptor etiqueta="Dejar que el socio suba su foto" ayuda="La foto es para reconocerlo en la puerta. Cuando la sube el socio, la recepción la ve marcada “foto nueva, subida por el socio” hasta que la confirma o la cambia. Nunca datos de salud."
          checked={permitida} disabled={!puedeEditar || ocupado}
          onChange={(e) => {
            const si = e.target.checked; setError(null); setOk(null);
            empezar(async () => { const r = await guardarFotoSocioPermitida(si); if (r.error || r.permitida === undefined) setError(r.error ?? "No se pudo guardar."); else { setPermitida(r.permitida); setOk(si ? "Prendido: los socios pueden subir su foto." : "Apagado: solo la recepción saca las fotos."); } });
          }} />
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {ok && !error && <Mensaje tipo="exito">{ok}</Mensaje>}
    </section>
  );
}
