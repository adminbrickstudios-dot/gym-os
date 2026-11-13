"use client";
// E1 · La barrita del DNI (abajo a la derecha, compu). Tipear números fuera de un campo ya no abre la ventana grande:
// la barrita muestra lo que se escribe ("DNI 30.45…") y al terminar (Enter, lector USB, o 7–8 dígitos y una pausa corta)
// el resultado sale ahí mismo: color, nombre, foto, el motivo en palabras y UN botón principal.
// La pregunta central sigue siendo UNA función: acá no se calcula nada. Lo que se ve sale de estado_acceso / guia_entrada
// (`veredicto`, `entradaRapida`) y lo que se anota, de registrar_ingreso (`registrarEntrada`).
// Nunca roba lo que se escribe en un campo, ni se abre con el PIN, la calculadora de billetes, el monto de Cobrar o una hoja abierta.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { entradaRapida, leerLlavero, leerQR, registrarEntrada, veredicto, type Guia, type ResultadoIngreso, type Veredicto } from "@/app/panel/entrada/acciones";
import { esLecturaRepetida, LECTOR_PAUSA_MAX_MS } from "@/app/panel/entrada/lector";
import { sonar } from "@/app/panel/entrada/sonido";
import { leerConReintento } from "@/lib/panel/lectura";
import { Icono } from "@/components/ui/Icono";
import { colorVar, PuntoEstado } from "../Estado";
import { EVENTO_ABRIR_SOCIO } from "../AvisosEntrada";
import { abrirCobrar, hayHojaCobrar, EVENTO_COBRAR, EVENTO_COBRAR_CERRADO, EVENTO_COBRO_HECHO, type CobroHecho } from "../cobrar/evento";
import { conPuntos, EMOJI, ES_QR, esEditable, EVENTO_ABRIR_ENTRADA_CON, hayAlgoEncima, sinPuntos, type PedidoAbrirSocio } from "./comun";
import { avisarFalloRed, avisarRedOk, esErrorDeRed, TEXTO_SIN_INTERNET } from "./conexion";

type Via = "recepcion" | "qr_socio" | "nfc";
type Res = { socio: ResultadoSocio; v: Veredicto; guia: Guia | null; apto: string | null; firmar: string | null; via: Via; error?: string };
type Fase =
  | { t: "idle" }
  | { t: "escribiendo" }
  | { t: "buscando" }
  | { t: "lista"; socios: ResultadoSocio[]; marcado: number }
  | { t: "nadie"; texto: string }
  | { t: "resultado"; r: Res; en: number }
  | { t: "anotando"; r: Res }
  | { t: "entro"; socio: ResultadoSocio; texto: string; motivo: string; color: "verde" | "amarillo" | "rojo" }
  | { t: "error"; msg: string; red: boolean };

/** Cuánto vive cada estado si nadie lo toca (ms). El mouse encima lo frena. */
const VIDA: Record<string, number> = { escribiendo: 15000, lista: 20000, nadie: 10000, error: 8000, resultado: 45000, entro: 4000, buscando: 30000, anotando: 30000 };
/** 7–8 dígitos y esta pausa = terminó de escribir el DNI. */
const PAUSA_DNI_MS = 600;
/** Un Enter que llega apenas sale el resultado es el segundo del lector: no anota. */
const ENTER_TARDE_MS = 500;

/**
 * Dónde se para la barrita: abajo a la derecha; si ahí taparía un botón "Cobrar" de la pantalla (Vender, Vencen hoy), abajo en el medio.
 * Se decide una vez, al empezar a escribir: no se corre mientras se usa.
 */
function elegirLado(): "derecha" | "centro" {
  const w = window.innerWidth, h = window.innerHeight;
  const ancho = Math.min(368, w - 32), alto = 320;
  const choca = (x0: number) => [...document.querySelectorAll<HTMLElement>("main a, main button")].some((e) => {
    if (!/^Cobrar(\s*\S{0,3})?$/i.test((e.textContent ?? "").trim())) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.left < x0 + ancho && r.right > x0 && r.top < h - 16 && r.bottom > h - 16 - alto;
  });
  if (!choca(w - 16 - ancho)) return "derecha";
  return choca((w - ancho) / 2) ? "derecha" : "centro";
}

const iniciales = (n: string) => { const [a, b] = n.trim().split(/\s+/); return `${(a?.[0] ?? "?").toUpperCase()}${(b?.[0] ?? "").toUpperCase()}`; };

export function Barrita({ sedeId, zona, activa, sonido, soloEnVerde, conLlavero, esRecepcion, sinInternet, onIngreso }: {
  sedeId: string; zona: string;
  /** Hay que atender el teclado: compu, modo "aviso", sin la ventana grande abierta ni la pantalla de Entrada. */
  activa: boolean; sonido: boolean; soloEnVerde: boolean; conLlavero: boolean; esRecepcion: boolean; sinInternet: boolean;
  /** Se anotó una entrada desde la barrita: la pantalla refresca sus números (la ventana lo hace con un solo refresco diferido). */
  onIngreso: () => void;
}) {
  const ruta = usePathname();
  const [fase, setFase] = useState<Fase>({ t: "idle" });
  const [texto, setTexto] = useState("");
  const [tic, setTic] = useState(0);
  const [cobrando, setCobrando] = useState(false);
  const [lado, setLado] = useState<"derecha" | "centro">("derecha");
  const caja = useRef<HTMLDivElement>(null);
  const faseRef = useRef<Fase>(fase);
  const textoRef = useRef("");
  const P = useRef({ sedeId, zona, activa, sonido, soloEnVerde, conLlavero, esRecepcion, sinInternet, onIngreso });
  const ultimaTecla = useRef(0);
  const rafaga = useRef("");
  const ultimaLectura = useRef<{ codigo: string; en: number } | null>(null);
  const ultimoFase = useRef<Fase | null>(null);   // lo último que se mostró: si el lector repite el código, eso vuelve
  const trabajando = useRef(false);
  const pendiente = useRef("");     // lo que se tipeó mientras se buscaba o se anotaba: arranca el próximo
  const busqueda = useRef(0);       // para descartar respuestas viejas
  const encima = useRef(false);     // el mouse está sobre la barrita: no se esconde

  useEffect(() => { P.current = { sedeId, zona, activa, sonido, soloEnVerde, conLlavero, esRecepcion, sinInternet, onIngreso }; });
  const poner = useCallback((f: Fase) => { faseRef.current = f; setFase(f); }, []);
  const ponerTexto = useCallback((t: string) => { textoRef.current = t; setTexto(t); }, []);

  const cancelar = useCallback(() => {
    busqueda.current++; trabajando.current = false; pendiente.current = ""; rafaga.current = ""; ultimoFase.current = null; ultimaLectura.current = null;
    ponerTexto(""); poner({ t: "idle" });
  }, [poner, ponerTexto]);
  const cancelarRef = useRef(cancelar);
  useEffect(() => { cancelarRef.current = cancelar; });

  const hora = useCallback(() => new Intl.DateTimeFormat("es-AR", { timeZone: P.current.zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()), []);
  const sonarSi = useCallback((color: string) => { if (P.current.sonido) sonar(color); }, []);

  /** Si se tipeó algo mientras se trabajaba, eso arranca la próxima búsqueda; si no, lo que haya. */
  const siguiente = useCallback((f: Fase) => {
    trabajando.current = false;
    const p = pendiente.current; pendiente.current = "";
    ultimoFase.current = f;
    if (f.t !== "error") avisarRedOk();   // lo que salió bien prueba que hay internet
    // Lo que se tipeó mientras se buscaba es el mismo código otra vez (el lector que manda dos veces): se descarta, el resultado queda.
    const duplicado = !!p && !!ultimaLectura.current && sinPuntos(p).trim() === ultimaLectura.current.codigo && Date.now() - ultimaLectura.current.en < 2000;
    if (p && !duplicado) { ponerTexto(p); poner({ t: "escribiendo" }); return; }
    poner(f);
  }, [poner, ponerTexto]);

  const falloDe = useCallback((e: unknown) => {
    if (esErrorDeRed(e)) { avisarFalloRed(); sonarSi("rojo"); siguiente({ t: "error", msg: TEXTO_SIN_INTERNET, red: true }); return; }
    sonarSi("rojo");
    siguiente({ t: "error", msg: (e as Error)?.message || "No se pudo ver el estado", red: false });
  }, [siguiente, sonarSi]);

  /** Un socio ya elegido: el veredicto lo da la base; con "anotar solo en verde" prendido, el verde se anota en la misma llamada. */
  const elegirSocio = useCallback(async (s: ResultadoSocio, via: Via = "recepcion") => {
    const mia = ++busqueda.current;
    trabajando.current = true;
    poner({ t: "buscando" });
    try {
      const auto = P.current.soloEnVerde && via === "recepcion";
      const x = auto ? await entradaRapida(s.socio_id, P.current.sedeId, true) : await veredicto(s.socio_id, P.current.sedeId);
      if (mia !== busqueda.current) return;
      if (x.error || !x.v) { sonarSi("rojo"); siguiente({ t: "error", msg: x.error ?? "No se pudo ver el estado", red: false }); return; }
      const v = x.v;
      const ingreso = (x as { r?: ResultadoIngreso }).r;
      if (ingreso) {
        sonarSi(v.color === "verde" ? "verde" : "amarillo");
        P.current.onIngreso();
        siguiente({ t: "entro", socio: s, texto: ingreso.repetido ? (ingreso.texto ?? "Ya había entrado hace un momento") : `Entró ${hora()}`, motivo: v.texto, color: ingreso.repetido ? "amarillo" : "verde" });
        return;
      }
      sonarSi(v.color);
      siguiente({ t: "resultado", r: { socio: s, v, guia: x.guia ?? null, apto: x.apto ?? null, firmar: x.firmar ?? null, via }, en: Date.now() });
    } catch (e) { if (mia === busqueda.current) falloDe(e); }
  }, [poner, siguiente, falloDe, sonarSi, hora]);

  /** QR o llavero leído por USB: si puede entrar se anota solo (como siempre); si no, queda el resultado con el porqué. */
  const directo = useCallback(async (socio: { socio_id: string; nombre: string; numero: number } | null | undefined, error: string | undefined, via: Via) => {
    if (error || !socio) { sonarSi("rojo"); siguiente({ t: "error", msg: error ?? "No se pudo leer", red: false }); return; }
    const s: ResultadoSocio = { ...socio, color: "gris", texto: "", puede: false, dado_de_baja: false };
    const mia = busqueda.current;
    const x = await veredicto(s.socio_id, P.current.sedeId);
    if (mia !== busqueda.current) return;
    if (x.error || !x.v) { sonarSi("rojo"); siguiente({ t: "error", msg: x.error ?? "No se pudo ver el estado", red: false }); return; }
    sonarSi(x.v.color);
    if (x.v.puede) {
      const e = await registrarEntrada(s.socio_id, P.current.sedeId, undefined, via);
      if (mia !== busqueda.current) return;
      if (e.error || !e.r) { siguiente({ t: "error", msg: e.error ?? "No se pudo anotar", red: false }); return; }
      P.current.onIngreso();
      siguiente({ t: "entro", socio: s, texto: e.r.repetido ? (e.r.texto ?? "Ya había entrado hace un momento") : `Entró ${hora()}`, motivo: x.v.texto, color: e.r.repetido ? "amarillo" : "verde" });
      return;
    }
    siguiente({ t: "resultado", r: { socio: s, v: x.v, guia: x.guia ?? null, apto: x.apto ?? null, firmar: x.firmar ?? null, via }, en: Date.now() });
  }, [siguiente, sonarSi, hora]);

  /** Enter (o la pausa del DNI): QR, llavero, o buscar. Un número elige al primero; un nombre muestra los 3 primeros. */
  const resolver = useCallback(async (crudo: string) => {
    const t = sinPuntos(crudo).trim();
    if (!t || trabajando.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      sonarSi("rojo"); poner({ t: "error", msg: TEXTO_SIN_INTERNET, red: true }); return;
    }
    const ahora = Date.now();
    if (esLecturaRepetida(ultimaLectura.current, t, ahora)) {   // el lector que manda dos veces el mismo código: un solo ingreso, y el resultado vuelve
      ponerTexto(""); poner(ultimoFase.current ?? { t: "idle" }); return;
    }
    ultimaLectura.current = { codigo: t, en: ahora };
    const mia = ++busqueda.current;
    trabajando.current = true;
    poner({ t: "buscando" });
    try {
      if (ES_QR.test(t)) { const q = await leerQR(t); if (mia === busqueda.current) await directo(q.socio, q.error, "qr_socio"); return; }
      if (P.current.conLlavero && /^[A-Za-z0-9-]{4,30}$/.test(t) && !/^\d{7,9}$/.test(t)) {
        const l = await leerLlavero(t);
        if (mia !== busqueda.current) return;
        if (l.socio || l.error) { await directo(l.socio, l.error, "nfc"); return; }
      }
      const r = await leerConReintento(() => buscarSociosRapido(t));
      if (mia !== busqueda.current) return;
      if (r.error) { sonarSi("rojo"); siguiente({ t: "error", msg: r.error, red: false }); return; }
      const lista = r.socios ?? [];
      if (lista.length === 0) { sonarSi("rojo"); siguiente({ t: "nadie", texto: t }); return; }
      if (!/^\d+$/.test(t) && lista.length > 1) { siguiente({ t: "lista", socios: lista.slice(0, 3), marcado: 0 }); return; }
      await elegirSocio(lista[0]);
    } catch (e) { if (mia === busqueda.current) falloDe(e); }
  }, [poner, ponerTexto, siguiente, directo, elegirSocio, falloDe, sonarSi]);
  const resolverRef = useRef(resolver);
  useEffect(() => { resolverRef.current = resolver; });
  const elegirRef = useRef(elegirSocio);
  useEffect(() => { elegirRef.current = elegirSocio; });

  /** El botón principal "Anotar entrada": registrar_ingreso, y el resultado sale en la misma barrita. */
  const anotar = useCallback(async () => {
    const f = faseRef.current;
    if (f.t !== "resultado" || trabajando.current) return;
    const r = f.r;
    trabajando.current = true;
    poner({ t: "anotando", r });
    try {
      const x = await registrarEntrada(r.socio.socio_id, P.current.sedeId, undefined, r.via);
      if (x.error || !x.r) { siguiente({ t: "resultado", r: { ...r, error: x.error ?? "No se pudo anotar" }, en: Date.now() }); return; }
      const ing: ResultadoIngreso = x.r;
      P.current.onIngreso();
      const rechazado = ing.resultado === "rechazado";
      if (rechazado) sonarSi("rojo");
      siguiente({
        t: "entro", socio: r.socio, motivo: r.v.texto,
        texto: rechazado ? "Anotado: no pudo entrar" : ing.repetido ? (ing.texto ?? "Ya había entrado hace un momento") : `Entró ${hora()}`,
        color: rechazado ? "rojo" : ing.repetido || ing.alerta_prestamo || r.v.color !== "verde" ? "amarillo" : "verde",
      });
    } catch (e) {
      if (esErrorDeRed(e)) { avisarFalloRed(); siguiente({ t: "error", msg: TEXTO_SIN_INTERNET, red: true }); }
      else siguiente({ t: "resultado", r: { ...r, error: (e as Error)?.message || "No se pudo anotar" }, en: Date.now() });
    }
  }, [poner, siguiente, sonarSi, hora]);
  const anotarRef = useRef(anotar);
  useEffect(() => { anotarRef.current = anotar; });

  const abrirGrande = useCallback((s: ResultadoSocio, dejar = false) => {
    cancelar();
    window.dispatchEvent(new CustomEvent<PedidoAbrirSocio>(EVENTO_ABRIR_SOCIO, { detail: { ...s, dejar } }));
  }, [cancelar]);

  // ── El teclado: un solo oyente, que lee las copias de abajo (vive mucho) ──
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!P.current.activa) return;
      const f = faseRef.current;
      const t = e.target as HTMLElement | null;
      if (f.t !== "idle" && e.key === "Escape" && !esEditable(t)) { e.preventDefault(); cancelarRef.current(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (esEditable(t) || hayAlgoEncima()) return;
      const imprimible = e.key.length === 1;
      const digito = /^[0-9]$/.test(e.key);
      const rapida = imprimible && ultimaTecla.current > 0 && e.timeStamp - ultimaTecla.current < LECTOR_PAUSA_MAX_MS;
      if (imprimible) ultimaTecla.current = e.timeStamp;

      if (f.t === "idle") {
        // Un número abre la barrita. Un código del lector que empieza con letras (QR, llavero) también: teclas de corrido.
        if (digito) { e.preventDefault(); rafaga.current = e.key; setLado(elegirLado()); ponerTexto(e.key); poner({ t: "escribiendo" }); return; }
        if (imprimible) {
          rafaga.current = rapida ? rafaga.current + e.key : e.key;
          if (rapida && rafaga.current.length >= 2 && !/^\s+$/.test(rafaga.current)) { e.preventDefault(); setLado(elegirLado()); ponerTexto(rafaga.current); poner({ t: "escribiendo" }); }
        }
        return;
      }
      // Con un botón de la barrita con el foco, Enter y espacio son del botón (si no, anotaría dos veces).
      if ((e.key === "Enter" || e.key === " ") && (t?.tagName === "BUTTON" || t?.tagName === "A")) return;

      if (e.key === "Enter") {
        e.preventDefault();
        const g = faseRef.current;
        if (g.t === "escribiendo" || g.t === "nadie" || g.t === "error") { if (textoRef.current.trim()) void resolverRef.current(textoRef.current); return; }
        if (g.t === "lista") { void elegirRef.current(g.socios[g.marcado]); return; }
        if (g.t === "resultado") {
          // El segundo Enter del lector (o un Enter apurado) no anota: tiene que pasar un instante desde que salió el resultado.
          if (Date.now() - g.en < ENTER_TARDE_MS) return;
          if (puedeAnotarConEnter(g.r)) void anotarRef.current();
        }
        return;   // buscando, anotando, entro: el Enter de más se traga
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (f.t === "lista") { e.preventDefault(); poner({ ...f, marcado: Math.max(0, Math.min(f.socios.length - 1, f.marcado + (e.key === "ArrowDown" ? 1 : -1))) }); }
        return;
      }
      if (e.key === "Backspace") {
        if (f.t === "escribiendo" || f.t === "lista" || f.t === "nadie" || f.t === "error") {
          e.preventDefault();
          const n = textoRef.current.slice(0, -1);
          if (!n) { cancelarRef.current(); return; }
          ponerTexto(n); poner({ t: "escribiendo" });
        }
        return;
      }
      if (imprimible) {
        e.preventDefault();
        if (f.t === "buscando" || f.t === "anotando") { pendiente.current += e.key; return; }   // el lector ya manda el próximo: no se pierde
        const nuevo = f.t === "escribiendo" || f.t === "lista" ? textoRef.current + e.key : e.key;   // sobre un resultado, tipear arranca de cero
        busqueda.current++; trabajando.current = false;
        ponerTexto(nuevo); poner({ t: "escribiendo" });
      }
    };
    // Si el foco entra a un campo (o se abre una hoja), la barrita se corre: nunca compite con lo que se escribe ahí.
    const foco = (e: FocusEvent) => { if (faseRef.current.t !== "idle" && esEditable(e.target)) cancelarRef.current(); };
    window.addEventListener("keydown", tecla);
    window.addEventListener("focusin", foco);
    return () => { window.removeEventListener("keydown", tecla); window.removeEventListener("focusin", foco); };
  }, [poner, ponerTexto]);

  // Se apaga (ventana grande abierta, otra pantalla): se va, con todo lo que tenía.
  useEffect(() => { if (!activa) cancelarRef.current(); }, [activa]);
  useEffect(() => { cancelarRef.current(); }, [ruta]);

  // 7–8 dígitos y una pausa corta = terminó el DNI. Letras: coincidencias mientras escribe (los 3 primeros).
  useEffect(() => {
    if (fase.t !== "escribiendo") return;
    const t = sinPuntos(texto).trim();
    const soloNumeros = /^\d+$/.test(t);
    if (soloNumeros && t.length >= 7 && t.length <= 8) {
      const id = setTimeout(() => { if (faseRef.current.t === "escribiendo") void resolverRef.current(t); }, PAUSA_DNI_MS);
      return () => clearTimeout(id);
    }
    if (!soloNumeros && t.length >= 3 && !ES_QR.test(t)) {
      const id = setTimeout(async () => {
        if (navigator.onLine === false || trabajando.current) return;
        const mia = ++busqueda.current;
        try {
          const r = await leerConReintento(() => buscarSociosRapido(t));
          if (mia !== busqueda.current || sinPuntos(textoRef.current).trim() !== t) return;
          if (r.error) { poner({ t: "error", msg: r.error, red: false }); return; }
          const lista = (r.socios ?? []).slice(0, 3);
          poner(lista.length ? { t: "lista", socios: lista, marcado: 0 } : { t: "nadie", texto: t });
        } catch (e) { if (mia === busqueda.current) { if (esErrorDeRed(e)) avisarFalloRed(); poner({ t: "error", msg: esErrorDeRed(e) ? TEXTO_SIN_INTERNET : "No se pudo buscar", red: esErrorDeRed(e) }); } }
      }, 250);
      return () => clearTimeout(id);
    }
  }, [fase, texto, poner]);
  // La lista de nombres sigue a lo que se escribe: si cambió el texto, vuelve a "escribiendo" y esto la rehace (arriba).

  // Cada estado se va solo si nadie lo toca; con el mouse encima no se esconde.
  useEffect(() => {
    if (fase.t === "idle") return;
    const id = setTimeout(() => {
      if (encima.current && fase.t !== "buscando" && fase.t !== "anotando") { setTic((n) => n + 1); return; }
      if (fase.t === "buscando" || fase.t === "anotando") { trabajando.current = false; poner({ t: "error", msg: "No contestó a tiempo: probá de nuevo", red: false }); return; }
      cancelarRef.current();
    }, VIDA[fase.t] ?? 15000);
    return () => clearTimeout(id);
  }, [fase, texto, tic, poner]);

  // Cobrar: la hoja se abre sobre la pantalla; mientras está, la barrita se esconde; al cobrar vuelve con el veredicto nuevo.
  useEffect(() => {
    const abierta = () => setCobrando(true);
    const cerrada = () => setCobrando(false);
    const hecho = (e: Event) => {
      const c = (e as CustomEvent<CobroHecho>).detail;
      const f = faseRef.current;
      if (c.origen === "entrada" && f.t === "resultado" && f.r.socio.socio_id === c.socioId) void elegirRef.current(f.r.socio, f.r.via);
    };
    window.addEventListener(EVENTO_COBRAR, abierta);
    window.addEventListener(EVENTO_COBRAR_CERRADO, cerrada);
    window.addEventListener(EVENTO_COBRO_HECHO, hecho);
    return () => { window.removeEventListener(EVENTO_COBRAR, abierta); window.removeEventListener(EVENTO_COBRAR_CERRADO, cerrada); window.removeEventListener(EVENTO_COBRO_HECHO, hecho); };
  }, []);

  // Los avisos de QR se apilan encima de la barrita (--barrita-alto = su alto + 8 px), y el botón redondo se corre mientras está.
  const visible = fase.t !== "idle" && activa && !cobrando;
  useEffect(() => {
    const raiz = document.documentElement;
    if (!visible || !caja.current) { raiz.style.removeProperty("--barrita-alto"); delete raiz.dataset.barritaVisible; return; }
    raiz.dataset.barritaVisible = "si";
    const medir = () => { if (caja.current) raiz.style.setProperty("--barrita-alto", `${Math.ceil(caja.current.getBoundingClientRect().height) + 8}px`); };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(caja.current);
    return () => { ro.disconnect(); raiz.style.removeProperty("--barrita-alto"); delete raiz.dataset.barritaVisible; };
  }, [visible, fase.t]);

  if (!visible) return null;

  const etiqueta = /^[\d.]*$/.test(texto) ? `DNI ${conPuntos(texto)}` : texto;
  const rojoRed = sinInternet || (fase.t === "error" && fase.red);
  const colorBorde = fase.t === "resultado" || fase.t === "anotando" ? colorVar(fase.r.v.color)
    : fase.t === "entro" ? colorVar(fase.color) : rojoRed ? colorVar("rojo") : "var(--borde)";

  return (
    <div ref={caja} data-barrita={fase.t} data-barrita-color={fase.t === "resultado" || fase.t === "anotando" ? fase.r.v.color : fase.t === "entro" ? fase.color : undefined}
      role="status" aria-live="polite" aria-label="Entrada por DNI"
      onMouseEnter={() => { encima.current = true; }} onMouseLeave={() => { encima.current = false; }}
      className="barrita fixed z-40 bottom-4 w-[min(23rem,calc(100vw-2rem))] rounded-[var(--radio)] bg-[var(--tarjeta)] overflow-hidden border-2"
      style={{ borderColor: colorBorde, boxShadow: "var(--sombra-flota)", ...(lado === "centro" ? { left: "calc(50% - min(11.5rem, 50vw - 1rem))" } : { right: "1rem" }) }}>
      {rojoRed && (
        <p data-barrita-sin-internet className="px-4 py-2 font-bold text-white text-center bg-[color-mix(in_oklab,var(--rojo),black_38%)]"><Icono nombre="alerta" /> {TEXTO_SIN_INTERNET}</p>
      )}
      {(fase.t === "escribiendo" || fase.t === "buscando" || fase.t === "lista" || fase.t === "nadie" || fase.t === "error") && (
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <span aria-hidden className="text-xl"><Icono nombre="puerta" /></span>
            <span data-barrita-texto className="numero text-2xl font-bold tracking-wide truncate flex-1">{etiqueta || "…"}{fase.t === "escribiendo" && <span aria-hidden className="barrita-cursor" />}</span>
            <kbd className="text-xs texto-tenue font-sans">Esc</kbd>
          </div>
          {fase.t === "escribiendo" && <p className="texto-tenue text-sm">{/^\d*$/.test(sinPuntos(texto)) ? "Enter para buscar" : "Buscando por nombre…"} · Esc cancela</p>}
          {fase.t === "buscando" && <div className="h-5 rounded-[var(--radio)] bg-[var(--tarjeta-alta)] esqueleto" aria-hidden />}
          {fase.t === "error" && !fase.red && <p className="text-sm" style={{ color: "var(--rojo)" }}>{fase.msg}</p>}
          {fase.t === "nadie" && (
            <div className="space-y-2" data-barrita-nadie>
              <p className="font-semibold">{/^\d{6,9}$/.test(fase.texto) ? `No hay nadie con el DNI ${conPuntos(fase.texto)}` : `No encontramos a “${fase.texto}”`}</p>
              {/^\d{6,9}$/.test(fase.texto) && (
                <button type="button" className="boton w-full" data-barrita-alta
                  onClick={() => { const t = fase.texto; cancelar(); window.dispatchEvent(new CustomEvent<string>(EVENTO_ABRIR_ENTRADA_CON, { detail: t })); }}><Icono nombre="mas" /> Darlo de alta</button>
              )}
            </div>
          )}
          {fase.t === "lista" && (
            <ul className="space-y-1" aria-label="Coincidencias" data-barrita-lista>
              {fase.socios.map((s, i) => (
                <li key={s.socio_id}>
                  <button type="button" aria-current={i === fase.marcado} onClick={() => void elegirSocio(s)}
                    className={`w-full flex items-center gap-2 text-left rounded-[var(--radio)] border px-3 py-2 min-h-11 active:opacity-70 ${i === fase.marcado ? "border-[var(--acento)]" : "border-[var(--borde)]"}`}>
                    <PuntoEstado color={s.color} />
                    <span className="min-w-0 flex-1"><span className="block font-semibold truncate">{s.nombre}</span><span className="block text-sm texto-suave truncate">{s.texto}</span></span>
                  </button>
                </li>
              ))}
              <li className="texto-tenue text-xs pt-1">↑ ↓ para elegir · Enter</li>
            </ul>
          )}
        </div>
      )}

      {(fase.t === "resultado" || fase.t === "anotando") && <Resultado fase={fase} esRecepcion={esRecepcion} onAbrir={(dejar) => abrirGrande(fase.r.socio, dejar)} onAnotar={() => void anotar()} />}

      {fase.t === "entro" && (
        <div data-barrita-entro={fase.color} className="px-4 py-3 flex items-center gap-3"
          style={{ background: `color-mix(in oklab, ${colorVar(fase.color)}, var(--fondo) 80%)` }}>
          <Foto socio={fase.socio} tam="size-12" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-lg leading-tight">{fase.color === "rojo" ? "No pudo entrar" : <>{fase.texto.startsWith("Entró") ? <><span className="barrita-tilde" aria-hidden><Icono nombre="ok" /></span> </> : null}{fase.texto}</>}</p>
            <p className="font-semibold truncate">{fase.socio.nombre}</p>
            <p className="text-sm texto-suave truncate">{fase.motivo}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const principalDe = (r: Res) => r.guia?.boton ?? (r.v.puede ? "anotar" : "cobrar");
/** Enter anota solo si el botón principal es "Anotar entrada" y hay permiso para anotar (la puerta en emergencia es un clic a propósito). */
const puedeAnotarConEnter = (r: Res) => principalDe(r) === "anotar" && r.v.puede;

function Foto({ socio, tam }: { socio: ResultadoSocio; tam: string }) {
  return (
    <span className={`relative ${tam} flex-none rounded-[var(--radio)] bg-[var(--tarjeta-alta)] flex items-center justify-center font-bold overflow-hidden`}>
      {iniciales(socio.nombre)}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={socio.socio_id} src={`/panel/socios/${socio.socio_id}/foto`} alt={`Foto de ${socio.nombre}`} data-foto-barrita
        className="absolute inset-0 size-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
    </span>
  );
}

function Resultado({ fase, esRecepcion, onAbrir, onAnotar }: { fase: Extract<Fase, { t: "resultado" | "anotando" }>; esRecepcion: boolean; onAbrir: (dejar: boolean) => void; onAnotar: () => void }) {
  const { r } = fase;
  const { v, guia, socio } = r;
  const trabajando = fase.t === "anotando";
  const principal = principalDe(r);
  const bloqueado = !v.puede && esRecepcion && (!!guia?.solo_encargado || v.motivo === "suspendido" || v.motivo === "se_fue");
  const aviso = r.apto ?? r.firmar ?? null;
  let boton: React.ReactNode;
  if (principal === "anotar" && v.puede) {
    boton = <button type="button" disabled={trabajando} data-barrita-anotar className="boton boton-principal w-full" onClick={onAnotar}><Icono nombre="ok" /> {trabajando ? "Anotando…" : "Anotar entrada"} {!trabajando && <kbd className="text-xs opacity-70 font-sans">Enter</kbd>}</button>;
  } else if (principal === "anotar" && !v.puede && guia?.emergencia) {
    boton = <button type="button" disabled={trabajando} data-barrita-anotar data-anotar-emergencia className="boton boton-principal w-full" onClick={onAnotar}><Icono nombre="alerta-circulo" /> {trabajando ? "Anotando…" : "Anotar entrada (emergencia)"}</button>;
  } else if (principal === "cobrar" || principal === "cobrar_pack") {
    boton = <button type="button" data-barrita-cobrar className="boton boton-principal w-full"
      onClick={() => { if (hayHojaCobrar()) abrirCobrar({ socioId: socio.socio_id, origen: "entrada" }); else onAbrir(false); }}>{guia?.boton_texto || (principal === "cobrar_pack" ? "Cobrar un pack" : "Cobrar")}</button>;
  } else if (principal === "dejar_pasar" && !bloqueado) {
    boton = <button type="button" data-barrita-dejar className="boton boton-principal w-full" onClick={() => onAbrir(true)}><Icono nombre="usuarios" /> Dejar pasar</button>;
  } else {
    boton = <button type="button" data-barrita-abrir className="boton boton-principal w-full" onClick={() => onAbrir(false)}><Icono nombre="persona" /> {bloqueado ? "Ver ficha: lo deja pasar el encargado" : "Abrir"}</button>;
  }
  return (
    <div data-barrita-resultado={v.color}>
      <div className="px-4 py-2 font-bold leading-snug" style={{ background: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 55%)` }}>
        <span aria-hidden><Icono nombre={EMOJI[v.color] ?? "ayuda"} /></span> <span data-barrita-motivo>{v.texto}</span>
      </div>
      <div className="px-4 pt-3 pb-4 space-y-3">
        <button type="button" onClick={() => onAbrir(false)} className="w-full flex items-center gap-3 text-left active:opacity-70" title="Abrir la ventana grande con este socio" data-barrita-abrir-grande>
          <Foto socio={socio} tam="size-14" />
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-xl leading-tight break-words" data-barrita-nombre>{socio.nombre}</span>
            <span className="block text-sm texto-suave">{socio.numero != null ? `Socio #${socio.numero}` : ""}{guia?.falta ? `${socio.numero != null ? " · " : ""}${guia.falta}` : ""}</span>
          </span>
        </button>
        {aviso && <p className="pildora pildora-amarillo whitespace-normal">{aviso}</p>}
        {r.error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--rojo)" }}>{r.error}</p>}
        {boton}
        <p className="texto-tenue text-xs">{puedeAnotarConEnter(r) ? "Enter anota · " : ""}Esc cierra · tocá el nombre para abrir la ventana</p>
      </div>
    </div>
  );
}
