"use client";
import { Icono } from "@/components/ui/Icono";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { agregarNotaBrik } from "../acciones";

export type NotaBrik = { id: string; texto: string; autor: string; creado_en: string };
const cuando = (iso: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));

/** VD-40: notas internas de BRIK sobre el gimnasio. El dueño no las ve. No se editan: se agrega otra. */
export function Notas({ gimnasioId, notas }: { gimnasioId: string; notas: NotaBrik[] }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="space-y-3" data-notas-brik>
      {notas.length === 0 && <p className="texto-suave">Todavía no hay notas. Anotá acá lo que pasó con este gimnasio (el dueño no las ve).</p>}
      {notas.map((n) => (
        <div key={n.id} className="tarjeta p-4">
          <p className="break-words">{n.texto}</p>
          <p className="texto-tenue text-sm mt-1">{n.autor} · {cuando(n.creado_en)}</p>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 items-end">
        <label className="space-y-1 flex-1 min-w-[14rem]"><span className="etiqueta">Nueva nota</span>
          <input className="campo" value={texto} maxLength={1000} onChange={(e) => setTexto(e.target.value)} placeholder="Le pasé el abono del mes por transferencia" /></label>
        <BotonAccion className="boton" disabled={!texto.trim()} onClick={async () => {
          const r = await agregarNotaBrik(gimnasioId, texto);
          if (r.error) { setError(r.error); return; }
          setError(""); setTexto(""); router.refresh();
        }}><Icono nombre="mas" /> Agregar nota</BotonAccion>
      </div>
      {error && <p role="alert" className="pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}
