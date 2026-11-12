"use client";
// Grupo familiar: quiénes son de la misma familia (con su estado) y sumar a alguien.
import Link from "next/link";
import { useState, useTransition } from "react";
import { PuntoEstado } from "@/components/panel/Estado";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { fijarTitularFamilia, quitarTitularFamilia, sacarDeFamilia, vincularFamilia } from "../acciones";
import { Icono } from "@/components/ui/Icono";

export type Familiar = { socio_id: string; numero: number; nombre: string; color: string; texto: string; es_titular?: boolean };
/** VD-46G: cómo está este socio respecto del plan familiar/corporativo (la base lo calcula). */
export type PlanFamiliar = { activo: boolean; en_grupo: boolean; titular_id: string | null; titular_nombre: string | null; tipo: "familiar" | "corporativo" | null; es_titular: boolean; vinculados: number | null };

export function Familia({ socioId, familia, plan = null, puedeArmar = false }: { socioId: string; familia: Familiar[]; plan?: PlanFamiliar | null; puedeArmar?: boolean }) {
  const [tipo, setTipo] = useState<"familiar" | "corporativo">(plan?.tipo ?? "familiar");
  const [texto, setTexto] = useState("");
  const [encontrados, setEncontrados] = useState<ResultadoSocio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const buscar = (t: string) => { setTexto(t); if (t.trim().length < 2) { setEncontrados([]); return; }
    void buscarSociosRapido(t).then((r) => { setEncontrados((r.socios ?? []).filter((s) => s.socio_id !== socioId && !familia.some((f) => f.socio_id === s.socio_id))); setError(r.error ?? null); }); };
  return (
    <div className="tarjeta p-6 sm:col-span-2 space-y-3 min-w-0" data-familia={familia.length}>
      <p className="titulo text-2xl"><Icono nombre="usuarios" /> Familia</p>
      {familia.length === 0 && <p className="texto-suave">No está vinculado con nadie. Sumá a quien viene con él (hermana, hijo…) para verlos juntos.</p>}
      {plan?.activo && familia.length > 0 && (
        <div className="rounded-[var(--radio)] border border-[var(--borde)] p-3 space-y-2 min-w-0" data-plan-familiar={plan.titular_id ? (plan.es_titular ? "titular" : "miembro") : "sin-titular"}>
          {plan.titular_id ? (
            <>
              <p className="font-semibold break-words"><Icono nombre="corona" /> {plan.es_titular ? `Paga por ${plan.vinculados ?? 0} ${plan.vinculados === 1 ? "persona" : "personas"}` : `Paga ${plan.titular_nombre}`} <span className="texto-tenue font-normal">· plan {plan.tipo === "corporativo" ? "corporativo" : "familiar"}</span></p>
              <p className="texto-suave text-sm">{plan.es_titular ? "Los demás entran con su plan. Si no paga, ellos quedan afuera y se les explica por qué." : "Entra con el plan del titular. Si el titular no está al día, acá se ve el motivo."}</p>
              {puedeArmar && <button type="button" className="text-sm texto-suave underline" disabled={ocupado} data-quitar-titular
                onClick={() => empezar(async () => { const r = await quitarTitularFamilia(socioId); setError(r.error ?? null); })}>Dejar el grupo sin titular</button>}
            </>
          ) : (
            <>
              <p className="font-semibold"><Icono nombre="corona" /> Nadie paga por el grupo todavía</p>
              {puedeArmar ? (
                <>
                  <p className="texto-suave text-sm">Elegí quién paga: los demás van a entrar con su plan.</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de plan">
                    {([["familiar", "Familiar"], ["corporativo", "Corporativo"]] as const).map(([v, t]) => (
                      <button key={v} type="button" aria-pressed={tipo === v} className={`pestana ${tipo === v ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`} onClick={() => setTipo(v)}>{t}</button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="boton" disabled={ocupado} data-titular-yo
                      onClick={() => empezar(async () => { const r = await fijarTitularFamilia(socioId, socioId, tipo); setError(r.error ?? null); })}>Que pague este socio</button>
                    {familia.map((f) => (
                      <button key={f.socio_id} type="button" className="boton" disabled={ocupado}
                        onClick={() => empezar(async () => { const r = await fijarTitularFamilia(socioId, f.socio_id, tipo); setError(r.error ?? null); })}>Que pague {f.nombre}</button>
                    ))}
                  </div>
                </>
              ) : <p className="texto-suave text-sm">Lo arma el dueño o el encargado.</p>}
            </>
          )}
        </div>
      )}
      <ul className="space-y-1">
        {familia.map((f) => (
          <li key={f.socio_id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1">
            <PuntoEstado color={f.color} />
            <Link href={`/panel/socios/${f.socio_id}`} className="font-semibold hover:underline">{f.nombre} <span className="texto-tenue font-normal">#{f.numero}</span></Link>
            {f.es_titular && <span className="pildora"><Icono nombre="corona" /> Titular</span>}
            <span className="texto-suave text-sm min-w-0 flex-1 basis-40">{f.texto}</span>
            <button type="button" className="text-sm texto-suave underline" disabled={ocupado}
              onClick={() => empezar(async () => { const r = await sacarDeFamilia(socioId, f.socio_id); setError(r.error ?? null); })}>Sacar</button>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <input value={texto} onChange={(e) => buscar(e.target.value)} placeholder="Sumar a la familia: nombre o DNI" aria-label="Sumar a la familia" className="campo" />
        {encontrados.length > 0 && (
          <ul className="space-y-1">
            {encontrados.map((s) => (
              <li key={s.socio_id}>
                <button type="button" className="fila !min-h-12" disabled={ocupado}
                  onClick={() => empezar(async () => { const r = await vincularFamilia(socioId, s.socio_id); setError(r.error ?? null); if (!r.error) { setTexto(""); setEncontrados([]); } })}>
                  <PuntoEstado color={s.color} /> <span className="font-semibold">{s.nombre}</span> <span className="texto-tenue">#{s.numero}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
      <p className="text-sm texto-tenue">Estar en la misma familia no cambia el precio (los descuentos son otra cosa).{plan?.activo ? " Con titular, los demás entran con el plan de quien paga." : ""}</p>
    </div>
  );
}
