"use client";
// La tablet en la puerta: el socio escribe su DNI (o muestra su QR) y ve si
// puede pasar. Si puede, ya quedó anotado; si no, que pase por recepción.
// Vuelve sola al inicio a los pocos segundos.
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { colorVar } from "@/components/panel/Estado";
import { Camara } from "@/app/panel/entrada/Camara";
import { entrarEnKiosco, type Resultado } from "./acciones";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];

function sonar(ok: boolean) {
  try {
    const c = new AudioContext(); let t = c.currentTime;
    for (const [f, d] of (ok ? [[880, 0.14]] : [[220, 0.2], [180, 0.3]]) as [number, number][]) {
      const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; o.type = ok ? "sine" : "square";
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + d); t += d + 0.06;
    }
    setTimeout(() => void c.close(), 1500);
  } catch { /* sin audio */ }
}

export function Kiosco({ gimnasio, sede, con_qr }: { tablet: string; sede: string; gimnasio: string; con_qr: boolean }) {
  const [dni, setDni] = useState("");
  const [r, setR] = useState<Resultado | null>(null);
  const [camara, setCamara] = useState(false);
  const [ocupado, empezar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);

  const mandar = useCallback((codigo: string) => empezar(async () => {
    setCamara(false);
    const x = await entrarEnKiosco(codigo);
    setR(x); setDni("");
    sonar(!x.error && (x.resultado === "entro" || x.resultado === "entro_modo_aviso"));
  }), []);
  // Vuelve solo al inicio, para el que sigue.
  useEffect(() => {
    if (!r) { campo.current?.focus(); return; }
    const t = setTimeout(() => setR(null), r.error ? 5000 : 4000);
    return () => clearTimeout(t);
  }, [r]);

  const tecla = (k: string) => {
    if (k === "⌫") setDni((d) => d.slice(0, -1));
    else if (k === "✓") { if (dni.length >= 6) mandar(dni); }
    else setDni((d) => (d.length < 9 ? d + k : d));
  };

  if (r) {
    const entro = !r.error && (r.resultado === "entro" || r.resultado === "entro_modo_aviso");
    const color = r.error ? "gris" : entro ? (r.color ?? "verde") : "rojo";
    return (
      <section className="fixed inset-0 grid place-items-center p-8 text-center" data-kiosco-resultado={r.error ? "error" : entro ? "entro" : "no"}
        style={{ background: `color-mix(in oklab, ${colorVar(color)}, var(--fondo) 55%)` }} onClick={() => setR(null)}>
        <div className="space-y-6 max-w-2xl">
          <p className="text-8xl" aria-hidden>{r.error ? "🤔" : entro ? "✅" : "⛔"}</p>
          <p className="titular text-6xl sm:text-7xl">{r.error ? "Probá de nuevo" : entro ? `¡Pasá, ${r.nombre}!` : `${r.nombre}, hoy no podés pasar`}</p>
          <p className="text-3xl font-semibold">{r.error ?? r.texto}</p>
          {!r.error && !entro && <p className="text-2xl texto-suave">Pasá por recepción y lo resolvemos.</p>}
        </div>
      </section>
    );
  }
  return (
    <div className="w-full max-w-md space-y-6 text-center" data-kiosco="listo">
      <div>
        <p className="texto-suave text-lg">{gimnasio}{sede ? ` · ${sede}` : ""}</p>
        <h1 className="titular text-5xl mt-2">¡Hola! 👋</h1>
        <p className="text-xl mt-2">Escribí tu DNI{con_qr ? " o mostrá tu QR" : ""}</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (dni.length >= 6 || /^GYMOS1\./.test(dni)) mandar(dni); }}>
        <input ref={campo} value={dni} onChange={(e) => setDni(e.target.value.startsWith("GYMOS1.") ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 9))}
          inputMode="numeric" autoComplete="off" aria-label="Tu DNI" placeholder="Tu DNI"
          className="campo !min-h-20 !text-4xl text-center tracking-widest numero" />
      </form>
      <div className="grid grid-cols-3 gap-3" aria-label="Teclado">
        {TECLAS.map((k) => (
          <button key={k} type="button" onClick={() => tecla(k)} disabled={ocupado || (k === "✓" && dni.length < 6)}
            className={`boton !min-h-20 !text-3xl ${k === "✓" ? "boton-principal" : ""}`} aria-label={k === "⌫" ? "Borrar" : k === "✓" ? "Entrar" : k}>{k}</button>
        ))}
      </div>
      {con_qr && <button type="button" className="boton w-full !min-h-16 text-xl" onClick={() => setCamara(true)}>📷 Mostrar mi QR</button>}
      {camara && <Camara frente alLeer={mandar} alCerrar={() => setCamara(false)} />}
    </div>
  );
}
