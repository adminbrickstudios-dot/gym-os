"use client";
import { Icono } from "@/components/ui/Icono";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarContactoPlataforma } from "./acciones";

export type ContactoPlataforma = { whatsapp: string | null; mensaje_demo: string };

/** VD-62: el WhatsApp al que escriben los dueños desde "Pedí una demo" en la página de Gym OS. Sin número, el botón no aparece. */
export function ContactoPlataformaForm({ inicial }: { inicial: ContactoPlataforma }) {
  const [guardado, setGuardado] = useState(inicial);
  const [whatsapp, setWhatsapp] = useState(inicial.whatsapp ?? "");
  const [mensaje, setMensaje] = useState(inicial.mensaje_demo);
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  const sucio = whatsapp.trim() !== (guardado.whatsapp ?? "") || mensaje.trim() !== guardado.mensaje_demo;
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-contacto-plataforma>
      <p className="titulo text-2xl"><Icono nombre="mensaje" /> WhatsApp para pedidos de demo</p>
      <p className="texto-suave">Es el número del botón “Pedí una demo por WhatsApp” de la página de Base. Con el + y la característica, sin espacios (ej: +5493875551234). Vacío = el botón no se muestra.</p>
      <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
        <label className="block"><span className="text-sm">WhatsApp</span>
          <input className="campo w-full" inputMode="tel" maxLength={20} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} aria-label="WhatsApp de BRIK" /></label>
        <label className="block"><span className="text-sm">Mensaje ya escrito</span>
          <input className="campo w-full" maxLength={300} value={mensaje} onChange={(e) => setMensaje(e.target.value)} aria-label="Mensaje de la demo" /></label>
      </div>
      <button type="button" className="boton" disabled={ocupado || !sucio}
        onClick={() => empezar(async () => {
          const r = await guardarContactoPlataforma(whatsapp, mensaje);
          if (r.error || !r.contacto) { setMsj({ error: r.error ?? "No se pudo guardar" }); return; }
          setGuardado(r.contacto); setWhatsapp(r.contacto.whatsapp ?? ""); setMensaje(r.contacto.mensaje_demo);
          setMsj({ ok: "Guardado." });
        })}>Guardar</button>
      {msj.ok && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
    </section>
  );
}
