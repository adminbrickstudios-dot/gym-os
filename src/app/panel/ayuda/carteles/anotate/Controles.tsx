"use client";
// C9 · Lo que el dueño decide del "Anotate acá": si el registro está abierto, qué plan llega elegido, y cómo mandar el link.
// El interruptor es el mismo de Configuración (un solo dato); el plan sugerido es de la base.
import Link from "next/link";
import { useState, useTransition } from "react";
import { Icono } from "@/components/ui/Icono";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { linkCompartirWhatsapp, mensajeAnotate } from "@/lib/carteles";
import { guardarRegistroAbierto } from "../../../configuracion/autoservicio-acciones";
import { guardarPlanSugerido, type QrAltaPanel } from "./acciones";

export function Controles({ inicial, puedeEditar, url, nombre }: { inicial: QrAltaPanel; puedeEditar: boolean; url: string; nombre: string }) {
  const [p, setP] = useState(inicial);
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [copiado, setCopiado] = useState(false);
  const [guardando, empezar] = useTransition();

  const abrirCerrar = (abierto: boolean) => empezar(async () => {
    setMsj({});
    const r = await guardarRegistroAbierto(abierto);
    if (r.error || !r.panel) { setMsj({ error: r.error ?? "No se pudo guardar" }); return; }
    setP((x) => ({ ...x, abierto: r.panel!.abierto, tiene_reglamento: r.panel!.tiene_reglamento }));
    setMsj({ ok: r.panel.abierto ? "Registro abierto: el QR y el link llevan al formulario." : "Registro cerrado: el QR y el link dicen que hoy no se puede y dan tu WhatsApp." });
  });
  const elegirPlan = (id: string) => empezar(async () => {
    setMsj({});
    const r = await guardarPlanSugerido(id || null);
    if (r.error || !r.panel) { setMsj({ error: r.error ?? "No se pudo guardar" }); return; }
    setP(r.panel);
    setMsj({ ok: r.panel.plan_sugerido_id ? "Listo: el formulario llega con ese plan elegido." : "Listo: la persona elige el plan en el formulario." });
  });
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { setCopiado(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl" data-no-imprimir data-qr-alta-controles data-abierto={p.abierto ? "si" : "no"}>
      <Interruptor etiqueta="Registro abierto" disabled={!puedeEditar || guardando} checked={p.abierto} data-registro-abierto
        ayuda={p.tiene_reglamento
          ? "Quien escanea el QR se anota solo y queda como socio sin pagar: entra cuando paga. La recepción lo ve en Interesados. Los menores de 18 se anotan en el gimnasio."
          : <>Primero escribí el reglamento en <Link href="/panel/pagina" className="underline">Tu página</Link>: cada socio nuevo lo tiene que aceptar.</>}
        onChange={(e) => abrirCerrar(e.target.checked)} />
      {!p.abierto && (
        <p className="pildora pildora-amarillo whitespace-normal" data-qr-alta-cerrado>
          Con el registro cerrado, el QR y el link dicen que hoy no se puede anotar{p.whatsapp ? " y dan tu WhatsApp" : " (cargá tu WhatsApp en Tu página para que lo muestren)"}.
        </p>
      )}
      <label className="block space-y-1">
        <span className="titulo text-lg block">Plan que llega elegido</span>
        <select className="campo" value={p.plan_sugerido_id ?? ""} disabled={!puedeEditar || guardando} onChange={(e) => elegirPlan(e.target.value)} data-plan-sugerido>
          <option value="">Ninguno: la persona elige</option>
          {p.planes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <span className="texto-suave text-sm block">Elegir un plan no da acceso: se paga igual en recepción o por transferencia.</span>
      </label>
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj.ok && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      <div>
        <p className="titulo text-lg">Mandar el link</p>
        <p className="campo !h-auto py-3 break-all select-all" data-link-anotate>{url}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" className="boton" onClick={copiar}>{copiado ? "Copiado" : "Copiar link"}</button>
          <a className="boton boton-principal" target="_blank" rel="noopener noreferrer" data-whatsapp-anotate
            href={linkCompartirWhatsapp(mensajeAnotate(nombre, url))}><Icono nombre="mensaje" /> Mandar por WhatsApp</a>
        </div>
      </div>
    </div>
  );
}
