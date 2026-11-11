"use client";
// La tablet en la puerta: el socio escribe su DNI (o muestra su QR) y ve si
// puede pasar. Si puede, ya quedó anotado; si no, que pase por recepción.
// Vuelve sola al inicio a los pocos segundos.
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { colorVar } from "@/components/panel/Estado";
import { Camara } from "@/app/panel/entrada/CamaraDinamica";
import { emergenciaDeLaTablet, entrarEnKiosco, entrarHabitual, habitualesDeLaTablet, qrDeLaTablet, salirEnKiosco, ultimoDeLaTablet, type Resultado } from "./acciones";
import QRCode from "qrcode";
import { Icono } from "@/components/ui/Icono";
import { SIN_CONEXION, valorDelCampo } from "./campo";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "borrar", "0", "entrar"];

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

/** El QR que la tablet muestra para que el socio lo escanee con su app (ENT-6). Se renueva solo. */
function QrPared({ alEntrar }: { alEntrar: (r: Resultado) => void }) {
  const [qr, setQr] = useState<{ codigo: string; vence_en: string } | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const desde = useRef(new Date().toISOString());
  useEffect(() => {
    let vivo = true, t: ReturnType<typeof setTimeout>;
    const traer = async () => {
      const r = await qrDeLaTablet();
      if (!vivo) return;
      if (r.codigo) { setQr({ codigo: r.codigo, vence_en: r.vence_en! }); setSvg(await QRCode.toString(r.codigo, { type: "svg", margin: 1 })); }
      t = setTimeout(traer, r.vence_en ? Math.max(1000, Date.parse(r.vence_en) - Date.now() - 1500) : 5000);
    };
    void traer();
    return () => { vivo = false; clearTimeout(t); };
  }, []);
  // Cada segundo y medio: ¿entró alguien escaneando?
  useEffect(() => {
    const i = setInterval(async () => {
      const u = await ultimoDeLaTablet(desde.current);
      if (u && "momento" in u) { desde.current = (u as Resultado & { momento: string }).momento; alEntrar(u); }
    }, 1500);
    return () => clearInterval(i);
  }, [alEntrar]);
  return (
    <div className="tarjeta p-5 space-y-3" data-qr-pared={qr?.codigo ?? ""}>
      <p className="text-xl font-semibold"><Icono nombre="celular" /> O escaneá este QR con tu app</p>
      <div className="mx-auto w-56 aspect-square bg-white rounded-2xl p-3" aria-hidden dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
    </div>
  );
}

export function Kiosco({ gimnasio, sede, con_qr, qr_pared, con_salida = false }: { tablet: string; sede: string; gimnasio: string; con_qr: boolean; qr_pared: boolean; con_salida?: boolean }) {
  const [dni, setDni] = useState("");
  const [r, setR] = useState<Resultado | null>(null);
  const [camara, setCamara] = useState(false);
  const [ocupado, empezar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);
  // VD-46M: el cartel rojo mientras la puerta está en emergencia (se pregunta cada 20 s; vence solo en la base).
  const [emergencia, setEmergencia] = useState(false);
  useEffect(() => {
    let vivo = true;
    const leer = () => void emergenciaDeLaTablet().then((e) => { if (vivo && e) setEmergencia(e.activa); });
    leer();
    const i = setInterval(leer, 20000);
    return () => { vivo = false; clearInterval(i); };
  }, []);
  // COM-7: los habituales de esta hora (vacío si el gimnasio no lo usa) y el que tocó su nombre.
  const [habituales, setHabituales] = useState<{ socio_id: string; nombre: string }[]>([]);
  const [elegido, setElegido] = useState<{ socio_id: string; nombre: string } | null>(null);
  useEffect(() => {
    if (r) return;
    let vivo = true;
    void habitualesDeLaTablet().then((h) => { if (vivo) setHabituales(h); });
    const i = setInterval(() => void habitualesDeLaTablet().then((h) => { if (vivo) setHabituales(h); }), 120000);
    return () => { vivo = false; clearInterval(i); };
  }, [r]);

  const mandar = useCallback((codigo: string) => empezar(async () => {
    setCamara(false);
    let x: Resultado;
    try { x = await entrarEnKiosco(codigo); } catch { x = { error: SIN_CONEXION }; }
    setR(x); setDni(""); setElegido(null);
    sonar(!x.error && (x.resultado === "entro" || x.resultado === "entro_modo_aviso"));
  }), []);
  // VD-48 · "Me voy": con el DNI (o el QR que escribió el lector) en el campo.
  const irme = (codigo: string) => empezar(async () => {
    setCamara(false);
    let x: Resultado;
    try { x = await salirEnKiosco(codigo); } catch { x = { error: SIN_CONEXION, salida: true }; }
    setR(x); setDni(""); setElegido(null);
    sonar(!x.error && !!x.registrada);
  });
  const mostrar = useCallback((x: Resultado) => { setR(x); sonar(x.resultado === "entro" || x.resultado === "entro_modo_aviso"); }, []);
  // Vuelve solo al inicio, para el que sigue.
  useEffect(() => {
    if (!r) { campo.current?.focus(); return; }
    const t = setTimeout(() => setR(null), r.error ? 5000 : 4000);
    return () => clearTimeout(t);
  }, [r]);

  const conHabitual = (fin: string) => empezar(async () => {
    let x: Resultado;
    try { x = await entrarHabitual(elegido!.socio_id, fin); } catch { x = { error: SIN_CONEXION }; }
    setR(x); setDni(""); setElegido(null);
    sonar(!x.error && (x.resultado === "entro" || x.resultado === "entro_modo_aviso"));
  });
  const largo = elegido ? 3 : 9;
  const tecla = (k: string) => {
    if (k === "borrar") setDni((d) => d.slice(0, -1));
    else if (k === "entrar") { if (elegido) { if (dni.length === 3) conHabitual(dni); } else if (dni.length >= 6) mandar(dni); }
    else setDni((d) => (d.length < largo ? d + k : d));
  };

  if (r?.salida) {
    return (
      <section className="fixed inset-0 grid place-items-center p-8 text-center" data-kiosco-resultado={r.error ? "error" : r.registrada ? "salio" : "sin-entrada"}
        style={{ background: `color-mix(in oklab, ${colorVar(r.error ? "gris" : r.registrada ? "verde" : "amarillo")}, var(--fondo) 55%)` }} onClick={() => setR(null)}>
        <div className="space-y-6 max-w-2xl">
          <p className="text-8xl" aria-hidden><Icono nombre={r.error ? "ayuda" : r.registrada ? "ok" : "info"} /></p>
          <p className="titular text-6xl sm:text-7xl">{r.error ? "Probá de nuevo" : r.registrada ? "¡Hasta pronto!" : "Listo"}</p>
          <p className="text-3xl font-semibold">{r.error ?? r.texto}</p>
        </div>
      </section>
    );
  }
  if (r) {
    const entro = !r.error && (r.resultado === "entro" || r.resultado === "entro_modo_aviso");
    const color = r.error ? "gris" : entro ? (r.color ?? "verde") : "rojo";
    return (
      <section className="fixed inset-0 grid place-items-center p-8 text-center" data-kiosco-resultado={r.error ? "error" : entro ? "entro" : "no"}
        style={{ background: `color-mix(in oklab, ${colorVar(color)}, var(--fondo) 55%)` }} onClick={() => setR(null)}>
        <div className="space-y-6 max-w-2xl">
          <p className="text-8xl" aria-hidden><Icono nombre={r.error ? "ayuda" : entro ? "ok" : "prohibido"} /></p>
          <p className="titular text-6xl sm:text-7xl">{r.error ? "Probá de nuevo" : entro ? `¡Pasá, ${r.nombre}!` : `${r.nombre}, hoy no podés pasar`}</p>
          <p className="text-3xl font-semibold">{r.error ?? r.texto}</p>
          {!r.error && !entro && <p className="text-2xl texto-suave">Pasá por recepción y lo resolvemos.</p>}
        </div>
      </section>
    );
  }
  return (
    <div className="w-full max-w-md space-y-6 text-center" data-kiosco="listo">
      {emergencia && (
        <div role="alert" data-kiosco-emergencia className="rounded-[var(--radio-grande)] p-4 border-2 text-2xl font-bold"
          style={{ background: `color-mix(in oklab, ${colorVar("rojo")}, var(--fondo) 75%)`, borderColor: colorVar("rojo") }}>
          <Icono nombre="alerta" /> EMERGENCIA activa: pasá por la puerta
        </div>
      )}
      <div>
        <p className="texto-suave text-lg">{gimnasio}{sede ? ` · ${sede}` : ""}</p>
        <h1 className="titular text-5xl mt-2">{elegido ? `¡Hola, ${elegido.nombre}!` : "¡Hola!"}</h1>
        <p className="text-xl mt-2">{elegido ? "Los últimos 3 números de tu DNI" : `Escribí tu DNI${con_qr ? " o mostrá tu QR" : ""}${habituales.length ? ", o tocá tu nombre" : ""}`}</p>
      </div>
      {!elegido && habituales.length > 0 && (
        <div className="grid grid-cols-2 gap-2" data-habituales={habituales.length} aria-label="Los que suelen venir a esta hora">
          {habituales.map((h) => (
            <button key={h.socio_id} type="button" className="boton !min-h-16 text-xl" onClick={() => { setElegido(h); setDni(""); }}>{h.nombre}</button>
          ))}
        </div>
      )}
      {elegido && <button type="button" className="boton-texto texto-suave" onClick={() => { setElegido(null); setDni(""); }}>← No soy {elegido.nombre}</button>}
      <form onSubmit={(e) => { e.preventDefault(); if (elegido) { if (dni.length === 3) conHabitual(dni); } else if (dni.length >= 6 || /^GYMOS1\./.test(dni)) mandar(dni); }}>
        <input ref={campo} value={dni} onChange={(e) => setDni(valorDelCampo(e.target.value, !!elegido, largo))}
          inputMode="numeric" autoComplete="off" aria-label={elegido ? "Últimos 3 números de tu DNI" : "Tu DNI"} placeholder={elegido ? "···" : "Tu DNI"}
          className="campo !min-h-20 !text-4xl text-center tracking-widest numero" />
      </form>
      <div className="grid grid-cols-3 gap-3" aria-label="Teclado">
        {TECLAS.map((k) => (
          <button key={k} type="button" onClick={() => tecla(k)} disabled={ocupado || (k === "entrar" && (elegido ? dni.length !== 3 : dni.length < 6))}
            className={`boton !min-h-20 !text-3xl ${k === "entrar" ? "boton-principal" : ""}`} aria-label={k === "borrar" ? "Borrar" : k === "entrar" ? "Entrar" : k}>{k === "borrar" ? <Icono nombre="izquierda" /> : k === "entrar" ? <Icono nombre="ok" /> : k}</button>
        ))}
      </div>
      {!elegido && con_qr && <button type="button" className="boton w-full !min-h-16 text-xl" onClick={() => setCamara(true)}><Icono nombre="camara" /> Mostrar mi QR</button>}
      {!elegido && con_salida && (
        <button type="button" className="boton w-full !min-h-16 text-xl" data-kiosco-me-voy disabled={ocupado || !(dni.length >= 6 || /^GYMOS1\./.test(dni))} onClick={() => irme(dni)}>
          <Icono nombre="salir" /> Me voy <span className="texto-tenue text-base font-normal">(escribí tu DNI y tocá acá)</span>
        </button>
      )}
      {camara && <Camara frente alLeer={mandar} alCerrar={() => setCamara(false)} />}
      {qr_pared && <QrPared alEntrar={mostrar} />}
    </div>
  );
}
