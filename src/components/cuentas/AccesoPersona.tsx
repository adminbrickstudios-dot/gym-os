"use client";
import { useActionState, useState } from "react";
import { darAccesoPersona, nuevaClavePersona, type Resultado } from "@/app/admin/acciones";

/** La contraseña provisoria se muestra una sola vez, grande y fácil de copiar. */
export function ContrasenaNueva({ r }: { r: Resultado }) {
  if (r.error) return <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3 basis-full w-full">⚠️ {r.error}</p>;
  if (!r.aviso) return null;
  return (
    <div role="status" className="tarjeta !bg-[var(--tarjeta-alta)] p-4 basis-full w-full space-y-1">
      <p>✅ {r.aviso}</p>
      {r.contrasena && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {r.email && <span>📧 <strong className="break-all">{r.email}</strong></span>}
          <span>🔑 <strong className="numero text-2xl select-all">{r.contrasena}</strong></span>
        </p>
      )}
    </div>
  );
}

/**
 * Acciones de cuenta de una persona del equipo. La base decide si quien
 * mira puede (cuenta_para_nueva_clave / persona_para_dar_acceso): si no, el
 * botón devuelve el error, nunca hace nada en silencio.
 */
export function AccesoPersona({ equipoId, nombre, tieneCuenta, puedeNuevaClave = true }: { equipoId: string; nombre: string; tieneCuenta: boolean; puedeNuevaClave?: boolean }) {
  const [clave, pedirClave, cambiando] = useActionState<Resultado, FormData>(nuevaClavePersona, {});
  const [acceso, darAcceso, dando] = useActionState<Resultado, FormData>(darAccesoPersona, {});
  const [abierto, setAbierto] = useState(false);
  // Primero el resultado: al dar acceso la página se refresca y la persona
  // ya figura con cuenta; la contraseña recién creada no se puede perder.
  if (acceso.aviso) return <ContrasenaNueva r={acceso} />;
  if (tieneCuenta) {
    if (!puedeNuevaClave) return null;
    return (
      <>
        <form action={pedirClave} onSubmit={(e) => { if (!confirm(`¿Darle a ${nombre} una contraseña nueva? La que tiene deja de servir.`)) e.preventDefault(); }}>
          <input type="hidden" name="equipo_id" value={equipoId} />
          <button className="boton !min-h-10" disabled={cambiando}>{cambiando ? "Generando…" : "🔑 Nueva contraseña"}</button>
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
          <input name="email" type="email" required autoFocus className="campo !min-h-10 sm:!w-64" placeholder={`Mail de ${nombre}`} aria-label={`Mail de ${nombre}`} />
          <button className="boton boton-principal !min-h-10" disabled={dando}>{dando ? "Dando acceso…" : "Dar acceso"}</button>
        </form>
      ) : (
        <button type="button" className="boton !min-h-10" onClick={() => setAbierto(true)}>✉️ Dar acceso</button>
      )}
      {acceso.error && <ContrasenaNueva r={acceso} />}
    </>
  );
}
