"use client";
// Editor de la página del gimnasio (PAG-1): portada y secciones a la
// izquierda, la página como la ve la gente a la derecha (en el celular, con
// "Ver cómo queda"). Guarda todo junto; la base valida y dice dónde.
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { LandingGimnasio } from "@/components/landing/Landing";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import type { LandingPublicada, Seccion } from "@/lib/landing";
import type { Agenda } from "@/lib/horarios";
import { urlMarca } from "@/lib/url-marca";
import { guardarPagina } from "./acciones";

type Portada = { titulo: string; bajada: string | null; boton_texto: string; foto_portada_path: string | null; mensaje_whatsapp: string; mostrar_precios: boolean };
type SeccionPanel = Seccion & { visible: boolean };
type Item = Record<string, string | undefined>;
export type PaginaPanel = { portada: Portada; secciones: SeccionPanel[]; fotos: string[]; vista: LandingPublicada | (Omit<LandingPublicada, "publicada"> & { publicada: false }) };

const EMOJI: Record<Seccion["tipo"], string> = {
  sobre_nosotros: "🏋️", actividades: "💪", planes: "🔥", horarios: "⏰", galeria: "📸", equipo: "👥", preguntas: "💬", ubicacion: "📍",
};
/** Lo que no se edita acá, y dónde se cambia. */
const DE_OTRO_LADO: Partial<Record<Seccion["tipo"], string>> = {
  planes: "Los planes y precios salen de Planes y precios (los que tienen “mostrar en la página”).",
  horarios: "Los horarios salen de Configuración → Horarios.",
  galeria: "Las fotos se suben en Configuración → Marca.",
  ubicacion: "Las direcciones salen de Configuración → Gimnasio (sedes).",
};
/** Los campos de cada lista: [clave, etiqueta, máximo, obligatorio, área de texto]. */
const LISTAS: Partial<Record<Seccion["tipo"], { clave: "items" | "personas"; nombre: string; campos: [string, string, number, boolean, boolean?][] }>> = {
  actividades: { clave: "items", nombre: "actividad", campos: [["emoji", "Emoji", 8, false], ["nombre", "Actividad", 40, true], ["descripcion", "Descripción", 160, false]] },
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

export function Editor({ inicial, agenda, puedeEditar }: { inicial: PaginaPanel; agenda: Agenda | null; puedeEditar: boolean }) {
  const [guardado, setGuardado] = useState(inicial);
  const [portada, setPortada] = useState(inicial.portada);
  const [secciones, setSecciones] = useState(inicial.secciones);
  const [respuesta, setRespuesta] = useState<{ ok?: string; error?: string; n: number }>({ n: 0 });
  const [verVista, setVerVista] = useState(false);
  const [guardando, empezar] = useTransition();
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);

  const sucio = !igual(portada, guardado.portada) || !igual(secciones, guardado.secciones);
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);

  const setP = <K extends keyof Portada>(k: K, v: Portada[K]) => setPortada((x) => ({ ...x, [k]: v }));
  const setS = (i: number, cambio: Partial<SeccionPanel>) => setSecciones((xs) => xs.map((s, j) => (j === i ? ({ ...s, ...cambio } as SeccionPanel) : s)));
  const mover = (i: number, d: -1 | 1) => setSecciones((xs) => {
    const j = i + d; if (j < 0 || j >= xs.length) return xs;
    const ys = [...xs]; [ys[i], ys[j]] = [ys[j], ys[i]]; return ys;
  });
  const items = (s: SeccionPanel): Item[] => {
    const l = LISTAS[s.tipo]; if (!l) return [];
    return ((s.contenido as Record<string, Item[] | undefined>)[l.clave] ?? []);
  };
  const setItems = (i: number, s: SeccionPanel, nuevos: Item[]) => setS(i, { contenido: { ...s.contenido, [LISTAS[s.tipo]!.clave]: nuevos } } as Partial<SeccionPanel>);

  const guardar = () => empezar(async () => {
    // Las filas vacías de una lista no se mandan (un "Agregar" que no se usó).
    const limpias = secciones.map((s) => {
      const l = LISTAS[s.tipo]; if (!l) return s;
      return { ...s, contenido: { ...s.contenido, [l.clave]: items(s).filter((it) => Object.values(it).some((v) => (v ?? "").trim())) } };
    });
    const r = await guardarPagina({ ...portada, bajada: portada.bajada ?? "" }, limpias);
    if (r.error || !r.pagina) { setRespuesta((x) => ({ error: r.error ?? "No se pudo guardar", n: x.n + 1 })); return; }
    const p = r.pagina as PaginaPanel;
    setGuardado(p); setPortada(p.portada); setSecciones(p.secciones);
    setRespuesta((x) => ({ ok: "Guardado. Ya se ve así en tu página.", n: x.n + 1 }));
  });
  const deshacer = () => { setPortada(guardado.portada); setSecciones(guardado.secciones); setRespuesta((x) => ({ n: x.n + 1 })); };

  // La página como la ve la gente, con lo que se está escribiendo.
  const vista: LandingPublicada = useMemo(() => ({
    ...(inicial.vista as LandingPublicada),
    publicada: true,
    portada: { titulo: portada.titulo || "Tu gimnasio", bajada: portada.bajada || null, foto_path: portada.foto_portada_path, boton_texto: portada.boton_texto || "Quiero empezar" },
    contacto: { ...inicial.vista.contacto, mensaje_whatsapp: portada.mensaje_whatsapp },
    mostrar_precios: portada.mostrar_precios,
    secciones: secciones.filter((s) => s.visible).map(({ tipo, titulo, contenido }) => ({ tipo, titulo, contenido }) as Seccion),
  }), [inicial.vista, portada, secciones]);

  const pagina = <LandingGimnasio landing={vista} agenda={agenda} />;
  // En el celular se ve a tamaño real; transform: lo fijo de la página (la barra de WhatsApp) queda dentro del cuadro.
  const VistaCelu = (
    <div className="rounded-[var(--radio-grande)] border border-[var(--borde)] overflow-auto h-full [transform:translateZ(0)]" data-vista-previa>{pagina}</div>
  );

  const pie = (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 z-10 tarjeta p-4 flex flex-wrap items-center gap-3 shadow-lg"
      data-pie-pagina data-respuestas={respuesta.n}>
      <button type="button" className="boton boton-principal" disabled={!sucio || guardando} onClick={guardar}>{guardando ? "Guardando…" : "💾 Guardar"}</button>
      {sucio && <button type="button" className="boton" onClick={deshacer}>↩️ Deshacer</button>}
      <button type="button" className="boton lg:hidden" onClick={() => setVerVista(true)}>👀 Ver cómo queda</button>
      {sucio && <span className="text-sm texto-suave" data-sin-guardar>• Cambios sin guardar</span>}
      {respuesta.error && <Mensaje tipo="error" className="w-full">{respuesta.error}</Mensaje>}
      {respuesta.ok && !sucio && <Mensaje tipo="exito" className="w-full">{respuesta.ok}</Mensaje>}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start" data-editor-pagina data-listo={listo}>
      <div className="space-y-4 min-w-0">
        {!puedeEditar && <p className="pildora">👀 Solo el dueño cambia la página.</p>}
        <fieldset disabled={!puedeEditar} className="space-y-4 min-w-0">
          <section className="tarjeta p-5 sm:p-6 space-y-4" data-bloque="portada">
            <div><p className="titulo text-2xl">🏠 Portada</p><p className="texto-suave">Lo primero que se ve. Una frase que diga por qué venir.</p></div>
            <Campo etiqueta="Título" ayuda={`${portada.titulo.length} de 80`}>
              <input className="campo" maxLength={80} value={portada.titulo} onChange={(e) => setP("titulo", e.target.value)} />
            </Campo>
            <Campo etiqueta="Frase" ayuda={`${(portada.bajada ?? "").length} de 240 · opcional`}>
              <textarea className="campo min-h-20" maxLength={240} value={portada.bajada ?? ""} onChange={(e) => setP("bajada", e.target.value)} />
            </Campo>
            <Campo etiqueta="Texto del botón principal" ayuda="Abre el WhatsApp del gimnasio. Ej.: “Quiero empezar”, “Probá una clase gratis”.">
              <input className="campo" maxLength={40} value={portada.boton_texto} onChange={(e) => setP("boton_texto", e.target.value)} />
            </Campo>
            <Campo etiqueta="Mensaje que llega por WhatsApp" ayuda="Lo que la persona ya tiene escrito al tocar el botón.">
              <input className="campo" maxLength={300} value={portada.mensaje_whatsapp} onChange={(e) => setP("mensaje_whatsapp", e.target.value)} />
            </Campo>
            <div>
              <p className="etiqueta mb-2">Foto de portada</p>
              {inicial.fotos.length === 0
                ? <p className="texto-tenue">Todavía no subiste fotos. Subilas en Configuración → Marca y elegí una acá.</p>
                : <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Foto de portada">
                    <button type="button" role="radio" aria-checked={!portada.foto_portada_path} onClick={() => setP("foto_portada_path", null)}
                      className={`size-20 rounded-xl border-2 texto-suave text-sm ${!portada.foto_portada_path ? "border-[var(--acento)]" : "border-[var(--borde)]"}`}>Sin foto</button>
                    {inicial.fotos.map((f, i) => (
                      <button key={f} type="button" role="radio" aria-checked={portada.foto_portada_path === f} aria-label={`Foto ${i + 1}`} onClick={() => setP("foto_portada_path", f)}
                        className={`size-20 rounded-xl border-2 overflow-hidden ${portada.foto_portada_path === f ? "border-[var(--acento)]" : "border-transparent"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={urlMarca(f)!} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>}
            </div>
            <Interruptor etiqueta="Mostrar los precios" ayuda="Apagado, los planes se ven sin precio (para que pregunten)."
              checked={portada.mostrar_precios} onChange={(e) => setP("mostrar_precios", e.target.checked)} />
          </section>

          <p className="titulo-grupo pt-2">Secciones, en el orden en que se ven</p>
          {secciones.map((s, i) => {
            const lista = LISTAS[s.tipo];
            return (
              <section key={s.tipo} className={`tarjeta p-5 sm:p-6 space-y-4 ${s.visible ? "" : "opacity-70"}`} data-seccion={s.tipo}>
                <div className="flex items-start gap-3">
                  <span className="icono" aria-hidden>{EMOJI[s.tipo]}</span>
                  <div className="min-w-0 flex-1">
                    <input className="campo font-semibold" aria-label={`Título de la sección ${i + 1}`} maxLength={60} value={s.titulo} onChange={(e) => setS(i, { titulo: e.target.value })} />
                  </div>
                  <div className="flex gap-1 flex-none">
                    <button type="button" className="boton px-3" aria-label={`Subir ${s.titulo}`} disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
                    <button type="button" className="boton px-3" aria-label={`Bajar ${s.titulo}`} disabled={i === secciones.length - 1} onClick={() => mover(i, 1)}>▼</button>
                  </div>
                </div>
                <Interruptor etiqueta="Se muestra en la página" checked={s.visible} onChange={(e) => setS(i, { visible: e.target.checked })} />
                {DE_OTRO_LADO[s.tipo] && <p className="text-sm texto-tenue">{DE_OTRO_LADO[s.tipo]}</p>}
                {s.tipo === "sobre_nosotros" && (
                  <Campo etiqueta="Texto" ayuda={`${((s.contenido as { texto?: string }).texto ?? "").length} de 1.500`}>
                    <textarea className="campo min-h-32" maxLength={1500} value={(s.contenido as { texto?: string }).texto ?? ""}
                      onChange={(e) => setS(i, { contenido: { texto: e.target.value } } as Partial<SeccionPanel>)} />
                  </Campo>
                )}
                {lista && (
                  <div className="space-y-3">
                    {items(s).map((it, k) => (
                      <div key={k} className="rounded-xl border border-[var(--borde)] p-3 space-y-2" data-elemento={k}>
                        <div className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]">
                          {lista.campos.map(([c, et, max, , area]) => (
                            <label key={c} className={`block space-y-1 ${area ? "sm:col-span-full" : c === "emoji" ? "sm:max-w-24" : ""}`}>
                              <span className="text-sm texto-suave">{et}</span>
                              {area
                                ? <textarea className="campo min-h-20" maxLength={max} value={it[c] ?? ""} onChange={(e) => setItems(i, s, items(s).map((x, m) => (m === k ? { ...x, [c]: e.target.value } : x)))} />
                                : <input className="campo" maxLength={max} value={it[c] ?? ""} onChange={(e) => setItems(i, s, items(s).map((x, m) => (m === k ? { ...x, [c]: e.target.value } : x)))} />}
                            </label>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" className="boton px-3 text-sm" aria-label={`Subir ${lista.nombre} ${k + 1}`} disabled={k === 0}
                            onClick={() => { const ys = [...items(s)]; [ys[k - 1], ys[k]] = [ys[k], ys[k - 1]]; setItems(i, s, ys); }}>▲</button>
                          <button type="button" className="boton px-3 text-sm" aria-label={`Bajar ${lista.nombre} ${k + 1}`} disabled={k === items(s).length - 1}
                            onClick={() => { const ys = [...items(s)]; [ys[k + 1], ys[k]] = [ys[k], ys[k + 1]]; setItems(i, s, ys); }}>▼</button>
                          <button type="button" className="boton px-3 text-sm texto-suave" onClick={() => setItems(i, s, items(s).filter((_, m) => m !== k))}>🗑️ Quitar</button>
                        </div>
                      </div>
                    ))}
                    {items(s).length < 30 && (
                      <button type="button" className="boton" onClick={() => setItems(i, s, [...items(s), {}])}>➕ Agregar {lista.nombre}</button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
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
            <p className="font-semibold">👀 Así la ve la gente</p>
            <button type="button" className="boton" onClick={() => setVerVista(false)}>✏️ Volver a editar</button>
          </div>
          <div className="flex-1 min-h-0 p-2">{VistaCelu}</div>
        </div>
      )}
    </div>
  );
}
