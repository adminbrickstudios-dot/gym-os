"use client";
// VD-46B · Suspender o expulsar desde la ficha. Recepción suspende; expulsar y levantar es del dueño o el encargado.
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { anularCortesia, darCortesia, levantarSuspension, registrarDevolucion, revisarSuspension, suspenderSocio, type CalculoDevolucion } from "../moderacion-acciones";
import { formatearPesos, leerMonto } from "@/lib/formato";
import { Icono } from "@/components/ui/Icono";

// ── VD-46J · Devolución al dar de baja ──────────────────────────────
const MEDIOS_DEVOLUCION: [string, string][] = [["efectivo", "Efectivo (sale de mi caja)"], ["transferencia", "Transferencia"], ["mercadopago", "MercadoPago"], ["otro", "Otro medio"], ["ninguno", "No se devuelve"]];

export function DevolucionBaja({ socioId, calculo: c, zona }: { socioId: string; calculo: CalculoDevolucion; zona: string }) {
  const [abierto, setAbierto] = useState(false);
  const [medio, setMedio] = useState("efectivo");
  const [monto, setMonto] = useState(String(c.total ?? 0).replace(".", ","));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const f = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit" }).format(new Date(m));
  if (!c.hay || c.ya_registrada) return null;
  if (c.total == null) {
    return <p className="mensaje mensaje-aviso" data-devolucion-baja><Icono nombre="deshacer" /> <span>Tenía períodos pagados por adelantado: la devolución la decide el dueño o el encargado.</span></p>;
  }
  const montoNum = medio === "ninguno" ? 0 : leerMonto(monto);
  const valido = medio === "ninguno" || (Number.isFinite(montoNum) && montoNum > 0 && montoNum <= (c.total ?? 0));
  const guardar = async () => { const r = await registrarDevolucion(socioId, medio, montoNum, motivo); if (r.error) setError(r.error); else setAbierto(false); };
  return (
    <div className="tarjeta p-4 space-y-3" data-devolucion-baja>
      <p className="font-semibold"><Icono nombre="deshacer" /> Devolución por cuota adelantada: {formatearPesos(c.total)}</p>
      <ul className="text-sm texto-suave space-y-1">
        {(c.lineas ?? []).map((l) => (
          <li key={l.cobertura_id}>{l.concepto} del {f(l.desde)} al {f(l.hasta)}: pagó {formatearPesos(l.pagado)}{l.empezado ? `, le quedaban ${l.dias_sin_usar} de ${l.dias_total} días` : " (todavía no empezó)"} → {formatearPesos(l.a_devolver)}{l.medios ? ` · pagó con ${l.medios}` : ""}</li>
        ))}
      </ul>
      <p className="texto-tenue text-sm">Se registra como un hecho nuevo con motivo: el pago original no se toca. Regla del gimnasio: {c.modo === "proporcional" ? "proporcional a los días sin usar" : "solo los períodos que todavía no empezaron"}.</p>
      {!c.puede_registrar ? <p className="texto-suave text-sm">La registra el dueño o el encargado.</p>
        : !abierto ? <button type="button" className="boton boton-principal" data-devolucion-abrir onClick={() => setAbierto(true)}>Registrar la devolución</button>
        : (
          <div className="space-y-3">
            <label className="block"><span className="font-semibold">Cómo se devuelve</span>
              <select className="campo mt-1" value={medio} onChange={(e) => { setMedio(e.target.value); if (e.target.value === "ninguno") setMonto("0"); else if (monto === "0") setMonto(String(c.total).replace(".", ",")); }} aria-label="Medio de la devolución">
                {MEDIOS_DEVOLUCION.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select></label>
            {medio !== "ninguno" && (
              <label className="block"><span className="font-semibold">Monto (hasta {formatearPesos(c.total)})</span>
                <input className="campo mt-1" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} aria-label="Monto a devolver" /></label>
            )}
            <label className="block"><span className="font-semibold">Motivo (queda anotado con tu nombre)</span>
              <input className="campo mt-1" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: se mudó a otra ciudad" aria-label="Motivo de la devolución" /></label>
            {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
            <div className="flex flex-wrap gap-2">
              <BotonAccion className="boton boton-principal" disabled={!valido || motivo.trim().length < 3} onClick={guardar}>{medio === "ninguno" ? "Dejar asentado: no se devuelve" : "Registrar la devolución"}</BotonAccion>
              <button type="button" className="boton" onClick={() => { setAbierto(false); setError(null); }}>Cancelar</button>
            </div>
          </div>
        )}
    </div>
  );
}

// ── VD-46C · Cortesías ──────────────────────────────────────────────
export type DatosCortesias = {
  rol: string; tiene_membresia: boolean; tope_dias: number; tope_mes: number | null; usados_mes: number; puede_dar: boolean; puede_anular: boolean;
  recientes_60_dias: number; alerta_desde: number; motivos: { id: string; nombre: string }[];
  cortesias: { id: string; desde: string; hasta: string; dias: number; motivo: string; por: string | null; en: string; anulada: boolean; anulada_motivo: string | null }[];
};

export function Cortesias({ socioId, datos: d, zona }: { socioId: string; datos: DatosCortesias; zona: string }) {
  const [abierto, setAbierto] = useState(false);
  const [dias, setDias] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const [anulando, setAnulando] = useState<string | null>(null);
  const [porque, setPorque] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cerrar = () => { setAbierto(false); setAnulando(null); setMotivo(""); setNota(""); setPorque(""); setDias(1); setError(null); };
  const correr = async (fn: () => Promise<{ error?: string }>) => { const r = await fn(); if (r.error) setError(r.error); else cerrar(); };
  const f = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit" }).format(new Date(m));
  const vigentes = d.cortesias.filter((c) => !c.anulada);
  if (!d.tiene_membresia && d.cortesias.length === 0) return null;
  return (
    <div className="mt-4 space-y-3" data-cortesias={vigentes.length}>
      {d.recientes_60_dias >= d.alerta_desde && (
        <Mensaje tipo="aviso"><p className="text-sm"><Icono nombre="regalo" /> Ya le dieron {d.recientes_60_dias} cortesías en los últimos 60 días: hablalo con el dueño antes de darle otra.</p></Mensaje>
      )}
      {!abierto ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {d.puede_dar
            ? <button type="button" className="boton boton-chico texto-suave" data-cortesia-abrir onClick={() => setAbierto(true)}><Icono nombre="regalo" /> Dar una cortesía</button>
            : <span className="texto-tenue text-sm" data-cortesia-sin-cupo><Icono nombre="regalo" /> {!d.tiene_membresia ? "Sin membresía: no se le puede dar una cortesía." : d.tope_dias === 0 ? "Tu rol no da cortesías." : "Ya usaste los días de cortesía de este mes."}</span>}
          {d.tope_mes != null && d.puede_dar && <span className="texto-tenue text-sm">Este mes diste {d.usados_mes} de {d.tope_mes} días</span>}
        </div>
      ) : (
        <div className="tarjeta p-4 space-y-3" data-cortesia-form>
          <p className="font-semibold">Dar días de cortesía</p>
          <p className="texto-suave text-sm">Empieza hoy (o cuando termina lo que ya tiene cubierto). Hasta {d.tope_dias} {d.tope_dias === 1 ? "día" : "días"} por cortesía{d.tope_mes != null ? `; este mes te quedan ${Math.max(0, d.tope_mes - d.usados_mes)}` : ""}.</p>
          <label className="block"><span className="font-semibold">Días</span>
            <select className="campo mt-1" value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Días de cortesía">
              {Array.from({ length: Math.min(d.tope_dias, d.tope_mes != null ? Math.max(1, d.tope_mes - d.usados_mes) : 31) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? "día" : "días"}</option>)}
            </select></label>
          <label className="block"><span className="font-semibold">Motivo (de la lista)</span>
            <select className="campo mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo de la cortesía">
              <option value="">Elegí el motivo</option>
              {d.motivos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select></label>
          <label className="block"><span className="font-semibold">Nota (opcional)</span>
            <input className="campo mt-1" value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} /></label>
          {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
          <div className="flex flex-wrap gap-2">
            <BotonAccion className="boton boton-principal" disabled={!motivo} onClick={() => correr(() => darCortesia(socioId, dias, motivo, nota))}><Icono nombre="regalo" /> Dar la cortesía</BotonAccion>
            <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
          </div>
        </div>
      )}
      {d.cortesias.length > 0 && (
        <ul className="space-y-1 text-sm">
          {d.cortesias.map((c) => (
            <li key={c.id} className={c.anulada ? "texto-tenue line-through" : "texto-suave"} data-cortesia={c.anulada ? "anulada" : "vigente"}>
              <Icono nombre="regalo" /> {c.dias} {c.dias === 1 ? "día" : "días"} del {f(c.desde)} al {f(c.hasta)} · {c.motivo}{c.por ? ` · ${c.por}` : ""}{c.anulada ? ` · anulada: ${c.anulada_motivo ?? ""}` : ""}
              {!c.anulada && d.puede_anular && (anulando === c.id ? (
                <span className="block mt-1 space-y-2 no-underline" data-anular-cortesia>
                  <input className="campo" placeholder="¿Por qué se anula?" value={porque} onChange={(e) => setPorque(e.target.value)} maxLength={300} aria-label="Motivo de la anulación" />
                  {error && <span role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</span>}
                  <span className="flex gap-2">
                    <BotonAccion className="boton boton-chico" disabled={porque.trim().length < 3} onClick={() => correr(() => anularCortesia(socioId, c.id, porque))}>Anular</BotonAccion>
                    <button type="button" className="boton boton-chico" onClick={cerrar}>Cancelar</button>
                  </span>
                </span>
              ) : <button type="button" className="boton-texto ml-2" onClick={() => { setAnulando(c.id); setError(null); }}>Anular</button>)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type DatosSuspension = {
  vigente: { id: string; tipo: "suspension" | "expulsion"; motivo: string; desde: string; hasta: string | null; revisar_en: string | null; por: string | null; revision_vencida: boolean } | null;
  historial: { id: string; tipo: string; motivo: string; desde: string; hasta: string | null; levantada_en: string | null; levantada_motivo: string | null; por: string | null }[];
  puede_suspender: boolean; puede_expulsar: boolean; puede_levantar: boolean;
};

const sumar = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const fecha = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(m));

export function Suspension({ socioId, datos: d, zona, hoy }: { socioId: string; datos: DatosSuspension; zona: string; hoy: string }) {
  const [abierto, setAbierto] = useState<null | "suspender" | "levantar" | "revisar">(null);
  const [tipo, setTipo] = useState<"suspension" | "expulsion">("suspension");
  const [motivo, setMotivo] = useState("");
  const [hasta, setHasta] = useState("");
  const [revisar, setRevisar] = useState(sumar(hoy, 30));
  const [error, setError] = useState<string | null>(null);
  const cerrar = () => { setAbierto(null); setMotivo(""); setHasta(""); setError(null); };
  const correr = async (fn: () => Promise<{ error?: string }>) => { const r = await fn(); if (r.error) setError(r.error); else cerrar(); };

  if (d.vigente) {
    const v = d.vigente;
    const nombre = v.tipo === "expulsion" ? "Expulsado" : "Suspendido";
    return (
      <div className="mt-4 space-y-3" data-suspension={v.tipo}>
        <Mensaje tipo="error">
          <p><strong><Icono nombre="prohibido" /> {nombre}</strong> desde el {fecha(v.desde, zona)}{v.por ? ` · lo cargó ${v.por}` : ""}{v.hasta ? ` · hasta el ${fecha(v.hasta, zona)}` : ""}</p>
          <p className="break-words">{v.motivo}</p>
          {v.revisar_en && <p className={`text-sm ${v.revision_vencida ? "font-semibold" : "texto-suave"}`}>{v.revision_vencida ? "Toca revisarla" : "Se revisa"} el {fecha(v.revisar_en, zona)}</p>}
          <p className="texto-suave text-sm">No entra por la puerta, ni con QR, ni como invitado.</p>
        </Mensaje>
        {d.puede_levantar ? (
          abierto === "levantar" ? (
            <div className="tarjeta p-4 space-y-3" data-levantar>
              <label className="block"><span className="font-semibold">¿Por qué se levanta?</span>
                <input className="campo mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} placeholder="Ej.: pidió disculpas y se habló" /></label>
              {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
              <div className="flex flex-wrap gap-2">
                <BotonAccion className="boton boton-principal" disabled={motivo.trim().length < 3} onClick={() => correr(() => levantarSuspension(socioId, v.id, motivo))}><Icono nombre="ok" /> Levantar</BotonAccion>
                <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
              </div>
            </div>
          ) : abierto === "revisar" ? (
            <div className="tarjeta p-4 space-y-3" data-revisar>
              <label className="block"><span className="font-semibold">La revisé y sigue: próxima revisión</span>
                <input type="date" className="campo mt-1" value={revisar} min={sumar(hoy, 1)} onChange={(e) => setRevisar(e.target.value)} /></label>
              {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
              <div className="flex flex-wrap gap-2">
                <BotonAccion className="boton boton-principal" onClick={() => correr(() => revisarSuspension(socioId, v.id, revisar))}>Guardar fecha</BotonAccion>
                <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="boton boton-principal" data-levantar-abrir onClick={() => setAbierto("levantar")}><Icono nombre="ok" /> Levantar {v.tipo === "expulsion" ? "la expulsión" : "la suspensión"}</button>
              <button type="button" className="boton" onClick={() => setAbierto("revisar")}><Icono nombre="calendario" /> La revisé, sigue</button>
            </div>
          )
        ) : <p className="texto-suave text-sm">La levanta el dueño o el encargado.</p>}
      </div>
    );
  }

  if (!d.puede_suspender) return null;
  if (abierto !== "suspender") {
    return (
      <p className="mt-4">
        <button type="button" className="boton boton-chico texto-suave" data-suspender-abrir onClick={() => setAbierto("suspender")}><Icono nombre="prohibido" /> Suspender</button>
        {d.historial.length > 0 && <span className="texto-tenue text-sm ml-3">Tuvo {d.historial.length} {d.historial.length === 1 ? "suspensión anterior" : "suspensiones anteriores"}</span>}
      </p>
    );
  }
  return (
    <div className="tarjeta p-4 mt-4 space-y-3" data-suspender>
      <p className="font-semibold">Suspender a este socio: no entra a ningún lado hasta que se levante</p>
      {d.puede_expulsar && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo">
          <button type="button" role="radio" aria-checked={tipo === "suspension"} className={`boton ${tipo === "suspension" ? "boton-principal" : ""}`} onClick={() => setTipo("suspension")}>Suspensión</button>
          <button type="button" role="radio" aria-checked={tipo === "expulsion"} className={`boton ${tipo === "expulsion" ? "boton-principal" : ""}`} onClick={() => { setTipo("expulsion"); setHasta(""); }}>Expulsión</button>
        </div>
      )}
      <label className="block"><span className="font-semibold">Motivo (queda anotado con tu nombre)</span>
        <input className="campo mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} placeholder="Ej.: pelea en el vestuario" /></label>
      {tipo === "suspension" && (
        <label className="block"><span className="font-semibold">Hasta cuándo (si lo sabés)</span>
          <input type="date" className="campo mt-1" value={hasta} min={sumar(hoy, 1)} onChange={(e) => setHasta(e.target.value)} /></label>
      )}
      <label className="block"><span className="font-semibold">Cuándo se revisa</span>
        <input type="date" className="campo mt-1" value={revisar} min={sumar(hoy, 1)} onChange={(e) => setRevisar(e.target.value)} /></label>
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
      <div className="flex flex-wrap gap-2">
        <BotonAccion className="boton boton-peligro" disabled={motivo.trim().length < 3} onClick={() => correr(() => suspenderSocio(socioId, motivo, tipo, hasta, revisar))}>
          <Icono nombre="prohibido" /> {tipo === "expulsion" ? "Expulsar" : "Suspender"}
        </BotonAccion>
        <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
      </div>
    </div>
  );
}
