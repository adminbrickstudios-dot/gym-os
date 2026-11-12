"use client";
import { useState, useTransition } from "react";
import { pedirMisDatos } from "./acciones";
import { Icono } from "@/components/ui/Icono";

const TIPOS: [string, string, string][] = [
  ["ver", "Ver mis datos", "Quiero saber qué datos tienen de mí."],
  ["corregir", "Corregir un dato", "Hay un dato mío que está mal."],
  ["borrar", "Borrar mis datos", "Quiero que borren mis datos."],
];

export function PedirDatos({ socioId }: { socioId: string }) {
  const [tipo, setTipo] = useState("ver");
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const [enviando, empezar] = useTransition();

  if (hecho) return <p className="pildora pildora-verde !rounded-[var(--radio)] !px-4 !py-3 w-full" role="status" data-pedido-enviado><Icono nombre="ok" /> Listo: el gimnasio recibió tu pedido.</p>;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await pedirMisDatos(socioId, tipo, detalle); if (r.error) setError(r.error); else { setError(null); setHecho(true); } }); }}>
      <div className="space-y-2" role="radiogroup" aria-label="Qué querés pedir">
        {TIPOS.map(([clave, titulo, texto]) => (
          <label key={clave} className={`tarjeta p-4 block cursor-pointer border-2 ${tipo === clave ? "border-[var(--acento)]" : "border-transparent"}`}>
            <input type="radio" name="tipo" value={clave} checked={tipo === clave} onChange={() => setTipo(clave)} className="sr-only" />
            <span className="block font-semibold">{titulo}</span><span className="block texto-suave text-sm">{texto}</span>
          </label>
        ))}
      </div>
      <label className="block space-y-2">
        <span className="etiqueta">{tipo === "corregir" ? "¿Qué dato hay que corregir?" : "Algo que quieras aclarar (opcional)"}</span>
        <textarea className="campo" rows={3} maxLength={1000} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
      </label>
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
      <button type="submit" disabled={enviando} className="boton boton-principal w-full">{enviando ? "Enviando…" : "Enviar el pedido"}</button>
    </form>
  );
}
