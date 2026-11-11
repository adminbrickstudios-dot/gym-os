"use client";
import { useState, useTransition } from "react";
import { apagarAyudas, reiniciarAyudas } from "@/app/ayuda-acciones";
import { EVENTO_AYUDAS } from "@/components/ui/AyudaPantalla";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { Icono } from "@/components/ui/Icono";

const avisar = (detalle: { apagadas?: boolean; reiniciar?: boolean }) => window.dispatchEvent(new CustomEvent(EVENTO_AYUDAS, { detail: detalle }));

/** VD-31: las ayudas por pantalla, apagadas o prendidas para esta persona (se guarda en la base, vale en todos sus dispositivos). */
export function AjustesAyuda({ apagadas: inicial }: { apagadas: boolean }) {
  const [apagadas, setApagadas] = useState(inicial);
  const [msj, setMsj] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <section className="tarjeta p-5 sm:p-6 max-w-xl mt-6" aria-labelledby="ayudas" data-ajustes-ayuda>
      <h2 id="ayudas" className="titulo text-2xl mb-1"><Icono nombre="info" /> Ayuda en cada pantalla</h2>
      <p className="texto-suave mb-3">La primera vez que abrís una pantalla, un globo corto cuenta para qué sirve. El “?” siempre está por si querés verlo de nuevo.</p>
      <Interruptor etiqueta="Mostrarme las ayudas" ayuda="Si lo apagás, no sale ningún globo solo. Vale en todos tus dispositivos."
        checked={!apagadas} disabled={ocupado}
        onChange={(e) => {
          const apagar = !e.target.checked;
          setMsj(null);
          empezar(async () => {
            const r = await apagarAyudas(apagar);
            if (r.error) { setMsj({ tipo: "error", texto: r.error }); return; }
            setApagadas(apagar); avisar({ apagadas: apagar });
            setMsj({ tipo: "exito", texto: apagar ? "Listo: no te muestro más ayudas solas." : "Listo: vuelven a salir las ayudas." });
          });
        }} />
      <button type="button" className="boton mt-3" disabled={ocupado} data-ayuda-reiniciar
        onClick={() => {
          setMsj(null);
          empezar(async () => {
            const r = await reiniciarAyudas();
            if (r.error) { setMsj({ tipo: "error", texto: r.error }); return; }
            avisar({ reiniciar: true });
            setMsj({ tipo: "exito", texto: "Listo: vas a ver de nuevo la ayuda de cada pantalla." });
          });
        }}><Icono nombre="repetir" /> Volver a ver todas las ayudas</button>
      {msj && <Mensaje tipo={msj.tipo} className="mt-3">{msj.texto}</Mensaje>}
    </section>
  );
}
