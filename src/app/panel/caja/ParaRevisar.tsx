"use client";
// VD-9 · Para revisar: las cajas que se cerraron solas sin que nadie las contara.
// El dueño o el encargado la cuenta después ("conté $X") o la deja así con un motivo.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalculadoraBilletes } from "@/components/panel/CalculadoraBilletes";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { formatearPesos, fechaHoraHumana } from "@/lib/formato";
import { contarCajaSinContar, dejarCajaSinContar, type Resumen } from "./acciones";
import type { Billetes, ParaRevisar as Caja } from "./tipos";
import { Icono } from "@/components/ui/Icono";

export function ParaRevisar({ cajas, zona, pedirBilletes }: { cajas: Caja[]; zona: string; pedirBilletes: boolean }) {
  const cuando = (m: string) => fechaHoraHumana(m, zona);
  return (
    <section aria-labelledby="para-revisar" data-para-revisar={cajas.length} className="space-y-3">
      <div>
        <h2 id="para-revisar" className="titulo text-3xl"><Icono nombre="recibo" /> Para revisar</h2>
        <p className="texto-suave">Cajas que quedaron abiertas de otro día y se cerraron solas, sin contar. Nadie pudo cobrar en ellas. Contá la plata y anotala, o dejala así con un motivo.</p>
      </div>
      <ul className="space-y-3">
        {cajas.map((c) => <Fila key={c.turno_id} c={c} cuando={cuando} pedirBilletes={pedirBilletes} />)}
      </ul>
    </section>
  );
}

function Fila({ c, cuando, pedirBilletes }: { c: Caja; cuando: (m: string) => string; pedirBilletes: boolean }) {
  const [modo, setModo] = useState<"nada" | "contar" | "dejar">("nada");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [conBilletes, setConBilletes] = useState(false);
  const [billetes, setBilletes] = useState<Billetes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resumen | null>(null);
  const router = useRouter();
  const usaCalculadora = conBilletes || pedirBilletes;

  if (resultado) {
    const dif = resultado.diferencia ?? 0;
    return (
      <li className="tarjeta p-5 space-y-2" data-revisada aria-live="polite">
        <p className="font-semibold text-lg">{c.caja} · {cuando(c.abierto_en)}</p>
        <p className="titular text-3xl">{dif === 0 ? "Caja justa" : dif > 0 ? `Sobraban ${formatearPesos(dif)}` : `Faltaban ${formatearPesos(-dif)}`}</p>
        <button type="button" className="boton" onClick={() => router.refresh()}><Icono nombre="ok" /> Listo</button>
      </li>
    );
  }
  return (
    <li className="tarjeta p-5 space-y-3" data-caja-para-revisar={c.turno_id}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-semibold text-lg flex-1 min-w-0">{c.caja} · la abrió {c.abierto_por ?? "—"}</p>
        <span className="pildora pildora-amarillo">Sin contar</span>
      </div>
      <p className="texto-suave text-sm">Abierta el {cuando(c.abierto_en)} · se cerró sola el {cuando(c.cerrado_en)}</p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><dt className="texto-tenue text-xs">Inicial</dt><dd className="numero text-lg">{formatearPesos(c.monto_inicial)}</dd></div>
        <div><dt className="texto-tenue text-xs"><Icono nombre="plata" /> Efectivo cobrado</dt><dd className="numero text-lg">{formatearPesos(c.efectivo)}</dd></div>
        <div><dt className="texto-tenue text-xs">Ingresos − retiros</dt><dd className="numero text-lg">{formatearPesos(c.ingresos - c.retiros)}</dd></div>
        <div><dt className="texto-tenue text-xs">Tenía que haber</dt><dd className="numero text-lg" style={{ color: "var(--acento)" }}>{formatearPesos(c.esperado)}</dd></div>
      </dl>
      {modo === "nada" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton boton-principal" onClick={() => { setModo("contar"); setError(null); }}><Icono nombre="calculadora" /> Contar ahora</button>
          <button type="button" className="boton" onClick={() => { setModo("dejar"); setError(null); }}>Dejarla así…</button>
        </div>
      )}
      {modo === "contar" && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); e.currentTarget.querySelector<HTMLButtonElement>("button.boton-principal")?.click(); }}>
          <p className="font-semibold">¿Cuánta plata había en esa caja?</p>
          <input autoFocus className="campo !text-2xl !min-h-16" inputMode="decimal" placeholder="$ contado" aria-label="Plata contada" value={monto} onChange={(e) => setMonto(e.target.value)} readOnly={usaCalculadora} />
          {!pedirBilletes && <button type="button" className="boton boton-chico" aria-pressed={conBilletes} onClick={() => { setConBilletes(!conBilletes); setBilletes(null); setMonto(""); }}>{conBilletes ? "Escribir el total yo" : "Contar billetes"}</button>}
          {usaCalculadora && <CalculadoraBilletes alCambiar={(total, detalle) => { setMonto(String(total).replace(".", ",")); setBilletes(detalle); }} />}
          <input className="campo" placeholder="Nota (opcional)" aria-label="Nota del conteo" value={nota} onChange={(e) => setNota(e.target.value)} />
          {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
          <div className="flex gap-2">
            <BotonAccion className="boton boton-principal" ocupadoTexto="Anotando…" disabled={!monto} onClick={async () => {
              const r = await contarCajaSinContar(c.turno_id, monto, nota, usaCalculadora ? billetes : null);
              if (r.error) setError(r.error); else setResultado(r.resumen!);
            }}>Anotar lo que conté</BotonAccion>
            <button type="button" className="boton" onClick={() => setModo("nada")}>Cancelar</button>
          </div>
        </form>
      )}
      {modo === "dejar" && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); e.currentTarget.querySelector<HTMLButtonElement>("button.boton-principal")?.click(); }}>
          <p className="font-semibold">¿Por qué se deja sin contar? (queda escrito, con tu nombre)</p>
          <input autoFocus className="campo" placeholder="Motivo" aria-label="Motivo de dejarla sin contar" value={nota} onChange={(e) => setNota(e.target.value)} />
          {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
          <div className="flex gap-2">
            <BotonAccion className="boton boton-principal" ocupadoTexto="Anotando…" disabled={!nota.trim()} onClick={async () => {
              const r = await dejarCajaSinContar(c.turno_id, nota);
              if (r.error) setError(r.error); else router.refresh();
            }}>Dejarla sin contar</BotonAccion>
            <button type="button" className="boton" onClick={() => setModo("nada")}>Cancelar</button>
          </div>
        </form>
      )}
    </li>
  );
}
