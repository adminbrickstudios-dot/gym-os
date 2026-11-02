"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { colorVar, PuntoEstado } from "@/components/panel/Estado";
import { formatearPesos } from "@/lib/formato";
import { registrarEntrada, veredicto, type ResultadoIngreso, type Veredicto } from "./acciones";

const EMOJI: Record<string, string> = { verde: "✅", amarillo: "⚠️", naranja: "⚠️", rojo: "⛔", gris: "❔" };

/** La puerta: buscar, ver si puede entrar y por qué, y anotar la entrada. */
export function Puerta({ sedeId }: { sedeId: string }) {
  const [texto, setTexto] = useState("");
  const [socios, setSocios] = useState<ResultadoSocio[]>([]);
  const [elegido, setElegido] = useState<ResultadoSocio | null>(null);
  const [v, setV] = useState<Veredicto | null>(null);
  const [hecho, setHecho] = useState<ResultadoIngreso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forzando, setForzando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, empezar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => {
    if (texto.trim().length < 2) { setSocios([]); return; }
    const t = setTimeout(async () => {
      const r = await buscarSociosRapido(texto.trim());
      setSocios(r.socios ?? []);
      setError(r.error ?? null);
    }, 150);
    return () => clearTimeout(t);
  }, [texto]);

  const reiniciar = () => { setTexto(""); setSocios([]); setElegido(null); setV(null); setForzando(false); setMotivo(""); setTimeout(() => campo.current?.focus(), 0); };
  const elegir = (s: ResultadoSocio) => empezar(async () => {
    setElegido(s); setHecho(null); setError(null); setForzando(false);
    const r = await veredicto(s.socio_id, sedeId);
    if (r.error) setError(r.error); else setV(r.v!);
  });
  const anotar = (forzar?: string) => empezar(async () => {
    if (!elegido) return;
    const r = await registrarEntrada(elegido.socio_id, sedeId, forzar);
    if (r.error) { setError(r.error); return; }
    setHecho(r.r!);
    reiniciar();
  });

  return (
    <div className="space-y-5">
      <input
        ref={campo} value={texto} onChange={(e) => { setTexto(e.target.value); setElegido(null); setV(null); setHecho(null); }}
        onKeyDown={(e) => { if (e.key === "Enter" && socios[0] && !elegido) elegir(socios[0]); if (e.key === "Escape") reiniciar(); }}
        placeholder="🔍 Nombre, DNI o número de socio" className="campo !min-h-16 !text-xl" aria-label="Buscar socio" autoComplete="off"
      />

      {hecho && (
        <div role="status" className="tarjeta p-5 flex items-center gap-4" style={{ borderColor: colorVar(hecho.resultado === "rechazado" ? "rojo" : "verde") }}>
          <span className="text-3xl" aria-hidden>{hecho.resultado === "rechazado" ? "⛔" : "✅"}</span>
          <p className="text-lg font-semibold">
            {hecho.repetido ? "Ya estaba anotado hace un momento" : hecho.resultado === "forzado" ? "Entrada anotada (dejada pasar)" : hecho.resultado === "rechazado" ? "Anotado: no pudo entrar" : "Entrada anotada"}
          </p>
        </div>
      )}
      {error && <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3 w-full">⚠️ {error}</p>}

      {!elegido && socios.length > 0 && (
        <ul className="space-y-2">
          {socios.map((s) => (
            <li key={s.socio_id}>
              <button type="button" onClick={() => elegir(s)} className="tarjeta w-full text-left flex items-center gap-4 px-4 py-3 min-h-[68px] hover:bg-[var(--tarjeta-alta)]">
                <PuntoEstado color={s.color} grande />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-lg truncate">{s.nombre} <span className="texto-tenue font-normal">#{s.numero}</span></span>
                  <span className="block texto-suave truncate">{s.texto}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!elegido && texto.trim().length >= 2 && socios.length === 0 && !error && (
        <p className="texto-suave text-lg">No encontramos a “{texto.trim()}”. <Link href="/panel/socios/nuevo" className="underline">Darlo de alta</Link></p>
      )}

      {elegido && v && (
        <section aria-live="polite" className="rounded-[var(--radio-grande)] p-6 sm:p-8 border"
          style={{ background: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 84%)`, borderColor: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 55%)` }}>
          <p className="text-5xl" aria-hidden>{EMOJI[v.color] ?? "❔"}</p>
          <p className="titular text-5xl sm:text-6xl mt-4">{elegido.nombre}</p>
          <p className="text-2xl mt-3 font-semibold" style={{ color: `color-mix(in oklab, ${colorVar(v.color)}, var(--texto) 35%)` }}>{v.texto}</p>
          {v.avisos?.length ? <ul className="mt-3 space-y-1 texto-suave">{v.avisos.map((a) => <li key={a}>• {a}</li>)}</ul> : null}
          {v.para_regularizar ? <p className="mt-2 texto-suave">Para ponerse al día: <strong className="text-[var(--texto)]">{formatearPesos(v.para_regularizar)}</strong></p> : null}

          <div className="flex flex-wrap gap-2 mt-7">
            {v.puede ? (
              <button type="button" disabled={ocupado} onClick={() => anotar()} className="boton boton-principal text-lg px-8">✅ Anotar entrada</button>
            ) : (
              <>
                <Link href={`/panel/vender?socio=${elegido.socio_id}`} className="boton boton-principal text-lg px-8">💵 Cobrar</Link>
                {!forzando && <button type="button" onClick={() => setForzando(true)} className="boton">🚪 Dejar pasar igual</button>}
              </>
            )}
            <Link href={`/panel/socios/${elegido.socio_id}`} className="boton">👤 Ver ficha</Link>
            <button type="button" onClick={reiniciar} className="boton">✕ Otro socio</button>
          </div>

          {forzando && (
            <form className="mt-5 flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) anotar(motivo); }}>
              <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} className="campo" placeholder="¿Por qué lo dejás pasar? (queda anotado)" />
              <button type="submit" disabled={!motivo.trim() || ocupado} className="boton boton-peligro">Dejar pasar</button>
            </form>
          )}
        </section>
      )}
      {elegido && !v && ocupado && <div className="h-48 rounded-[var(--radio-grande)] bg-[var(--tarjeta)] animate-pulse" />}
    </div>
  );
}
