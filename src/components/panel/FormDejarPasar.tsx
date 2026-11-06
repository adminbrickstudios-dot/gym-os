"use client";
// VD-8 (D19) · "Dejar pasar" en la Entrada (la ventana flotante y la pantalla). Motivo, "promete pagar el …" y, según el
// modo que eligió el dueño (Configuración → Cobros), el PIN del dueño o del encargado. La base decide y vuelve a validar todo.
import { useMemo, useState } from "react";
import type { CupoDejarPasar, PromesaPago } from "@/app/panel/entrada/acciones";

const MOTIVOS = ["Paga mañana", "Paga a la tarde", "Se olvidó la plata", "Clase de prueba", "Autorizado por el dueño"];
const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sumar = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return dia(d); };
const corto = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

/** Cuántos días faltan hasta ese día (en la fecha de esta compu; la base lo vuelve a contar con la hora del gimnasio). */
const diasHasta = (iso: string) => Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${dia(new Date())}T00:00:00`).getTime()) / 86_400_000);

export function FormDejarPasar({ motivo, setMotivo, cupo, ocupado, porPlata, alConfirmar }: {
  motivo: string; setMotivo: (m: string) => void; cupo: CupoDejarPasar | null; ocupado: boolean;
  /** Lo que lo frena es una deuda: ahí rige el modo de D19 y se pide el día que promete pagar. */
  porPlata: boolean; alConfirmar: (promesa: PromesaPago) => void;
}) {
  const modo = cupo?.modo ?? "libre";
  const sinTope = !!cupo?.sin_tope;                         // dueño o encargado: no pide nada
  const [fecha, setFecha] = useState<string>("");
  const [pin, setPin] = useState("");
  const [verOtro, setVerOtro] = useState(false);

  const dias = fecha ? diasHasta(fecha) : null;
  const agotado = !!cupo && !sinTope && cupo.usados >= cupo.tope;
  const pidePromesa = porPlata && !sinTope && modo === "recepcion_hasta_dias";
  const pidePin = !sinTope && (agotado || (porPlata && (modo === "siempre_pin" || (modo === "recepcion_hasta_dias" && dias != null && dias > (cupo?.dias_max ?? 3)))));
  const pinListo = /^\d{4}$/.test(pin);
  const lista = useMemo(() => [["Hoy", sumar(0)], ["Mañana", sumar(1)], ["En 3 días", sumar(3)], ["En una semana", sumar(7)]] as const, []);
  const falta = !motivo.trim() || (pidePromesa && !fecha) || (pidePin && !pinListo) || (dias != null && dias < 0);

  return (
    <form className="mt-5 space-y-3" data-dejar-pasar data-modo={modo} onSubmit={(e) => { e.preventDefault(); if (!falta && !ocupado) alConfirmar({ prometePagarEl: porPlata && fecha ? fecha : null, pin: pidePin ? pin : null }); }}>
      <div className="flex flex-wrap gap-2" aria-label="Motivos frecuentes">
        {MOTIVOS.map((m) => <button key={m} type="button" className={`pestana ${motivo === m ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`} onClick={() => setMotivo(m)}>{m}</button>)}
      </div>
      <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} className="campo" placeholder="¿Por qué lo dejás pasar? (queda anotado)" aria-label="Motivo para dejar pasar" />

      {porPlata && (
        <div className="space-y-2" data-promete-pagar>
          <p className="font-semibold">Promete pagar el…{!pidePromesa && <span className="texto-tenue font-normal"> (opcional)</span>}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Día que promete pagar">
            {lista.map(([t, f]) => (
              <button key={t} type="button" aria-pressed={fecha === f} className={`pestana ${fecha === f ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`} onClick={() => { setFecha(f); setVerOtro(false); }}>{t} <span className="opacity-70">{corto(f)}</span></button>
            ))}
            <button type="button" aria-pressed={verOtro} className={`pestana ${verOtro ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`} onClick={() => setVerOtro(true)}>Otro día</button>
            {fecha && !pidePromesa && <button type="button" className="boton-texto px-2" onClick={() => { setFecha(""); setVerOtro(false); }}>Sin fecha</button>}
          </div>
          {verOtro && <input type="date" className="campo !w-auto" min={sumar(0)} max={sumar(90)} value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Otro día en que promete pagar" />}
          {modo === "recepcion_hasta_dias" && !sinTope && (
            <p className="text-sm texto-suave" data-promesa-tope>
              {dias != null && dias > (cupo?.dias_max ?? 3)
                ? `Son ${dias} días y la recepción deja pasar hasta ${cupo?.dias_max ?? 3}: lo autoriza el dueño o el encargado con su PIN.`
                : `La recepción deja pasar si paga dentro de ${cupo?.dias_max ?? 3} día${(cupo?.dias_max ?? 3) === 1 ? "" : "s"}; más lejos pide el PIN del dueño o del encargado.`}
            </p>
          )}
          {modo === "siempre_pin" && !sinTope && <p className="text-sm texto-suave">En este gimnasio dejar pasar sin pagar lo autoriza el dueño o el encargado con su PIN.</p>}
        </div>
      )}

      {pidePin && (
        <div className="space-y-1" data-pin-dueno>
          <label className="block space-y-1 max-w-xs">
            <span className="etiqueta">PIN del dueño o del encargado</span>
            <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} className="campo" value={pin} aria-label="PIN del dueño o del encargado"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </label>
          {cupo?.hay_pines === false && <p className="text-sm texto-suave">Nadie del dueño o del encargado cargó su PIN todavía: que entre con su sesión o lo cargue en “Mi PIN”.</p>}
          <p className="text-sm texto-suave">Vale solo para esta entrada y queda anotado a su nombre.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={falta || ocupado} className="boton boton-peligro">Dejar pasar</button>
      </div>
      {cupo && !sinTope && (
        <p className="text-sm texto-suave" data-cupo={cupo.tope - cupo.usados}>
          {agotado ? `Ya dejaste pasar a ${cupo.usados} hoy (el tope es ${cupo.tope}): que lo autorice el dueño o el encargado con su PIN.`
            : `Te ${cupo.tope - cupo.usados === 1 ? "queda" : "quedan"} ${cupo.tope - cupo.usados} de ${cupo.tope} hoy. Lo ve el dueño.`}
        </p>
      )}
    </form>
  );
}
