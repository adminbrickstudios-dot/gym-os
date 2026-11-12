"use client";
// Editor de la página del gimnasio (PAG-1, P8b): los controles a la izquierda y la página como la ve la gente a la
// derecha, que cambia mientras se escribe (en el celular, con "Ver cómo queda"). Logo y fotos, colores y letra, textos,
// qué secciones se ven y en qué orden (arrastrando o con las flechas). Guarda todo junto; la base valida y dice dónde.
// Deshacer y rehacer paso a paso, y "Restaurar por defecto" que carga lo de un gimnasio nuevo como borrador.
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { LandingGimnasio } from "@/components/landing/Landing";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { Icono } from "@/components/ui/Icono";
import type { ClaseSemana, LandingPublicada, Seccion } from "@/lib/landing";
import type { Agenda } from "@/lib/horarios";
import { urlMarca } from "@/lib/url-marca";
import { contraste, seLeePoco } from "@/lib/marca";
import {
  ACENTOS, FONDOS, TIPOGRAFIAS, conActual, deshacer, esTipografia, estiloTipografia, mover, nuevoHistorial, puedeDeshacer, puedeRehacer, registrar, rehacer,
  type Historial, type Tipografia,
} from "@/lib/landing-estilo";
import { guardarEstilo, guardarPagina, leerPaginaPorDefecto } from "./acciones";
import { publicarPagina } from "../configuracion/acciones";
import { Fotos, UnaImagen, type Imagenes, type Reglas } from "../configuracion/Imagenes";
import { useCambiosSinGuardar } from "@/components/ui/useCambiosSinGuardar";
import { BorradorDeEstado, borrarBorradorDe } from "@/components/ui/BorradorDeEstado";

type Portada = { titulo: string; bajada: string | null; boton_texto: string; foto_portada_path: string | null; mensaje_whatsapp: string; mostrar_precios: boolean };
type SeccionPanel = Seccion & { visible: boolean };
type Item = Record<string, string | undefined>;
type Estilo = { color_acento: string; color_fondo: string; tipografia: Tipografia };
type Estado = { portada: Portada; secciones: SeccionPanel[]; estilo: Estilo };
export type PaginaPanel = { portada: Portada; secciones: SeccionPanel[]; fotos: string[]; vista: LandingPublicada | (Omit<LandingPublicada, "publicada"> & { publicada: false }) };
export type ReglasImagenes = { logo: Reglas; foto: Reglas };

const ICONO_SECCION: Record<Seccion["tipo"], string> = {
  sobre_nosotros: "info", actividades: "pesa", planes: "tarjeta", horarios: "reloj", galeria: "imagen", equipo: "usuarios", preguntas: "ayuda", ubicacion: "ubicacion", probar: "regalo",
};
/** Lo que no se edita acá, y dónde se cambia. */
const DE_OTRO_LADO: Partial<Record<Seccion["tipo"], string>> = {
  planes: "Los planes y precios salen de Planes y precios (los que tienen “mostrar en la página”).",
  horarios: "Los horarios salen de Configuración → Horarios. Si hay clases en la agenda, se muestran las de los próximos 7 días.",
  galeria: "Las fotos se suben acá arriba, en Imágenes.",
  ubicacion: "Las direcciones salen de Configuración → Gimnasio (sedes).",
  probar: "Un formulario corto (nombre, WhatsApp y qué le interesa): lo que deja la gente llega a Prospectos. Arriba de todo aparece el botón “Probá una clase”.",
};
/** Los campos de cada lista: [clave, etiqueta, máximo, obligatorio, área de texto]. */
const LISTAS: Partial<Record<Seccion["tipo"], { clave: "items" | "personas"; nombre: string; campos: [string, string, number, boolean, boolean?][] }>> = {
  actividades: { clave: "items", nombre: "actividad", campos: [["emoji", "Emoji (opcional)", 8, false], ["nombre", "Actividad", 40, true], ["descripcion", "Descripción", 160, false]] },
  equipo: { clave: "personas", nombre: "profe", campos: [["nombre", "Nombre", 60, true], ["rol", "Especialidad", 60, false]] },
  preguntas: { clave: "items", nombre: "pregunta", campos: [["pregunta", "Pregunta", 160, true], ["respuesta", "Respuesta", 800, true, true]] },
};

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="etiqueta">{etiqueta}</span>{children}{ayuda && <span className="block text-sm texto-tenue">{ayuda}</span>}</label>;
}

/**
 * La página como se ve en una compu, achicada al ancho del cuadro: las
 * medidas de la página responden al ancho de la pantalla, así que en un cuadro
 * angosto se vería la versión de compu rota. Se dibuja a 1280 px y se escala.
 */
const ANCHO_COMPU = 1280;
function Miniatura({ children }: { children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null), adentro = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.4), [alto, setAlto] = useState(0);
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (caja.current) setEscala(caja.current.clientWidth / ANCHO_COMPU);
      if (adentro.current) setAlto(adentro.current.scrollHeight);
    });
    if (caja.current) ro.observe(caja.current);
    if (adentro.current) ro.observe(adentro.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={caja} className="rounded-[var(--radio-grande)] border border-[var(--borde)] overflow-y-auto overflow-x-hidden h-full" data-vista-previa data-escala={escala.toFixed(2)}>
      <div style={{ height: alto * escala }}>
        <div ref={adentro} style={{ width: ANCHO_COMPU, transform: `scale(${escala})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}

/** Arriba del editor: si la página está publicada, publicarla o pasarla a borrador, y compartir el link. */
function Estado({ publicadaInicial, direccion, nombre, puedeEditar }: { publicadaInicial: boolean; direccion: string; nombre: string; puedeEditar: boolean }) {
  const [publicada, setPublicada] = useState(publicadaInicial);
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [copiado, setCopiado] = useState(false);
  const [cambiando, empezar] = useTransition();
  const cambiar = (p: boolean) => empezar(async () => {
    const r = await publicarPagina(p);
    if (r.error) { setMsj({ error: r.error }); return; }
    setPublicada(p);
    setMsj({ ok: p ? "Visible: ya la puede ver cualquiera con el link." : "Oculta: la gente ve solo tu portada con tu marca y los botones." });
  });
  const copiar = async () => {
    try { await navigator.clipboard.writeText(direccion); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { setCopiado(false); }
  };
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-estado-pagina={publicada ? "publicada" : "borrador"}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`pildora ${publicada ? "pildora-verde" : "pildora-amarillo"}`}>{publicada ? "Visible" : "Oculta: la gente ve solo tu portada y los botones"}</span>
        <span className="texto-suave break-all">{direccion}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {puedeEditar && (publicada
          ? <button type="button" className="boton" disabled={cambiando} onClick={() => cambiar(false)}>{cambiando ? "Guardando…" : "Ocultar mi página"}</button>
          : <button type="button" className="boton boton-principal" disabled={cambiando} onClick={() => cambiar(true)}>{cambiando ? "Guardando…" : "Mostrar mi página"}</button>)}
        <a href={direccion} target="_blank" rel="noopener noreferrer" className="boton"><Icono nombre="web" /> Ver</a>
        <button type="button" className="boton" onClick={copiar}>{copiado ? "Copiado" : "Copiar link"}</button>
        <a className="boton" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Conocé ${nombre}: ${direccion}`)}`}><Icono nombre="mensaje" /> Compartir por WhatsApp</a>
      </div>
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj.ok && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      <p className="text-sm texto-tenue">Al pegar el link en WhatsApp o Instagram se ve el nombre, la frase y la foto de portada (o una imagen con tus colores).</p>
    </section>
  );
}

const estadoDe = (p: PaginaPanel): Estado => ({
  portada: p.portada,
  secciones: p.secciones,
  estilo: { color_acento: p.vista.marca.color_acento, color_fondo: p.vista.marca.color_fondo, tipografia: esTipografia(p.vista.marca.tipografia) ? p.vista.marca.tipografia : "condensada" },
});

export function Editor({ inicial, agenda, clases = [], puedeEditar, direccion, altas, reglas }: {
  inicial: PaginaPanel; agenda: Agenda | null; clases?: ClaseSemana[]; puedeEditar: boolean; direccion: string; altas?: ReactNode; reglas?: ReglasImagenes;
}) {
  const [guardado, setGuardado] = useState<Estado>(() => estadoDe(inicial));
  const [est, setEst] = useState<Estado>(() => estadoDe(inicial));
  const [hist, setHist] = useState<Historial<Estado>>(() => nuevoHistorial(estadoDe(inicial)));
  const [media, setMedia] = useState({ logo_path: inicial.vista.marca.logo_path, favicon_path: inicial.vista.marca.favicon_path, fotos: inicial.fotos });
  const [respuesta, setRespuesta] = useState<{ ok?: string; error?: string; n: number }>({ n: 0 });
  const [verVista, setVerVista] = useState(false);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [pideRestaurar, setPideRestaurar] = useState(false);
  const [guardando, empezar] = useTransition();
  const [restaurando, empezarRestaurar] = useTransition();
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);
  // La vista previa a pantalla completa (celular) se cierra con Esc además de con “Volver a editar”.
  useEffect(() => {
    if (!verVista) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setVerVista(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [verVista]);

  const sucio = !igual(est, guardado);
  useCambiosSinGuardar(sucio);
  const eraSucio = useRef(false);
  useEffect(() => { if (eraSucio.current && !sucio) borrarBorradorDe("pagina"); eraSucio.current = sucio; }, [sucio]);   // guardado o vuelto a lo guardado: no queda borrador

  // ── Cambios: los de un toque quedan como un paso del historial; lo que se escribe, al salir del campo ──
  const ahora = useCallback((fn: (e: Estado) => Estado) => { const n = fn(est); setEst(n); setHist((h) => registrar(h, n)); }, [est]);
  const escribir = (fn: (e: Estado) => Estado) => setEst(fn(est));
  const confirmar = () => setHist((h) => registrar(h, est));
  const sinConfirmar = !igual(est, hist.actual);
  const deshacerPaso = useCallback(() => {
    if (sinConfirmar) { setEst(hist.actual); return; }
    const n = deshacer(hist); setHist(n); setEst(n.actual);
  }, [hist, sinConfirmar]);
  const rehacerPaso = useCallback(() => { const n = rehacer(hist); setHist(n); setEst(n.actual); }, [hist]);
  // Ctrl+Z y Ctrl+Mayús+Z, salvo escribiendo en un campo (ahí deshace el texto, como siempre).
  useEffect(() => {
    if (!puedeEditar) return;
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) rehacerPaso(); else deshacerPaso();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [puedeEditar, deshacerPaso, rehacerPaso]);

  const { portada, secciones, estilo } = est;
  const setP = <K extends keyof Portada>(k: K, v: Portada[K], yaConfirmado = false) => (yaConfirmado ? ahora : escribir)((e) => ({ ...e, portada: { ...e.portada, [k]: v } }));
  const setE = <K extends keyof Estilo>(k: K, v: Estilo[K]) => ahora((e) => ({ ...e, estilo: { ...e.estilo, [k]: v } }));
  const setS = (i: number, cambio: Partial<SeccionPanel>, yaConfirmado = false) =>
    (yaConfirmado ? ahora : escribir)((e) => ({ ...e, secciones: e.secciones.map((s, j) => (j === i ? ({ ...s, ...cambio } as SeccionPanel) : s)) }));
  const moverSeccion = (desde: number, hasta: number) => ahora((e) => ({ ...e, secciones: mover(e.secciones, desde, hasta) }));
  const items = (s: SeccionPanel): Item[] => {
    const l = LISTAS[s.tipo]; if (!l) return [];
    return ((s.contenido as Record<string, Item[] | undefined>)[l.clave] ?? []);
  };
  const setItems = (i: number, s: SeccionPanel, nuevos: Item[], yaConfirmado = false) =>
    setS(i, { contenido: { ...s.contenido, [LISTAS[s.tipo]!.clave]: nuevos } } as Partial<SeccionPanel>, yaConfirmado);

  // ── Imágenes: se guardan al subirlas (como en Configuración → Marca); la foto de portada se suelta sola si se quita ──
  const imagenesListas = (x: Imagenes) => {
    setMedia({ logo_path: x.logo_path, favicon_path: x.favicon_path, fotos: x.fotos });
    const fuera = (p: Portada) => (p.foto_portada_path && !x.fotos.includes(p.foto_portada_path) ? { ...p, foto_portada_path: null } : p);
    setEst((e) => ({ ...e, portada: fuera(e.portada) }));
    setGuardado((g) => ({ ...g, portada: fuera(g.portada) }));
    setHist((h) => ({ ...h, pasado: [], futuro: [], actual: { ...h.actual, portada: fuera(h.actual.portada) } }));
  };

  const guardar = () => empezar(async () => {
    // Las filas vacías de una lista no se mandan (un "Agregar" que no se usó).
    const limpias = secciones.map((s) => {
      const l = LISTAS[s.tipo]; if (!l) return s;
      return { ...s, contenido: { ...s.contenido, [l.clave]: items(s).filter((it) => Object.values(it).some((v) => (v ?? "").trim())) } };
    });
    const r = await guardarPagina({ ...portada, bajada: portada.bajada ?? "" }, limpias);
    if (r.error || !r.pagina) { setRespuesta((x) => ({ error: r.error ?? "No se pudo guardar", n: x.n + 1 })); return; }
    let p = r.pagina as PaginaPanel;
    // Colores y letra: solo si cambiaron (son de la marca, no de la portada).
    if (!igual(estilo, guardado.estilo)) {
      const e = await guardarEstilo(estilo.color_acento, estilo.color_fondo, estilo.tipografia);
      if (e.error || !e.pagina) {
        // Lo de la página quedó guardado; los colores no. Se dice cuál.
        const parcial: Estado = { ...estadoDe(p), estilo: guardado.estilo };
        setGuardado(parcial); setEst({ ...parcial, estilo });
        setRespuesta((x) => ({ error: `La portada y las secciones se guardaron, pero los colores y la letra no: ${e.error ?? "no se pudo guardar"}`, n: x.n + 1 }));
        return;
      }
      p = e.pagina as PaginaPanel;
    }
    const nuevo = estadoDe(p);
    setGuardado(nuevo); setEst(nuevo); setHist((h) => conActual(registrar(h, nuevo), nuevo));
    setRespuesta((x) => ({ ok: "Guardado. Ya se ve así en tu página.", n: x.n + 1 }));
  });

  /** Vuelve a lo último guardado (un paso más en el historial: se puede deshacer). */
  const descartar = () => { ahora(() => guardado); setRespuesta((x) => ({ n: x.n + 1 })); };

  const restaurar = () => empezarRestaurar(async () => {
    const r = await leerPaginaPorDefecto();
    if (r.error || !r.defecto) { setRespuesta((x) => ({ error: r.error ?? "No se pudo leer lo por defecto", n: x.n + 1 })); setPideRestaurar(false); return; }
    const d = r.defecto;
    ahora((e) => ({
      portada: d.portada,
      secciones: d.secciones.map((s) => ({ ...s, contenido: s.contenido } as unknown as SeccionPanel)).concat(e.secciones.filter((s) => !d.secciones.some((x) => x.tipo === s.tipo))),
      estilo: d.estilo,
    }));
    setPideRestaurar(false);
    setRespuesta((x) => ({ ok: "Cargamos lo que trae un gimnasio nuevo. Mirá cómo queda y tocá Guardar; si no te gusta, Deshacer.", n: x.n + 1 }));
  });

  // La página como la ve la gente, con lo que se está escribiendo.
  const vista: LandingPublicada = useMemo(() => ({
    ...(inicial.vista as LandingPublicada),
    publicada: true,
    marca: { ...inicial.vista.marca, color_acento: estilo.color_acento, color_fondo: estilo.color_fondo, tipografia: estilo.tipografia, logo_path: media.logo_path, favicon_path: media.favicon_path },
    portada: { titulo: portada.titulo || "Tu gimnasio", bajada: portada.bajada || null, foto_path: portada.foto_portada_path, boton_texto: portada.boton_texto || "Quiero empezar" },
    contacto: { ...inicial.vista.contacto, mensaje_whatsapp: portada.mensaje_whatsapp },
    mostrar_precios: portada.mostrar_precios,
    secciones: secciones.filter((s) => s.visible).map(({ tipo, titulo, contenido }) => ({ tipo, titulo, contenido }) as Seccion),
  }), [inicial.vista, portada, secciones, estilo, media]);

  const pagina = <LandingGimnasio landing={vista} agenda={agenda} clases={clases} />;
  // En el celular se ve a tamaño real; transform: lo fijo de la página (la barra de WhatsApp) queda dentro del cuadro.
  const VistaCelu = (
    <div className="rounded-[var(--radio-grande)] border border-[var(--borde)] overflow-auto h-full [transform:translateZ(0)]" data-vista-previa>{pagina}</div>
  );

  const pie = (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 z-10 tarjeta p-4 flex flex-wrap items-center gap-3 [box-shadow:var(--sombra-flota)]"
      data-pie-pagina data-respuestas={respuesta.n}>
      <button type="button" className="boton boton-principal" disabled={!sucio || guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
      <button type="button" className="boton" disabled={!puedeDeshacer(hist) && !sinConfirmar} onClick={deshacerPaso} data-deshacer><Icono nombre="deshacer" /> Deshacer</button>
      <button type="button" className="boton" disabled={!puedeRehacer(hist)} onClick={rehacerPaso} data-rehacer>Rehacer</button>
      {sucio && <button type="button" className="boton texto-suave" onClick={descartar} data-descartar>Volver a lo guardado</button>}
      <button type="button" className="boton lg:hidden" onClick={() => setVerVista(true)}><Icono nombre="ojo" /> Ver cómo queda</button>
      {sucio && <span className="text-sm texto-suave" data-sin-guardar>• Cambios sin guardar</span>}
      {respuesta.error && <Mensaje tipo="error" className="w-full">{respuesta.error}</Mensaje>}
      {respuesta.ok && <Mensaje tipo="exito" className="w-full">{respuesta.ok}</Mensaje>}
    </div>
  );

  const poco = seLeePoco(estilo.color_acento, estilo.color_fondo);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start" data-editor-pagina data-listo={listo}>
      <div className="space-y-4 min-w-0">
        <Estado publicadaInicial={inicial.vista.publicada} direccion={direccion} nombre={inicial.vista.marca.nombre} puedeEditar={puedeEditar} />
        {altas}
        {puedeEditar && <BorradorDeEstado clave="pagina" valor={est} aplicar={(v: Estado) => setEst(v)} />}
        {!puedeEditar && <p className="pildora"><Icono nombre="ojo" /> Solo el dueño cambia la página.</p>}

        {/* Logo y fotos: se guardan al subirlas, como en Configuración → Marca. */}
        {reglas && (
          <section className="tarjeta p-5 sm:p-6 space-y-5" data-bloque="imagenes">
            <div><p className="titulo text-2xl"><Icono nombre="imagen" /> Logo y fotos</p><p className="texto-suave">Se guardan apenas las subís. Sin logo, la página usa tus iniciales; sin fotos, usa tu nombre y tu color.</p></div>
            <div className="space-y-2">
              <p className="etiqueta">Logo</p>
              <UnaImagen tipo="logo" ruta={media.logo_path} reglas={reglas.logo} puedeEditar={puedeEditar} alListo={imagenesListas}
                vista={(url) => url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={url} alt={`Logo de ${inicial.vista.marca.nombre}`} className="h-20 max-w-full object-contain rounded-[var(--radio)] p-2 border border-[var(--borde)]" style={{ background: estilo.color_fondo }} />
                  : <p className="texto-tenue">Sin logo: se muestra el nombre del gimnasio.</p>} />
            </div>
            <div className="space-y-2">
              <p className="etiqueta">Fotos de la página</p>
              <Fotos fotos={media.fotos} reglas={reglas.foto} puedeEditar={puedeEditar} nombre={inicial.vista.marca.nombre} alListo={imagenesListas} />
            </div>
          </section>
        )}

        <fieldset disabled={!puedeEditar} className="space-y-4 min-w-0">
          <section className="tarjeta p-5 sm:p-6 space-y-4" data-bloque="estilo">
            <div><p className="titulo text-2xl"><Icono nombre="imagen" /> Colores y letra</p><p className="texto-suave">El color principal es el de los botones y los números. Se ve también en el panel y en la app de tus socios.</p></div>
            <div>
              <p className="etiqueta mb-2">Color principal</p>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Color principal">
                {ACENTOS.map((a) => <button key={a} type="button" aria-label={`Color ${a}`} aria-pressed={estilo.color_acento.toLowerCase() === a} onClick={() => setE("color_acento", a)} data-color-acento={a}
                  className="size-11 rounded-[var(--radio)] border-2" style={{ background: a, borderColor: estilo.color_acento.toLowerCase() === a ? "var(--texto)" : "transparent" }} />)}
                <input type="color" aria-label="Otro color principal" value={estilo.color_acento} onChange={(e) => setE("color_acento", e.target.value)} className="size-11 rounded-[var(--radio)] bg-transparent" data-color-acento-libre />
              </div>
            </div>
            <div>
              <p className="etiqueta mb-2">Fondo</p>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Fondo">
                {FONDOS.map((f) => <button key={f} type="button" aria-label={`Fondo ${f}`} aria-pressed={estilo.color_fondo.toLowerCase() === f} onClick={() => setE("color_fondo", f)}
                  className="size-11 rounded-[var(--radio)] border-2" style={{ background: f, borderColor: estilo.color_fondo.toLowerCase() === f ? "var(--acento)" : "var(--borde)" }} />)}
                <input type="color" aria-label="Otro fondo" value={estilo.color_fondo} onChange={(e) => setE("color_fondo", e.target.value)} className="size-11 rounded-[var(--radio)] bg-transparent" />
              </div>
            </div>
            {poco && (
              <p className="pildora pildora-amarillo" role="status"><Icono nombre="alerta" /> Este color se ve poco sobre este fondo (contraste {contraste(estilo.color_acento, estilo.color_fondo)?.toFixed(1).replace(".", ",")} a 1; conviene 3 o más).</p>
            )}
            <div>
              <p className="etiqueta mb-2">Letra de los títulos</p>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Letra de los títulos">
                {TIPOGRAFIAS.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={estilo.tipografia === t.id} onClick={() => setE("tipografia", t.id)} data-tipografia-opcion={t.id}
                    className={`rounded-[var(--radio)] border-2 p-3 text-left ${estilo.tipografia === t.id ? "border-[var(--acento)]" : "border-[var(--borde)]"}`}>
                    <span className="block text-2xl titulo" style={estiloTipografia(t.id)}>Entrená hoy</span>
                    <span className="block text-sm font-semibold mt-1">{t.nombre}</span>
                    <span className="block text-sm texto-tenue">{t.detalle}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="tarjeta p-5 sm:p-6 space-y-4" data-bloque="portada">
            <div><p className="titulo text-2xl"><Icono nombre="inicio" /> Portada</p><p className="texto-suave">Lo primero que se ve. Una frase que diga por qué venir.</p></div>
            <Campo etiqueta="Título" ayuda={`${portada.titulo.length} de 80`}>
              <input className="campo" maxLength={80} value={portada.titulo} onChange={(e) => setP("titulo", e.target.value)} onBlur={confirmar} />
            </Campo>
            <Campo etiqueta="Frase" ayuda={`${(portada.bajada ?? "").length} de 240 · opcional. Sin frase, la página pone una según tus clases.`}>
              <textarea className="campo min-h-20" maxLength={240} value={portada.bajada ?? ""} onChange={(e) => setP("bajada", e.target.value)} onBlur={confirmar} />
            </Campo>
            <Campo etiqueta="Texto del botón principal" ayuda="Abre el WhatsApp del gimnasio. Ej.: “Quiero empezar”, “Probá una clase gratis”.">
              <input className="campo" maxLength={40} value={portada.boton_texto} onChange={(e) => setP("boton_texto", e.target.value)} onBlur={confirmar} />
            </Campo>
            <Campo etiqueta="Mensaje que llega por WhatsApp" ayuda="Lo que la persona ya tiene escrito al tocar el botón.">
              <input className="campo" maxLength={300} value={portada.mensaje_whatsapp} onChange={(e) => setP("mensaje_whatsapp", e.target.value)} onBlur={confirmar} />
            </Campo>
            <div>
              <p className="etiqueta mb-2">Foto de portada</p>
              {media.fotos.length === 0
                ? <p className="texto-tenue">Todavía no subiste fotos. Subilas arriba, en Logo y fotos, y elegí una acá.</p>
                : <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Foto de portada">
                    <button type="button" role="radio" aria-checked={!portada.foto_portada_path} onClick={() => setP("foto_portada_path", null, true)}
                      className={`size-20 rounded-[var(--radio)] border-2 texto-suave text-sm ${!portada.foto_portada_path ? "border-[var(--acento)]" : "border-[var(--borde)]"}`}>Sin foto</button>
                    {media.fotos.map((f, i) => (
                      <button key={f} type="button" role="radio" aria-checked={portada.foto_portada_path === f} aria-label={`Foto ${i + 1}`} onClick={() => setP("foto_portada_path", f, true)}
                        className={`size-20 rounded-[var(--radio)] border-2 overflow-hidden ${portada.foto_portada_path === f ? "border-[var(--acento)]" : "border-transparent"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={urlMarca(f)!} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>}
            </div>
            <Interruptor etiqueta="Mostrar los precios" ayuda="Apagado, los planes se ven sin precio (para que pregunten)."
              checked={portada.mostrar_precios} onChange={(e) => setP("mostrar_precios", e.target.checked, true)} />
          </section>

          <p className="titulo-grupo pt-2">Secciones, en el orden en que se ven <span className="texto-tenue normal-case font-normal">· arrastrá desde <Icono nombre="menu" /> o usá las flechas</span></p>
          {secciones.map((s, i) => {
            const lista = LISTAS[s.tipo];
            return (
              <section key={s.tipo}
                className={`tarjeta p-5 sm:p-6 space-y-4 ${s.visible ? "" : "opacity-70"} ${arrastrando === i ? "opacity-50" : ""} ${sobre === i && arrastrando !== null && arrastrando !== i ? "outline-2 outline-[var(--acento)]" : ""}`}
                data-seccion={s.tipo} data-orden={i}
                onDragOver={(e) => { if (arrastrando === null) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (sobre !== i) setSobre(i); }}
                onDrop={(e) => { e.preventDefault(); if (arrastrando !== null) moverSeccion(arrastrando, i); setArrastrando(null); setSobre(null); }}>
                <div className="flex items-start gap-3">
                  <button type="button" draggable={puedeEditar} aria-label={`Arrastrar ${s.titulo}`} data-arrastrar={s.tipo}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", s.tipo); setArrastrando(i); }}
                    onDragEnd={() => { setArrastrando(null); setSobre(null); }}
                    className="boton px-3 cursor-grab active:cursor-grabbing flex-none touch-none"><Icono nombre="menu" /></button>
                  <span className="icono" aria-hidden><Icono nombre={ICONO_SECCION[s.tipo]} /></span>
                  <div className="min-w-0 flex-1">
                    <input className="campo font-semibold" aria-label={`Título de la sección ${i + 1}`} maxLength={60} value={s.titulo} onChange={(e) => setS(i, { titulo: e.target.value })} onBlur={confirmar} />
                  </div>
                  <div className="flex gap-1 flex-none">
                    <button type="button" className="boton px-3" aria-label={`Subir ${s.titulo}`} disabled={i === 0} onClick={() => moverSeccion(i, i - 1)}>▲</button>
                    <button type="button" className="boton px-3" aria-label={`Bajar ${s.titulo}`} disabled={i === secciones.length - 1} onClick={() => moverSeccion(i, i + 1)}>▼</button>
                  </div>
                </div>
                <Interruptor etiqueta="Se muestra en la página" checked={s.visible} onChange={(e) => setS(i, { visible: e.target.checked }, true)} />
                {DE_OTRO_LADO[s.tipo] && <p className="text-sm texto-tenue">{DE_OTRO_LADO[s.tipo]}</p>}
                {s.tipo === "probar" && (
                  <Campo etiqueta="Texto arriba del formulario" ayuda={`${((s.contenido as { texto?: string }).texto ?? "").length} de 300 · opcional`}>
                    <textarea className="campo min-h-20" maxLength={300} placeholder="La primera clase es sin cargo. Dejanos tus datos y te escribimos."
                      value={(s.contenido as { texto?: string }).texto ?? ""} onChange={(e) => setS(i, { contenido: { texto: e.target.value } } as Partial<SeccionPanel>)} onBlur={confirmar} />
                  </Campo>
                )}
                {s.tipo === "sobre_nosotros" && (
                  <Campo etiqueta="Texto" ayuda={`${((s.contenido as { texto?: string }).texto ?? "").length} de 1.500 · opcional. Sin texto, la página pone uno según tus clases.`}>
                    <textarea className="campo min-h-32" maxLength={1500} value={(s.contenido as { texto?: string }).texto ?? ""}
                      onChange={(e) => setS(i, { contenido: { texto: e.target.value } } as Partial<SeccionPanel>)} onBlur={confirmar} />
                  </Campo>
                )}
                {lista && (
                  <div className="space-y-3">
                    {items(s).map((it, k) => (
                      <div key={k} className="rounded-[var(--radio)] border border-[var(--borde)] p-3 space-y-2" data-elemento={k}>
                        <div className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]">
                          {lista.campos.map(([c, et, max, , area]) => (
                            <label key={c} className={`block space-y-1 ${area ? "sm:col-span-full" : c === "emoji" ? "sm:max-w-24" : ""}`}>
                              <span className="text-sm texto-suave">{et}</span>
                              {area
                                ? <textarea className="campo min-h-20" maxLength={max} value={it[c] ?? ""} onBlur={confirmar} onChange={(e) => setItems(i, s, items(s).map((x, m) => (m === k ? { ...x, [c]: e.target.value } : x)))} />
                                : <input className="campo" maxLength={max} value={it[c] ?? ""} onBlur={confirmar} onChange={(e) => setItems(i, s, items(s).map((x, m) => (m === k ? { ...x, [c]: e.target.value } : x)))} />}
                            </label>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" className="boton px-3 text-sm" aria-label={`Subir ${lista.nombre} ${k + 1}`} disabled={k === 0}
                            onClick={() => setItems(i, s, mover(items(s), k, k - 1), true)}>▲</button>
                          <button type="button" className="boton px-3 text-sm" aria-label={`Bajar ${lista.nombre} ${k + 1}`} disabled={k === items(s).length - 1}
                            onClick={() => setItems(i, s, mover(items(s), k, k + 1), true)}>▼</button>
                          <button type="button" className="boton px-3 text-sm texto-suave" onClick={() => setItems(i, s, items(s).filter((_, m) => m !== k), true)}><Icono nombre="papelera" /> Quitar</button>
                        </div>
                      </div>
                    ))}
                    {items(s).length < 30 && (
                      <button type="button" className="boton" onClick={() => setItems(i, s, [...items(s), {}], true)}><Icono nombre="mas" /> Agregar {lista.nombre}</button>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {puedeEditar && (
            <section className="tarjeta p-5 sm:p-6 space-y-3" data-bloque="restaurar">
              <div><p className="titulo text-xl">Restaurar por defecto</p>
                <p className="texto-suave">Vuelve la portada, las secciones, los colores y la letra a lo que trae un gimnasio nuevo. Tus fotos y tu logo no se tocan. Queda como borrador: lo ves a la derecha y no se guarda hasta que toques Guardar.</p></div>
              {pideRestaurar ? (
                <div className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label="Restaurar por defecto">
                  <span className="text-sm">Se pierden los textos que escribiste en la página (si no guardás, los recuperás con Deshacer).</span>
                  <button type="button" className="boton boton-principal" disabled={restaurando} onClick={restaurar} data-confirmar-restaurar>{restaurando ? "Cargando…" : "Sí, restaurar"}</button>
                  <button type="button" className="boton" onClick={() => setPideRestaurar(false)}>No</button>
                </div>
              ) : (
                <button type="button" className="boton" onClick={() => setPideRestaurar(true)} data-restaurar><Icono nombre="deshacer" /> Restaurar por defecto</button>
              )}
            </section>
          )}
        </fieldset>
        {puedeEditar && pie}
      </div>

      <div className="hidden lg:block sticky top-4 h-[calc(100dvh-2rem)]">
        <p className="etiqueta mb-2">Así la ve la gente{sucio ? " (sin guardar)" : ""}</p>
        <div className="h-[calc(100%-2rem)]">{verVista ? null : <Miniatura>{pagina}</Miniatura>}</div>
      </div>

      {verVista && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[var(--fondo)] flex flex-col" role="dialog" aria-label="Cómo queda la página">
          <div className="p-3 flex items-center justify-between gap-2 border-b border-[var(--borde)]">
            <p className="font-semibold"><Icono nombre="ojo" /> Así la ve la gente</p>
            <button type="button" className="boton" onClick={() => setVerVista(false)}><Icono nombre="lapiz" /> Volver a editar</button>
          </div>
          <div className="flex-1 min-h-0 p-2">{VistaCelu}</div>
        </div>
      )}
    </div>
  );
}
