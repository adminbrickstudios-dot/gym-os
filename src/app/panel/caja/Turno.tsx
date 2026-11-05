"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { linkCompartir, textoCierre } from "@/lib/caja";
import { formatearPesos } from "@/lib/formato";
import { abrirCaja, cerrarCaja, moverCaja, type Resumen } from "./acciones";

const MEDIO: Record<string, string> = { transferencia: "🏦 Transferencia", debito: "💳 Débito", credito: "💳 Crédito", mercadopago: "📲 MercadoPago", cuenta_corriente: "📒 A cuenta" };

export function AbrirCaja({ cajaId, nombre }: { cajaId: string; nombre: string }) {
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <form className="tarjeta p-6 space-y-4 max-w-md" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await abrirCaja(cajaId, monto || "0"); setError(r.error ?? null); }); }}>
      <p className="titulo text-2xl">🔒 {nombre} está cerrada</p>
      <label className="block space-y-2">
        <span className="etiqueta">¿Con cuánta plata arrancás?</span>
        <input className="campo !text-xl" inputMode="decimal" placeholder="$ 0" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
      </label>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
      <button type="submit" disabled={ocupado} className="boton boton-principal w-full text-lg">🔓 Abrir caja</button>
    </form>
  );
}

export function TurnoAbierto({ turnoId, nombre, desde, resumen }: { turnoId: string; nombre: string; desde: string; resumen: Resumen | null }) {
  const [modo, setModo] = useState<"nada" | "ingreso" | "retiro" | "cerrar">("nada");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cierre, setCierre] = useState<Resumen | null>(null);
  const [ocupado, empezar] = useTransition();
  const router = useRouter();
  const reiniciar = () => { setModo("nada"); setMonto(""); setMotivo(""); setError(null); };

  if (cierre) {
    const dif = cierre.diferencia ?? 0;
    return (
      <section className="tarjeta p-6 sm:p-8 max-w-xl" aria-live="polite">
        <p className="text-5xl" aria-hidden>{dif === 0 ? "✅" : dif > 0 ? "➕" : "⚠️"}</p>
        <p className="titular text-5xl mt-4">{dif === 0 ? "Caja justa" : dif > 0 ? `Sobran ${formatearPesos(dif)}` : `Faltan ${formatearPesos(-dif)}`}</p>
        <dl className="grid grid-cols-2 gap-4 mt-6">
          <div><dt className="texto-tenue text-sm">Contaste</dt><dd className="numero text-3xl">{formatearPesos(cierre.contado)}</dd></div>
          <div><dt className="texto-tenue text-sm">Tenía que haber</dt><dd className="numero text-3xl">{formatearPesos(cierre.esperado)}</dd></div>
        </dl>
        <OtrosMedios r={cierre} />
        <div className="flex flex-wrap gap-2 mt-8">
          <button type="button" className="boton boton-principal" onClick={() => router.refresh()}>👍 Listo</button>
          {/* CAJ-2: el cierre, escrito, para mandárselo al dueño. */}
          <a className="boton" data-compartir-cierre target="_blank" rel="noopener noreferrer"
            href={linkCompartir(textoCierre({ ...cierre, caja: nombre, cuando: `${desde.replace(/^Desde las /, "de ").replace(/ · la abrió .*/, "")} a ${new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date())}` }))}>
            📲 Mandar el cierre por WhatsApp</a>
        </div>
      </section>
    );
  }

  return (
    <section className="tarjeta p-6 sm:p-8 space-y-6">
      <div>
        <p className="titulo text-2xl">🔓 {nombre} abierta</p>
        <p className="texto-suave">{desde}</p>
      </div>
      {resumen ? (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><dt className="texto-tenue text-sm">Inicial</dt><dd className="numero text-2xl">{formatearPesos(resumen.monto_inicial)}</dd></div>
          <div><dt className="texto-tenue text-sm">💵 Cobrado en efectivo</dt><dd className="numero text-2xl">{formatearPesos(resumen.efectivo)}</dd></div>
          <div><dt className="texto-tenue text-sm">Ingresos − retiros</dt><dd className="numero text-2xl">{formatearPesos(resumen.ingresos - resumen.retiros)}</dd></div>
          <div><dt className="texto-tenue text-sm">Tiene que haber</dt><dd className="numero text-3xl" style={{ color: "var(--acento)" }}>{formatearPesos(resumen.esperado)}</dd></div>
        </dl>
      ) : (
        <p className="texto-suave">🙈 Al cerrar contás la plata y recién ahí ves cuánto tenía que haber.</p>
      )}
      {resumen && <OtrosMedios r={resumen} />}

      {modo === "nada" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton" onClick={() => setModo("ingreso")}>➕ Entra plata</button>
          <button type="button" className="boton" onClick={() => setModo("retiro")}>➖ Sale plata</button>
          <button type="button" className="boton boton-principal" onClick={() => setModo("cerrar")}>🔒 Cerrar caja</button>
        </div>
      )}
      {(modo === "ingreso" || modo === "retiro") && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await moverCaja(turnoId, modo, monto, motivo); if (r.error) setError(r.error); else reiniciar(); }); }}>
          <p className="font-semibold">{modo === "ingreso" ? "➕ Entra plata a la caja" : "➖ Sale plata de la caja"}</p>
          <div className="grid sm:grid-cols-[160px_1fr] gap-2">
            <input autoFocus className="campo" inputMode="decimal" placeholder="$" value={monto} onChange={(e) => setMonto(e.target.value)} />
            <input className="campo" placeholder={modo === "ingreso" ? "Motivo (ej: cambio)" : "Motivo (ej: pago al proveedor)"} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
          <div className="flex gap-2"><button type="submit" disabled={ocupado} className="boton boton-principal">Anotar</button><button type="button" className="boton" onClick={reiniciar}>Cancelar</button></div>
        </form>
      )}
      {modo === "cerrar" && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await cerrarCaja(turnoId, monto, motivo); if (r.error) setError(r.error); else setCierre(r.resumen!); }); }}>
          <p className="font-semibold">Contá la plata del cajón y escribí cuánto hay.</p>
          <input autoFocus className="campo !text-2xl !min-h-16" inputMode="decimal" placeholder="$ contado" value={monto} onChange={(e) => setMonto(e.target.value)} />
          <input className="campo" placeholder="Nota (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
          <div className="flex gap-2"><button type="submit" disabled={ocupado || !monto} className="boton boton-principal">🔒 Cerrar con este monto</button><button type="button" className="boton" onClick={reiniciar}>Cancelar</button></div>
        </form>
      )}
    </section>
  );
}

function OtrosMedios({ r }: { r: Resumen }) {
  const otros = Object.entries(r.otros_medios ?? {});
  if (!otros.length) return null;
  return (
    <p className="texto-suave mt-4">Además, en este turno: {otros.map(([m, t]) => `${MEDIO[m] ?? m} ${formatearPesos(t)}`).join(" · ")}</p>
  );
}
