"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { useConfirmar } from "@/components/ui/useConfirmar";
import { darDeBajaGimnasio, guardarCiudad, pausarGimnasio, reanudarGimnasio, restaurarBaja, restaurarTextoGimnasio } from "../acciones";

const Alerta = ({ m }: { m: string }) => (m ? <p role="alert" className="pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3">{m}</p> : null);

/** QR para imprimir: el de la página del gimnasio. */
export function QrGimnasio({ url, nombre }: { url: string; nombre: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => { void import("qrcode").then(({ default: QRCode }) => QRCode.toString(url, { type: "svg", margin: 1 })).then(setSvg); }, [url]);
  if (!svg) return null;
  return (
    <div className="tarjeta p-4 space-y-2 print:border-0" data-qr-gimnasio>
      <p className="font-semibold">QR de la página de {nombre}</p>
      <div className="w-44 bg-white p-2 rounded-[var(--radio)]" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="texto-suave text-sm break-all">{url}</p>
      <button type="button" className="boton print:hidden" onClick={() => window.print()}>Imprimir</button>
    </div>
  );
}

const TEXTOS_WEB: [string, string][] = [["landing.boton_texto", "Botón principal"], ["landing.mensaje_whatsapp", "Mensaje de WhatsApp"], ["landing.bajada", "Bajada de la portada"]];

/** EDIT-S07: vuelve un texto de la web de este gimnasio a lo que dice su plantilla (se pierde lo que había escrito el dueño). */
export function RestaurarTextos({ gimnasioId }: { gimnasioId: string }) {
  const [msj, setMsj] = useState<{ ok?: boolean; t?: string }>({});
  const [confirmar, dialogo] = useConfirmar();
  return (
    <div className="space-y-2" data-restaurar-textos>
      {dialogo}
      <div className="flex flex-wrap gap-2">
        {TEXTOS_WEB.map(([clave, t]) => (
          <BotonAccion key={clave} className="boton boton-chico" data-restaurar-texto={clave} onClick={async () => {
            if (!(await confirmar(`Esto pisa lo que escribió el dueño en “${t}”. Se vuelve al texto de la plantilla.`, { boton: "Restaurar por defecto", peligro: true }))) return;
            const r = await restaurarTextoGimnasio(gimnasioId, clave);
            setMsj(r.error ? { t: r.error } : { ok: true, t: `${t}: “${r.valor}”` });
          }}>Restaurar “{t}”</BotonAccion>
        ))}
      </div>
      {msj.t && <p role={msj.ok ? "status" : "alert"} className={msj.ok ? "texto-suave text-sm" : "pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3"}>{msj.t}</p>}
    </div>
  );
}

export function Ciudad({ gimnasioId, ciudad }: { gimnasioId: string; ciudad: string | null }) {
  const router = useRouter();
  const [v, setV] = useState(ciudad ?? "");
  const [error, setError] = useState("");
  return (
    <div className="flex flex-wrap gap-2 items-end" data-ciudad>
      <label className="space-y-1 flex-1 min-w-[12rem]"><span className="etiqueta">Ciudad</span><input className="campo" value={v} maxLength={80} onChange={(e) => setV(e.target.value)} /></label>
      <BotonAccion className="boton" disabled={v.trim() === (ciudad ?? "")} onClick={async () => { const r = await guardarCiudad(gimnasioId, v); if (r.error) { setError(r.error); return; } setError(""); router.refresh(); }}>Guardar</BotonAccion>
      <Alerta m={error} />
    </div>
  );
}

/** Pausar, dar de baja (con la exportación primero), restaurar. */
export function CicloDeVida({ gimnasioId, nombre, pausado, paraBorrar }: { gimnasioId: string; nombre: string; pausado: boolean; paraBorrar: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [exportado, setExportado] = useState(false);
  const [confirmar, dialogo] = useConfirmar();
  const hecho = async (f: () => Promise<{ error?: string }>) => { const r = await f(); if (r.error) { setError(r.error); return; } setError(""); setMotivo(""); router.refresh(); };
  return (
    <div className="space-y-3" data-ciclo-de-vida>
      {dialogo}
      {paraBorrar ? (
        <>
          <p className="texto-suave">Está dado de baja y queda 30 días en &ldquo;para borrar&rdquo;. Se puede restaurar hasta entonces.</p>
          <BotonAccion className="boton" onClick={() => hecho(() => restaurarBaja(gimnasioId))}>Restaurar el gimnasio</BotonAccion>
        </>
      ) : (
        <>
          <p className="texto-suave">{pausado ? "Está pausado: el panel está en solo lectura, no se borró nada." : "Pausar deja el panel en solo lectura (la puerta y la app siguen). No se borra nada."}</p>
          {pausado && <BotonAccion className="boton" onClick={() => hecho(() => reanudarGimnasio(gimnasioId))}>Reanudar</BotonAccion>}
          <label className="space-y-1 block"><span className="etiqueta">Motivo (queda registrado)</span>
            <input className="campo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2 items-center">
            {!pausado && <BotonAccion className="boton" disabled={motivo.trim().length < 5} onClick={() => hecho(() => pausarGimnasio(gimnasioId, motivo))}>Pausar</BotonAccion>}
            <a className="boton" href={`/admin/${gimnasioId}/exportar`} onClick={() => setExportado(true)}>1. Exportar todo (zip)</a>
            <BotonAccion className="boton texto-suave" disabled={!exportado || motivo.trim().length < 5} onClick={async () => {
              if (!(await confirmar(`Vas a dar de baja a ${nombre}. Queda 30 días para borrar y se puede restaurar.`, { boton: "Dar de baja", peligro: true }))) return;
              await hecho(() => darDeBajaGimnasio(gimnasioId, motivo));
            }}>2. Dar de baja</BotonAccion>
          </div>
          {!exportado && <p className="texto-tenue text-sm">Primero exportá todo: el botón de baja se habilita después.</p>}
        </>
      )}
      <Alerta m={error} />
    </div>
  );
}
