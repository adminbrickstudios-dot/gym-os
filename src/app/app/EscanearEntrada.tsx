"use client";
// El socio escanea el QR de la tablet de la entrada con su celular (ENT-6).
import { useCallback, useState, useTransition } from "react";
import { colorVar } from "@/components/panel/Estado";
import { Camara } from "@/app/panel/entrada/CamaraDinamica";
import { escanearEntrada, escanearSalida } from "./acciones";

/** principal: el verde de la pantalla solo si es lo que tiene que hacer ahora (si debe pagar, el verde es pagar). conSalida (VD-48): el gimnasio registra la salida y se ofrece "Me voy". */
export function EscanearEntrada({ gimnasioId, socioId, principal = true, conSalida = false }: { gimnasioId: string; socioId: string; principal?: boolean; conSalida?: boolean }) {
  const [abierta, setAbierta] = useState<false | "entrar" | "salir">(false);
  const [r, setR] = useState<{ resultado?: string; color?: string; texto?: string; error?: string } | null>(null);
  const [salio, setSalio] = useState<{ registrada?: boolean; texto?: string; error?: string } | null>(null);
  const [ocupado, empezar] = useTransition();
  const leer = useCallback((codigo: string) => empezar(async () => {
    const modo = abierta; setAbierta(false);
    if (modo === "salir") setSalio(await escanearSalida(gimnasioId, socioId, codigo));
    else setR(await escanearEntrada(gimnasioId, socioId, codigo));
  }), [gimnasioId, socioId, abierta]);
  const entro = r && !r.error && (r.resultado === "entro" || r.resultado === "entro_modo_aviso");
  return (
    <section className="space-y-3" data-escanear-entrada>
      <button type="button" className={`boton ${principal ? "boton-principal" : ""} w-full !min-h-16 text-lg`} disabled={ocupado} onClick={() => { setR(null); setSalio(null); setAbierta("entrar"); }}>
        {ocupado ? "Un momento…" : "📷 Escanear el QR de la entrada"}
      </button>
      {conSalida && (
        <button type="button" className="boton w-full !min-h-14 text-lg" disabled={ocupado} data-me-voy onClick={() => { setR(null); setSalio(null); setAbierta("salir"); }}>
          👋 Me voy
        </button>
      )}
      {salio && (
        <div role="status" className="rounded-[var(--radio-grande)] p-5 border" data-resultado-salida={salio.error ? "error" : salio.registrada ? "salio" : "sin-entrada"}
          style={{ background: `color-mix(in oklab, ${colorVar(salio.error ? "gris" : salio.registrada ? "verde" : "amarillo")}, var(--fondo) 80%)` }}>
          <p className="titulo text-2xl">{salio.error ? "🤔 No se pudo" : salio.registrada ? "👋 ¡Hasta pronto!" : "ℹ️ Listo"}</p>
          <p className="mt-1">{salio.error ?? salio.texto}</p>
        </div>
      )}
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
