"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { borrarEjemplos, cargarEjemplos } from "@/app/panel/seguridad-acciones";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";

/**
 * VD-43: "Cargar 10 socios de ejemplo para probar" mientras el gimnasio no tiene socios reales, y el aviso fijo
 * "Estás viendo datos de ejemplo · Borrarlos" mientras haya. Los ejemplos tienen teléfonos +54 9 000… y mails
 * @ejemplo.invalid, y borrarlos no toca nada real.
 */
export function DatosEjemplo({ cargados, ofrecer }: { cargados: number; ofrecer: boolean }) {
  const router = useRouter();
  const [msj, setMsj] = useState<{ ok?: boolean; texto: string } | null>(null);
  if (cargados > 0) {
    return (
      <div data-datos-ejemplo={cargados} className="space-y-2">
        <Mensaje tipo="aviso" accion={
          <BotonAccion className="boton boton-chico" ocupadoTexto="Borrando…" data-borrar-ejemplos
            onClick={async () => { const r = await borrarEjemplos(); setMsj(r.error ? { texto: r.error } : { ok: true, texto: r.aviso ?? "Listo." }); router.refresh(); }}>
            Borrarlos
          </BotonAccion>}>
          <p><strong>Estás viendo datos de ejemplo</strong> ({cargados} socios de prueba, no son reales). Borrarlos no toca nada tuyo.</p>
        </Mensaje>
        {msj && <Mensaje tipo={msj.ok ? "exito" : "error"}>{msj.texto}</Mensaje>}
      </div>
    );
  }
  if (!ofrecer) return msj ? <Mensaje tipo={msj.ok ? "exito" : "error"}><span data-ejemplos-borrados>{msj.texto}</span></Mensaje> : null;
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-2" aria-labelledby="ejemplos" data-ofrecer-ejemplos>
      <h2 id="ejemplos" className="titulo text-2xl">¿Querés probar con datos de mentira?</h2>
      <p className="texto-suave">Cargamos 10 socios de ejemplo para que veas cómo se ve todo (la entrada, la lista, los vencimientos). Después los borrás en un botón.</p>
      {msj && <Mensaje tipo={msj.ok ? "exito" : "error"}>{msj.texto}</Mensaje>}
      <BotonAccion className="boton" ocupadoTexto="Cargando…" data-cargar-ejemplos
        onClick={async () => { const r = await cargarEjemplos(); if (r.error) setMsj({ texto: r.error }); else { setMsj(null); router.refresh(); } }}>
        Cargar 10 socios de ejemplo
      </BotonAccion>
    </section>
  );
}
