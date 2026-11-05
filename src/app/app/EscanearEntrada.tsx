"use client";
// El socio escanea el QR de la tablet de la entrada con su celular (ENT-6).
import { useCallback, useState, useTransition } from "react";
import { colorVar } from "@/components/panel/Estado";
import { Camara } from "@/app/panel/entrada/Camara";
import { escanearEntrada } from "./acciones";

export function EscanearEntrada({ gimnasioId, socioId }: { gimnasioId: string; socioId: string }) {
  const [abierta, setAbierta] = useState(false);
  const [r, setR] = useState<{ resultado?: string; color?: string; texto?: string; error?: string } | null>(null);
  const [ocupado, empezar] = useTransition();
  const leer = useCallback((codigo: string) => empezar(async () => { setAbierta(false); setR(await escanearEntrada(gimnasioId, socioId, codigo)); }), [gimnasioId, socioId]);
  const entro = r && !r.error && (r.resultado === "entro" || r.resultado === "entro_modo_aviso");
  return (
    <section className="space-y-3" data-escanear-entrada>
      <button type="button" className="boton boton-principal w-full !min-h-16 text-lg" disabled={ocupado} onClick={() => { setR(null); setAbierta(true); }}>
        {ocupado ? "Entrando…" : "📷 Escanear el QR de la entrada"}
      </button>
      {r && (
        <div role="status" className="rounded-[var(--radio-grande)] p-5 border" data-resultado-escaneo={r.error ? "error" : entro ? "entro" : "no"}
          style={{ background: `color-mix(in oklab, ${colorVar(r.error ? "gris" : entro ? (r.color ?? "verde") : "rojo")}, var(--fondo) 80%)` }}>
          <p className="titulo text-2xl">{r.error ? "🤔 No se pudo" : entro ? "✅ ¡Adentro! Buen entrenamiento" : "⛔ Hoy no podés pasar"}</p>
          <p className="mt-1">{r.error ?? r.texto}</p>
        </div>
      )}
      {abierta && <Camara alLeer={leer} alCerrar={() => setAbierta(false)} />}
    </section>
  );
}
