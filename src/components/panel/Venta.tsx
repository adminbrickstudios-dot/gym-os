"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { anularVenta, resolverAnulacion, type Venta } from "@/app/panel/ventas-acciones";
import { fechaCorta, formatearPesos } from "@/lib/formato";
import { Icono } from "@/components/ui/Icono";

const MEDIO: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito", credito: "Crédito", mercadopago: "MercadoPago" };

/** Una venta con lo que se puede hacer con ella (VEN-6): anular con motivo, o aprobar/rechazar el pedido de la recepción. */
export function FilaVenta({ v, zona, conSocio = false }: { v: Venta; zona: string; conSocio?: boolean }) {
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) setAnulando(false); });
  const anulada = v.estado === "anulada";
  return (
    <li className={`tarjeta px-4 py-3 ${anulada ? "opacity-60" : ""}`} data-venta={v.venta_id} data-estado={v.estado}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={`numero text-2xl ${anulada ? "line-through" : ""}`}>{formatearPesos(v.total)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{conSocio && v.socio ? `${v.socio} · ` : ""}{v.detalle ?? "Venta"}</span>
          <span className="block text-sm texto-tenue">{fechaCorta(v.fecha, zona)} · {v.medios.map((m) => MEDIO[m] ?? m).join(" + ") || "sin pago"}{v.cobro ? ` · cobró ${v.cobro}` : ""}</span>
        </span>
        {v.recibo_n != null && <Link href={`/panel/recibo/${v.venta_id}`} className="boton boton-chico" data-ver-recibo><Icono nombre="recibo" /> Recibo</Link>}
        {anulada && <span className="pildora pildora-rojo">Anulada</span>}
        {v.estado === "pendiente" && <span className="pildora pildora-azul">Esperando aprobación</span>}
        {!anulada && !v.pedido && !anulando && <button type="button" className="boton boton-chico" onClick={() => setAnulando(true)}><Icono nombre="deshacer" /> Anular</button>}
      </div>
      {anulada && <p className="text-sm texto-suave mt-1">Anulada{v.anulada_por ? ` por ${v.anulada_por}` : ""}: “{v.anulada_motivo}”</p>}
      {v.pedido && !anulada && (
        <div className="mt-2 flex flex-wrap items-center gap-2" data-pedido-anulacion>
          <p className="flex-1 min-w-0 text-sm"><Icono nombre="deshacer" /> {v.pedido.por} pidió anularla: “{v.pedido.motivo}”</p>
          <button type="button" className="boton boton-chico boton-peligro" disabled={ocupado} onClick={() => correr(() => resolverAnulacion(v.pedido!.pedido_id, true, v.socio_id))}>Anular</button>
          <button type="button" className="boton boton-chico" disabled={ocupado} onClick={() => correr(() => resolverAnulacion(v.pedido!.pedido_id, false, v.socio_id))}>Dejarla</button>
        </div>
      )}
      {anulando && (
        <form className="mt-3 flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) correr(() => anularVenta(v.venta_id, motivo, v.socio_id)); }}>
          <input autoFocus className="campo" placeholder="Motivo (obligatorio): ej. se cobró dos veces" aria-label="Motivo de la anulación" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button type="submit" className="boton boton-peligro" disabled={!motivo.trim() || ocupado}>Anular venta</button>
          <button type="button" className="boton" onClick={() => setAnulando(false)}>Cancelar</button>
        </form>
      )}
      {anulando && <p className="text-sm texto-tenue mt-2">Se revierte lo que habilitó (la cuota, el pase o el pack). Si se cobró en efectivo de una caja ya cerrada, la devolución sale de la caja abierta.</p>}
      {error && <p role="alert" className="pildora pildora-rojo mt-2"><Icono nombre="alerta" /> {error}</p>}
    </li>
  );
}
