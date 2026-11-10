"use client";
// Convenio del socio (VEN-3): lo asignan el dueño y el encargado; Vender lo descuenta solo de la cuota.
import { useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { asignarConvenio, quitarConvenio } from "../acciones";
import { Icono } from "@/components/ui/Icono";

export type ConvenioSocio = { convenio_id: string; nombre: string; tipo: string; valor: number; hasta: string | null } | null;
type Opcion = { convenio_id: string; nombre: string; tipo: string; valor: number; activo: boolean };
const valor = (c: { tipo: string; valor: number }) => (c.tipo === "porcentaje" ? `${Number(c.valor)} %` : formatearPesos(c.valor));

export function Convenio({ socioId, actual, opciones, puede, hoy, zona }: { socioId: string; actual: ConvenioSocio; opciones: Opcion[]; puede: boolean; hoy: string; zona: string }) {
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState(actual?.convenio_id ?? "");
  const [hasta, setHasta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const activos = opciones.filter((o) => o.activo);
  if (!actual && activos.length === 0) return null;
  const correr = (fn: () => Promise<{ error?: string }>) => empezar(async () => { const r = await fn(); if (r.error) setError(r.error); else { setError(null); setAbierto(false); } });
  // "hasta" es el instante en que deja de regir: el último día es el anterior.
  const ultimo = actual?.hasta ? new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit" }).format(new Date(new Date(actual.hasta).getTime() - 3600_000)) : null;
  return (
    <div className="space-y-2" data-convenio-socio={actual?.nombre ?? ""}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pildora">{actual ? `${actual.nombre} (−${valor(actual)})${ultimo ? ` hasta el ${ultimo}` : ""}` : "Sin convenio"}</span>
        {puede && !abierto && <button type="button" className="text-sm texto-suave underline" onClick={() => setAbierto(true)}>{actual ? "Cambiar" : "Asignar convenio"}</button>}
        {puede && !abierto && actual && <button type="button" className="text-sm texto-tenue underline" disabled={ocupado} onClick={() => correr(() => quitarConvenio(socioId))}>Quitar</button>}
      </div>
      {abierto && (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); correr(() => asignarConvenio(socioId, elegido, hasta)); }}>
          <select className="campo !w-auto" aria-label="Convenio" value={elegido} onChange={(e) => setElegido(e.target.value)}>
            <option value="">Elegí…</option>
            {activos.map((o) => <option key={o.convenio_id} value={o.convenio_id}>{o.nombre} (−{valor(o)})</option>)}
          </select>
          <input type="date" className="campo !w-auto" min={hoy} aria-label="Hasta (opcional)" title="Último día del convenio (vacío = sin vencimiento)" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <button type="submit" className="boton boton-principal" disabled={ocupado || !elegido}>Guardar</button>
          <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
        </form>
      )}
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}
