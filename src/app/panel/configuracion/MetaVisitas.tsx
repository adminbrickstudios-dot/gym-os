"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { Restablecer } from "./Restablecer";
import { guardarMetaVisitas } from "./acciones";
import { Icono } from "@/components/ui/Icono";

/** VD-23b: la meta de visitas del mes que cada socio ve en su Inicio (se guarda aparte del resto de la pestaña). */
export function MetaVisitas({ inicial, puedeEditar }: { inicial: number; puedeEditar: boolean }) {
  const [guardada, setGuardada] = useState(inicial);
  const [texto, setTexto] = useState(String(inicial));
  const [estado, setEstado] = useState<{ ok?: boolean; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  const n = Number(texto);
  const valida = Number.isInteger(n) && n >= 1 && n <= 31;
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-meta-visitas={guardada}>
      <p className="titulo text-2xl"><Icono nombre="objetivo" /> Meta de visitas del mes</p>
      <p className="texto-suave">Cuántas veces al mes queremos que venga cada socio. En su app ve “Meta X/{guardada}” y una barra que se llena.{puedeEditar ? "" : " La cambia el dueño."}</p>
      <form className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valida) return;
          empezar(async () => {
            const r = await guardarMetaVisitas(n);
            if (r.error) setEstado({ error: r.error }); else { setGuardada(n); setEstado({ ok: true }); }
          });
        }}>
        <label className="block space-y-1"><span className="etiqueta">Visitas por mes (1 a 31)</span>
          <input className="campo w-32" type="number" inputMode="numeric" min={1} max={31} step={1} value={texto} disabled={!puedeEditar || ocupado}
            onChange={(e) => { setTexto(e.target.value); setEstado({}); }} aria-label="Meta de visitas del mes" /></label>
        {puedeEditar && <button type="submit" className="boton boton-principal" disabled={ocupado || !valida || n === guardada}>{ocupado ? "Guardando…" : "Guardar meta"}</button>}
      </form>
      {!valida && texto !== "" && <Mensaje tipo="error">Poné un número entero entre 1 y 31.</Mensaje>}
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      {estado.ok && <Mensaje tipo="exito">Meta guardada: {guardada} visitas por mes.</Mensaje>}
      {puedeEditar && (
        <Restablecer id="meta-visitas" recomendado="12 visitas por mes."
          alConfirmar={async () => {
            const r = await guardarMetaVisitas(12);
            if (r.error) return r.error;
            setGuardada(12); setTexto("12"); setEstado({}); return null;
          }} />
      )}
    </section>
  );
}
