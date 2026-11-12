// Pestaña Cambios: quién cambió qué de la configuración y cuándo. Lo escribe
// la base (triggers), nunca la pantalla; acá solo se lee. F9.2 (EDIT-D04): el dueño puede volver un dato al valor
// anterior ("Restaurar este valor"); la base decide qué filas se pueden (solo el último cambio de cada dato).
"use client";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { restaurarCambio } from "./acciones";
import { Vacio } from "@/components/ui/Vacio";
import { Icono } from "@/components/ui/Icono";

export type Cambio = { campo: string; etiqueta: string; antes: string; despues: string; quien: string; cuando: string; cuando_texto: string; restaurar_id?: string };

export function Historial({ cambios }: { cambios: Cambio[] }) {
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  if (!cambios.length) {
    return <Vacio icono="reloj" titulo="Todavía no hay cambios">Cada vez que alguien cambie algo de la configuración, aparece acá: qué, de qué a qué, quién y cuándo.</Vacio>;
  }
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-historial={cambios.length}>
      <div>
        <p className="titulo text-2xl"><Icono nombre="reloj" /> Cambios</p>
        <p className="texto-suave">Quién cambió qué de la configuración, de lo más nuevo a lo más viejo. No se puede borrar.</p>
      </div>
      {msj.ok && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      <ul className="divide-y divide-[var(--borde)]">
        {cambios.map((c, i) => (
          <li key={`${c.cuando}-${c.campo}-${i}`} className="py-3 space-y-1" data-cambio={c.campo}>
            <p className="font-semibold">{c.etiqueta}</p>
            <p className="break-words"><span className="texto-tenue line-through">{c.antes}</span> <span aria-hidden>→</span> <span>{c.despues}</span></p>
            <p className="text-sm texto-tenue">{c.quien} · {c.cuando_texto}</p>
            {c.restaurar_id && (
              <BotonAccion className="boton" ocupadoTexto="Restaurando…" data-restaurar={c.campo}
                onClick={async () => { const r = await restaurarCambio(c.restaurar_id!); setMsj(r.error ? { error: r.error } : { ok: r.aviso }); }}>
                <Icono nombre="deshacer" /> Restaurar el valor anterior
              </BotonAccion>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
