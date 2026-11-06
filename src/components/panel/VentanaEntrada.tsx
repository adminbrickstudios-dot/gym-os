"use client";
// VD-1 · La Entrada que está en todos lados (docs/v2/01-ENTRADA.md §1-2 y §6).
// Una sola ventana flotante en el layout del panel: se abre al tipear un número
// (fuera de campos de texto), con el botón (F2 / Ctrl+E) o con un lector USB, y
// opcionalmente hay una barra fija a la derecha. Todo lo que dice y hace sale de
// las funciones de la base de siempre (estado_acceso, registrar_ingreso, leer_qr…):
// acá no se calcula nada.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { anularEntrada, cupoDejarPasar, leerLlavero, leerQR, registrarEntrada, terminarPausa, veredicto, type Guia, type ResultadoIngreso, type Veredicto } from "@/app/panel/entrada/acciones";
import { efectiva, EVENTO_PISADO, leerPisado, type ConfigEntrada, type PisadoEnEstaCompu } from "@/app/panel/entrada/config";
import { CLAVE_SONIDO, sonar } from "@/app/panel/entrada/sonido";
import { ultimasEntradas, type UltimaEntrada } from "@/app/panel/entrada/ventana-acciones";
import { altaRapida, planesParaAlta, prospectoPorTelefono, volverADarDeAlta, type PlanParaAlta, type ProspectoOfrecido } from "@/app/panel/socios/acciones";
import { TarjetasPlan, PrimerPago } from "./TarjetasPlan";
import { Camara } from "@/app/panel/entrada/CamaraDinamica";
import { Hoja } from "@/components/ui/Hoja";
import { Mensaje } from "@/components/ui/Mensaje";
import { Tilde } from "@/components/ui/Tilde";
import { colorVar, PuntoEstado } from "./Estado";
import { EVENTO_ABRIR_SOCIO } from "./AvisosEntrada";
import { escucharEntradas } from "./entradas-vivo";
import { abrirCobrar, hayHojaCobrar, EVENTO_COBRAR_CERRADO, EVENTO_COBRO_HECHO, type CobroHecho } from "./cobrar/evento";
import { MandarComprobante } from "@/app/panel/vender/compartido";
import { formatearPesos } from "@/lib/formato";

export const EVENTO_ABRIR_ENTRADA = "gymos:abrir-entrada";

const ES_QR = /^GYMOS1\./;
const EMOJI: Record<string, string> = { verde: "✅", amarillo: "⚠️", naranja: "⚠️", rojo: "⛔", gris: "❔" };
const MOTIVOS_PASAR = ["Paga hoy más tarde", "Paga mañana", "Se olvidó el celular", "Clase de prueba", "Autorizado por el dueño"];

type Paso = "escribir" | "veredicto" | "anotado" | "alta";
/** VD-6 · El alta rápida dentro de la ventana: datos → plan → (cobro en la hoja) → entra. */
type Alta = {
  dni: string; nombre: string; apellido: string; telefono: string; plan: string;
  paso: "datos" | "plan"; planes: PlanParaAlta[] | null; ofrecido: ProspectoOfrecido | null; vinculado: string | null; error: string | null;
};
const CLAVE_SEDE = "gymos.entrada.sede";
/** VD-1b: la ficha abierta desde la ventana deja acá el socio (CLAVE_FICHA); su "Volver" lo pide de vuelta (CLAVE_VOLVER). */
const CLAVE_FICHA = "gymos.entrada.ficha";
const CLAVE_VOLVER = "gymos.entrada.volver";

/** VD-1b · El "Volver" de la ficha abierta desde la Entrada: regresa a donde estabas y la ventana se reabre con el mismo socio. */
export function VolverAEntrada({ socioId, nombre }: { socioId: string; nombre: string }) {
  const router = useRouter();
  return (
    <button type="button" className="boton boton-principal" data-volver-entrada
      onClick={() => {
        let socio: ResultadoSocio = { socio_id: socioId, numero: null, nombre, color: "gris", texto: "", puede: false, dado_de_baja: false };
        try {
          const guardado = JSON.parse(sessionStorage.getItem(CLAVE_FICHA) ?? "null");
          if (guardado?.socio?.socio_id === socioId) socio = guardado.socio;
          sessionStorage.setItem(CLAVE_VOLVER, JSON.stringify({ socio, ts: Date.now() }));
        } catch { /* sin almacenamiento: vuelve igual, sin reabrir */ }
        if (window.history.length > 1) router.back(); else router.push("/panel");
      }}>
      ← Volver a la Entrada con {nombre.split(" ")[0]}
    </button>
  );
}
type Hecho = ResultadoIngreso & { nombre: string; hora: string; socioId: string };

/** Un campo donde se escribe (la ventana nunca le roba el foco). */
const esEditable = (t: EventTarget | null) => {
  const e = t as HTMLElement | null;
  if (!e || !e.tagName) return false;
  return e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable;
};

/** El DNI con puntos a medida que se tipea (30.123.456); si no son solo números, tal cual. */
function conPuntos(t: string): string {
  if (!/^[\d.]*$/.test(t)) return t;
  const d = t.replace(/\./g, "");
  return d.length >= 7 ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : d;
}
const sinPuntos = (t: string) => (/^[\d.]*$/.test(t) ? t.replace(/\./g, "") : t);

function Iniciales({ nombre }: { nombre: string }) {
  const [a, b] = nombre.trim().split(/\s+/);
  return <>{(a?.[0] ?? "?").toUpperCase()}{(b?.[0] ?? "").toUpperCase()}</>;
}

export function VentanaEntrada({ gimnasioId, sedeId: sedeBase, zona, config, conQr, conLlavero, esRecepcion, sedes = [], puedeCobrar = false }: {
  gimnasioId: string; sedeId: string; zona: string; config: ConfigEntrada; conQr: boolean; conLlavero: boolean; esRecepcion: boolean;
  /** VD-1b: las sedes entre las que el dueño elige (vacío si no puede elegir). */
  sedes?: { id: string; nombre: string }[]; puedeCobrar?: boolean;
}) {
  const ruta = usePathname();
  // VD-1b: la sede en la que se anota (la elegida en esta compu; la base valida que sea del gimnasio).
  const [sedeElegida, setSedeElegida] = useState<string | null>(null);
  const sedeId = sedeElegida && sedes.some((s) => s.id === sedeElegida) ? sedeElegida : sedeBase;
  useEffect(() => {
    try { const g = localStorage.getItem(CLAVE_SEDE); if (g) setSedeElegida(g); } catch { /* sin almacenamiento */ }
  }, []);
  const elegirSede = (id: string) => { setSedeElegida(id); try { localStorage.setItem(CLAVE_SEDE, id); } catch { /* sin almacenamiento */ } };
  const [alta, setAlta] = useState<Alta | null>(null);
  // En la pantalla de Entrada la puerta ya está a la vista: la ventana no se mete.
  const propia = ruta.startsWith("/panel/entrada");

  const [pisado, setPisado] = useState<PisadoEnEstaCompu>({});
  const cfg = efectiva(config, pisado);
  const [abierta, setAbierta] = useState(false);
  const [paso, setPaso] = useState<Paso>("escribir");
  const [texto, setTexto] = useState("");
  const [socios, setSocios] = useState<ResultadoSocio[]>([]);
  const [listaPara, setListaPara] = useState("");
  const [marcado, setMarcado] = useState(0);
  const [nadie, setNadie] = useState<string | null>(null);
  const [elegido, setElegido] = useState<ResultadoSocio | null>(null);
  const [v, setV] = useState<Veredicto | null>(null);
  const [guia, setGuia] = useState<Guia | null>(null);
  const [apto, setApto] = useState<string | null>(null);
  const [firmar, setFirmar] = useState<string | null>(null);
  const [via, setVia] = useState<"recepcion" | "qr_socio" | "nfc">("recepcion");
  const [hecho, setHecho] = useState<Hecho | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forzando, setForzando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [cupo, setCupo] = useState<{ sin_tope: boolean; tope: number; usados: number } | null>(null);
  const [sonido, setSonido] = useState(true);
  const [ocupado, empezar] = useTransition();
  const [ultimas, setUltimas] = useState<UltimaEntrada[]>([]);
  const [textoBarra, setTextoBarra] = useState("");
  const [camara, setCamara] = useState(false);
  // VD-5: mientras la hoja Cobrar está abierta, la Entrada se esconde (y no atiende teclas); al cobrar vuelve con el veredicto nuevo.
  const [cobrando, setCobrando] = useState(false);
  const [cobrado, setCobrado] = useState<{ ventaId: string; total: number } | null>(null);
  const cobrandoRef = useRef(false);

  const campo = useRef<HTMLInputElement>(null);
  const barra = useRef<HTMLInputElement>(null);
  const textoRef = useRef("");
  const pasoRef = useRef<Paso>("escribir");
  const trabajando = useRef(false);
  const buffer = useRef({ t: "", cuando: 0 });
  const cobrarRef = useRef<HTMLAnchorElement>(null);
  const fichaRef = useRef<HTMLAnchorElement>(null);
  // Los oyentes de teclado viven mucho: leen estas copias para no quedarse con valores viejos.
  const abiertaRef = useRef(false);
  const conBarraRef = useRef(false);
  const cfgRef = useRef(cfg);
  const formandoRef = useRef(false);
  const puedeEnterRef = useRef(false);
  const anotarRef = useRef<() => void>(() => {});
  const dejarRef = useRef<() => void>(() => {});
  const nadieRef = useRef<string | null>(null);
  const iniciarAltaRef = useRef<(dni: string) => void>(() => {});
  useEffect(() => { textoRef.current = texto; }, [texto]);
  useEffect(() => { pasoRef.current = paso; }, [paso]);
  useEffect(() => { cobrandoRef.current = cobrando; }, [cobrando]);

  // Lo que esta compu le pisa al gimnasio, y el sonido (por compu).
  useEffect(() => {
    const leer = () => setPisado(leerPisado());
    leer();
    try { setSonido(localStorage.getItem(CLAVE_SONIDO) !== "no"); } catch { /* sin almacenamiento */ }
    window.addEventListener(EVENTO_PISADO, leer);
    window.addEventListener("storage", leer);
    return () => { window.removeEventListener(EVENTO_PISADO, leer); window.removeEventListener("storage", leer); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.ventanaEntrada = "si";
    return () => { delete document.documentElement.dataset.ventanaEntrada; };
  }, []);

  const conBarra = cfg.barra_fija && !propia;
  useEffect(() => {
    document.documentElement.dataset.barraEntrada = conBarra ? "si" : "no";
    return () => { delete document.documentElement.dataset.barraEntrada; };
  }, [conBarra]);

  // Las últimas 5 entradas de la barra: al abrir la pantalla, después de cada entrada propia y (VD-4) apenas
  // entra alguien por otra vía: el "oído" compartido avisa y acá se vuelve a leer la lista (sin otro polling).
  const refrescarUltimas = useCallback(async () => {
    const r = await ultimasEntradas(sedeId);
    if (r.entradas) setUltimas(r.entradas);
  }, [sedeId]);
  const refrescarRef = useRef(refrescarUltimas);
  useEffect(() => { refrescarRef.current = refrescarUltimas; });
  useEffect(() => {
    if (!conBarra) return;
    return escucharEntradas(gimnasioId, () => { void refrescarRef.current(); });
  }, [conBarra, gimnasioId]);
  useEffect(() => {
    if (!conBarra) return;
    void refrescarUltimas();
  }, [conBarra, refrescarUltimas, hecho]);

  const hora = (d: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

  const reiniciar = useCallback((inicial = "", enfocar = true) => {
    setPaso("escribir"); setTexto(inicial); setSocios([]); setListaPara(""); setMarcado(0); setNadie(null); setElegido(null);
    setV(null); setGuia(null); setApto(null); setFirmar(null); setHecho(null); setError(null); setForzando(false); setMotivo(""); setVia("recepcion"); setCobrado(null); setAlta(null);
    trabajando.current = false;
    if (enfocar) setTimeout(() => campo.current?.focus(), 0);
  }, []);
  const cerrar = useCallback(() => { setAbierta(false); setTimeout(() => reiniciar(), 0); }, [reiniciar]);
  // Sin enfocar a mano: la hoja guarda dónde estaba el foco y recién después lo lleva al campo (así Esc vuelve exacto).
  const abrir = useCallback((inicial = "") => { reiniciar(inicial, false); setAbierta(true); }, [reiniciar]);

  const elegir = useCallback((s: ResultadoSocio, forma: "recepcion" | "qr_socio" | "nfc" = "recepcion") => empezar(async () => {
    setElegido(s); setHecho(null); setError(null); setForzando(false); setVia(forma); setPaso("veredicto"); setV(null);
    const r = await veredicto(s.socio_id, sedeId);
    if (r.error) { setError(r.error); setPaso("escribir"); setElegido(null); return; }
    setV(r.v!); setGuia(r.guia ?? null); setApto(r.apto ?? null); setFirmar(r.firmar ?? null);
    if (sonido) sonar(r.v!.color);
  }), [sedeId, sonido]);

  const anotado = useCallback((r: ResultadoIngreso, s: ResultadoSocio) => {
    setHecho({ ...r, nombre: s.nombre, hora: hora(new Date()), socioId: s.socio_id });
    setPaso("anotado"); setForzando(false); setMotivo(""); setSocios([]); setTexto(""); setNadie(null);
    setTextoBarra("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona]);

  const anotar = useCallback((forzar?: string) => {
    if (!elegido || trabajando.current) return;
    trabajando.current = true;
    empezar(async () => {
      const r = await registrarEntrada(elegido.socio_id, sedeId, forzar, via);
      trabajando.current = false;
      if (r.error) { setError(r.error); return; }
      setError(null);
      anotado(r.r!, elegido);
    });
  }, [elegido, sedeId, via, anotado]);

  // QR (cámara no: acá solo el lector USB) o llavero: si puede entrar se anota solo; si no, queda el veredicto con el porqué.
  const directo = useCallback(async (q: { socio?: { socio_id: string; nombre: string; numero: number } | null; error?: string }, forma: "qr_socio" | "nfc") => {
    if (q.error || !q.socio) { setError(q.error ?? "No se pudo leer"); setPaso("escribir"); if (sonido) sonar("rojo"); return; }
    const s: ResultadoSocio = { ...q.socio, color: "gris", texto: "", puede: false, dado_de_baja: false };
    const r = await veredicto(s.socio_id, sedeId);
    if (r.error) { setError(r.error); setPaso("escribir"); return; }
    setError(null);
    if (sonido) sonar(r.v!.color);
    if (r.v!.puede) {
      const e = await registrarEntrada(s.socio_id, sedeId, undefined, forma);
      if (e.error) { setError(e.error); setPaso("escribir"); return; }
      setElegido(s); setVia(forma);
      anotado(e.r!, s);
      return;
    }
    setElegido(s); setVia(forma); setV(r.v!); setGuia(r.guia ?? null); setApto(r.apto ?? null); setFirmar(r.firmar ?? null); setPaso("veredicto");
  }, [sedeId, sonido, anotado]);

  // Enter sobre lo escrito: QR del lector, llavero, o buscar y elegir (la base busca por DNI, número o nombre).
  const resolver = useCallback((crudo: string) => empezar(async () => {
    const t = sinPuntos(crudo).trim();
    if (!t) return;
    setError(null); setNadie(null);
    if (ES_QR.test(t)) { await directo(await leerQR(t), "qr_socio"); return; }
    if (conLlavero && /^[A-Za-z0-9-]{4,30}$/.test(t) && !/^\d{7,9}$/.test(t)) {
      const l = await leerLlavero(t);
      if (l.socio || l.error) { await directo(l, "nfc"); return; }
    }
    const r = await buscarSociosRapido(t);
    if (r.error) { setError(r.error); return; }
    const lista = r.socios ?? [];
    setSocios(lista); setListaPara(t);
    if (lista.length === 0) { setNadie(t); return; }
    elegir(lista[0]);
  }), [conLlavero, directo, elegir]);

  // VD-6 · DNI que no existe → alta en la misma ventana. Los planes y su primer pago los trae la base.
  const iniciarAlta = useCallback((dniEscrito: string) => {
    setAlta({ dni: dniEscrito, nombre: "", apellido: "", telefono: "", plan: "", paso: "datos", planes: null, ofrecido: null, vinculado: null, error: null });
    setPaso("alta"); setError(null);
    void planesParaAlta(sedeId).then((r) => setAlta((a) => (a ? { ...a, planes: r.planes ?? [], error: r.error ?? a.error } : a)));
    setTimeout(() => document.querySelector<HTMLInputElement>("[data-alta-nombre]")?.focus(), 0);
  }, [sedeId]);
  const guardarAlta = (cobrarYa: boolean) => {
    if (!alta || trabajando.current) return;
    trabajando.current = true;
    empezar(async () => {
      const r = await altaRapida({ nombre: alta.nombre, apellido: alta.apellido, dni: alta.dni, telefono: alta.telefono }, alta.plan || null, alta.vinculado);
      trabajando.current = false;
      // Un error no borra nada: se queda en el alta con todo lo escrito.
      if (r.error || !r.socioId) { setAlta((a) => (a ? { ...a, error: r.error ?? "No se pudo dar de alta" } : a)); return; }
      const nuevo: ResultadoSocio = { socio_id: r.socioId, numero: r.numero ?? null, nombre: `${alta.nombre} ${alta.apellido}`.trim(), color: "gris", texto: "", puede: false, dado_de_baja: false };
      setAlta(null);
      elegir(nuevo);
      // Con plan y "Guardar y cobrar": la hoja Cobrar se abre sobre la ventana y al cobrar vuelve con el veredicto en verde.
      if (cobrarYa && alta.plan && !r.sinPlan && hayHojaCobrar()) { setCobrando(true); cobrandoRef.current = true; abrirCobrar({ socioId: r.socioId, origen: "entrada" }); }
      else if (r.sinPlan) setError("Quedó dado de alta, pero el plan no se pudo asignar: asignalo desde su ficha.");
    });
  };
  const buscarInteresado = async (celular: string) => {
    const r = await prospectoPorTelefono(celular);
    setAlta((a) => (a ? { ...a, ofrecido: r.prospecto ?? null, vinculado: r.prospecto ? a.vinculado : null } : a));
  };
  const enviar = useCallback((crudo: string) => {
    setAbierta(true);
    setTexto(crudo);
    resolver(crudo);
  }, [resolver]);

  // Coincidencias mientras escribe (hasta 3).
  useEffect(() => {
    if (!abierta || paso !== "escribir") return;
    const t = sinPuntos(texto).trim();
    if (t.length < 2 || ES_QR.test(t)) { setSocios([]); setListaPara(""); setNadie(null); return; }
    const id = setTimeout(async () => {
      const r = await buscarSociosRapido(t);
      if (sinPuntos(textoRef.current).trim() !== t) return;
      if (r.error) { setError(r.error); return; }
      setError(null);
      setSocios(r.socios ?? []); setListaPara(t); setMarcado(0);
      setNadie((r.socios ?? []).length === 0 && t.length >= 3 ? t : null);
    }, 150);
    return () => clearTimeout(id);
  }, [texto, abierta, paso]);

  // Anotado: se cierra sola a los N segundos (o nunca).
  useEffect(() => {
    if (!abierta || paso !== "anotado" || cfg.cerrar_sola_seg === 0) return;
    const id = setTimeout(() => cerrar(), cfg.cerrar_sola_seg * 1000);
    return () => clearTimeout(id);
  }, [abierta, paso, hecho, cfg.cerrar_sola_seg, cerrar]);

  // Al cambiar de pantalla (ficha, cobrar…) la ventana se cierra.
  useEffect(() => { if (abiertaRef.current) cerrar(); }, [ruta, cerrar]);

  // VD-1b: "Volver" de la ficha (abierta con F) regresa a la ventana con el mismo socio.
  useEffect(() => {
    let pedido: { socio: ResultadoSocio; ts: number } | null = null;
    try {
      const crudo = sessionStorage.getItem(CLAVE_VOLVER);
      if (crudo) pedido = JSON.parse(crudo);
    } catch { pedido = null; }
    if (!pedido || Date.now() - pedido.ts > 30 * 60 * 1000 || propia || ruta.startsWith(`/panel/socios/${pedido.socio.socio_id}`)) return;
    const socio = pedido.socio;
    const id = setTimeout(() => {
      try { sessionStorage.removeItem(CLAVE_VOLVER); } catch { /* sin almacenamiento */ }
      abrir(); elegir(socio);
    }, 80);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta]);

  const puedeAnotarConEnter = !!v && v.puede && (!cfg.anotar_solo_en_verde || v.color === "verde");

  // Un solo oyente de teclado para toda la ventana.
  useEffect(() => {
    if (propia) return;
    const tecla = (e: KeyboardEvent) => {
      if (cobrandoRef.current) return;   // la hoja Cobrar tiene el teclado
      const t = e.target as HTMLElement | null;
      const editable = esEditable(t);
      // F2 / Ctrl+E: abrir o cerrar.
      if (e.key === "F2" || (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "e")) {
        e.preventDefault();
        if (abiertaRef.current) cerrar(); else if (conBarraRef.current) barra.current?.focus(); else abrir();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const imprimible = e.key.length === 1;
      const digito = /^[0-9]$/.test(e.key);

      if (abiertaRef.current) {
        if (editable) return;
        const p = pasoRef.current;
        if (p === "alta") return;   // el alta tiene sus propios campos
        if (p === "escribir") {
          if (e.key.toLowerCase() === "a" && /^\d{6,9}$/.test(nadieRef.current ?? "")) { e.preventDefault(); iniciarAltaRef.current(nadieRef.current!); return; }
          if (imprimible) { e.preventDefault(); setTexto((x) => x + e.key); setTimeout(() => campo.current?.focus(), 0); }
          else if (e.key === "Enter" && textoRef.current.trim()) { e.preventDefault(); resolver(textoRef.current); }
          return;
        }
        if (p === "anotado") { if (digito) { e.preventDefault(); reiniciar(e.key); } return; }
        // Veredicto
        if (formandoRef.current) return;
        if (digito) { e.preventDefault(); reiniciar(e.key); return; }
        if (e.key === "Enter" && t?.tagName !== "BUTTON" && t?.tagName !== "A") { e.preventDefault(); if (puedeEnterRef.current && !trabajando.current) anotarRef.current(); return; }
        const k = e.key.toLowerCase();
        if (k === "c") { e.preventDefault(); cobrarRef.current?.click(); }
        else if (k === "f") { e.preventDefault(); fichaRef.current?.click(); }
        else if (k === "d") { e.preventDefault(); dejarRef.current(); }
        return;
      }

      // Cerrada: un número abre la ventana con ese número; un lector (teclas a menos de 30 ms) también.
      if (editable) { buffer.current = { t: "", cuando: 0 }; return; }
      if (document.querySelector('[aria-modal="true"]')) return;
      if (e.key === "Enter") {
        const b = buffer.current; buffer.current = { t: "", cuando: 0 };
        if (b.t.length >= 4 && e.timeStamp - b.cuando < 60) { e.preventDefault(); enviar(b.t); }
        return;
      }
      if (!imprimible) return;
      const rapida = buffer.current.t !== "" && e.timeStamp - buffer.current.cuando < 30;
      buffer.current = { t: (rapida ? buffer.current.t : "") + e.key, cuando: e.timeStamp };
      const b = buffer.current.t;
      if (b.length === 1 && digito && cfgRef.current.abrir_al_tipear) {
        e.preventDefault();
        if (conBarraRef.current) { barra.current?.focus(); setTextoBarra(e.key); } else abrir(e.key);
        return;
      }
      if (b.length >= 2 && rapida && !conBarraRef.current) { e.preventDefault(); abrir(b); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [propia, abrir, cerrar, reiniciar, resolver, enviar]);

  useEffect(() => {
    abiertaRef.current = abierta; conBarraRef.current = conBarra; cfgRef.current = cfg; formandoRef.current = forzando;
    puedeEnterRef.current = puedeAnotarConEnter; anotarRef.current = () => anotar();
    nadieRef.current = nadie; iniciarAltaRef.current = iniciarAlta;
    dejarRef.current = () => { if (v && !v.puede && !(esRecepcion && (guia?.solo_encargado || v.motivo === "suspendido" || v.motivo === "se_fue"))) { setForzando(true); void cupoDejarPasar().then(setCupo); } };
  });

  // El botón grande de Inicio y cualquier otro "abrir la Entrada".
  useEffect(() => {
    if (propia) return;
    const abrirDesdeBoton = () => { if (abiertaRef.current) cerrar(); else if (conBarraRef.current) barra.current?.focus(); else abrir(); };
    window.addEventListener(EVENTO_ABRIR_ENTRADA, abrirDesdeBoton);
    return () => window.removeEventListener(EVENTO_ABRIR_ENTRADA, abrirDesdeBoton);
  }, [propia, abrir, cerrar]);

  // VD-4: tocar un aviso de la puerta abre el veredicto de ese socio acá.
  useEffect(() => {
    if (propia) return;
    const abrirSocio = (e: Event) => {
      const s = (e as CustomEvent<ResultadoSocio>).detail;
      abrir();
      setTimeout(() => elegir(s), 0);
    };
    window.addEventListener(EVENTO_ABRIR_SOCIO, abrirSocio);
    return () => window.removeEventListener(EVENTO_ABRIR_SOCIO, abrirSocio);
  }, [propia, abrir, elegir]);

  const refrescar = async (socioId: string) => {
    const r = await veredicto(socioId, sedeId);
    if (r.error) { setError(r.error); return; }
    setError(null); setV(r.v!); setGuia(r.guia ?? null); setApto(r.apto ?? null); setFirmar(r.firmar ?? null);
  };
  const volvioAntes = () => empezar(async () => {
    if (!elegido) return;
    const r = await terminarPausa(elegido.socio_id, sedeId);
    if (r.error) setError(r.error); else await refrescar(elegido.socio_id);
  });
  const volverAlta = () => empezar(async () => {
    if (!elegido) return;
    const r = await volverADarDeAlta(elegido.socio_id);
    if (r.error) setError(r.error); else await refrescar(elegido.socio_id);
  });
  const deshacer = () => empezar(async () => {
    if (!hecho) return;
    const r = await anularEntrada(hecho.ingreso_id, "Anotada por error");
    if (r.error) setError(r.error); else reiniciar();
  });
  // Esc en el alta vuelve a la búsqueda (no tira lo escrito de golpe); otra vez, cierra.
  const alCerrarHoja = () => {
    if (forzando) setForzando(false);
    else if (paso === "alta") { const dniAlta = alta?.dni ?? ""; setAlta(null); setPaso("escribir"); setTexto(dniAlta); setNadie(dniAlta); setTimeout(() => campo.current?.focus(), 0); }
    else cerrar();
  };

  // VD-5: Cobrar se abre sobre la Entrada; al cobrar vuelve con el veredicto recalculado (verde: Enter anota).
  const cobrarAhora = () => { if (!elegido) return; setCobrando(true); cobrandoRef.current = true; abrirCobrar({ socioId: elegido.socio_id, origen: "entrada" }); };
  const elegidoRef = useRef<ResultadoSocio | null>(null);
  useEffect(() => { elegidoRef.current = elegido; }, [elegido]);
  // Al volver de cobrar con el veredicto en verde, el foco queda en "Anotar entrada": Enter anota.
  useEffect(() => {
    if (!cobrado || cobrando || !v?.puede) return;
    const id = setTimeout(() => document.querySelector<HTMLElement>("[data-ventana-anotar]")?.focus(), 0);
    return () => clearTimeout(id);
  }, [cobrado, cobrando, v]);
  useEffect(() => {
    const hecho = (e: Event) => {
      const c = (e as CustomEvent<CobroHecho>).detail;
      if (c.origen !== "entrada" || elegidoRef.current?.socio_id !== c.socioId) return;
      setCobrado({ ventaId: c.ventaId, total: c.total });
      void refrescar(c.socioId);
    };
    const cerrada = () => setCobrando(false);
    window.addEventListener(EVENTO_COBRO_HECHO, hecho);
    window.addEventListener(EVENTO_COBRAR_CERRADO, cerrada);
    return () => { window.removeEventListener(EVENTO_COBRO_HECHO, hecho); window.removeEventListener(EVENTO_COBRAR_CERRADO, cerrada); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId]);

  if (propia) return null;

  // VD-2: el botón principal (y el segundo) lo dice la base según la situación; acá solo se dibujan.
  const bloqueadoParaRecepcion = !!v && !v.puede && esRecepcion && (!!guia?.solo_encargado || v.motivo === "suspendido" || v.motivo === "se_fue");
  const principal = guia?.boton ?? (v?.puede ? "anotar" : "cobrar");
  const segundo = guia?.segundo ?? null;
  const avisosSueltos = (v?.avisos ?? []).filter((a) => !guia || !(a === "Cumple años hoy" || /^Debe .+ a cuenta$/.test(a)));
  const boton = (clave: string, esPrincipal: boolean) => {
    if (!v || !elegido) return null;
    const clase = `boton ${esPrincipal ? "boton-principal text-lg px-8" : ""}`;
    switch (clave) {
      case "anotar":
        return v.puede ? <button key={clave} type="button" disabled={ocupado} onClick={() => anotar()} className={clase} data-ventana-anotar>✅ Anotar entrada <kbd className="text-xs opacity-70 font-sans">Enter</kbd></button> : null;
      case "cobrar":
      case "cobrar_pack":
        return <Link key={clave} ref={cobrarRef} href={`/panel/vender?socio=${elegido.socio_id}${v.para_regularizar ? "&cuota=1" : ""}&desde=entrada`} className={clase} data-ventana-cobrar
          onClick={(e) => { if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !hayHojaCobrar()) return; e.preventDefault(); cobrarAhora(); }}>{guia?.boton_texto && clave === principal ? guia.boton_texto : clave === "cobrar_pack" ? "💵 Cobrar un pack" : "💵 Cobrar"} <kbd className="text-xs opacity-70 font-sans">C</kbd></Link>;
      case "dejar_pasar":
        if (v.puede || forzando) return null;
        return bloqueadoParaRecepcion ? null : <button key={clave} type="button" onClick={() => dejarRef.current()} className={clase} data-ventana-dejar>🤝 Dejar pasar <kbd className="text-xs opacity-70 font-sans">D</kbd></button>;
      case "volver_antes":
        return v.puede ? null : <button key={clave} type="button" disabled={ocupado} onClick={volvioAntes} className={clase} data-ventana-volvio>🏃 Volvió antes: terminar la pausa</button>;
      case "volver_alta":
        return <button key={clave} type="button" disabled={ocupado} onClick={volverAlta} className={clase} data-ventana-volver-alta>↩️ Volver a dar de alta</button>;
      default:
        return null;
    }
  };

  const dni = /^\d{6,9}$/.test(nadie ?? "") ? `el DNI ${conPuntos(nadie!)}` : null;
  const hayLista = paso === "escribir" && socios.length > 0 && listaPara === sinPuntos(texto).trim();

  return (
    <>
      {/* B · El botón: redondo y flotante (en el celular, centrado sobre la barra de abajo). En Inicio está el grande. */}
      {ruta !== "/panel" && (
        <button type="button" data-boton-ventana onClick={() => (abierta ? cerrar() : conBarra ? barra.current?.focus() : abrir())}
          aria-label={abierta ? "Cerrar la Entrada" : "Abrir la Entrada"} aria-pressed={abierta} title="Entrada (F2)"
          className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:left-auto lg:translate-x-0 lg:right-6 lg:bottom-6
            size-16 rounded-full bg-[var(--verde)] text-white text-3xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ boxShadow: "0 10px 28px -10px rgb(0 0 0 / 0.6)" }}>
          <span aria-hidden>{abierta ? "✕" : "🚪"}</span>
        </button>
      )}

      {/* C · La barra fija (compu ≥ 1280 px): el DNI siempre a mano y las últimas 5 entradas. */}
      {conBarra && (
        <aside data-barra-entrada aria-label="Entrada" className="hidden xl:flex fixed right-0 top-0 bottom-0 w-72 z-20 flex-col gap-4 border-l border-[var(--borde)] bg-[var(--fondo)] p-4 pt-20">
          <p className="titulo text-xl">🚪 Entrada</p>
          <input ref={barra} data-barra-dni value={conPuntos(textoBarra)} inputMode="numeric" autoComplete="off" aria-label="DNI, número de socio o nombre"
            onChange={(e) => setTextoBarra(sinPuntos(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && textoBarra.trim()) { e.preventDefault(); const t = textoBarra; setTextoBarra(""); enviar(t); }
              if (e.key === "Escape") { setTextoBarra(""); barra.current?.blur(); }
            }}
            placeholder="DNI o nombre" className="campo !min-h-14 !text-2xl text-center" />
          <p className="texto-tenue text-sm -mt-2">Enter para buscar · F2 enfoca acá</p>
          <p className="titulo-grupo mt-2">Últimas entradas</p>
          {ultimas.length === 0 ? <p className="texto-tenue text-sm">Todavía no entró nadie hoy.</p> : (
            <ul className="space-y-2 min-w-0" data-barra-ultimas={ultimas.length}>
              {ultimas.map((u) => (
                <li key={u.ingreso_id} className="flex items-center gap-2 min-w-0 text-sm">
                  <PuntoEstado color={u.color} />
                  <span className="truncate flex-1">{u.socio}</span>
                  <span className="texto-tenue tabular-nums">{hora(new Date(u.momento))}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

      <Hoja abierta={abierta && !cobrando} alCerrar={alCerrarHoja} etiqueta="Entrada" className="!max-w-2xl">
        <div data-ventana-entrada data-paso={paso} className="max-h-[88dvh] overflow-y-auto">
          {paso === "escribir" && (
            <div className="p-6 sm:p-8 space-y-4">
              <p className="titulo text-2xl text-center">🚪 Entrada</p>
              {/* VD-1b: el dueño con varias sedes elige en cuál anota (queda en esta compu). */}
              {sedes.length > 1 && (
                <div role="group" aria-label="Sede" className="flex flex-wrap justify-center gap-2" data-ventana-sedes>
                  {sedes.map((s) => (
                    <button key={s.id} type="button" aria-pressed={s.id === sedeId} data-sede={s.id} onClick={() => { elegirSede(s.id); setTimeout(() => campo.current?.focus(), 0); }}
                      className={`pestana ${s.id === sedeId ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`}>📍 {s.nombre}</button>
                  ))}
                </div>
              )}
              <input ref={campo} data-ventana-campo value={conPuntos(texto)} autoComplete="off" aria-label="Buscar socio: DNI, número o nombre"
                onChange={(e) => { setTexto(sinPuntos(e.target.value)); setNadie(null); setError(null); setMarcado(0); }}
                onKeyDown={(e) => {
                  if (e.code === "NumpadDecimal") { e.preventDefault(); return; }   // el punto del teclado numérico no va en un DNI
                  if (e.key.toLowerCase() === "a" && !e.ctrlKey && !e.metaKey && !e.altKey && dni) { e.preventDefault(); iniciarAlta(nadie!); }
                  else if (e.key === "ArrowDown" && hayLista) { e.preventDefault(); setMarcado((m) => Math.min(m + 1, Math.min(socios.length, 3) - 1)); }
                  else if (e.key === "ArrowUp" && hayLista) { e.preventDefault(); setMarcado((m) => Math.max(m - 1, 0)); }
                  else if (e.key === "Enter") {
                    e.preventDefault();
                    if (ocupado) return;
                    if (hayLista) elegir(socios[Math.min(marcado, socios.length - 1)]); else resolver(texto);
                  }
                }}
                placeholder="30.123.456" className="campo !min-h-24 !text-5xl sm:!text-6xl text-center font-bold tracking-wide numero" />
              <p className="texto-tenue text-center text-sm">Enter para buscar · Esc para cerrar · también por nombre</p>
              {conQr && <div className="flex justify-center"><button type="button" className="boton" onClick={() => setCamara(true)}>📷 Leer QR</button></div>}

              {error && <Mensaje tipo="error">{error}</Mensaje>}
              {ocupado && !hayLista && <div className="h-16 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto" aria-hidden />}

              {hayLista && (
                <ul className="space-y-2" aria-label="Coincidencias">
                  {socios.slice(0, 3).map((s, i) => (
                    <li key={s.socio_id}>
                      <button type="button" onClick={() => elegir(s)} aria-current={i === marcado} className={`fila ${i === marcado ? "!border-[var(--acento)]" : ""}`}>
                        <PuntoEstado color={s.color} grande />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-lg truncate">{s.nombre} {s.numero != null && <span className="texto-tenue font-normal">#{s.numero}</span>}</span>
                          <span className="block texto-suave truncate">{s.texto}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {nadie && !error && (
                <div className="tarjeta p-5 space-y-3" data-ventana-nadie>
                  <p className="text-lg font-semibold">{dni ? `No hay nadie con ${dni}` : `No encontramos a “${nadie}”`}</p>
                  <div className="flex flex-wrap gap-2">
                    {dni
                      ? <button type="button" className="boton boton-principal" data-ventana-alta onClick={() => iniciarAlta(nadie!)}>➕ Darlo de alta <kbd className="text-xs opacity-70 font-sans">A</kbd></button>
                      : <Link href="/panel/socios/nuevo" className="boton boton-principal">➕ Darlo de alta</Link>}
                    {dni && <Link href="/panel/socios/nuevo" className="boton" data-ventana-alta-completa>Alta completa</Link>}
                  </div>
                </div>
              )}
            </div>
          )}

          {paso === "alta" && alta && (
            <form data-ventana-alta-form data-alta-paso={alta.paso} className="p-6 sm:p-8 space-y-4"
              onSubmit={(e) => { e.preventDefault(); if (ocupado) return; if (alta.paso === "datos") { if (alta.nombre.trim()) setAlta({ ...alta, paso: "plan" }); } else guardarAlta(!!alta.plan && puedeCobrar); }}>
              <p className="titulo text-2xl text-center">➕ Alta rápida</p>
              <p className="text-center texto-suave">DNI <strong className="text-[var(--texto)] numero">{conPuntos(alta.dni)}</strong></p>
              <ol className="flex gap-2 text-sm" aria-label="Pasos del alta rápida">
                {["Datos", "Plan", "Cobro", "Entra"].map((n, i) => {
                  const actual = alta.paso === "datos" ? 0 : 1;
                  return <li key={n} className={`flex-1 min-w-0 rounded-full px-2 py-1 text-center truncate border ${i === actual ? "border-[var(--acento)] font-semibold" : "border-[var(--borde)] texto-tenue"}`}>{i < actual ? "✓ " : `${i + 1} · `}{n}</li>;
                })}
              </ol>

              {alta.paso === "datos" ? (
                <div className="space-y-3">
                  <label className="block space-y-1"><span className="etiqueta">Nombre</span>
                    <input data-alta-nombre value={alta.nombre} onChange={(e) => setAlta({ ...alta, nombre: e.target.value })} autoComplete="off" required className="campo" /></label>
                  <label className="block space-y-1"><span className="etiqueta">Apellido</span>
                    <input data-alta-apellido value={alta.apellido} onChange={(e) => setAlta({ ...alta, apellido: e.target.value })} autoComplete="off" className="campo" /></label>
                  <label className="block space-y-1"><span className="etiqueta">Celular (WhatsApp)</span>
                    <input data-alta-celular type="tel" value={alta.telefono} onChange={(e) => setAlta({ ...alta, telefono: e.target.value })} onBlur={(e) => void buscarInteresado(e.target.value)}
                      placeholder="387 555-1234" className="campo" /></label>
                  {alta.ofrecido && !alta.vinculado && (
                    <Mensaje tipo="info"><span data-interesado-ofrecido={alta.ofrecido.id}>¿Es {alta.ofrecido.nombre}, que preguntó el {new Date(alta.ofrecido.creado_en).toLocaleDateString("es-AR", { day: "numeric", month: "numeric" })}?</span>{" "}
                      <button type="button" className="boton mt-2" onClick={() => setAlta({ ...alta, vinculado: alta.ofrecido!.id, nombre: alta.nombre || alta.ofrecido!.nombre.split(" ")[0], apellido: alta.apellido || alta.ofrecido!.nombre.split(" ").slice(1).join(" ") })}>Sí, es esa persona</button></Mensaje>
                  )}
                  {alta.vinculado && <Mensaje tipo="info">Es {alta.ofrecido?.nombre}: queda marcado como “se hizo socio”.</Mensaje>}
                </div>
              ) : (
                <div className="space-y-3">
                  {alta.planes === null ? <div className="h-24 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto" aria-hidden />
                    : alta.planes.length === 0 ? <Mensaje tipo="info">Este gimnasio no tiene planes cargados: se da de alta sin plan y se cobra un pase o pack desde Vender.</Mensaje>
                    : <TarjetasPlan planes={alta.planes} valor={alta.plan} alElegir={(plan) => setAlta({ ...alta, plan })} />}
                  {alta.planes?.find((p) => p.plan_id === alta.plan) && <PrimerPago plan={alta.planes.find((p) => p.plan_id === alta.plan)!} />}
                </div>
              )}

              {alta.error && <Mensaje tipo="error">{alta.error}</Mensaje>}
              {alta.paso === "datos" ? (
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={!alta.nombre.trim()} className="boton boton-principal text-lg px-8" data-alta-siguiente>Siguiente: plan →</button>
                  <button type="button" className="boton" onClick={() => guardarAlta(false)} disabled={!alta.nombre.trim() || ocupado} data-alta-solo>Solo guardar</button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {alta.plan && puedeCobrar
                    ? <button type="submit" disabled={ocupado} className="boton boton-principal text-lg px-8" data-alta-cobrar>{ocupado ? "Guardando…" : "💵 Guardar y cobrar"}</button>
                    : <button type="submit" disabled={ocupado} className="boton boton-principal text-lg px-8" data-alta-guardar>{ocupado ? "Guardando…" : "✅ Guardar"}</button>}
                  {alta.plan && puedeCobrar && <button type="button" className="boton" disabled={ocupado} onClick={() => guardarAlta(false)} data-alta-solo>Solo guardar</button>}
                  <button type="button" className="boton-texto px-3" onClick={() => setAlta({ ...alta, paso: "datos" })}>← Datos</button>
                </div>
              )}
              <p className="text-sm texto-tenue">Esc vuelve a la búsqueda · los datos que escribiste no se pierden si hay un error</p>
            </form>
          )}

          {paso === "veredicto" && elegido && (
            <div data-ventana-veredicto={v?.color ?? "cargando"} aria-live="polite">
              {!v ? <div className="p-8"><div className="h-64 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto" aria-hidden /></div> : (<>
                <div className="px-6 sm:px-8 py-5" style={{ background: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 55%)` }}>
                  <p className="text-2xl sm:text-3xl font-bold leading-tight"><span aria-hidden>{EMOJI[v.color] ?? "❔"}</span> {v.texto}</p>
                </div>
                <div className="p-6 sm:p-8 space-y-5">
                  <div className="flex items-center gap-4">
                    <span className="relative size-24 sm:size-32 flex-none rounded-3xl bg-[var(--tarjeta-alta)] flex items-center justify-center text-4xl font-bold overflow-hidden">
                      <Iniciales nombre={elegido.nombre} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img key={elegido.socio_id} src={`/panel/socios/${elegido.socio_id}/foto`} alt={`Foto de ${elegido.nombre}`} data-foto-ventana
                        className="absolute inset-0 size-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    </span>
                    <div className="min-w-0">
                      <p className="titular text-4xl sm:text-5xl break-words">{elegido.nombre}</p>
                      <p className="texto-suave text-lg">{elegido.numero != null ? `Socio #${elegido.numero}` : ""}</p>
                    </div>
                  </div>

                  {/* VD-2: lo que hay que decirle, cuánto le falta y los avisos (todo lo calcula la base). */}
                  {guia?.falta && <p className="text-xl font-semibold" data-ventana-falta>{guia.falta}</p>}
                  {guia?.decile && <p className="text-xl leading-snug" data-ventana-decile>💬 {guia.decile}</p>}
                  {(guia?.chips.length || avisosSueltos.length || apto || (firmar && !guia)) ? (
                    <ul className="flex flex-wrap gap-2" data-ventana-chips>
                      {guia?.chips.map((c) => <li key={c.clave} data-chip={c.clave} className="pildora whitespace-normal"><span aria-hidden>{c.emoji}</span> {c.texto}</li>)}
                      {avisosSueltos.map((a) => <li key={a} className="pildora whitespace-normal">{a}</li>)}
                      {apto && <li className="pildora pildora-amarillo whitespace-normal" data-aviso-apto>{apto}</li>}
                      {firmar && !guia && <li className="pildora pildora-amarillo whitespace-normal" data-aviso-firmar>{firmar}</li>}
                    </ul>
                  ) : null}
                  {v.para_regularizar ? <p className="texto-suave">Para ponerse al día: <strong className="text-[var(--texto)]">{formatearPesos(v.para_regularizar)}</strong></p> : null}
                  {error && <Mensaje tipo="error">{error}</Mensaje>}
                  {cobrado && (
                    <Mensaje tipo="exito"><span data-ventana-cobrado={cobrado.total}>Cobrado {formatearPesos(cobrado.total)}.</span> <MandarComprobante ventaId={cobrado.ventaId} className="mt-2" /></Mensaje>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {[principal, segundo].map((clave, i) => clave && boton(clave, i === 0))}
                    {!v.puede && !forzando && principal !== "dejar_pasar" && !bloqueadoParaRecepcion && (
                      <button type="button" onClick={() => dejarRef.current()} className="boton" data-ventana-dejar>🤝 Dejar pasar <kbd className="text-xs opacity-70 font-sans">D</kbd></button>
                    )}
                    {!v.puede && bloqueadoParaRecepcion && <p className="basis-full texto-suave">🔒 A este socio lo deja pasar el dueño o el encargado.</p>}
                    <Link ref={fichaRef} href={`/panel/socios/${elegido.socio_id}?desde=entrada`} className="boton" data-ventana-ficha
                      onClick={() => { try { sessionStorage.setItem(CLAVE_FICHA, JSON.stringify({ socio: elegido, ts: Date.now() })); } catch { /* sin almacenamiento */ } }}>👤 Ficha <kbd className="text-xs opacity-70 font-sans">F</kbd></Link>
                    <button type="button" onClick={() => reiniciar()} className="boton-texto px-3">Otro socio</button>
                  </div>

                  {forzando && (
                    <form className="space-y-3" data-dejar-pasar onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) anotar(motivo); }}>
                      <div className="flex flex-wrap gap-2" aria-label="Motivos frecuentes">
                        {MOTIVOS_PASAR.map((m) => <button key={m} type="button" className={`pestana ${motivo === m ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`} onClick={() => setMotivo(m)}>{m}</button>)}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} className="campo" placeholder="¿Por qué lo dejás pasar? (queda anotado)" aria-label="Motivo para dejar pasar" />
                        <button type="submit" disabled={!motivo.trim() || ocupado || (!!cupo && !cupo.sin_tope && cupo.usados >= cupo.tope)} className="boton boton-peligro">Dejar pasar</button>
                      </div>
                      {cupo && !cupo.sin_tope && (
                        <p className="text-sm texto-suave" data-cupo={cupo.tope - cupo.usados}>
                          {cupo.usados >= cupo.tope ? `Ya dejaste pasar a ${cupo.usados} hoy (el tope es ${cupo.tope}): que lo autorice el dueño o el encargado.`
                            : `Te ${cupo.tope - cupo.usados === 1 ? "queda" : "quedan"} ${cupo.tope - cupo.usados} de ${cupo.tope} hoy. Lo ve el dueño.`}
                        </p>
                      )}
                    </form>
                  )}
                  <p className="text-sm texto-tenue">{puedeAnotarConEnter ? "Enter anota · " : ""}Esc cierra · escribí un número para buscar a otro</p>
                </div>
              </>)}
            </div>
          )}

          {paso === "anotado" && hecho && (
            <div className="p-8 text-center space-y-4" data-ventana-hecho={hecho.resultado} role="status">
              <div className="flex justify-center text-6xl" aria-hidden>{hecho.resultado === "rechazado" ? "⛔" : hecho.alerta_prestamo ? "⚠️" : <Tilde tamano={72} />}</div>
              <p className="titular text-4xl break-words">{hecho.nombre}</p>
              <p className="text-xl font-semibold">
                {hecho.repetido ? (hecho.texto ?? "Ya estaba anotado hace un momento")
                  : hecho.resultado === "forzado" ? `Entrada anotada a las ${hecho.hora} (lo dejaste pasar)`
                  : hecho.resultado === "rechazado" ? "Anotado que no pudo entrar"
                  : `Entró ${hecho.hora}`}
              </p>
              {error && <Mensaje tipo="error">{error}</Mensaje>}
              <div className="flex flex-wrap justify-center gap-2">
                {!hecho.repetido && <button type="button" className="boton" disabled={ocupado} onClick={deshacer}>↩️ Deshacer</button>}
                <button type="button" className="boton boton-principal" onClick={() => reiniciar()}>Siguiente</button>
              </div>
              <p className="texto-tenue text-sm">{cfg.cerrar_sola_seg ? `Se cierra sola en ${cfg.cerrar_sola_seg} s · ` : ""}escribí un número para el próximo</p>
            </div>
          )}
        </div>
      </Hoja>
      {camara && <Camara alLeer={(codigo) => { setCamara(false); enviar(codigo.trim()); }} alCerrar={() => { setCamara(false); setTimeout(() => campo.current?.focus(), 0); }} />}
    </>
  );
}
