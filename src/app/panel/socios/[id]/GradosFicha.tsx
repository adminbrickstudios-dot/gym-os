"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { textoRequisitos, type GradosSocio } from "@/lib/clases/grados";
import { anularGradoSocio, otorgarGrado } from "@/app/panel/grados/acciones";

/** COM-13: el grado del socio en cada actividad con grados, lo que le falta para el próximo y su historial. */
export function GradosFicha({ socioId, grados, puedeOtorgar, puedeAnular, zona }: { socioId: string; grados: GradosSocio; puedeOtorgar: boolean; puedeAnular: boolean; zona: string }) {
  const fecha = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(m));
  return (
    <section className="mt-6 space-y-3" data-grados-ficha>
      <p className="titulo-grupo">🥋 Grados</p>
      {grados.map((a) => (
        <div key={a.actividad_id} className="tarjeta p-4 space-y-2" data-grado-actividad={a.actividad}>
          <p><span className="font-semibold">{a.emoji ?? "🥋"} {a.actividad}:</span> {a.actual ? <>{a.actual.color && <span className="inline-block w-3 h-3 rounded-full border align-middle mr-1" style={{ background: a.actual.color }} aria-hidden />}{a.actual.nombre}</> : "sin grado"}</p>
          {a.proximo && <p className="text-sm texto-suave">Para {a.proximo.nombre}: {textoRequisitos(a)}{a.listo ? " · ✅ listo para rendir" : ""}</p>}
          {puedeOtorgar && a.proximo && <Otorgar socioId={socioId} gradoId={a.proximo.grado_id} nombre={a.proximo.nombre} />}
          {a.historial.length > 0 && (
            <ul className="text-sm texto-suave space-y-1">{a.historial.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2">✅ {h.nombre} · {fecha(h.otorgado_en)}{h.por ? ` · ${h.por}` : ""}{puedeAnular && <Anular id={h.id} />}</li>
            ))}</ul>
          )}
        </div>
      ))}
    </section>
  );
}

function Otorgar({ socioId, gradoId, nombre }: { socioId: string; gradoId: string; nombre: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <>
      <button type="button" className="boton boton-chico" disabled={ocupado} data-otorgar-grado
        onClick={() => empezar(async () => { const r = await otorgarGrado(socioId, gradoId, null); setError(r.error ?? null); })}>🥋 Rindió: {nombre}</button>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </>
  );
}

function Anular({ id }: { id: string }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (!abierto) return <button type="button" className="underline" onClick={() => setAbierto(true)}>Anular</button>;
  return (
    <form className="flex flex-wrap gap-2 w-full" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await anularGradoSocio(id, motivo); setError(r.error ?? null); }); }}>
      <input className="campo grow" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué se anula" aria-label="Por qué se anula el grado" />
      <button type="submit" className="boton" disabled={ocupado}>Anular</button>
      {error && <Mensaje tipo="error" className="w-full">{error}</Mensaje>}
    </form>
  );
}
