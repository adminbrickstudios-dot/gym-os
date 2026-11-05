"use client";
import { useState, useTransition } from "react";
import { asignarPlan, darDeBaja, volverADarDeAlta } from "../acciones";

type Plan = { plan_id: string; nombre: string; precio: number | null };
const MOTIVOS: [string, string][] = [
  ["precio", "💸 Precio"], ["horario", "⏰ Horario"], ["mudanza", "📦 Se mudó"], ["otro_gimnasio", "🏋️ Otro gimnasio"],
  ["sin_tiempo", "⌛ Sin tiempo"], ["insatisfecho", "😕 No le gustó"], ["otro", "Otro"],
];

export function CambiarPlan({ socioId, actual, planes }: { socioId: string; actual: string | null; planes: Plan[] }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (!abierto) return <button type="button" className="boton" onClick={() => setAbierto(true)}>{actual ? "🔄 Cambiar plan" : "🏷️ Asignar plan"}</button>;
  return (
    <div className="tarjeta p-4 w-full space-y-3">
      <p className="font-semibold">{actual ? "Elegí el plan nuevo (el actual se cierra hoy)" : "Elegí el plan"}</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {planes.filter((p) => p.plan_id !== actual).map((p) => (
          <button key={p.plan_id} type="button" disabled={ocupado} className="boton !justify-between"
            onClick={() => empezar(async () => { const r = await asignarPlan(socioId, p.plan_id, !!actual); if (r.error) setError(r.error); else setAbierto(false); })}>
            <span>{p.nombre}</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
      <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
    </div>
  );
}

export function DarDeBaja({ socioId }: { socioId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (!abierto) return <button type="button" className="boton texto-suave" onClick={() => setAbierto(true)}>👋 Dar de baja</button>;
  return (
    <div className="tarjeta p-4 w-full space-y-3">
      <p className="font-semibold">¿Por qué se va? Sirve para saber qué mejorar.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MOTIVOS.map(([v, t]) => (
          <button key={v} type="button" disabled={ocupado} className="boton"
            onClick={() => empezar(async () => { const r = await darDeBaja(socioId, v); if (r.error) setError(r.error); else setAbierto(false); })}>{t}</button>
        ))}
      </div>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
      <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
    </div>
  );
}

export function VolverADarDeAlta({ socioId }: { socioId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <div className="space-y-2">
      <button type="button" disabled={ocupado} className="boton boton-principal"
        onClick={() => empezar(async () => { const r = await volverADarDeAlta(socioId); setError(r.error ?? null); })}>
        {ocupado ? "Guardando…" : "↩️ Volver a darlo de alta"}
      </button>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
    </div>
  );
}
