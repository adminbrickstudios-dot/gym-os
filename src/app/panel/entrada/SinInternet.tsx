"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { colorVar } from "@/components/panel/Estado";
import { Mensaje } from "@/components/ui/Mensaje";
import { buscarEnCopia, copiaVigente } from "@/lib/entrada/sin-internet";
import { copiaEntrada, sincronizarSinInternet, type CopiaEntrada, type EntradaSinInternet, type Sincronizada } from "./acciones";

const CADA_COPIA_MS = 15 * 60e3;
const CADA_PRUEBA_MS = 20e3;
const leer = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const guardar = (k: string, v: unknown) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

/**
 * SEG-5: la entrada sin internet. Prendido en esta compu, guarda cada 15
 * minutos una copia de quién puede entrar hoy (la calcula la base). Si se
 * corta internet, se busca en la copia y se anota "entró" solo a los que la
 * copia dice que pueden. Al volver, se registra todo con la base decidiendo.
 */
export function SinInternet({ sedeId, zona }: { sedeId: string; zona: string }) {
  const K = { prendido: `gymos.sin-internet.prendido.${sedeId}`, copia: `gymos.sin-internet.copia.${sedeId}`, cola: `gymos.sin-internet.cola.${sedeId}` };
  const [listo, setListo] = useState(false);
  const [prendido, setPrendido] = useState(false);
  const [copia, setCopia] = useState<CopiaEntrada | null>(null);
  const [cola, setCola] = useState<EntradaSinInternet[]>([]);
  const [sinRed, setSinRed] = useState(false);
  const [manual, setManual] = useState(false);
  const [texto, setTexto] = useState("");
  const [anotado, setAnotado] = useState<string | null>(null);
  const [sync, setSync] = useState<{ r?: Sincronizada[]; error?: string } | null>(null);
  const sincronizando = useRef(false);

  useEffect(() => {
    setPrendido(leer<boolean>(K.prendido) === true);
    setCopia(leer<CopiaEntrada>(K.copia));
    setCola(leer<EntradaSinInternet[]>(K.cola) ?? []);
    setSinRed(typeof navigator !== "undefined" && navigator.onLine === false);
    setListo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId]);

  // ¿Hay internet? El aviso del navegador y, prendido, una prueba cada 20 segundos.
  useEffect(() => {
    const on = () => setSinRed(false), off = () => setSinRed(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    let id: ReturnType<typeof setInterval> | undefined;
    if (prendido || cola.length) {
      id = setInterval(async () => {
        try { const r = await fetch("/manifest.webmanifest", { method: "HEAD", cache: "no-store" }); setSinRed(!r.ok && r.status >= 500); }
        catch { setSinRed(true); }
      }, CADA_PRUEBA_MS);
    }
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); if (id) clearInterval(id); };
  }, [prendido, cola.length]);

  const bajarCopia = useCallback(async () => {
    const r = await copiaEntrada(sedeId).catch(() => ({ error: "sin conexión" as string, copia: undefined }));
    if (r.copia) { setCopia(r.copia); guardar(K.copia, r.copia); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId]);
  useEffect(() => {
    if (!prendido || sinRed) return;
    void bajarCopia();
    const id = setInterval(() => void bajarCopia(), CADA_COPIA_MS);
    return () => clearInterval(id);
  }, [prendido, sinRed, bajarCopia]);

  // Volvió internet: se registra lo anotado (la base decide de nuevo).
  useEffect(() => {
    if (sinRed || manual || !cola.length || sincronizando.current) return;
    sincronizando.current = true;
    void (async () => {
      const r = await sincronizarSinInternet(sedeId, cola).catch(() => ({ error: "Todavía no hay conexión: se reintenta sola." as string, r: undefined }));
      if (r.r) {
        const hechos = new Set(r.r.map((x) => x.id_local));
        const resto = cola.filter((c) => !hechos.has(c.id_local));
        setCola(resto); guardar(K.cola, resto.length ? resto : null);
      }
      setSync(r);
      sincronizando.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinRed, manual, cola, sedeId]);

  const anotar = (s: CopiaEntrada["socios"][number]) => {
    const e: EntradaSinInternet = { id_local: crypto.randomUUID(), socio_id: s.s, momento: new Date().toISOString(), nombre: s.n };
    const nueva = [...cola, e];
    setCola(nueva); guardar(K.cola, nueva); setAnotado(s.n); setTexto("");
  };
  const prender = (si: boolean) => {
    setPrendido(si); guardar(K.prendido, si || null);
    if (!si) { setCopia(null); guardar(K.copia, null); setManual(false); }
  };

  if (!listo) return null;
  const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  const offline = sinRed || manual;
  const rechazados = sync?.r?.filter((x) => x.resultado === "rechazado") ?? [];
  const vigente = copiaVigente(copia);
  const encontrados = offline && vigente ? buscarEnCopia(copia, texto) : [];

  return (
    <div className="contents" data-sin-internet={offline ? "sin" : prendido ? "prendido" : "apagado"}>
      {offline && (
        <section className="tarjeta p-5 space-y-3 !border-[var(--amarillo)]" data-sin-internet-panel>
          <p className="titulo text-2xl">📴 Sin internet</p>
          {!vigente ? (
            <p className="texto-suave">No hay una copia de hoy en esta compu. Anotá en un papel nombre y hora de cada uno, y cargalos cuando vuelva internet.</p>
          ) : (
            <>
              <p className="texto-suave">Según la copia de las {hora(copia!.generada_en)}. Se anota “entró” solo a los que pueden; cuando vuelva internet se registra todo y la base lo confirma.</p>
              <input className="campo w-full text-lg" value={texto} onChange={(e) => { setTexto(e.target.value); setAnotado(null); }}
                placeholder="Nombre, número o DNI" aria-label="Buscar en la copia" autoFocus />
              <ul className="space-y-2">{encontrados.map((s) => (
                <li key={s.s} className="tarjeta px-4 py-3 flex flex-wrap items-center gap-3" data-copia-socio={s.n}>
                  <span className="w-3 h-3 rounded-full" style={{ background: colorVar(s.c) }} aria-hidden />
                  <span className="grow min-w-0"><span className="font-semibold">{s.n}</span> <span className="texto-suave">#{s.num}</span>
                    <span className="block text-sm">{s.t}</span></span>
                  {s.p ? <button type="button" className="boton boton-principal" onClick={() => anotar(s)}>✅ Entró</button>
                    : <span className="text-sm texto-suave basis-full">⛔ Sin internet no se deja pasar a quien no puede: cuando vuelva, cobrale o dejalo pasar desde la Entrada.</span>}
                </li>
              ))}</ul>
              {anotado && <Mensaje tipo="exito">{anotado}: anotado. Se registra cuando vuelva internet.</Mensaje>}
            </>
          )}
          {cola.length > 0 && <p className="text-sm" data-cola={cola.length}>🕐 {cola.length} {cola.length === 1 ? "entrada espera" : "entradas esperan"} a que vuelva internet (quedan guardadas en esta compu).</p>}
          {manual && !sinRed && <button type="button" className="boton" onClick={() => setManual(false)}>Ya volvió internet</button>}
        </section>
      )}
      {!offline && cola.length > 0 && <p className="pildora" data-cola={cola.length}>🔄 Registrando {cola.length} {cola.length === 1 ? "entrada" : "entradas"} anotadas sin internet…</p>}
      {sync?.error && !offline && <Mensaje tipo="aviso">{sync.error}</Mensaje>}
      {sync?.r && sync.r.length > 0 && (
        <div data-sincronizado={sync.r.length}>
          <Mensaje tipo={rechazados.length ? "error" : "exito"}>
            {rechazados.length === 0 ? `Se registraron las ${sync.r.length} entradas anotadas sin internet.`
              : <>Se registraron {sync.r.length} entradas anotadas sin internet. <strong>La base dice que {rechazados.length === 1 ? "este no podía" : "estos no podían"} entrar</strong> (quedó como rechazado): {rechazados.map((x) => `${x.nombre} (${x.texto})`).join(" · ")}. Cobrale o avisale al dueño.</>}
          </Mensaje>
        </div>
      )}
      {!offline && (
        <p className="order-last text-sm texto-suave flex flex-wrap items-center gap-x-3 gap-y-1">
          {prendido ? <>
            <span data-copia={copia?.socios.length ?? 0}>📴 Copia para cuando se corte internet: {copia ? `${hora(copia.generada_en)} · ${copia.socios.length} socios` : "bajando…"}</span>
            <button type="button" className="underline" onClick={() => setManual(true)}>Usarla ahora</button>
            <button type="button" className="underline" onClick={() => prender(false)}>Apagar en esta compu</button>
          </> : <>
            <span>📴 ¿Se te corta internet?</span>
            <button type="button" className="underline" data-prender-copia onClick={() => prender(true)}>Guardar una copia en esta compu</button>
          </>}
        </p>
      )}
    </div>
  );
}
