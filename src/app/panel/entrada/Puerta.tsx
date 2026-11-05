"use client";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { useEffect, useRef, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { colorVar, PuntoEstado } from "@/components/panel/Estado";
import { formatearPesos } from "@/lib/formato";
import { anularEntrada, registrarEntrada, terminarPausa, veredicto, type ResultadoIngreso, type Veredicto } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";

const EMOJI: Record<string, string> = { verde: "✅", amarillo: "⚠️", naranja: "⚠️", rojo: "⛔", gris: "❔" };

/** Un sonido por color, para no tener que mirar: agudo y corto si entra, grave y doble si no. */
function sonar(color: string) {
  try {
    const c = new AudioContext();
    const tonos: [number, number][] = color === "verde" ? [[880, 0.12]] : color === "rojo" || color === "gris" ? [[220, 0.18], [180, 0.28]] : [[560, 0.16], [560, 0.16]];
    let t = c.currentTime;
    for (const [f, d] of tonos) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = color === "verde" ? "sine" : "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d); t += d + 0.06;
    }
    setTimeout(() => void c.close(), 1500);
  } catch { /* sin audio: no pasa nada */ }
}
const CLAVE_SONIDO = "gymos.entrada.sonido";

/** La puerta: buscar, ver si puede entrar y por qué, y anotar la entrada. */
export function Puerta({ sedeId }: { sedeId: string }) {
  const [texto, setTexto] = useState("");
  const [socios, setSocios] = useState<ResultadoSocio[]>([]);
  const [elegido, setElegido] = useState<ResultadoSocio | null>(null);
  const [v, setV] = useState<Veredicto | null>(null);
  const [hecho, setHecho] = useState<(ResultadoIngreso & { nombre: string }) | null>(null);
  const [apto, setApto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forzando, setForzando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, empezar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);
  // El sonido se prende o apaga por compu (es del mostrador, no del gimnasio).
  const [sonido, setSonido] = useState(true);
  useEffect(() => { try { setSonido(localStorage.getItem(CLAVE_SONIDO) !== "no"); } catch { /* sin almacenamiento */ } }, []);
  const cambiarSonido = () => setSonido((x) => { try { localStorage.setItem(CLAVE_SONIDO, x ? "no" : "si"); } catch { /* sin almacenamiento */ } return !x; });

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

  const reiniciar = () => { setTexto(""); setSocios([]); setElegido(null); setV(null); setApto(null); setForzando(false); setMotivo(""); setTimeout(() => campo.current?.focus(), 0); };
  const elegir = (s: ResultadoSocio) => empezar(async () => {
    setElegido(s); setHecho(null); setError(null); setForzando(false);
    const r = await veredicto(s.socio_id, sedeId);
    if (r.error) setError(r.error); else { setV(r.v!); setApto(r.apto ?? null); if (sonido) sonar(r.v!.color); }
  });
  const volvioAntes = () => empezar(async () => {
    if (!elegido) return;
    const r = await terminarPausa(elegido.socio_id, sedeId);
    if (r.error) setError(r.error); else { setError(null); setV(r.v!); }
  });
  const deshacer = () => empezar(async () => {
    if (!hecho) return;
    const r = await anularEntrada(hecho.ingreso_id, "Anotada por error");
    if (r.error) setError(r.error); else setHecho(null);
  });
  const anotar = (forzar?: string) => empezar(async () => {
    if (!elegido) return;
    const r = await registrarEntrada(elegido.socio_id, sedeId, forzar);
    if (r.error) { setError(r.error); return; }
    setHecho({ ...r.r!, nombre: elegido.nombre });
    reiniciar();
  });

  // Con el veredicto abierto: Enter anota (si puede), Esc vuelve, y escribir arranca otra búsqueda
  // (así el lector de DNI o llavero sigue andando sin tocar nada).
  useEffect(() => {
    if (!elegido || !v) return;
    const tecla = (e: KeyboardEvent) => {
      // El motivo de "dejar pasar" se escribe tranquilo; el buscador (aunque tenga el foco) no cuenta.
      if (forzando || ((e.target as HTMLElement)?.tagName === "INPUT" && e.target !== campo.current)) return;
      if (e.key === "Escape") { e.preventDefault(); reiniciar(); }
      else if (e.key === "Enter" && v.puede && !ocupado && (e.target as HTMLElement)?.tagName !== "BUTTON" && (e.target as HTMLElement)?.tagName !== "A") { e.preventDefault(); anotar(); }
      // Una letra con el foco en otro lado: va al buscador, reemplazando lo que había (el onChange cierra el veredicto).
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.target !== campo.current) { campo.current?.focus(); campo.current?.select(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  return (
    <div className="space-y-5">
      <input
        ref={campo} value={texto} onChange={(e) => { setTexto(e.target.value); setElegido(null); setV(null); setHecho(null); }}
        onKeyDown={(e) => { if (e.key === "Enter" && socios[0] && !elegido) elegir(socios[0]); if (e.key === "Escape") reiniciar(); }}
        placeholder="🔍 Nombre, DNI o número de socio" className="campo !min-h-16 !text-xl" aria-label="Buscar socio" autoComplete="off"
      />
      <div className="flex justify-end -mt-3">
        <button type="button" onClick={cambiarSonido} className="text-sm texto-suave underline" aria-pressed={sonido} data-sonido={sonido ? "si" : "no"}>
          {sonido ? "🔊 Con sonido" : "🔇 Sin sonido"}
        </button>
      </div>

      {hecho && (
        <div role="status" className="tarjeta p-5 flex flex-wrap items-center gap-4" data-hecho={hecho.resultado} style={{ borderColor: colorVar(hecho.resultado === "rechazado" ? "rojo" : "verde") }}>
          <span className="text-3xl" aria-hidden>{hecho.resultado === "rechazado" ? "⛔" : "✅"}</span>
          <p className="text-lg font-semibold min-w-0 flex-1">
            {hecho.repetido ? `${hecho.nombre} ya estaba anotado hace un momento` : hecho.resultado === "forzado" ? `${hecho.nombre}: entrada anotada (lo dejaste pasar)` : hecho.resultado === "rechazado" ? `${hecho.nombre}: anotado que no pudo entrar` : `Entró ${hecho.nombre}`}
          </p>
          {!hecho.repetido && <button type="button" className="boton" disabled={ocupado} onClick={deshacer}>↩️ Deshacer</button>}
        </div>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}

      {!elegido && socios.length > 0 && (
        <ul className="space-y-2">
          {socios.map((s) => (
            <li key={s.socio_id}>
              <button type="button" onClick={() => elegir(s)} className="fila">
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
        <p className="texto-suave text-lg">No encontramos a “{texto.trim()}”. <LinkPanel href="/panel/socios/nuevo" className="underline">Darlo de alta</LinkPanel></p>
      )}

      {elegido && v && (
        // El color ocupa la pantalla: se ve desde lejos. Enter confirma (si puede entrar), Esc vuelve a buscar.
        <section aria-live="polite" role="dialog" aria-label={`Veredicto: ${elegido.nombre}`} data-veredicto={v.color}
          className="fixed inset-0 z-50 overflow-y-auto p-6 sm:p-12 flex"
          style={{ background: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 62%)` }}>
          <div className="m-auto w-full max-w-3xl">
          <div className="flex items-center gap-4">
            <p className="text-7xl" aria-hidden>{EMOJI[v.color] ?? "❔"}</p>
            {/* La foto, si tiene (sin foto la dirección responde vacía y no se muestra nada). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={elegido.socio_id} src={`/panel/socios/${elegido.socio_id}/foto`} alt={`Foto de ${elegido.nombre}`} data-foto-entrada
              className="size-28 sm:size-36 rounded-3xl object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </div>
          <p className="titular text-6xl sm:text-8xl mt-4 break-words">{elegido.nombre}</p>
          <p className="text-3xl sm:text-4xl mt-4 font-semibold">{v.texto}</p>
          {v.avisos?.length ? <ul className="mt-3 space-y-1 texto-suave">{v.avisos.map((a) => <li key={a}>• {a}</li>)}</ul> : null}
          {apto && <p className="mt-3 pildora pildora-amarillo whitespace-normal" data-aviso-apto>{apto}</p>}
          {v.para_regularizar ? <p className="mt-2 texto-suave">Para ponerse al día: <strong className="text-[var(--texto)]">{formatearPesos(v.para_regularizar)}</strong></p> : null}

          <div className="flex flex-wrap gap-2 mt-7">
            {v.puede ? (
              <button type="button" disabled={ocupado} onClick={() => anotar()} className="boton boton-principal text-lg px-8">✅ Anotar entrada</button>
            ) : (
              <>
                {/* En pausa no se cobra: si volvió antes, se termina la pausa y entra. */}
                {v.motivo === "congelada"
                  ? <button type="button" disabled={ocupado} onClick={volvioAntes} className="boton boton-principal text-lg px-8">🏃 Volvió antes: terminar la pausa</button>
                  : <LinkPanel href={`/panel/vender?socio=${elegido.socio_id}`} className="boton boton-principal text-lg px-8">💵 Cobrar</LinkPanel>}
                {!forzando && <button type="button" onClick={() => setForzando(true)} className="boton">🚪 Dejar pasar igual</button>}
              </>
            )}
            <LinkPanel href={`/panel/socios/${elegido.socio_id}`} className="boton">👤 Ver ficha</LinkPanel>
            <button type="button" onClick={reiniciar} className="boton">✕ Otro socio</button>
          </div>

          {forzando && (
            <form className="mt-5 flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) anotar(motivo); }}>
              <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} className="campo" placeholder="¿Por qué lo dejás pasar? (queda anotado)" />
              <button type="submit" disabled={!motivo.trim() || ocupado} className="boton boton-peligro">Dejar pasar</button>
            </form>
          )}
          <p className="mt-6 text-sm texto-suave">{v.puede ? "Enter anota la entrada · " : ""}Esc vuelve a buscar · escribí para buscar a otro</p>
          </div>
        </section>
      )}
      {elegido && !v && ocupado && <div className="h-48 rounded-[var(--radio-grande)] bg-[var(--tarjeta)] animate-pulse" />}
    </div>
  );
}
