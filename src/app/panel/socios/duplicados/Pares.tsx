"use client";
// Cada par de posibles duplicados, lado a lado. El dueño elige con cuál se
// queda; confirma (no se deshace) y todo lo del otro pasa a ese.
import Link from "next/link";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { fechaCorta, formatearCelular } from "@/lib/formato";
import { unir } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type Par = { motivo: string; a: string; a_numero: number; a_nombre: string; a_dni: string | null; a_telefono: string | null; a_alta: string;
  b: string; b_numero: number; b_nombre: string; b_dni: string | null; b_telefono: string | null; b_alta: string };

export function Pares({ pares, zona, puedeUnir }: { pares: Par[]; zona: string; puedeUnir: boolean }) {
  const [eleccion, setEleccion] = useState<{ par: number; queda: "a" | "b" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const lado = (p: Par, x: "a" | "b") => ({ id: p[x], numero: p[`${x}_numero`], nombre: p[`${x}_nombre`], dni: p[`${x}_dni`], tel: p[`${x}_telefono`], alta: p[`${x}_alta`] });
  return (
    <div className="space-y-4">
      {hecho && <Mensaje tipo="exito">{hecho}</Mensaje>}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!puedeUnir && <p className="pildora"><Icono nombre="ojo" /> Unir fichas lo hace el dueño (mueve pagos y la cuenta de la app).</p>}
      <ul className="space-y-3">
        {pares.map((p, i) => (
          <li key={`${p.a}-${p.b}`} className="tarjeta p-5 space-y-4" data-par={i}>
            <p className="pildora w-fit">{p.motivo === "Mismo celular" ? "" : ""} {p.motivo}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["a", "b"] as const).map((x) => {
                const s = lado(p, x);
                return (
                  <div key={x} className="rounded-[var(--radio)] border border-[var(--borde)] p-4 space-y-1">
                    <Link href={`/panel/socios/${s.id}`} className="font-semibold text-lg underline-offset-4 hover:underline">{s.nombre} <span className="texto-tenue font-normal">#{s.numero}</span></Link>
                    <p className="text-sm texto-suave">DNI {s.dni ?? "—"} · {s.tel ? formatearCelular(s.tel) : "sin celular"} · alta {fechaCorta(s.alta, zona)}</p>
                    {puedeUnir && <button type="button" className="boton mt-2" disabled={ocupado} onClick={() => setEleccion({ par: i, queda: x })}><Icono nombre="ok" /> Quedarse con #{s.numero}</button>}
                  </div>
                );
              })}
            </div>
            {eleccion?.par === i && (() => {
              const q = lado(p, eleccion.queda), v = lado(p, eleccion.queda === "a" ? "b" : "a");
              return (
                <div className="rounded-[var(--radio)] border-2 border-[var(--acento)] p-4 space-y-3" data-confirmar>
                  <p>Todo lo de <strong>{v.nombre} #{v.numero}</strong> (pagos, cuotas, entradas, reservas, notas, etiquetas y la cuenta de la app) pasa a <strong>{q.nombre} #{q.numero}</strong>, y la ficha #{v.numero} se borra. <strong>No se puede deshacer.</strong></p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="boton boton-principal" disabled={ocupado}
                      onClick={() => empezar(async () => {
                        const r = await unir(q.id, v.id);
                        if (r.error) { setError(r.error); setHecho(null); return; }
                        setError(null); setEleccion(null); setHecho(`Listo: ${v.nombre} #${v.numero} quedó unido a #${q.numero}.`);
                      })}>{ocupado ? "Uniendo…" : `Unir en #${q.numero}`}</button>
                    <button type="button" className="boton" onClick={() => setEleccion(null)}>Cancelar</button>
                  </div>
                </div>
              );
            })()}
          </li>
        ))}
      </ul>
    </div>
  );
}
