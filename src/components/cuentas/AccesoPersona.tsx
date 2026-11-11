"use client";
import { CampoContrasena } from "@/components/cuentas/CampoContrasena";
import { useActionState, useState } from "react";
import { darAccesoPersona, nuevaClavePersona, type Resultado } from "@/app/admin/acciones";
import { Mensaje } from "@/components/ui/Mensaje";
import { Icono } from "@/components/ui/Icono";

/** La contraseña provisoria se muestra una sola vez, grande y fácil de copiar. */
export function ContrasenaNueva({ r, telefono, onListo }: { r: Resultado & { texto?: string }; telefono?: string | null; onListo?: () => void }) {
  const [copiado, setCopiado] = useState<"clave" | "mensaje" | null>(null);
  if (r.error) return <Mensaje tipo="error" className="basis-full">{r.error}</Mensaje>;
  if (!r.aviso) return null;
  // C1: con el mensaje armado por el servidor (marca del gimnasio, su dirección, mail y clave) se manda a un toque.
  // Sin él (altas del super admin) se arma acá con la dirección actual.
  const texto = r.texto ?? (r.contrasena ? `Tu acceso a Base: entrá en ${window.location.origin}/ingresar${r.email ? ` con ${r.email}` : ""} y la contraseña ${r.contrasena}. Después cambiala en “Mi cuenta”.` : "");
  const copiar = async (que: "clave" | "mensaje") => {
    try { await navigator.clipboard.writeText(que === "clave" ? r.contrasena ?? "" : texto); setCopiado(que); setTimeout(() => setCopiado(null), 1800); }
    catch { setCopiado(null); }
  };
  const digitos = (telefono ?? "").replace(/\D/g, "");
  return (
    <Mensaje tipo="exito" className="basis-full">
      <p>{r.aviso}</p>
      {r.contrasena && (
        <>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[var(--texto)]">
            {r.email && <span><Icono nombre="mail" /> <strong className="break-all">{r.email}</strong></span>}
            <span><Icono nombre="llave" /> <strong className="numero text-2xl select-all" data-clave-nueva>{r.contrasena}</strong></span>
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" className="boton boton-chico" data-copiar-clave onClick={() => copiar("clave")}>{copiado === "clave" ? "Copiada" : "Copiar clave"}</button>
            {/* Se arma recién acá; el texto sale hacia WhatsApp solo si se toca (contraseña provisoria por WhatsApp, 10-DIA-A-DIA). */}
            <a className="boton boton-chico" target="_blank" rel="noopener noreferrer" data-compartir-clave
               href={`https://wa.me/${digitos.length >= 8 ? digitos : ""}?text=${encodeURIComponent(texto)}`}>
              <Icono nombre="celular" /> Mandar por WhatsApp
            </a>
            <button type="button" className="boton boton-chico" data-copiar-mensaje onClick={() => copiar("mensaje")}>{copiado === "mensaje" ? "Copiado" : "Copiar mensaje"}</button>
            {onListo && <button type="button" className="boton-texto texto-suave" data-clave-lista onClick={onListo}>Listo, ocultar</button>}
          </div>
        </>
      )}
    </Mensaje>
  );
}

/**
 * Acciones de cuenta de una persona del equipo. La base decide si quien
 * mira puede (cuenta_para_nueva_clave / persona_para_dar_acceso): si no, el
 * botón devuelve el error, nunca hace nada en silencio.
 */
export function AccesoPersona({ equipoId, nombre, tieneCuenta, puedeNuevaClave = true, accionClave = nuevaClavePersona }: {
  equipoId: string; nombre: string; tieneCuenta: boolean; puedeNuevaClave?: boolean;
  /** C1: el panel del dueño pasa la suya (con el mensaje de la marca y el registro de quién la generó). */
  accionClave?: (previo: Resultado & { texto?: string }, f: FormData) => Promise<Resultado & { texto?: string }>;
}) {
  const [clave, pedirClave, cambiando] = useActionState<Resultado & { texto?: string }, FormData>(accionClave, {});
  const [acceso, darAcceso, dando] = useActionState<Resultado, FormData>(darAccesoPersona, {});
  const [abierto, setAbierto] = useState(false);
  // Primero el resultado: al dar acceso la página se refresca y la persona
  // ya figura con cuenta; la contraseña recién creada no se puede perder.
  // Si el mail ya tenía cuenta y la contraseña escrita NO se aplicó, el aviso queda y el botón “Nueva contraseña” sigue a la vista.
  if (acceso.aviso && !acceso.contrasenaNoAplicada) return <ContrasenaNueva r={acceso} />;
  if (tieneCuenta) {
    if (!puedeNuevaClave) return null;
    return (
      <>
        {acceso.contrasenaNoAplicada && <ContrasenaNueva r={acceso} />}
        <form action={pedirClave} onSubmit={(e) => { if (!confirm(`¿Darle a ${nombre} una contraseña nueva? La que tiene deja de servir.`)) e.preventDefault(); }}>
          <input type="hidden" name="equipo_id" value={equipoId} />
          <CampoContrasena className="campo !w-48" />
          <button className="boton boton-chico" disabled={cambiando}>{cambiando ? "Generando…" : "Nueva contraseña"}</button>
        </form>
        <ContrasenaNueva r={clave} />
      </>
    );
  }
  return (
    <>
      {abierto ? (
        <form action={darAcceso} className="flex flex-wrap gap-2 basis-full sm:basis-auto">
          <input type="hidden" name="equipo_id" value={equipoId} />
          <input name="email" type="email" required autoFocus className="campo sm:!w-64" placeholder={`Mail de ${nombre}`} aria-label={`Mail de ${nombre}`} />
          <CampoContrasena className="campo sm:!w-56" />
          <button className="boton boton-principal boton-chico" disabled={dando}>{dando ? "Dando acceso…" : "Dar acceso"}</button>
        </form>
      ) : (
        <button type="button" className="boton boton-chico" onClick={() => setAbierto(true)}><Icono nombre="mail" /> Dar acceso</button>
      )}
      {acceso.error && <ContrasenaNueva r={acceso} />}
    </>
  );
}
