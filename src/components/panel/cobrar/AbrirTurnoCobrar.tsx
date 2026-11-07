"use client";
// VD-49 (D32) · Cobrar en efectivo sin turno: se abre el turno ACÁ, en la misma hoja, con el fondo, y se sigue con
// el cobro sin perder lo cargado. El efectivo cae en la caja de quien cobra (con PIN, la de esa persona): lo decide
// la base (vender → sin_caja / caja_ajena); esta pieza solo ofrece abrirla.
import Link from "next/link";
import { useState } from "react";
import { abrirCaja } from "@/app/panel/caja/acciones";
import type { CajaCobro } from "@/app/panel/vender/acciones";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { formatearPesos, leerMonto } from "@/lib/formato";

export function AbrirTurnoCobrar({ caja, alAbrir }: { caja: CajaCobro; alAbrir: (turnoId: string, nombreCaja: string) => void }) {
  const [cajaId, setCajaId] = useState(caja.libres[0]?.caja_id ?? "");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const libre = caja.libres.find((l) => l.caja_id === cajaId) ?? caja.libres[0];
  const escrito = monto.trim() === "" ? null : leerMonto(monto);
  // VD-9E: si el fondo no coincide con lo que dejó el turno anterior se avisa (no se frena: puede ser a propósito).
  const deja = libre?.dejo_anterior != null ? Number(libre.dejo_anterior) : null;
  const noCoincide = deja != null && escrito != null && !Number.isNaN(escrito) && Math.abs(escrito - deja) > 0.009;

  // No hay con qué abrir: hay que resolverlo en Caja (otra sede con turno, o todas las cajas ocupadas).
  if (caja.otra_sede || !libre) {
    return (
      <div className="pildora pildora-amarillo !rounded-2xl !px-4 !py-3 w-full whitespace-normal" data-cobrar-sin-caja="bloqueada">
        <p>💵 Para cobrar en efectivo necesitás tu turno de caja abierto en esta sede.</p>
        <p className="text-sm mt-1">
          {caja.otra_sede ? <>Tenés un turno abierto en {caja.otra_sede}: cerralo antes de abrir otro.</> : <>No hay una caja libre para abrir ahora.</>}
          {" "}<Link href="/panel/caja" className="underline">Ir a Caja</Link>. Mientras, podés cobrar con otro medio.
        </p>
      </div>
    );
  }

  return (
    <form className="tarjeta p-3 space-y-3" data-cobrar-sin-caja="abrir" onSubmit={(e) => e.preventDefault()}>
      <div>
        <p className="font-semibold">💵 Para cobrar en efectivo abrí tu turno</p>
        <p className="texto-suave text-sm">
          {caja.vencido ? "Tu turno anterior quedó abierto de otro día: se cierra sin contar y el dueño lo revisa. " : ""}
          El efectivo queda en tu caja. Después seguís con este cobro.
        </p>
      </div>
      {caja.libres.length > 1 && (
        <select className="campo !min-h-11" aria-label="Qué caja" value={libre.caja_id} onChange={(e) => setCajaId(e.target.value)}>
          {caja.libres.map((l) => <option key={l.caja_id} value={l.caja_id}>{l.nombre}</option>)}
        </select>
      )}
      <label className="block space-y-1">
        <span className="etiqueta">¿Con cuánta plata arrancás{caja.libres.length === 1 ? ` (${libre.nombre})` : ""}?</span>
        <input className="campo !min-h-11" inputMode="decimal" placeholder="$ 0" aria-label="Fondo del turno" value={monto} onChange={(e) => { setMonto(e.target.value); setError(null); }} />
      </label>
      {Number(libre.fondo_sugerido) > 0 && (
        <button type="button" className="boton !min-h-11" data-fondo-sugerido onClick={() => setMonto(String(libre.fondo_sugerido).replace(".", ","))}>
          Usar {formatearPesos(libre.fondo_sugerido)} (lo que quedó en el cajón)
        </button>
      )}
      {noCoincide && (
        <p className="text-sm pildora pildora-amarillo whitespace-normal" data-fondo-aviso>
          ⚠️ El turno anterior dejó {formatearPesos(deja!)} en el cajón y abrís con {formatearPesos(escrito!)}. Si es a propósito, abrí igual.
        </p>
      )}
      {error && <p role="alert" className="text-sm pildora pildora-rojo whitespace-normal">⚠️ {error}</p>}
      <BotonAccion className="boton !min-h-11 w-full" data-abrir-turno ocupadoTexto="Abriendo…" onClick={async () => {
        if (monto.trim() !== "" && (escrito == null || Number.isNaN(escrito))) { setError("No entiendo el monto: escribilo como 84.500 o 84500,50"); return; }
        const r = await abrirCaja(libre.caja_id, monto.trim() === "" ? "0" : monto);
        if (r.error || !r.turnoId) { setError(r.error ?? "No se pudo abrir el turno"); return; }
        setError(null);
        alAbrir(r.turnoId, libre.nombre);
      }}>🔓 Abrir mi turno</BotonAccion>
    </form>
  );
}
