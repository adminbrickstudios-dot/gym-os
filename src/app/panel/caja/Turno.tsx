"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalculadoraBilletes } from "@/components/panel/CalculadoraBilletes";
import { linkCompartir, textoCierre } from "@/lib/caja";
import { formatearPesos } from "@/lib/formato";
import { abrirCaja, cerrarCaja, moverCaja, type Resumen } from "./acciones";
import { PorMedio } from "./PorMedio";
import type { Billetes, CobrosMedio } from "./tipos";
import { Icono } from "@/components/ui/Icono";

const MEDIO: Record<string, string> = { transferencia: "Transferencia", debito: "Débito", credito: "Crédito", mercadopago: "MercadoPago", cuenta_corriente: "A cuenta" };

export function AbrirCaja({ cajaId, nombre, fondoSugerido = 0 }: { cajaId: string; nombre: string; fondoSugerido?: number }) {
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <form className="tarjeta p-6 space-y-4 max-w-md" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await abrirCaja(cajaId, monto || "0"); setError(r.error ?? null); }); }}>
      <p className="titulo text-2xl"><Icono nombre="candado" /> {nombre} está cerrada</p>
      <label className="block space-y-2">
        <span className="etiqueta">¿Con cuánta plata arrancás?</span>
        <input className="campo !text-xl" inputMode="decimal" placeholder="$ 0" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
      </label>
      {/* VD-9: el fondo sugerido (el fondo fijo o lo que dejó el turno anterior); se confirma con un toque, no se pone solo. */}
      {fondoSugerido > 0 && (
        <button type="button" className="boton boton-chico" data-fondo-sugerido onClick={() => setMonto(String(fondoSugerido).replace(".", ","))}>
          Usar {formatearPesos(fondoSugerido)} (lo que quedó en el cajón)
        </button>
      )}
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
      <button type="submit" disabled={ocupado} className="boton boton-principal w-full text-lg">{ocupado ? "Abriendo la caja…" : <><Icono nombre="candado-abierto" /> Abrir caja</>}</button>
    </form>
  );
}

export function TurnoAbierto({ turnoId, cajaId, nombre, desde, resumen, cobros = null, olvidada = false, vencida = false, pedirBilletes = false, zona }: {
  turnoId: string; cajaId: string; nombre: string; desde: string; resumen: Resumen | null; cobros?: CobrosMedio[] | null; olvidada?: boolean; vencida?: boolean; pedirBilletes?: boolean;
  /** La zona horaria del gimnasio: la hora del cierre que se manda por WhatsApp sale en ella, no en la de la compu. */
  zona: string;
}) {
  const [modo, setModo] = useState<"nada" | "ingreso" | "retiro" | "cerrar" | "nuevo">("nada");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cierre, setCierre] = useState<Resumen | null>(null);
  const [cobrosCierre, setCobrosCierre] = useState<CobrosMedio[] | null>(null);
  const [conBilletes, setConBilletes] = useState(false);
  const [billetes, setBilletes] = useState<Billetes | null>(null);
  const [ocupado, empezar] = useTransition();
  const router = useRouter();
  const reiniciar = () => { setModo("nada"); setMonto(""); setMotivo(""); setError(null); setConBilletes(false); setBilletes(null); };
  const usaCalculadora = conBilletes || pedirBilletes;

  if (cierre) {
    const dif = cierre.diferencia ?? 0;
    return (
      <section className="tarjeta p-6 sm:p-8 max-w-xl" aria-live="polite">
        <p className="text-5xl" aria-hidden><Icono nombre={dif === 0 ? "ok" : dif > 0 ? "info" : "alerta"} /></p>
        <p className="titular text-5xl mt-4">{dif === 0 ? "Caja justa" : dif > 0 ? `Sobran ${formatearPesos(dif)}` : `Faltan ${formatearPesos(-dif)}`}</p>
        <dl className="grid grid-cols-2 gap-4 mt-6">
          <div><dt className="texto-tenue text-sm">Contaste</dt><dd className="numero text-3xl">{formatearPesos(cierre.contado)}</dd></div>
          <div><dt className="texto-tenue text-sm">Tenía que haber</dt><dd className="numero text-3xl">{formatearPesos(cierre.esperado)}</dd></div>
        </dl>
        <p className="texto-suave text-sm mt-3" data-dif-efectivo>La diferencia cuenta solo el efectivo: lo que contaste menos lo que tenía que haber en el cajón. La transferencia y la tarjeta no entran.</p>
        {cobrosCierre
          ? <div className="mt-6"><PorMedio medios={cobrosCierre} zona={zona} titulo="Lo cobrado en el turno, por medio" /></div>
          : <OtrosMedios r={cierre} />}
        <div className="flex flex-wrap gap-2 mt-8">
          <button type="button" className="boton boton-principal" onClick={() => router.refresh()}><Icono nombre="ok" /> Listo</button>
          {/* VD-9: el reporte del turno, con SOBRA / FALTA, para ver o mandar. */}
          <Link className="boton" data-ver-reporte href={`/panel/caja/reporte?turno=${cierre.turno_id}`}><Icono nombre="documento" /> Ver el reporte</Link>
          {/* CAJ-2: el cierre, escrito, para mandárselo al dueño. */}
          <a className="boton" data-compartir-cierre target="_blank" rel="noopener noreferrer"
            href={linkCompartir(textoCierre({ ...cierre, caja: nombre, cuando: `${desde.replace(/^Desde las /, "de ").replace(/ · la abrió .*/, "")} a ${new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date())}` }))}>
            <Icono nombre="celular" /> Mandar el cierre por WhatsApp</a>
        </div>
      </section>
    );
  }

  return (
    <section className="tarjeta p-6 sm:p-8 space-y-6">
      <div>
        <p className="titulo text-2xl"><Icono nombre="candado-abierto" /> {nombre} abierta</p>
        <p className="texto-suave">{desde}</p>
      </div>
      {/* CAJ-5: abierta de otro día o pasada la hora de cierre. */}
      {olvidada && !vencida && <p className="pildora pildora-amarillo !rounded-[var(--radio)] !px-4 !py-3 whitespace-normal" data-olvidada><Icono nombre="reloj" /> Esta caja quedó abierta. Contá la plata y cerrala: hasta que se cierre, quien la abrió no puede abrir otra.</p>}
      {/* VD-9 (D20): de otro día o pasadas las horas, ya figura sin contar: nadie cobra en ella. */}
      {vencida && (
        <div className="pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3 whitespace-normal space-y-3" data-olvidada data-sin-contar>
          <p><Icono nombre="reloj" /> Esta caja quedó abierta de otro día: figura <strong>sin contar</strong> y nadie puede cobrar en ella. Contá la plata y cerrala, o dejala para que la cuente el dueño y abrí tu turno.</p>
          {modo !== "nuevo" && <button type="button" className="boton boton-chico" onClick={() => { setModo("nuevo"); setMonto(""); setError(null); }}><Icono nombre="candado-abierto" /> Dejarla para el dueño y abrir mi turno</button>}
        </div>
      )}
      {vencida && modo === "nuevo" && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await abrirCaja(cajaId, monto || "0"); if (r.error) setError(r.error); }); }}>
          <p className="font-semibold">La caja de antes queda anotada como sin contar. ¿Con cuánta plata arrancás tu turno?</p>
          <input autoFocus className="campo !text-xl" inputMode="decimal" placeholder="$ 0" aria-label="Fondo del turno nuevo" value={monto} onChange={(e) => setMonto(e.target.value)} />
          {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
          <div className="flex gap-2"><button type="submit" disabled={ocupado} className="boton boton-principal">{ocupado ? "Abriendo…" : "Abrir mi turno"}</button><button type="button" className="boton" onClick={reiniciar}>Cancelar</button></div>
        </form>
      )}
      {resumen && cobros ? (
        <PorMedio medios={cobros} zona={zona} cajon={{ esperado: resumen.esperado, inicial: resumen.monto_inicial, efectivo: resumen.efectivo, ingresos: resumen.ingresos, retiros: resumen.retiros }} />
      ) : resumen ? (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><dt className="texto-tenue text-sm">Inicial</dt><dd className="numero text-2xl">{formatearPesos(resumen.monto_inicial)}</dd></div>
          <div><dt className="texto-tenue text-sm"><Icono nombre="plata" /> Cobrado en efectivo</dt><dd className="numero text-2xl">{formatearPesos(resumen.efectivo)}</dd></div>
          <div><dt className="texto-tenue text-sm">Ingresos − retiros</dt><dd className="numero text-2xl">{formatearPesos(resumen.ingresos - resumen.retiros)}</dd></div>
          <div><dt className="texto-tenue text-sm">Tiene que haber</dt><dd className="numero text-3xl" style={{ color: "var(--acento)" }}>{formatearPesos(resumen.esperado)}</dd></div>
        </dl>
      ) : (
        <p className="texto-suave"><Icono nombre="persona" /> Al cerrar contás la plata y recién ahí ves cuánto tenía que haber.</p>
      )}
      {resumen && !cobros && <OtrosMedios r={resumen} />}

      {modo === "nada" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton" onClick={() => setModo("ingreso")}><Icono nombre="mas" /> Entra plata</button>
          <button type="button" className="boton" onClick={() => setModo("retiro")}><Icono nombre="menos" /> Sale plata</button>
          <button type="button" className="boton boton-principal" onClick={() => setModo("cerrar")}><Icono nombre="candado" /> Cerrar caja</button>
          {resumen && <Link className="boton" data-reporte-x href={`/panel/caja/reporte?turno=${turnoId}`}><Icono nombre="lista" /> Reporte del turno</Link>}
        </div>
      )}
      {(modo === "ingreso" || modo === "retiro") && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); empezar(async () => { const r = await moverCaja(turnoId, modo, monto, motivo, modo === "retiro" ? f : null); if (r.error) setError(r.error); else reiniciar(); }); }}>
          <p className="font-semibold">{modo === "ingreso" ? "Entra plata a la caja" : "Sale plata de la caja"}</p>
          <div className="grid sm:grid-cols-[160px_1fr] gap-2">
            <input autoFocus className="campo" inputMode="decimal" placeholder="$" value={monto} onChange={(e) => setMonto(e.target.value)} />
            <input className="campo" placeholder={modo === "ingreso" ? "Motivo (ej: cambio)" : "Motivo (ej: pago al proveedor)"} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          {modo === "retiro" && (
            <label className="flex flex-wrap items-center gap-2 text-sm texto-suave"><Icono nombre="camara" /> Foto del ticket (opcional)
              <input type="file" name="ticket" accept="image/jpeg,image/png,image/webp" capture="environment" className="text-sm" aria-label="Foto del ticket" />
            </label>
          )}
          {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
          <div className="flex gap-2"><button type="submit" disabled={ocupado} className="boton boton-principal">{ocupado ? "Anotando…" : "Anotar"}</button><button type="button" className="boton" onClick={reiniciar}>Cancelar</button></div>
        </form>
      )}
      {modo === "cerrar" && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await cerrarCaja(turnoId, monto, motivo, usaCalculadora ? billetes : null); if (r.error) setError(r.error); else { setCobrosCierre(r.cobros ?? null); setCierre(r.resumen!); } }); }}>
          <p className="font-semibold">Contá la plata del cajón y escribí cuánto hay.</p>
          <input autoFocus className="campo !text-2xl !min-h-16" inputMode="decimal" placeholder="$ contado" value={monto} onChange={(e) => setMonto(e.target.value)} readOnly={usaCalculadora} />
          {/* VD-9: la calculadora es opcional (el gimnasio puede exigirla); el total sale solo y la base lo vuelve a sumar. */}
          {!pedirBilletes && <button type="button" className="boton boton-chico" aria-pressed={conBilletes} onClick={() => { setConBilletes(!conBilletes); setBilletes(null); setMonto(""); }}>{conBilletes ? "Escribir el total yo" : "Contar billetes"}</button>}
          {usaCalculadora && <CalculadoraBilletes alCambiar={(total, detalle) => { setMonto(String(total).replace(".", ",")); setBilletes(detalle); }} />}
          <input className="campo" placeholder="Nota (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
          <div className="flex gap-2"><button type="submit" disabled={ocupado || !monto} className="boton boton-principal">{ocupado ? "Cerrando la caja…" : <><Icono nombre="candado" /> Cerrar con este monto</>}</button><button type="button" className="boton" onClick={reiniciar}>Cancelar</button></div>
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
