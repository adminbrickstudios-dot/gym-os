"use client";
// "Probá una clase": nombre, WhatsApp y qué le interesa. Lo recibe la base
// (quiero_probar, sin sesión) y aparece en Prospectos del panel.
import { useActionState, useEffect, useState } from "react";
import { clasesParaProbar, quieroProbar, reservarPrueba, type ClaseParaProbar, type EstadoProbar, type EstadoReservaPrueba } from "./acciones";

/** VD-51: si el gimnasio da prueba gratis y hay clases, se reserva una (nombre, DNI, celular); si no, queda el pedido de siempre. */
export function FormProbar() {
  const [clases, setClases] = useState<ClaseParaProbar[] | null>(null);
  useEffect(() => { let vivo = true; void clasesParaProbar().then((c) => { if (vivo) setClases(c); }).catch(() => { if (vivo) setClases([]); }); return () => { vivo = false; }; }, []);
  if (clases === null) return <div className="tarjeta p-6 esqueleto h-48" aria-hidden />;
  return clases.length > 0 ? <FormReservaPrueba clases={clases} /> : <FormPedido />;
}

function FormReservaPrueba({ clases }: { clases: ClaseParaProbar[] }) {
  const [estado, accion, enviando] = useActionState<EstadoReservaPrueba, FormData>(reservarPrueba, {});
  if (estado.ok) {
    return (
      <div className="tarjeta p-6 space-y-2" role="status" data-probar-listo data-reserva-prueba>
        <p className="titulo text-2xl">🙌 ¡Listo, {estado.nombre}!</p>
        <p className="texto-suave text-lg">{estado.clase ? `Te anotamos para ${estado.clase}. ` : ""}Llegá con tu DNI: en recepción te dejan entrar gratis a tu primera clase.</p>
      </div>
    );
  }
  return (
    <form action={accion} className="tarjeta p-6 space-y-4" data-form-probar data-form-reserva-prueba>
      <p className="titulo text-xl">🎁 Tu primera clase es gratis</p>
      <label className="block space-y-1"><span className="etiqueta">Elegí la clase</span>
        <select name="clase" required className="campo" defaultValue={estado.datos?.clase ?? ""}>
          <option value="" disabled>Elegí una…</option>
          {clases.map((c) => <option key={c.clase_id} value={c.clase_id}>{c.texto}{c.sede ? ` · ${c.sede}` : ""}</option>)}
        </select></label>
      <label className="block space-y-1"><span className="etiqueta">Tu nombre</span>
        <input name="nombre" required maxLength={80} autoComplete="name" className="campo" defaultValue={estado.datos?.nombre} /></label>
      <label className="block space-y-1"><span className="etiqueta">Tu DNI</span>
        <input name="dni" required inputMode="numeric" autoComplete="off" placeholder="Sin puntos" maxLength={12} className="campo" defaultValue={estado.datos?.dni} /></label>
      <label className="block space-y-1"><span className="etiqueta">Tu WhatsApp</span>
        <input name="telefono" required type="tel" inputMode="tel" autoComplete="tel" placeholder="387 555 1234" className="campo" defaultValue={estado.datos?.telefono} /></label>
      <input name="sitio" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {estado.error && <p role="alert" className="mensaje mensaje-error">⚠️ {estado.error}</p>}
      <button type="submit" disabled={enviando} className="boton boton-principal text-lg w-full sm:w-auto px-8">{enviando ? "Enviando…" : "🙋 Reservar mi clase gratis"}</button>
      <p className="text-sm texto-tenue">Es una prueba por persona. Usamos tu DNI y tu WhatsApp solo para esta clase.</p>
    </form>
  );
}

function FormPedido() {
  const [estado, accion, enviando] = useActionState<EstadoProbar, FormData>(quieroProbar, {});
  // REF-1: el link de un socio trae ?ref=código.
  const [ref, setRef] = useState("");
  useEffect(() => { setRef(new URLSearchParams(window.location.search).get("ref")?.slice(0, 12) ?? ""); }, []);
  if (estado.ok) {
    return (
      <div className="tarjeta p-6 space-y-2" role="status" data-probar-listo>
        <p className="titulo text-2xl">🙌 ¡Listo, {estado.nombre}!</p>
        <p className="texto-suave text-lg">Te escribimos por WhatsApp para arreglar el día y el horario.</p>
      </div>
    );
  }
  return (
    <form action={accion} className="tarjeta p-6 space-y-4" data-form-probar>
      {ref && <><input type="hidden" name="ref" value={ref} /><p className="pildora pildora-azul" data-referido>🤝 Te invitó un amigo</p></>}
      <label className="block space-y-1"><span className="etiqueta">Tu nombre</span>
        <input name="nombre" required maxLength={80} autoComplete="name" className="campo" defaultValue={estado.datos?.nombre} /></label>
      <label className="block space-y-1"><span className="etiqueta">Tu WhatsApp</span>
        <input name="telefono" required type="tel" inputMode="tel" autoComplete="tel" placeholder="387 555 1234" className="campo" defaultValue={estado.datos?.telefono} /></label>
      <label className="block space-y-1"><span className="etiqueta">¿Qué te gustaría hacer? <span className="texto-tenue font-normal">(opcional)</span></span>
        <input name="interes" maxLength={200} placeholder="Musculación, funcional, a la tarde…" className="campo" defaultValue={estado.datos?.interes} /></label>
      {/* Para robots: una persona no ve este campo y no lo llena. */}
      <input name="sitio" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {estado.error && <p role="alert" className="mensaje mensaje-error">⚠️ {estado.error}</p>}
      <button type="submit" disabled={enviando} className="boton boton-principal text-lg w-full sm:w-auto px-8">{enviando ? "Enviando…" : "🙋 Quiero probar"}</button>
      <p className="text-sm texto-tenue">Solo usamos tu WhatsApp para escribirte por la clase de prueba.</p>
    </form>
  );
}
