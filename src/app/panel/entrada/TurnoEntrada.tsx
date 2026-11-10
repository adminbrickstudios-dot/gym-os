"use client";
// VD-9 · Mi turno de caja, a la vista en la Entrada: abrirlo con un toque (con el fondo sugerido) o
// ver desde cuándo está abierto y cerrarlo. Es la caja de la persona: lo cobrado en efectivo cae acá.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { abrirCaja } from "@/app/panel/caja/acciones";
import type { MiTurno } from "@/app/panel/caja/tipos";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { formatearPesos } from "@/lib/formato";
import { Icono } from "@/components/ui/Icono";

export function TurnoEntrada({ inicial, zona }: { inicial: MiTurno; zona: string }) {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);
  const [cajaId, setCajaId] = useState(inicial.libres[0]?.caja_id ?? "");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  const t = inicial.turno;

  if (t) {
    return (
      <p data-mi-turno="abierto" className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1">
          {t.vencido ? <><Icono nombre="reloj" /> Tu turno de {t.caja} quedó abierto de otro día: no se puede cobrar en él.</> : <><Icono nombre="punto-verde" /> Tu turno: {t.caja}, desde las {hora(t.abierto_en)}</>}
        </span>
        <Link href="/panel/caja" className="boton">{t.vencido ? "Resolverlo" : "Cerrar mi turno"}</Link>
      </p>
    );
  }
  if (inicial.libres.length === 0) {
    return inicial.modo === "una_por_dia"
      ? <p data-mi-turno="ninguna" className="texto-tenue text-sm"><Icono nombre="candado" /> La caja de hoy ya se usó (este gimnasio tiene una sola caja por día).</p>
      : null;
  }
  const libre = inicial.libres.find((l) => l.caja_id === cajaId) ?? inicial.libres[0];
  if (!abriendo) {
    return (
      <p data-mi-turno="cerrado" className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1"><Icono nombre="candado" /> No tenés turno abierto. Sin turno no se cobra en efectivo.</span>
        <button type="button" className="boton boton-principal" onClick={() => setAbriendo(true)}>Abrir mi turno</button>
      </p>
    );
  }
  return (
    <form data-mi-turno="abriendo" className="tarjeta space-y-3 px-4 py-3" onSubmit={(e) => e.preventDefault()}>
      <p className="font-semibold">Abrir mi turno</p>
      {inicial.libres.length > 1 && (
        <select className="campo" aria-label="Qué caja" value={libre.caja_id} onChange={(e) => setCajaId(e.target.value)}>
          {inicial.libres.map((l) => <option key={l.caja_id} value={l.caja_id}>{l.nombre}</option>)}
        </select>
      )}
      <label className="block space-y-1">
        <span className="etiqueta">¿Con cuánta plata arrancás?</span>
        <input autoFocus className="campo" inputMode="decimal" placeholder="$ 0" aria-label="Fondo del turno" value={monto} onChange={(e) => setMonto(e.target.value)} />
      </label>
      {libre.fondo_sugerido > 0 && (
        <button type="button" className="boton boton-chico" onClick={() => setMonto(String(libre.fondo_sugerido).replace(".", ","))}>
          Usar {formatearPesos(libre.fondo_sugerido)} (lo que quedó en el cajón)
        </button>
      )}
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
      <div className="flex gap-2">
        <BotonAccion className="boton boton-principal" ocupadoTexto="Abriendo…" onClick={async () => {
          const r = await abrirCaja(libre.caja_id, monto || "0");
          if (r.error) setError(r.error); else { setError(null); router.refresh(); }
        }}><Icono nombre="candado-abierto" /> Abrir turno</BotonAccion>
        <button type="button" className="boton" onClick={() => setAbriendo(false)}>Cancelar</button>
      </div>
    </form>
  );
}
