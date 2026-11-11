"use client";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { BotonCobrar } from "@/components/panel/cobrar/BotonCobrar";
import { EVENTO_COBRO_HECHO, type CobroHecho } from "@/components/panel/cobrar/evento";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { colorVar, PuntoEstado } from "@/components/panel/Estado";
import { formatearPesos } from "@/lib/formato";
import { leerConfigVisita, type RegistrarSalida } from "./ventana-acciones";
import { anularEntrada, cupoDejarPasar, leerLlavero, leerQR, modoPrueba, darPruebaGratis, pruebaPorDni, registrarEntrada, registrarSalida, terminarPausa, veredicto, type ResultadoSalida, type CupoDejarPasar, type Guia, type PromesaPago, type ResultadoIngreso, type Veredicto } from "./acciones";
import { FormDejarPasar } from "@/components/panel/FormDejarPasar";
import { Camara } from "./CamaraDinamica";
import { crearDetectorLector, esLecturaRepetida } from "./lector";
import { CartelEmergencia, useEmergencia } from "@/components/panel/CartelEmergencia";
import type { EmergenciaActiva } from "./emergencia-tipos";
import { Mensaje } from "@/components/ui/Mensaje";
import { Tilde } from "@/components/ui/Tilde";
import { Icono } from "@/components/ui/Icono";

const EMOJI: Record<string, string> = { verde: "✓", amarillo: "!", naranja: "!", rojo: "", gris: "" };

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
const ES_QR = /^GYMOS1\./;

export function Puerta({ sedeId, conQr = false, conLlavero = false, esRecepcion = false, socioInicial = null, emergenciaInicial = null }: {
  sedeId: string; conQr?: boolean; conLlavero?: boolean; esRecepcion?: boolean; socioInicial?: ResultadoSocio | null; emergenciaInicial?: EmergenciaActiva | null;
}) {
  // VD-46M: el cartel rojo mientras la puerta está en emergencia (lo pregunta a la base cada 30 s).
  const emergencia = useEmergencia(sedeId, true, emergenciaInicial);
  const [cupo, setCupo] = useState<CupoDejarPasar | null>(null);
  const [camara, setCamara] = useState(false);
  const [via, setVia] = useState<"recepcion" | "qr_socio" | "nfc">("recepcion");
  const [texto, setTexto] = useState("");
  const [socios, setSocios] = useState<ResultadoSocio[]>([]);
  const [elegido, setElegido] = useState<ResultadoSocio | null>(null);
  const [v, setV] = useState<Veredicto | null>(null);
  const [hecho, setHecho] = useState<(ResultadoIngreso & { nombre: string; socioId?: string }) | null>(null);
  // VD-48: la salida (si el gimnasio la registra): DNI + S o la tecla S con el socio elegido.
  const [salidaModo, setSalidaModo] = useState<RegistrarSalida>("no");
  const [salio, setSalio] = useState<(ResultadoSalida & { nombre: string }) | null>(null);
  // VD-51: prueba gratis para un DNI que no existe (o que reservó desde la página).
  const [pruebaModo, setPruebaModo] = useState<"no" | "dia" | "clase">("no");
  const [prueba, setPrueba] = useState<{ nombre: string; apellido: string; telefono: string; reservada: boolean; error: string | null } | null>(null);
  useEffect(() => { void modoPrueba().then((r) => { if (r.modo) setPruebaModo(r.modo); }); }, []);
  useEffect(() => { void leerConfigVisita().then((r) => { if (r.config) setSalidaModo(r.config.registrar_salida ?? "no"); }); }, []);
  const [guia, setGuia] = useState<Guia | null>(null);
  const [apto, setApto] = useState<string | null>(null);
  const [firmar, setFirmar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forzando, setForzando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, empezar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);
  // El sonido se prende o apaga por compu (es del mostrador, no del gimnasio).
  const [sonido, setSonido] = useState(true);
  useEffect(() => { try { setSonido(localStorage.getItem(CLAVE_SONIDO) !== "no"); } catch { /* sin almacenamiento */ } }, []);
  const cambiarSonido = () => setSonido((x) => { try { localStorage.setItem(CLAVE_SONIDO, x ? "no" : "si"); } catch { /* sin almacenamiento */ } return !x; });

  // Volviendo de cobrar (ENT-9): abre el veredicto nuevo de ese socio.
  const abrioInicial = useRef(false);
  useEffect(() => {
    campo.current?.focus();
    if (socioInicial && !abrioInicial.current) { abrioInicial.current = true; elegir(socioInicial); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (texto.trim().length < 2 || ES_QR.test(texto.trim())) { setSocios([]); return; }
    const t = setTimeout(async () => {
      const r = await buscarSociosRapido(texto.trim());
      setSocios(r.socios ?? []);
      setError(r.error ?? null);
    }, 150);
    return () => clearTimeout(t);
  }, [texto]);

  const reiniciar = () => { setTexto(""); setSocios([]); setElegido(null); setV(null); setGuia(null); setApto(null); setFirmar(null); setForzando(false); setMotivo(""); setTimeout(() => campo.current?.focus(), 0); };
  const elegir = (s: ResultadoSocio) => empezar(async () => {
    setElegido(s); setHecho(null); setError(null); setForzando(false); setVia("recepcion");
    const r = await veredicto(s.socio_id, sedeId);
    if (r.error) setError(r.error); else { setV(r.v!); setGuia(r.guia ?? null); setApto(r.apto ?? null); setFirmar(r.firmar ?? null); if (sonido) sonar(r.v!.color); }
  });
  // QR (cámara o lector USB): si puede entrar, se anota solo; si no, queda el veredicto con el porqué.
  // QR (cámara o lector) o llavero: si puede entrar, se anota solo; si no, queda el veredicto con el porqué.
  const directo = useCallback(async (q: { socio?: { socio_id: string; nombre: string; numero: number } | null; error?: string }, forma: "recepcion" | "qr_socio" | "nfc") => {
    if (q.error || !q.socio) { setError(q.error ?? "No se pudo leer"); if (sonido) sonar("rojo"); campo.current?.focus(); return; }
    const s: ResultadoSocio = { ...q.socio, color: "gris", texto: "", puede: false, dado_de_baja: false };
    const r = await veredicto(s.socio_id, sedeId);
    if (r.error) { setError(r.error); return; }
    setError(null);
    if (sonido) sonar(r.v!.color);
    if (r.v!.puede) {
      const e = await registrarEntrada(s.socio_id, sedeId, undefined, forma);
      if (e.error) { setError(e.error); return; }
      setHecho({ ...e.r!, nombre: s.nombre, socioId: s.socio_id });
      campo.current?.focus();
      return;
    }
    setElegido(s); setVia(forma); setV(r.v!); setGuia(r.guia ?? null); setApto(r.apto ?? null); setFirmar(r.firmar ?? null);
  }, [sedeId, sonido]);
  const porQr = useCallback((codigo: string) => empezar(async () => {
    setCamara(false); setTexto(""); setHecho(null); setForzando(false);
    await directo(await leerQR(codigo.trim()), "qr_socio");
  }), [directo]);
  // Lo que escribió el lector de llaveros (sin espacios): si es el llavero de alguien, entra directo; si no, búsqueda normal.
  const porLlavero = (codigo: string, siNo: () => void) => empezar(async () => {
    const l = await leerLlavero(codigo.trim());
    if (!l.socio && !l.error) { siNo(); return; }
    setTexto(""); setHecho(null); setForzando(false);
    await directo(l, "nfc");
  });
  // C5 · Lector USB: el código llegó de corrido y terminó en Enter. Busca por QR, credencial (llavero) o DNI; el veredicto lo da la base.
  // Si no encuentra a nadie suena el error, el campo queda vacío y con el foco (la próxima lectura no se pega a esta). El mismo código dos veces seguidas es un solo ingreso.
  const detector = useRef(crearDetectorLector());
  const ultimaLectura = useRef<{ codigo: string; en: number } | null>(null);
  const porLectura = (crudo: string) => {
    const t = crudo.replace(/\./g, "").trim() || crudo.trim();
    if (!t) return;
    const ahora = Date.now();
    if (esLecturaRepetida(ultimaLectura.current, t, ahora)) return;
    ultimaLectura.current = { codigo: t, en: ahora };
    setTexto(""); setSocios([]); setHecho(null); setForzando(false);
    const noEsta = () => { setError("No encontramos a nadie con ese código."); if (sonido) sonar("rojo"); setTimeout(() => campo.current?.focus(), 0); };
    empezar(async () => {
      if (ES_QR.test(t)) { await directo(await leerQR(t), "qr_socio"); return; }
      if (conLlavero && /^[A-Za-z0-9-]{4,30}$/.test(t) && !/^\d{7,9}$/.test(t)) {
        const l = await leerLlavero(t);
        if (l.socio || l.error) { await directo(l, "nfc"); return; }
      }
      const r = await buscarSociosRapido(t);
      if (r.error) { setError(r.error); if (sonido) sonar("rojo"); campo.current?.focus(); return; }
      const primero = r.socios?.[0];
      if (!primero) { noEsta(); return; }
      await directo({ socio: { socio_id: primero.socio_id, nombre: primero.nombre, numero: primero.numero ?? 0 } }, "recepcion");
    });
  };
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
  const anotar = (forzar?: string, promesa?: PromesaPago) => empezar(async () => {
    if (!elegido) return;
    // F0.4 · Si el veredicto ya dice que puede entrar, el aviso "Entró Fulana" sale en el mismo instante (provisorio, sin Deshacer)
    // y la base confirma por detrás. Si la base lo rechaza, vuelve atrás: el mismo veredicto en pantalla y el error con el porqué.
    const optimista = !forzar && !promesa && !!v?.puede;
    const antes = { elegido, v, guia, apto, firmar, texto, socios };
    if (optimista) {
      setHecho({ ingreso_id: "", repetido: false, resultado: "entro", nombre: elegido.nombre, socioId: elegido.socio_id });
      reiniciar();
    }
    const r = await registrarEntrada(elegido.socio_id, sedeId, forzar, via, promesa);
    if (r.error) {
      setError(r.error);
      if (optimista) { setHecho(null); setElegido(antes.elegido); setV(antes.v); setGuia(antes.guia); setApto(antes.apto); setFirmar(antes.firmar); setTexto(antes.texto); setSocios(antes.socios); }
      return;
    }
    setHecho({ ...r.r!, nombre: elegido.nombre, socioId: elegido.socio_id });
    if (!optimista) reiniciar();
  });
  const dniEscrito = texto.replace(/\./g, "").trim();
  const abrirPrueba = () => empezar(async () => {
    const r = await pruebaPorDni(dniEscrito);
    if (r.error || !r.p) { setError(r.error ?? "No se pudo mirar la prueba"); return; }
    if (r.p.existe && r.p.usada) { setError(`Ya usó su prueba gratis el ${r.p.dia} · Hacete socio.`); return; }
    setError(null);
    setPrueba({ nombre: r.p.existe ? r.p.nombre ?? "" : "", apellido: "", telefono: r.p.existe ? r.p.telefono ?? "" : "", reservada: !!r.p.existe, error: null });
  });
  const darPrueba = () => empezar(async () => {
    if (!prueba) return;
    const x = await darPruebaGratis(sedeId, { dni: dniEscrito, nombre: prueba.nombre, apellido: prueba.apellido, telefono: prueba.telefono });
    if (x.error || !x.socioId) { setPrueba((p) => (p ? { ...p, error: x.error ?? "No se pudo dar la prueba" } : p)); return; }
    setPrueba(null);
    elegir({ socio_id: x.socioId, numero: x.numero ?? null, nombre: x.nombre ?? prueba.nombre, color: "gris", texto: "", puede: false, dado_de_baja: false });
  });
  const marcarSalida = (socioId: string, nombre: string) => empezar(async () => {
    const r = await registrarSalida(socioId, sedeId);
    if (r.error || !r.r) { setError(r.error ?? "No se pudo marcar la salida"); return; }
    setError(null); setHecho(null); setSalio({ ...r.r, nombre });
    if (sonido) sonar(r.r.registrada ? "verde" : "amarillo");
    reiniciar();
  });
  const salirConDni = (dni: string) => empezar(async () => {
    const r = await buscarSociosRapido(dni);
    if (r.error) { setError(r.error); return; }
    const s = (r.socios ?? [])[0];
    if (!s) { setError(`No hay nadie con el DNI ${dni}.`); return; }
    const p = await registrarSalida(s.socio_id, sedeId);
    if (p.error || !p.r) { setError(p.error ?? "No se pudo marcar la salida"); return; }
    setError(null); setHecho(null); setSalio({ ...p.r, nombre: s.nombre });
    if (sonido) sonar(p.r.registrada ? "verde" : "amarillo");
    reiniciar();
  });

  // VD-5b: Cobrar abre la hoja sobre esta pantalla; al cobrar, el veredicto se recalcula (ahora en verde: Enter anota).
  const elegidoRef = useRef<ResultadoSocio | null>(null);
  useEffect(() => { elegidoRef.current = elegido; });
  useEffect(() => {
    const hecho = (e: Event) => {
      const c = (e as CustomEvent<CobroHecho>).detail;
      if (c.origen !== "entrada" || !elegidoRef.current || elegidoRef.current.socio_id !== c.socioId) return;
      elegir(elegidoRef.current);
    };
    window.addEventListener(EVENTO_COBRO_HECHO, hecho);
    return () => window.removeEventListener(EVENTO_COBRO_HECHO, hecho);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Con el veredicto abierto: Enter anota (si puede), Esc vuelve, y escribir arranca otra búsqueda
  // (así el lector de DNI o llavero sigue andando sin tocar nada).
  useEffect(() => {
    if (!elegido || !v) return;
    const tecla = (e: KeyboardEvent) => {
      // El motivo de "dejar pasar" se escribe tranquilo; el buscador (aunque tenga el foco) no cuenta.
      if (forzando || ((e.target as HTMLElement)?.tagName === "INPUT" && e.target !== campo.current)) return;
      if (e.key === "Escape") { e.preventDefault(); reiniciar(); }
      else if (e.key === "Enter" && v.puede && !ocupado && (e.target as HTMLElement)?.tagName !== "BUTTON" && (e.target as HTMLElement)?.tagName !== "A") { e.preventDefault(); anotar(); }
      else if (e.key.toLowerCase() === "s" && salidaModo !== "no" && !ocupado && e.target !== campo.current && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); marcarSalida(elegido.socio_id, elegido.nombre); }
      // Una letra con el foco en otro lado: va al buscador, reemplazando lo que había (el onChange cierra el veredicto).
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.target !== campo.current) { campo.current?.focus(); campo.current?.select(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  return (
    <div className="space-y-5">
      <CartelEmergencia e={emergencia} />
      <input
        ref={campo} value={texto} onChange={(e) => { setTexto(e.target.value); setElegido(null); setV(null); setHecho(null); setSalio(null); setPrueba(null); }}
        onKeyDown={(e) => {
          detector.current.tecla(e.key, e.timeStamp);
          if (e.key === "Enter" && detector.current.enter(e.timeStamp)) { e.preventDefault(); porLectura(e.currentTarget.value); return; }
          // VD-48: DNI + S marca la salida (solo si el gimnasio la registra).
          if (e.key.toLowerCase() === "s" && salidaModo !== "no" && !e.ctrlKey && !e.metaKey && !e.altKey && /^\d{6,9}$/.test(texto.replace(/\./g, "").trim())) {
            e.preventDefault(); if (!ocupado) salirConDni(texto.replace(/\./g, "").trim()); return;
          }
          if (e.key === "Enter" && ES_QR.test(texto.trim())) { e.preventDefault(); porQr(texto); return; }   // lector USB
          if (e.key === "Enter" && !elegido && conLlavero && /^[A-Za-z0-9-]{4,30}$/.test(texto.trim())) {
            e.preventDefault(); const primero = socios[0]; porLlavero(texto, () => { if (primero) elegir(primero); }); return;
          }
          if (e.key === "Enter" && socios[0] && !elegido) elegir(socios[0]);
          if (e.key === "Escape") reiniciar();
        }}
        placeholder="Nombre, DNI o número de socio" className="campo !min-h-16 !text-xl" aria-label="Buscar socio" autoComplete="off"
      />
      <div className="flex flex-wrap items-center justify-end gap-3 -mt-3">
        {conQr && <button type="button" onClick={() => setCamara(true)} className="boton mr-auto"><Icono nombre="camara" /> Leer QR</button>}
        <button type="button" onClick={cambiarSonido} className="min-h-11 px-3 rounded-xl text-sm texto-suave active:opacity-60" aria-pressed={sonido} data-sonido={sonido ? "si" : "no"}>
          {sonido ? "Con sonido" : "Sin sonido"}
        </button>
      </div>

      {hecho && (
        <div role="status" className="tarjeta p-5 flex flex-wrap items-center gap-4" data-hecho={hecho.resultado} style={{ borderColor: colorVar(hecho.resultado === "rechazado" ? "rojo" : hecho.alerta_prestamo ? "amarillo" : "verde") }}>
          <span className="text-3xl" aria-hidden>{hecho.resultado === "rechazado" ? "" : hecho.alerta_prestamo ? "!" : <Tilde tamano={32} />}</span>
          <p className="text-lg font-semibold min-w-0 flex-1">
            {hecho.repetido ? `${hecho.nombre}: ${hecho.texto ?? "ya estaba anotado hace un momento"}` : hecho.resultado === "forzado" ? `${hecho.nombre}: entrada anotada (lo dejaste pasar)` : hecho.resultado === "rechazado" ? `${hecho.nombre}: anotado que no pudo entrar` : hecho.emergencia ? `Entró ${hecho.nombre} por la emergencia (queda marcado)` : `Entró ${hecho.nombre}`}
          </p>
          {!hecho.repetido && <button type="button" className="boton" disabled={ocupado || !hecho.ingreso_id} onClick={deshacer}><Icono nombre="deshacer" /> Deshacer</button>}
          {hecho.repetido && hecho.puede_salir && hecho.socioId && (
            <button type="button" className={`boton ${hecho.avisar_salida ? "boton-principal" : ""}`} disabled={ocupado} data-ventana-salida-boton
              onClick={() => marcarSalida(hecho.socioId!, hecho.nombre)}><Icono nombre="salir" /> Marcar salida</button>
          )}
        </div>
      )}
      {salio && (
        <div role="status" className="tarjeta p-5 flex flex-wrap items-center gap-4" data-ventana-salida={salio.registrada ? "registrada" : "sin-entrada"}>
          <span className="text-3xl" aria-hidden>{salio.registrada ? "" : ""}</span>
          <p className="text-lg font-semibold min-w-0 flex-1">{salio.registrada ? salio.texto : `${salio.nombre}: ${salio.texto}`}</p>
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
        <div className="space-y-3">
          <p className="texto-suave text-lg">No encontramos a “{texto.trim()}”. <LinkPanel href="/panel/socios/nuevo" className="underline">Darlo de alta</LinkPanel></p>
          {pruebaModo !== "no" && /^\d{6,9}$/.test(dniEscrito) && !prueba && (
            <button type="button" className="boton" data-ventana-prueba disabled={ocupado} onClick={abrirPrueba}><Icono nombre="regalo" /> Dar prueba gratis</button>
          )}
        </div>
      )}
      {prueba && (
        <form data-ventana-prueba-form className="tarjeta p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!ocupado && prueba.nombre.trim()) darPrueba(); }}>
          <p className="titulo text-xl"><Icono nombre="regalo" /> Prueba gratis · {dniEscrito}</p>
          {prueba.reservada && <p className="pildora pildora-azul !rounded-[var(--radio)] !px-4 !py-3 w-full" data-prueba-reservada><Icono nombre="persona" /> Reservó desde la página. Confirmá y lo dejás entrar.</p>}
          <label className="block space-y-1"><span className="etiqueta">Nombre</span>
            <input data-prueba-nombre className="campo" value={prueba.nombre} autoComplete="off" onChange={(e) => setPrueba({ ...prueba, nombre: e.target.value, error: null })} /></label>
          {!prueba.reservada && (
            <>
              <label className="block space-y-1"><span className="etiqueta">Apellido <span className="texto-tenue font-normal">(opcional)</span></span>
                <input className="campo" value={prueba.apellido} autoComplete="off" onChange={(e) => setPrueba({ ...prueba, apellido: e.target.value })} /></label>
              <label className="block space-y-1"><span className="etiqueta">Celular <span className="texto-tenue font-normal">(opcional)</span></span>
                <input className="campo" type="tel" inputMode="tel" value={prueba.telefono} placeholder="387 555 1234" autoComplete="off" onChange={(e) => setPrueba({ ...prueba, telefono: e.target.value })} /></label>
            </>
          )}
          {prueba.error && <Mensaje tipo="error">{prueba.error}</Mensaje>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="boton boton-principal" disabled={ocupado || !prueba.nombre.trim()} data-prueba-dar><Icono nombre="regalo" /> Dejarlo entrar con la prueba</button>
            <button type="button" className="boton-texto px-3" onClick={() => setPrueba(null)}>Volver</button>
          </div>
        </form>
      )}

      {elegido && v && (
        // El color ocupa la pantalla: se ve desde lejos. Enter confirma (si puede entrar), Esc vuelve a buscar.
        <section aria-live="polite" role="dialog" aria-label={`Veredicto: ${elegido.nombre}`} data-veredicto={v.color}
          className="fixed inset-0 z-50 overflow-y-auto p-6 sm:p-12 flex"
          style={{ background: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 62%)` }}>
          <div className="pulso m-auto w-full max-w-3xl">
          <div className="flex items-center gap-4">
            <p className="text-7xl" aria-hidden><Icono nombre={EMOJI[v.color] ?? "ayuda"} /></p>
            {/* La foto, si tiene (sin foto la dirección responde vacía y no se muestra nada). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={elegido.socio_id} src={`/panel/socios/${elegido.socio_id}/foto`} alt={`Foto de ${elegido.nombre}`} data-foto-entrada
              className="size-28 sm:size-36 rounded-[var(--radio)] object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </div>
          <p className="titular text-6xl sm:text-8xl mt-4 break-words">{elegido.nombre}</p>
          <p className="text-3xl sm:text-4xl mt-4 font-semibold">{v.texto}</p>
          {guia?.falta && <p className="mt-2 text-2xl font-semibold" data-falta>{guia.falta}</p>}
          {guia?.decile && <p className="mt-2 text-2xl" data-decile><Icono nombre="mensaje" /> {guia.decile}</p>}
          {guia?.chips.length ? <ul className="mt-3 flex flex-wrap gap-2" data-chips>{guia.chips.map((c) => <li key={c.clave} data-chip={c.clave} className="pildora whitespace-normal"><span aria-hidden><Icono nombre={c.emoji} /></span> {c.href ? <LinkPanel href={c.href.startsWith("/panel") ? c.href : `/panel${c.href}`} siNoEsta="texto" className="underline">{c.texto}</LinkPanel> : c.texto}</li>)}</ul> : null}
          {v.avisos?.length ? <ul className="mt-3 space-y-1 texto-suave">{v.avisos.map((a) => <li key={a}>• {a}</li>)}</ul> : null}
          {apto && <p className="mt-3 pildora pildora-amarillo whitespace-normal" data-aviso-apto>{apto}</p>}
          {firmar && <p className="mt-3 pildora pildora-amarillo whitespace-normal" data-aviso-firmar>{firmar}</p>}
          {v.para_regularizar ? <p className="mt-2 texto-suave">Para ponerse al día: <strong className="text-[var(--texto)]">{formatearPesos(v.para_regularizar)}</strong></p> : null}

          <div className="flex flex-wrap gap-2 mt-7">
            {v.puede ? (
              <button type="button" disabled={ocupado} onClick={() => anotar()} className="boton boton-principal text-lg px-8"><Icono nombre="ok" /> Anotar entrada</button>
            ) : (
              <>
                {/* VD-46M: puerta en emergencia: a quien no podía entrar se lo anota igual (queda marcado). Es un clic a propósito: Enter no lo hace. */}
                {guia?.emergencia && <button type="button" disabled={ocupado} onClick={() => anotar()} className="boton boton-principal text-lg px-8" data-anotar-emergencia><Icono nombre="alerta-circulo" /> Anotar entrada (emergencia)</button>}
                {/* En pausa no se cobra: si volvió antes, se termina la pausa y entra. */}
                {v.motivo === "congelada"
                  ? <button type="button" disabled={ocupado} onClick={volvioAntes} className="boton boton-principal text-lg px-8"><Icono nombre="pesa" /> Volvió antes: terminar la pausa</button>
                  : <BotonCobrar socioId={elegido.socio_id} origen="entrada" cuota={!!v.para_regularizar} className="boton boton-principal text-lg px-8"><Icono nombre="plata" /> Cobrar</BotonCobrar>}
                {/* D1: a un suspendido o dado de baja lo deja pasar el dueño o el encargado (la base lo frena igual). */}
                {!forzando && (esRecepcion && (v.motivo === "suspendido" || v.motivo === "se_fue")
                  ? <p className="basis-full texto-suave"><Icono nombre="candado" /> A este socio lo deja pasar el dueño o el encargado.</p>
                  : <button type="button" onClick={() => { setForzando(true); void cupoDejarPasar().then(setCupo); }} className="boton"><Icono nombre="puerta" /> Dejar pasar igual</button>)}
              </>
            )}
            <LinkPanel href={`/panel/socios/${elegido.socio_id}`} className="boton"><Icono nombre="persona" /> Ver ficha</LinkPanel>
            {salidaModo !== "no" && <button type="button" onClick={() => marcarSalida(elegido.socio_id, elegido.nombre)} disabled={ocupado} className="boton" data-ventana-salida-boton><Icono nombre="salir" /> Salida</button>}
            <button type="button" onClick={reiniciar} className="boton">✕ Otro socio</button>
          </div>

          {forzando && (
            <FormDejarPasar motivo={motivo} setMotivo={setMotivo} cupo={cupo} ocupado={ocupado} porPlata={!!v.para_regularizar} alConfirmar={(p) => anotar(motivo, p)} />
          )}
          <p className="mt-6 text-sm texto-suave">{v.puede ? "Enter anota la entrada · " : ""}Esc vuelve a buscar · escribí para buscar a otro</p>
          </div>
        </section>
      )}
      {camara && <Camara alLeer={porQr} alCerrar={() => { setCamara(false); campo.current?.focus(); }} />}
      {elegido && !v && ocupado && <div className="h-48 rounded-[var(--radio-grande)] bg-[var(--tarjeta)] animate-pulse" />}
    </div>
  );
}
