"use client";
// VD-1 · La Entrada que está en todos lados (docs/v2/01-ENTRADA.md §1-2 y §6).
// Una sola ventana flotante en el layout del panel: se abre con el botón (F2 / Ctrl+E), con "/" o con un lector USB desde
// la ventana, y opcionalmente hay una barra fija a la derecha. Todo lo que dice y hace sale de las funciones de la base de
// siempre (estado_acceso, registrar_ingreso, leer_qr…): acá no se calcula nada.
//
// E4: este archivo es el que manda (el estado y los atajos); cada paso vive en su pieza dentro de ./entrada/:
//   Barrita (E1), PasoEscribir, PasoVeredicto, PasosFinales, BarraFija, y lo pesado con carga diferida en cargas.tsx
//   (alta rápida, prueba gratis, "dejar pasar", comprobante del cobro, cámara del QR).
// E1: con `resultado_entrada` = "aviso" (compu) un número tipeado fuera de un campo abre la barrita, no esta ventana.
// E6: sin internet lo dice en rojo (conexion.tsx).
import { useCallback, useEffect, useRef, useState, useTransition, startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { type EventoHoy, anularEntrada, cupoDejarPasar, leerLlavero, leerQR, modoPrueba, darPruebaGratis, pruebaPorDni, entradaRapida, registrarEntrada, registrarSalida, terminarPausa, veredicto, type CupoDejarPasar, type Guia, type PromesaPago, type ResultadoIngreso, type ResultadoSalida, type Veredicto } from "@/app/panel/entrada/acciones";
import { efectiva, EVENTO_PISADO, leerPisado, type ConfigEntrada, type PisadoEnEstaCompu } from "@/app/panel/entrada/config";
import { CLAVE_SONIDO, sonar } from "@/app/panel/entrada/sonido";
import { CierreInactividad } from "@/app/panel/pin/CierreInactividad";
import { crearDetectorLector, esLecturaRepetida, LECTOR_MIN_CARACTERES, LECTOR_PAUSA_MAX_MS } from "@/app/panel/entrada/lector";
import { leerConfigVisita, type RegistrarSalida, type UltimaEntrada } from "@/app/panel/entrada/ventana-acciones";
import { altaRapida, planesParaAlta, prospectoPorTelefono, volverADarDeAlta } from "@/app/panel/socios/acciones";
import { leerConReintento } from "@/lib/panel/lectura";
import { Hoja } from "@/components/ui/Hoja";
import { Icono } from "@/components/ui/Icono";
import { EVENTO_ABRIR_SOCIO, EVENTO_AVISO_LOCAL, type AvisoLocal } from "./AvisosEntrada";
import { CartelEmergencia, useEmergencia } from "./CartelEmergencia";
import { escucharEntradas } from "./entradas-vivo";
import { abrirCobrar, hayHojaCobrar, EVENTO_COBRAR_CERRADO, EVENTO_COBRO_HECHO, type CobroHecho } from "./cobrar/evento";
import { Barrita } from "./entrada/Barrita";
import { AltaRapida, BarraFija, Camara, PasoAnotado, PasoEscribir, PasoSalio, PasoVeredicto, PruebaGratis, precargarAlta, precargarDejarPasar, precargarPrueba, precargarVentana } from "./entrada/cargas";
import { CLAVE_SEDE, CLAVE_VOLVER, conPuntos, EVENTO_ABRIR_ENTRADA, EVENTO_ABRIR_ENTRADA_CON, ES_QR, esEditable, hayAlgoEncima, sinPuntos, type Alta, type FormPrueba, type Hecho, type Paso, type PedidoAbrirSocio } from "./entrada/comun";
import { SinInternet, useSinInternet } from "./entrada/conexion";

// Lo que otras pantallas importan de acá (siguen apuntando a este archivo).
export { EVENTO_ABRIR_ENTRADA, EVENTO_ABRIR_ENTRADA_CON };
export { VolverAEntrada } from "./entrada/VolverAEntrada";

/** La compu (y no el celular): ahí vive la barrita. En el celular la Entrada es su pantalla y no cambia nada. */
function useEsCompu() {
  const [si, setSi] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const leer = () => setSi(m.matches);
    leer();
    m.addEventListener("change", leer);
    return () => m.removeEventListener("change", leer);
  }, []);
  return si;
}

type Props = {
  gimnasioId: string; sedeId: string; zona: string; config: ConfigEntrada; conQr: boolean; conLlavero: boolean; esRecepcion: boolean;
  /** VD-1b: las sedes entre las que el dueño elige (vacío si no puede elegir). */
  sedes?: { id: string; nombre: string }[]; puedeCobrar?: boolean;
};

export function VentanaEntrada(props: Props) {
  // E6: la franja roja va en todo el panel (también en la pantalla de Entrada, donde la ventana no se mete).
  const sin = useSinInternet();
  return (
    <>
      <SinInternet sin={sin} />
      <VentanaCuerpo {...props} sinInternet={sin} />
    </>
  );
}

function VentanaCuerpo({ gimnasioId, sedeId: sedeBase, zona, config, conQr, conLlavero, esRecepcion, sedes = [], puedeCobrar = false, sinInternet }: Props & { sinInternet: boolean }) {
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
  const esCompu = useEsCompu();
  const [abierta, setAbierta] = useState(false);
  // VD-46M: el cartel rojo mientras la puerta está en emergencia (se pregunta solo con la ventana abierta).
  const emergencia = useEmergencia(sedeId, abierta);
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
  const [eventosHoy, setEventosHoy] = useState<EventoHoy[]>([]);
  const [via, setVia] = useState<"recepcion" | "qr_socio" | "nfc">("recepcion");
  const [hecho, setHecho] = useState<Hecho | null>(null);
  const [anulada, setAnulada] = useState<string | null>(null);   // "Entrada de Juan anulada": el Deshacer no vuelve a la búsqueda en silencio
  const [error, setError] = useState<string | null>(null);
  const [forzando, setForzando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [cupo, setCupo] = useState<CupoDejarPasar | null>(null);
  const [sonido, setSonido] = useState(true);
  // VD-48: ¿el gimnasio registra la salida? (se lee de la base la primera vez que se abre la ventana; null = todavía no se sabe)
  const [salidaModo, setSalidaModo] = useState<RegistrarSalida | null>(null);
  const [salio, setSalio] = useState<(ResultadoSalida & { nombre: string }) | null>(null);
  // VD-51: ¿el gimnasio da prueba gratis? (se lee de la base al abrir la ventana)
  const [pruebaModo, setPruebaModo] = useState<"no" | "dia" | "clase" | null>(null);
  const [prueba, setPrueba] = useState<FormPrueba | null>(null);
  const iniciarPruebaRef = useRef<(dni: string) => void>(() => {});
  const salidaModoRef = useRef<RegistrarSalida | null>(null);
  const pruebaModoRef = useRef<"no" | "dia" | "clase" | null>(null);
  const salirRef = useRef<() => void>(() => {});
  const salirConDniRef = useRef<(dni: string) => void>(() => {});
  const router = useRouter();
  const refrescoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ocupado, empezar] = useTransition();
  const enterPendiente = useRef(false);
  // C5: lector USB. El detector mide la velocidad entre teclas; la última lectura sirve para ignorar el doble Enter del lector.
  const detector = useRef(crearDetectorLector());
  const ultimaLectura = useRef<{ codigo: string; en: number } | null>(null);
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
  const rafaga = useRef("");
  const ultimaTecla = useRef(0);  // C5: cuándo fue la tecla anterior; una tecla a menos de 50 ms de otra es del lector, nunca un atajo
  const cobrarRef = useRef<HTMLAnchorElement>(null);
  const fichaRef = useRef<HTMLAnchorElement>(null);
  // Los oyentes de teclado viven mucho: leen estas copias para no quedarse con valores viejos.
  const abiertaRef = useRef(false);
  const conBarraRef = useRef(false);
  const barritaRef = useRef(false);
  const cfgRef = useRef(cfg);
  const formandoRef = useRef(false);
  const puedeEnterRef = useRef(false);
  const anotarRef = useRef<() => void>(() => {});
  const dejarRef = useRef<() => void>(() => {});
  const dejarAlAbrirRef = useRef(false);
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

  useEffect(() => { if (!propia) precargarVentana(); }, [propia]);

  useEffect(() => {
    document.documentElement.dataset.entradaLista = "si";
    return () => { delete document.documentElement.dataset.entradaLista; };
  }, []);

  const conBarra = cfg.barra_fija && !propia;
  useEffect(() => {
    document.documentElement.dataset.barraEntrada = conBarra ? "si" : "no";
    return () => { delete document.documentElement.dataset.barraEntrada; };
  }, [conBarra]);
  // E1: la barrita del DNI. Compu, modo "aviso" y "abrir al tipear" prendido; con la barra fija a la derecha el DNI ya tiene su campo ahí.
  const barritaModo = cfg.resultado_entrada === "aviso" && cfg.abrir_al_tipear && esCompu && !propia && !conBarra;

  // Las últimas 5 entradas de la barra: al abrir la pantalla, después de cada entrada propia y (VD-4) apenas
  // entra alguien por otra vía: el "oído" compartido avisa y acá se vuelve a leer la lista (sin otro polling).
  const refrescarUltimas = useCallback(async () => {
    try {
      const res = await fetch(`/panel/entrada/ultimas?sede=${encodeURIComponent(sedeId)}`, { cache: "no-store" });
      const r = (await res.json()) as { entradas?: UltimaEntrada[] };
      if (r.entradas) setUltimas(r.entradas);
    } catch { /* sin red: se queda lo último que llegó */ }
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
    setV(null); setGuia(null); setApto(null); setFirmar(null); setEventosHoy([]); setHecho(null); setSalio(null); setPrueba(null); setError(null); setForzando(false); setMotivo(""); setVia("recepcion"); setCobrado(null); setAlta(null);
    trabajando.current = false;
    if (enfocar) setTimeout(() => campo.current?.focus(), 0);
  }, []);
  // C5: después de cada ingreso el foco vuelve a donde se escribe (con la barra fija, a la barra) para que el lector siga andando.
  const cerrar = useCallback(() => {
    setAbierta(false);
    setTimeout(() => { reiniciar(); if (conBarraRef.current) setTimeout(() => barra.current?.focus(), 60); }, 0);
  }, [reiniciar]);
  // Sin enfocar a mano: la hoja guarda dónde estaba el foco y recién después lo lleva al campo (así Esc vuelve exacto).
  const abrir = useCallback((inicial = "") => { reiniciar(inicial, false); setAbierta(true); }, [reiniciar]);

  // Los números de la pantalla se actualizan después de mostrar el resultado, sin frenar el próximo Enter.
  // Un solo refresco, 2 s después del último ingreso: con varios seguidos no se encolan re-renders de toda la pantalla.
  const refrescarPantalla = useCallback(() => {
    if (refrescoRef.current) clearTimeout(refrescoRef.current);
    refrescoRef.current = setTimeout(() => startTransition(() => router.refresh()), 2000);
  }, [router]);

  // BASE-3 (D40): con "aviso", Enter anota (si corresponde) y el resultado sale abajo a la derecha; tocarlo abre el panel lateral.
  // Va fuera de la transición a propósito: si no, la ventana queda "ocupada" mientras el panel se refresca y el próximo Enter se pierde.
  const elegirAviso = useCallback(async (s: ResultadoSocio) => {
    const r = await entradaRapida(s.socio_id, sedeId, !!cfgRef.current.anotar_solo_en_verde);
    if (r.error || !r.v) { setError(r.error ?? "No se pudo ver el estado"); return; }
    const vv = r.v;
    const aviso = (id: string, color: AvisoLocal["color"], texto: string, cobrar: boolean, puede: boolean): AvisoLocal => ({ id, color, texto, socioId: s.socio_id, nombre: s.nombre, numero: s.numero, cobrar, puede, textoSocio: vv.texto });
    let a: AvisoLocal;
    if (r.r) {
      const color: AvisoLocal["color"] = vv.via === "prueba" ? "azul" : vv.color === "verde" ? "verde" : "amarillo";
      a = aviso(`${r.r.ingreso_id}-${Date.now()}`, color, r.r.repetido ? `${s.nombre} ya había entrado: ${r.r.texto ?? vv.texto}` : `${s.nombre} entró · ${vv.texto}`, false, true);
      refrescarPantalla();
    } else {
      a = aviso(`local-${s.socio_id}-${Date.now()}`, vv.puede ? "amarillo" : "rojo", `${s.nombre}: ${vv.texto}`, !!(vv.para_regularizar || r.guia?.boton === "cobrar" || r.guia?.boton === "cobrar_pack"), vv.puede);
    }
    if (sonido) sonar(a.color === "azul" ? "verde" : a.color);
    window.dispatchEvent(new CustomEvent<AvisoLocal>(EVENTO_AVISO_LOCAL, { detail: a }));
    cerrar();
  }, [sedeId, sonido, cerrar, refrescarPantalla]);

  const elegir = useCallback((s: ResultadoSocio, forma: "recepcion" | "qr_socio" | "nfc" = "recepcion", ventanaGrande = false) => {
    if (cfgRef.current.resultado_entrada === "aviso" && forma === "recepcion" && !ventanaGrande) { void elegirAviso(s); return; }
    empezar(async () => {
    setElegido(s); setHecho(null); setError(null); setForzando(false); setVia(forma); setPaso("veredicto"); setV(null);
    const r = await veredicto(s.socio_id, sedeId);
    if (r.error) { setError(r.error); setPaso("escribir"); setElegido(null); return; }
    setV(r.v!); setGuia(r.guia ?? null); setApto(r.apto ?? null); setFirmar(r.firmar ?? null); setEventosHoy(r.eventosHoy ?? []);
    if (sonido) sonar(r.v!.color);
  }); }, [sedeId, sonido, elegirAviso]);

  const anotado = useCallback((r: ResultadoIngreso, s: ResultadoSocio) => {
    setHecho({ ...r, nombre: s.nombre, hora: hora(new Date()), socioId: s.socio_id });
    setPaso("anotado"); setForzando(false); setMotivo(""); setSocios([]); setTexto(""); setNadie(null);
    setTextoBarra("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona]);

  const anotar = useCallback((forzar?: string, promesa?: PromesaPago) => {
    if (!elegido || trabajando.current) return;
    trabajando.current = true;
    empezar(async () => {
      const r = await registrarEntrada(elegido.socio_id, sedeId, forzar, via, promesa);
      trabajando.current = false;
      if (r.error) { setError(r.error); return; }
      setError(null);
      anotado(r.r!, elegido);
    });
  }, [elegido, sedeId, via, anotado]);

  // VD-48 · La salida: la base dice "Chau Juan, estuviste 1 h 20" o "No tenía entrada abierta" (eso no es un error).
  useEffect(() => {
    if (!abierta || salidaModo !== null) return;
    void leerConfigVisita().then((r) => { if (r.config) setSalidaModo(r.config.registrar_salida ?? "no"); });
  }, [abierta, salidaModo]);
  useEffect(() => {
    if (!abierta || pruebaModo !== null) return;
    void modoPrueba().then((r) => { if (r.modo) setPruebaModo(r.modo); });
  }, [abierta, pruebaModo]);
  // VD-51 · Prueba gratis: DNI que no existe (o que reservó desde la página) → un formulario corto y queda en verde "En prueba".
  const iniciarPrueba = useCallback((dniEscrito: string) => {
    setPrueba({ dni: dniEscrito, nombre: "", apellido: "", telefono: "", info: null, error: null });
    setPaso("prueba"); setError(null);
    void pruebaPorDni(dniEscrito).then((r) => setPrueba((p) => {
      if (!p) return p;
      if (r.error) return { ...p, error: r.error };
      const info = r.p ?? null;
      if (info?.existe && info.usada) return { ...p, info, error: `Ya usó la prueba gratis el ${info.dia}: ofrecele un plan o un pase.` };
      return { ...p, info, nombre: info?.existe ? info.nombre ?? "" : p.nombre, telefono: info?.existe ? info.telefono ?? "" : p.telefono };
    }));
    setTimeout(() => document.querySelector<HTMLInputElement>("[data-prueba-nombre]")?.focus(), 0);
  }, []);
  const guardarPrueba = () => {
    if (!prueba || trabajando.current) return;
    trabajando.current = true;
    empezar(async () => {
      const x = await darPruebaGratis(sedeId, { dni: prueba.dni, nombre: prueba.nombre, apellido: prueba.apellido, telefono: prueba.telefono });
      trabajando.current = false;
      if (x.error || !x.socioId) { setPrueba((p) => (p ? { ...p, error: x.error ?? "No se pudo dar la prueba" } : p)); return; }
      const nuevo: ResultadoSocio = { socio_id: x.socioId, numero: x.numero ?? null, nombre: x.nombre ?? prueba.nombre, color: "gris", texto: "", puede: false, dado_de_baja: false };
      setPrueba(null);
      elegir(nuevo);   // el veredicto sale en verde "En prueba": Enter anota la entrada
    });
  };
  // A un socio que ya está, sin plan y que nunca tuvo prueba: la misma función de la base, con su ficha.
  const darPruebaAlSocio = (s: ResultadoSocio) => {
    if (trabajando.current) return;
    trabajando.current = true;
    empezar(async () => {
      const x = await darPruebaGratis(sedeId, { socioId: s.socio_id });
      trabajando.current = false;
      if (x.error) { setError(x.error); return; }
      elegir(s);
    });
  };
  const marcarSalida = useCallback((s: ResultadoSocio) => {
    if (trabajando.current) return;
    trabajando.current = true;
    empezar(async () => {
      const r = await registrarSalida(s.socio_id, sedeId);
      trabajando.current = false;
      if (r.error || !r.r) { setError(r.error ?? "No se pudo marcar la salida"); return; }
      setError(null); setElegido(s);
      setSalio({ ...r.r, nombre: s.nombre });
      setPaso("salio"); setSocios([]); setTexto(""); setNadie(null);
      if (sonido) sonar(r.r.registrada ? "verde" : "amarillo");
    });
  }, [sedeId, sonido]);
  // DNI + S: se busca por el DNI y se marca la salida de esa persona.
  const salirConDni = useCallback((dniEscrito: string) => {
    if (trabajando.current) return;
    empezar(async () => {
      const r = await leerConReintento(() => buscarSociosRapido(dniEscrito));
      if (r.error) { setError(r.error); return; }
      const lista = r.socios ?? [];
      if (lista.length === 0) { setNadie(dniEscrito); return; }
      marcarSalida(lista[0]);
    });
  }, [marcarSalida]);

  // QR (cámara no: acá solo el lector USB) o llavero: si puede entrar se anota solo; si no, queda el veredicto con el porqué.
  const directo = useCallback(async (q: { socio?: { socio_id: string; nombre: string; numero: number } | null; error?: string }, forma: "qr_socio" | "nfc") => {
    if (q.error || !q.socio) { setError(q.error ?? "No se pudo leer"); setPaso("escribir"); if (sonido) sonar("rojo"); return; }
    const s: ResultadoSocio = { ...q.socio, color: "gris", texto: "", puede: false, dado_de_baja: false };
    const r = await veredicto(s.socio_id, sedeId);
    if (r.error) { setError(r.error); setPaso("escribir"); return; }
    setError(null); setEventosHoy(r.eventosHoy ?? []);
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
  // `lector`: lo que entró fue una lectura (ver lector.ts). Si no se encuentra a nadie suena el error y el campo queda vacío y con el foco,
  // así la próxima lectura no se pega a este código. Quién es y si entra lo sigue diciendo solo la base.
  const resolver = useCallback((crudo: string, lector = false) => empezar(async () => {
    const t = sinPuntos(crudo).trim();
    if (!t) return;
    const volverAlCampo = () => { if (lector) { setTexto(""); setTimeout(() => campo.current?.focus(), 0); } };
    setError(null); setNadie(null);
    if (ES_QR.test(t)) { await directo(await leerQR(t), "qr_socio"); volverAlCampo(); return; }
    if (conLlavero && /^[A-Za-z0-9-]{4,30}$/.test(t) && !/^\d{7,9}$/.test(t)) {
      const l = await leerLlavero(t);
      if (l.socio || l.error) { await directo(l, "nfc"); volverAlCampo(); return; }
    }
    const r = await leerConReintento(() => buscarSociosRapido(t));
    if (r.error) { setError(r.error); if (sonido) sonar("rojo"); volverAlCampo(); return; }
    const lista = r.socios ?? [];
    setSocios(lista); setListaPara(t);
    if (lista.length === 0) { setNadie(t); if (sonido) sonar("rojo"); volverAlCampo(); return; }
    elegir(lista[0]);
  }), [conLlavero, directo, elegir, sonido]);

  // C5: una lectura del lector USB. El mismo código dos veces seguidas (doble Enter) es un solo ingreso; y de todos modos
  // la base no anota dos veces la misma visita (registrar_ingreso es idempotente: el segundo dice "ya había entrado").
  const leer = useCallback((crudo: string) => {
    const t = sinPuntos(crudo).trim();
    if (!t) return;
    const ahora = Date.now();
    if (esLecturaRepetida(ultimaLectura.current, t, ahora)) return;
    ultimaLectura.current = { codigo: t, en: ahora };
    enterPendiente.current = false;
    setTexto("");
    resolver(t, true);
  }, [resolver]);

  // BASE-3: el Enter que llegó mientras se terminaba de buscar corre ahora (con lo que haya en pantalla).
  useEffect(() => {
    if (ocupado || !enterPendiente.current) return;
    enterPendiente.current = false;
    if (paso !== "escribir") return;
    if (socios.length > 0) elegir(socios[Math.min(marcado, socios.length - 1)]); else if (texto.trim()) resolver(texto);
  }, [ocupado, paso, socios, marcado, texto, elegir, resolver]);

  // VD-6 · DNI que no existe → alta en la misma ventana. Los planes y su primer pago los trae la base.
  const iniciarAlta = useCallback((dniEscrito: string) => {
    setAlta({ dni: dniEscrito, nombre: "", apellido: "", telefono: "", plan: "", paso: "datos", planes: null, ofrecido: null, vinculado: null, error: null });
    setPaso("alta"); setError(null);
    // Causa raíz del Plan sin tarjetas: Next aborta el pedido en vuelo si justo se refresca la pantalla (entrada en vivo, cierre de la hoja de cobro).
    // Es una lectura: se repite; si no hay caso, se dice en vez de dejar el esqueleto para siempre.
    leerConReintento(() => planesParaAlta(sedeId)).then((r) => setAlta((a) => (a ? { ...a, planes: r.planes ?? [], error: r.error ?? a.error } : a)))
      .catch(() => setAlta((a) => (a ? { ...a, planes: [], error: "No se pudieron cargar los planes: revisá la conexión y volvé a abrir el alta." } : a)));
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
  const enviar = useCallback((crudo: string, lector = false) => {
    if (lector) {
      const t = sinPuntos(crudo).trim();
      const ahora = Date.now();
      if (esLecturaRepetida(ultimaLectura.current, t, ahora)) return;
      ultimaLectura.current = { codigo: t, en: ahora };
    }
    setAbierta(true);
    setTexto(crudo);
    resolver(crudo, lector);
  }, [resolver]);

  // Coincidencias mientras escribe (hasta 3).
  useEffect(() => {
    if (!abierta || paso !== "escribir") return;
    const t = sinPuntos(texto).trim();
    if (t.length < 2 || ES_QR.test(t)) { setSocios([]); setListaPara(""); setNadie(null); return; }
    const id = setTimeout(async () => {
      let r: Awaited<ReturnType<typeof buscarSociosRapido>>;
      try { r = await leerConReintento(() => buscarSociosRapido(t)); } catch { setError("No se pudo buscar: revisá la conexión y probá de nuevo."); return; }
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
    if (!abierta || (paso !== "anotado" && paso !== "salio") || cfg.cerrar_sola_seg === 0) return;
    const id = setTimeout(() => cerrar(), cfg.cerrar_sola_seg * 1000);
    return () => clearTimeout(id);
  }, [abierta, paso, hecho, salio, cfg.cerrar_sola_seg, cerrar]);

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
      // BASE-3: "/" (fuera de campos de texto) abre la Entrada, como F2.
      if (e.key === "/" && !editable && !abiertaRef.current) { e.preventDefault(); if (conBarraRef.current) barra.current?.focus(); else abrir(); return; }
      const imprimible = e.key.length === 1;
      const digito = /^[0-9]$/.test(e.key);
      const delLector = imprimible && e.timeStamp - ultimaTecla.current < LECTOR_PAUSA_MAX_MS;
      if (imprimible) ultimaTecla.current = e.timeStamp;

      if (abiertaRef.current) {
        if (editable) return;
        const p = pasoRef.current;
        if (p === "alta") return;   // el alta tiene sus propios campos
        // C5: con un resultado en pantalla, las teclas que llegan de corrido (un lector leyendo el código siguiente) no son atajos:
        // una "c" o una "s" dentro del código no puede cobrar ni marcar una salida.
        // Y si lo que llegó de corrido termina en Enter, era una lectura: se empieza de nuevo con ese código (nunca anota al de antes).
        if (p !== "escribir") {
          if (imprimible) rafaga.current = delLector ? rafaga.current + e.key : e.key;
          else if (e.key === "Enter" && rafaga.current.length >= LECTOR_MIN_CARACTERES && e.timeStamp - ultimaTecla.current < LECTOR_PAUSA_MAX_MS * 2) {
            e.preventDefault(); const c = rafaga.current; rafaga.current = ""; reiniciar(); leer(c); return;
          }
          if (delLector && !digito) return;
        }
        if (p === "escribir") {
          if (e.key.toLowerCase() === "a" && /^\d{6,9}$/.test(nadieRef.current ?? "")) { e.preventDefault(); iniciarAltaRef.current(nadieRef.current!); return; }
          if (e.key.toLowerCase() === "p" && pruebaModoRef.current && pruebaModoRef.current !== "no" && /^\d{6,9}$/.test(nadieRef.current ?? "")) { e.preventDefault(); iniciarPruebaRef.current(nadieRef.current!); return; }
          // VD-48: DNI + S = marcar la salida (solo si el gimnasio la registra)
          if (e.key.toLowerCase() === "s" && salidaModoRef.current && salidaModoRef.current !== "no" && /^\d{6,9}$/.test(sinPuntos(textoRef.current).trim())) {
            e.preventDefault(); salirConDniRef.current(sinPuntos(textoRef.current).trim()); return;
          }
          if (imprimible) { e.preventDefault(); setTexto((x) => x + e.key); setTimeout(() => campo.current?.focus(), 0); }
          else if (e.key === "Enter" && textoRef.current.trim()) { e.preventDefault(); resolver(textoRef.current); }
          return;
        }
        if (p === "salio") { if (digito) { e.preventDefault(); reiniciar(e.key); } return; }
        if (p === "anotado") {
          if (digito) { e.preventDefault(); reiniciar(e.key); }
          else if (e.key.toLowerCase() === "s" && salidaModoRef.current && salidaModoRef.current !== "no" && t?.tagName !== "BUTTON") { e.preventDefault(); salirRef.current(); }
          return;
        }
        // Veredicto
        if (formandoRef.current) return;
        if (digito) { e.preventDefault(); reiniciar(e.key); return; }
        if (e.key === "Enter" && t?.tagName !== "BUTTON" && t?.tagName !== "A") { e.preventDefault(); if (puedeEnterRef.current && !trabajando.current) anotarRef.current(); return; }
        const k = e.key.toLowerCase();
        if (k === "c") { e.preventDefault(); cobrarRef.current?.click(); }
        else if (k === "f") { e.preventDefault(); fichaRef.current?.click(); }
        else if (k === "d") { e.preventDefault(); dejarRef.current(); }
        else if (k === "s" && salidaModoRef.current && salidaModoRef.current !== "no") { e.preventDefault(); salirRef.current(); }
        return;
      }

      // Cerrada: un número abre la ventana con ese número; un lector (teclas a menos de 30 ms) también.
      // E1: con la barrita (modo "aviso" en la compu) eso lo atiende la barrita: acá no se hace nada.
      if (barritaRef.current) return;
      if (editable) { buffer.current = { t: "", cuando: 0 }; return; }
      if (hayAlgoEncima()) return;
      if (e.key === "Enter") {
        const b = buffer.current; buffer.current = { t: "", cuando: 0 };
        if (b.t.length >= 4 && e.timeStamp - b.cuando < 60) { e.preventDefault(); enviar(b.t, true); }
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
  }, [propia, abrir, cerrar, reiniciar, resolver, enviar, leer]);

  useEffect(() => {
    abiertaRef.current = abierta; conBarraRef.current = conBarra; cfgRef.current = cfg; formandoRef.current = forzando;
    barritaRef.current = barritaModo;
    puedeEnterRef.current = puedeAnotarConEnter; anotarRef.current = () => anotar();
    nadieRef.current = nadie; iniciarAltaRef.current = iniciarAlta;
    pruebaModoRef.current = pruebaModo; iniciarPruebaRef.current = iniciarPrueba;
    salidaModoRef.current = salidaModo; salirRef.current = () => { if (elegido) marcarSalida(elegido); }; salirConDniRef.current = salirConDni;
    dejarRef.current = () => { if (v && !v.puede && !(esRecepcion && (guia?.solo_encargado || v.motivo === "suspendido" || v.motivo === "se_fue"))) { setForzando(true); void cupoDejarPasar().then(setCupo); } };
  });

  // E4: lo pesado se baja un instante antes de que haga falta, así el toque no espera.
  useEffect(() => {
    if (!abierta) return;
    if (nadie && /^\d{6,9}$/.test(nadie)) { precargarAlta(); precargarPrueba(); }
    if (v && !v.puede) precargarDejarPasar();
  }, [abierta, nadie, v]);

  // E1: "Dejar pasar" desde la barrita abre la ventana con el socio y, apenas llega el veredicto, el formulario de dejar pasar.
  useEffect(() => {
    if (!dejarAlAbrirRef.current || !v) return;
    dejarAlAbrirRef.current = false;
    if (!v.puede) dejarRef.current();
  }, [v]);

  // El botón grande de Inicio y cualquier otro "abrir la Entrada".
  useEffect(() => {
    if (propia) return;
    const abrirDesdeBoton = () => { if (abiertaRef.current) cerrar(); else if (conBarraRef.current) barra.current?.focus(); else abrir(); };
    window.addEventListener(EVENTO_ABRIR_ENTRADA, abrirDesdeBoton);
    return () => window.removeEventListener(EVENTO_ABRIR_ENTRADA, abrirDesdeBoton);
  }, [propia, abrir, cerrar]);

  // VD-29: Ctrl+K "entrada 12345678": abre la ventana con eso ya escrito (un DNI se resuelve solo; un nombre muestra coincidencias).
  useEffect(() => {
    if (propia) return;
    const conTexto = (e: Event) => {
      const t = ((e as CustomEvent<string>).detail ?? "").trim();
      if (!t) { abrir(); return; }
      if (/^[\d.\s]{6,}$/.test(t)) enviar(t.replace(/[.\s]/g, "")); else abrir(t);
    };
    window.addEventListener(EVENTO_ABRIR_ENTRADA_CON, conTexto);
    return () => window.removeEventListener(EVENTO_ABRIR_ENTRADA_CON, conTexto);
  }, [propia, abrir, enviar]);

  // VD-4: tocar un aviso de la puerta (o la barrita) abre el veredicto de ese socio acá.
  useEffect(() => {
    if (propia) return;
    const abrirSocio = (e: Event) => {
      const { dejar, ...s } = (e as CustomEvent<PedidoAbrirSocio>).detail;
      dejarAlAbrirRef.current = !!dejar;
      abrir();
      setTimeout(() => elegir(s, "recepcion", true), 0);   // desde un aviso, la barrita o el panel lateral: la ventana grande, con todos sus botones
    };
    window.addEventListener(EVENTO_ABRIR_SOCIO, abrirSocio);
    return () => window.removeEventListener(EVENTO_ABRIR_SOCIO, abrirSocio);
  }, [propia, abrir, elegir]);

  const refrescar = async (socioId: string) => {
    const r = await veredicto(socioId, sedeId);
    if (r.error) { setError(r.error); return; }
    setError(null); setV(r.v!); setGuia(r.guia ?? null); setApto(r.apto ?? null); setFirmar(r.firmar ?? null); setEventosHoy(r.eventosHoy ?? []);
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
    if (r.error) setError(r.error); else { const n = hecho.nombre; reiniciar(); setAnulada(`Entrada de ${n} anulada`); }
  });
  // Esc en el alta vuelve a la búsqueda (no tira lo escrito de golpe); otra vez, cierra.
  const alCerrarHoja = () => {
    if (forzando) setForzando(false);
    else if (paso === "prueba") { const dniP = prueba?.dni ?? ""; setPrueba(null); setPaso("escribir"); setTexto(dniP); setNadie(dniP); setTimeout(() => campo.current?.focus(), 0); }
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

  const dni = /^\d{6,9}$/.test(nadie ?? "") ? `el DNI ${conPuntos(nadie!)}` : null;
  const hayLista = paso === "escribir" && socios.length > 0 && listaPara === sinPuntos(texto).trim();

  return (
    <>
      {/* C6 · Compu compartida: sin uso el tiempo que puso el gimnasio, suelta a quien atiende y después cierra la sesión (0 = apagado). */}
      {(cfg.cerrar_por_inactividad_min ?? 0) > 0 && <CierreInactividad minutos={cfg.cerrar_por_inactividad_min} />}
      {/* B · El botón: redondo y flotante (en el celular, centrado sobre la barra de abajo). En Inicio está el grande. */}
      {ruta !== "/panel" && (
        <button type="button" data-boton-ventana onClick={() => (abierta ? cerrar() : conBarra ? barra.current?.focus() : abrir())}
          aria-label={abierta ? "Cerrar la Entrada" : "Abrir la Entrada"} aria-pressed={abierta} title="Entrada (F2)"
          className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:left-auto lg:translate-x-0 lg:right-6 lg:bottom-6
            size-16 rounded-full bg-[var(--acento)] text-[var(--sobre-acento)] text-3xl flex items-center justify-center active:scale-95 transition-transform"
          style={{ boxShadow: "var(--sombra-flota)" }}>
          <span aria-hidden><Icono nombre={abierta ? "cerrar" : "puerta"} /></span>
        </button>
      )}

      {/* E1 · La barrita del DNI. */}
      <Barrita sedeId={sedeId} zona={zona} activa={barritaModo && !abierta && !cobrando} sonido={sonido} soloEnVerde={!!cfg.anotar_solo_en_verde}
        conLlavero={conLlavero} esRecepcion={esRecepcion} sinInternet={sinInternet} onIngreso={refrescarPantalla} />

      {/* C · La barra fija (compu ≥ 1280 px): el DNI siempre a mano y las últimas 5 entradas. */}
      {conBarra && <BarraFija barra={barra} detector={detector} textoBarra={textoBarra} setTextoBarra={setTextoBarra} enviar={enviar} ultimas={ultimas} hora={hora} />}

      <Hoja abierta={abierta && !cobrando} alCerrar={alCerrarHoja} etiqueta="Entrada" className="!max-w-2xl" atras={false}>
        <div data-ventana-entrada data-paso={paso} className="max-h-[88dvh] overflow-y-auto">
          {emergencia && <div className="p-4 pb-0"><CartelEmergencia e={emergencia} /></div>}
          {paso === "escribir" && (
            <PasoEscribir campo={campo} detector={detector} enterPendiente={enterPendiente} texto={texto} setTexto={setTexto} setNadie={setNadie} setError={setError}
              setMarcado={setMarcado} setAnulada={setAnulada} anulada={anulada} error={error} nadie={nadie} dni={dni} socios={socios} hayLista={hayLista} marcado={marcado}
              ocupado={ocupado} sedes={sedes} sedeId={sedeId} elegirSede={elegirSede} sonido={sonido}
              alternarSonido={() => setSonido((x) => { try { localStorage.setItem(CLAVE_SONIDO, x ? "no" : "si"); } catch { /* sin almacenamiento */ } return !x; })}
              conQr={conQr} abrirCamara={() => setCamara(true)} pruebaModo={pruebaModo} salidaModo={salidaModo}
              leer={leer} resolver={resolver} elegir={elegir} iniciarAlta={iniciarAlta} iniciarPrueba={iniciarPrueba} salirConDni={salirConDni} />
          )}

          {paso === "prueba" && prueba && <PruebaGratis prueba={prueba} setPrueba={setPrueba} ocupado={ocupado} onGuardar={guardarPrueba} onVolver={alCerrarHoja} />}

          {paso === "alta" && alta && <AltaRapida alta={alta} setAlta={setAlta} ocupado={ocupado} puedeCobrar={puedeCobrar} onGuardar={guardarAlta} onBuscarInteresado={(c) => void buscarInteresado(c)} />}

          {paso === "veredicto" && elegido && (
            <PasoVeredicto elegido={elegido} v={v} guia={guia} apto={apto} firmar={firmar} eventosHoy={eventosHoy} error={error} cobrado={cobrado} esRecepcion={esRecepcion}
              ocupado={ocupado} forzando={forzando} cupo={cupo} motivo={motivo} setMotivo={setMotivo} pruebaModo={pruebaModo} salidaModo={salidaModo}
              puedeAnotarConEnter={puedeAnotarConEnter} cobrarRef={cobrarRef} fichaRef={fichaRef} anotar={anotar} dejar={() => dejarRef.current()}
              volvioAntes={volvioAntes} volverAlta={volverAlta} cobrarAhora={cobrarAhora} darPruebaAlSocio={darPruebaAlSocio} marcarSalida={marcarSalida} reiniciar={() => reiniciar()} />
          )}

          {paso === "anotado" && hecho && (
            <PasoAnotado hecho={hecho} eventosHoy={eventosHoy} error={error} ocupado={ocupado} elegido={elegido} cerrarSolaSeg={cfg.cerrar_sola_seg}
              onDeshacer={deshacer} onSalida={marcarSalida} onSiguiente={() => reiniciar()} />
          )}

          {paso === "salio" && salio && <PasoSalio salio={salio} error={error} cerrarSolaSeg={cfg.cerrar_sola_seg} onSiguiente={() => reiniciar()} />}
        </div>
      </Hoja>
      {camara && <Camara alLeer={(codigo) => { setCamara(false); enviar(codigo.trim()); }} alCerrar={() => { setCamara(false); setTimeout(() => campo.current?.focus(), 0); }} />}
    </>
  );
}

