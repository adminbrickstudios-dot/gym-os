"use client";
// Cierre para vender (25/11) · caja.png: los movimientos del turno con Todos / Entradas / Salidas. Solo muestra lo que trajo la base
// (movimientos_turno, con el permiso del arqueo ciego): no suma ni resta plata.
import { useState } from "react";
import { formatearPesos } from "@/lib/formato";
import type { MovimientosTurno as Datos } from "./tipos";

const MEDIO: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito", credito: "Crédito", mercadopago: "Mercado Pago", cuenta_corriente: "A cuenta", debito_automatico: "Débito automático" };
type Fila = { id: string; en: string; texto: string; quien: string | null; medio: string; monto: number; entra: boolean };
const FILTROS = [["todos", "Todos"], ["entradas", "Entradas"], ["salidas", "Salidas"]] as const;

export function MovimientosTurno({ datos, zona }: { datos: Datos; zona: string }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number][0]>("todos");
  const detalle = new Map(datos.detalle.map((d) => [d.pago_id, d.detalle]));
  const filas: Fila[] = [
    ...datos.cobros.flatMap((m) => m.cobros.map((c) => ({ id: c.pago_id, en: c.en, texto: detalle.get(c.pago_id) ?? "Cobro", quien: c.socio, medio: MEDIO[m.medio] ?? m.medio, monto: c.monto, entra: true }))),
    ...datos.movimientos.map((m) => ({ id: m.id, en: m.en, texto: m.motivo, quien: m.por, medio: "Efectivo", monto: m.monto, entra: m.tipo === "ingreso" })),
  ].sort((a, b) => b.en.localeCompare(a.en));
  const vistas = filas.filter((f) => filtro === "todos" || (filtro === "entradas") === f.entra);
  const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  return (
    <section className="tarjeta caja-movimientos" aria-labelledby="movimientos-turno" data-movimientos-turno={filas.length}>
      <div className="caja-movimientos-cabeza">
        <h2 id="movimientos-turno" className="titulo">Movimientos del turno</h2>
        <div className="pestanas" role="group" aria-label="Filtrar movimientos">
          {FILTROS.map(([k, t]) => <button key={k} type="button" className="pestana" aria-pressed={filtro === k} data-filtro-movimientos={k} onClick={() => setFiltro(k)}>{t}</button>)}
        </div>
      </div>
      {vistas.length === 0 ? <p className="texto-suave">{filas.length === 0 ? "Todavía no hubo movimientos en este turno." : "Nada con este filtro."}</p> : (
        <ul className="caja-movimientos-lista">
          {vistas.map((f) => (
            <li key={f.id} className="caja-movimientos-fila" data-movimiento={f.entra ? "entra" : "sale"}>
              <span className="numero texto-suave">{hora(f.en)}</span>
              <span className="min-w-0"><span className="block font-semibold truncate">{f.texto}</span><span className="block texto-suave text-sm truncate">{f.quien ?? "—"}</span></span>
              <span className="pildora">{f.medio}</span>
              <span className={`numero caja-movimientos-monto ${f.entra ? "entra" : "sale"}`}>{f.entra ? "+" : "−"}{formatearPesos(f.monto)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
