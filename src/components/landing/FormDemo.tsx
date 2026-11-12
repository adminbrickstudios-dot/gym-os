"use client";
// "Quiero una demo": nombre, gimnasio, cómo contestarte. Lo recibe la base (pedir_demo_brik, sin sesión)
// y le aparece a BRIK en el super admin.
import { useActionState } from "react";
import { pedirDemo, type EstadoDemo } from "./acciones-plataforma";
import { Icono } from "@/components/ui/Icono";
import { CampoAntiRobot } from "@/components/cuentas/CampoAntiRobot";

export function FormDemo() {
  const [estado, accion, enviando] = useActionState<EstadoDemo, FormData>(pedirDemo, {});
  if (estado.ok) {
    return (
      <div className="tarjeta p-6 space-y-2" role="status" data-demo-listo>
        <p className="titulo text-2xl"><Icono nombre="persona" /> ¡Listo, {estado.nombre}!</p>
        <p className="texto-suave text-lg">Recibimos tu pedido. Te escribimos para mostrarte Base con los datos de tu gimnasio.</p>
      </div>
    );
  }
  return (
    <form action={accion} className="tarjeta p-5 sm:p-6 space-y-4" data-form-demo>
      <label className="block space-y-1"><span className="etiqueta">Tu nombre</span>
        <input name="nombre" required maxLength={80} autoComplete="name" className="campo" defaultValue={estado.datos?.nombre} /></label>
      <label className="block space-y-1"><span className="etiqueta">Tu gimnasio <span className="texto-tenue font-normal">(opcional)</span></span>
        <input name="gimnasio" maxLength={100} autoComplete="organization" className="campo" defaultValue={estado.datos?.gimnasio} /></label>
      <label className="block space-y-1"><span className="etiqueta">WhatsApp o mail para contestarte</span>
        <input name="contacto" required maxLength={120} autoComplete="tel" placeholder="387 555 1234 o tu@mail.com" className="campo" defaultValue={estado.datos?.contacto} /></label>
      <label className="block space-y-1"><span className="etiqueta">¿Algo que quieras contarnos? <span className="texto-tenue font-normal">(opcional)</span></span>
        <textarea name="mensaje" rows={3} maxLength={500} className="campo" defaultValue={estado.datos?.mensaje} /></label>
      {/* Para robots: el campo trampa y el contador de segundos (una persona no pasa de 3 s). */}
      <CampoAntiRobot />
      {estado.error && <p role="alert" className="mensaje mensaje-error"><Icono nombre="alerta" /> {estado.error}</p>}
      <button type="submit" disabled={enviando} className="boton boton-principal text-lg w-full sm:w-auto px-8">{enviando ? "Enviando…" : "Quiero una demo"}</button>
      <p className="text-sm texto-tenue">Usamos estos datos solo para contestarte sobre la demo.</p>
    </form>
  );
}
