"use client";
import { useEffect, useState, useTransition } from "react";
import { propsMarca } from "@/lib/marca";
import { guardarConfiguracion, guardarDatosGimnasio } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";
import { Interruptor } from "@/components/ui/Interruptor";
import { Pestanas, type Pestana } from "@/components/ui/Pestanas";
import { PESTANAS, type ClavePestana } from "./pestanas";
import { Fotos, UnaImagen, type Imagenes, type Reglas } from "./Imagenes";
import { urlMarca } from "@/lib/url-marca";

export type Config = {
  nombre: string; color_acento: string; color_fondo: string; cobra_membresia: boolean; cobra_pase: boolean; cobra_pack: boolean;
  modo_clases: string; tolerancia_dias: number; dias_aviso: number; secciones_apagadas: string[]; alias_transferencia: string | null;
  cbu: string | null; titular_cuenta: string | null; descuento_max_recepcion: number; retencion_dias_ausencia: number;
  reserva_dias_anticipacion: number; cancelacion_horas_limite: number;
};
export type Sede = { id: string; nombre: string; direccion: string | null; telefono: string | null; mapa_url: string | null; es_principal: boolean };
export type DatosGimnasio = {
  nombre: string; slug: string; zona_horaria: string; whatsapp: string | null; instagram: string | null; email_contacto: string | null;
  publicada: boolean; sedes: Sede[]; dominios: { host: string; tipo: string; verificado: boolean }[];
  logo_path: string | null; favicon_path: string | null; fotos: string[];
  reglas_imagenes: { logo: Reglas; favicon: Reglas; foto: Reglas };
};
type Campo = keyof Config;
type Respuesta = { ok?: string; error?: string; n: number };

const FONDOS = ["#14161b", "#101418", "#16121f", "#1a1512", "#0f1a14", "#faf7f0"];
const ACENTOS = ["#2fbf5b", "#f5c518", "#3b82f6", "#a78bfa", "#ef4444", "#f97316", "#14b8a6"];
const SECCIONES: [string, string, string][] = [
  ["entrada", "🚪 Entrada", "Recepción busca al socio y le marca la entrada."],
  ["vencen_hoy", "⏰ Vencen hoy", "La lista de los que vencen y a quién avisar."],
  ["socios", "👥 Socios", "Fichas, altas y búsqueda."],
  ["retencion", "📉 Retención", "Los que dejaron de venir, para llamarlos antes de perderlos."],
  ["vender", "🛒 Vender", "Cobrar membresías, pases y productos."],
  ["caja", "💵 Caja", "Abrir y cerrar caja. Sin caja no se cobra en efectivo: Vender ofrece solo transferencia y tarjeta."],
  ["transferencias", "🧾 Transferencias", "Aprobar los comprobantes que mandan los socios."],
];

/** Los números de cada campo, igual que la base: si no cierra, ni se manda. */
const RANGOS: Partial<Record<Campo, [number, number, string]>> = {
  tolerancia_dias: [0, 60, "Días de gracia al vencer"],
  dias_aviso: [0, 30, "Avisar que vence"],
  descuento_max_recepcion: [0, 100, "Descuento máximo de la recepción"],
  retencion_dias_ausencia: [3, 90, "“No viene” después de"],
  reserva_dias_anticipacion: [0, 60, "Se reserva con hasta"],
  cancelacion_horas_limite: [0, 72, "Cancelar hasta"],
};

/** Qué campos de la configuración guarda cada pestaña. Gimnasio guarda aparte (otra función). */
const CAMPOS: Partial<Record<ClavePestana, Campo[]>> = {
  marca: ["color_fondo", "color_acento"],
  cobros: ["cobra_membresia", "cobra_pase", "cobra_pack", "alias_transferencia", "cbu", "titular_cuenta"],
  reglas: ["tolerancia_dias", "dias_aviso", "descuento_max_recepcion", "retencion_dias_ausencia"],
  clases: ["modo_clases", "reserva_dias_anticipacion", "cancelacion_horas_limite"],
  secciones: ["secciones_apagadas", "modo_clases"],
};
const CAMPOS_GIMNASIO = ["nombre", "whatsapp", "instagram", "email_contacto"] as const;

const normal = (v: unknown) => (Array.isArray(v) ? [...v].sort() : v === "" ? null : v ?? null);
const igual = (a: unknown, b: unknown) => JSON.stringify(normal(a)) === JSON.stringify(normal(b));
const sedesIguales = (a: Sede[], b: Sede[]) =>
  JSON.stringify(a.map((s) => [s.nombre, s.direccion || null, s.telefono || null, s.mapa_url || null]))
  === JSON.stringify(b.map((s) => [s.nombre, s.direccion || null, s.telefono || null, s.mapa_url || null]));

/** Lo que el navegador puede decir antes de mandar. La base valida igual. */
function problema(c: Config, campos: Campo[]): string | null {
  for (const k of campos) {
    const r = RANGOS[k];
    if (!r) continue;
    const v = c[k] as unknown;
    if (v === "" || v === null || Number.isNaN(v)) return `${r[2]}: no puede quedar vacío, poné un número entre ${r[0]} y ${r[1]}.`;
    if ((v as number) < r[0] || (v as number) > r[1]) return `${r[2]}: tiene que estar entre ${r[0]} y ${r[1]}.`;
  }
  if (campos.includes("cobra_membresia") && !c.cobra_membresia && !c.cobra_pase && !c.cobra_pack)
    return "Dejá prendida al menos una forma de cobrar (membresía, pase diario o pack de clases).";
  if (campos.includes("alias_transferencia") && c.alias_transferencia?.trim() && !/^[A-Za-z0-9.-]{6,20}$/.test(c.alias_transferencia.trim()))
    return "El alias tiene que tener de 6 a 20 caracteres: letras, números, puntos o guiones, sin espacios.";
  if (campos.includes("cbu") && c.cbu?.trim()) {
    const digitos = c.cbu.replace(/[\s-]/g, "");
    if (!/^[0-9]{22}$/.test(digitos)) return `El CBU o CVU tiene 22 números (sin letras). El que pusiste tiene ${digitos.replace(/\D/g, "").length}.`;
  }
  return null;
}

/** Una tarjeta dentro de una pestaña: título, una línea de qué es, y sus campos. */
function Tarjeta({ emoji, titulo, ayuda, children }: { emoji: string; titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4">
      <div><p className="titulo text-2xl">{emoji} {titulo}</p>{ayuda && <p className="texto-suave">{ayuda}</p>}</div>
      {children}
    </section>
  );
}

/** Pie de cada pestaña: el resultado del último guardado y el botón, que solo se prende con cambios. */
function Pie({ id, onGuardar, ocupado, sucio, msj }: { id: string; onGuardar: () => void; ocupado: boolean; sucio: boolean; msj?: Respuesta }) {
  return (
    <div className="space-y-3" data-pie={id} data-respuestas={msj?.n ?? 0}>
      {msj?.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj?.ok && !sucio && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="boton boton-principal" disabled={ocupado || !sucio} onClick={onGuardar}>
          {ocupado ? "Guardando…" : "✅ Guardar"}
        </button>
        {sucio && <span className="pildora" data-sin-guardar>• Cambios sin guardar</span>}
      </div>
    </div>
  );
}

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1"><span className="etiqueta">{etiqueta}</span>{children}
      {ayuda && <span className="block text-sm texto-tenue">{ayuda}</span>}</label>
  );
}

export function Ajustes({ inicial, datos, puedeEditar, pestanaInicial, direccionPagina }: {
  inicial: Config; datos: DatosGimnasio; puedeEditar: boolean; pestanaInicial: ClavePestana; direccionPagina: string;
}) {
  const [c, setC] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [d, setD] = useState(datos);
  const [dGuardado, setDGuardado] = useState(datos);
  const [msj, setMsj] = useState<Partial<Record<ClavePestana, Respuesta>>>({});
  const [enCurso, setEnCurso] = useState<ClavePestana | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [, empezar] = useTransition();
  const conClases = c.modo_clases !== "ninguno";
  const [pestana, setPestana] = useState<ClavePestana>(pestanaInicial === "clases" && inicial.modo_clases === "ninguno" ? "secciones" : pestanaInicial);

  const set = <K extends Campo>(k: K, v: Config[K]) => setC((x) => ({ ...x, [k]: v }));
  const setDato = <K extends keyof DatosGimnasio>(k: K, v: DatosGimnasio[K]) => setD((x) => ({ ...x, [k]: v }));
  const setSede = (i: number, k: keyof Sede, v: string) => setD((x) => ({ ...x, sedes: x.sedes.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const responder = (p: ClavePestana, r: Omit<Respuesta, "n">) => setMsj((m) => ({ ...m, [p]: { ...r, n: (m[p]?.n ?? 0) + 1 } }));

  const sucio = (p: ClavePestana): boolean => {
    if (!puedeEditar) return false;
    if (p === "gimnasio") return CAMPOS_GIMNASIO.some((k) => !igual(d[k], dGuardado[k])) || !sedesIguales(d.sedes, dGuardado.sedes);
    return (CAMPOS[p] ?? []).some((k) => !igual(c[k], guardado[k]));
  };
  const algoSucio = PESTANAS.some((p) => sucio(p.clave));

  // Irse con cambios sin guardar: el navegador pregunta antes.
  useEffect(() => {
    if (!algoSucio) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [algoSucio]);

  // La pestaña queda en la dirección: se puede recargar o mandar el link ("Configuración → Cobros").
  const cambiarPestana = (p: string) => {
    setPestana(p as ClavePestana);
    try { window.history.replaceState(null, "", `?pestana=${p}`); } catch { /* sin historial: igual cambia */ }
  };

  const guardar = (p: ClavePestana) => {
    if (p === "gimnasio") {
      if (!d.nombre.trim()) { responder(p, { error: "El nombre del gimnasio es obligatorio." }); return; }
      const sinNombre = d.sedes.findIndex((s) => !s.nombre.trim());
      if (sinNombre >= 0) { responder(p, { error: `Sede ${sinNombre + 1}: el nombre es obligatorio.` }); return; }
      setEnCurso(p);
      empezar(async () => {
        const r = await guardarDatosGimnasio({
          nombre: d.nombre, whatsapp: d.whatsapp ?? "", instagram: d.instagram ?? "", email_contacto: d.email_contacto ?? "",
          sedes: d.sedes.map(({ id, nombre, direccion, telefono, mapa_url }) => ({ id, nombre, direccion, telefono, mapa_url })),
        });
        setEnCurso(null);
        if (r.error || !r.datos) { responder(p, { error: r.error ?? "No se pudo guardar" }); return; }
        // La base normaliza teléfonos e Instagram: lo que queda en pantalla es lo guardado.
        const nuevo = r.datos as DatosGimnasio;
        setD(nuevo); setDGuardado(nuevo);
        responder(p, { ok: "Guardado ✅" });
      });
      return;
    }
    const campos = CAMPOS[p] ?? [];
    const mal = problema(c, campos);
    if (mal) { responder(p, { error: mal }); return; }
    setEnCurso(p);
    empezar(async () => {
      const datosAGuardar = Object.fromEntries(campos.map((k) => [k, c[k]]));
      const r = await guardarConfiguracion(datosAGuardar);
      setEnCurso(null);
      if (r.error) { responder(p, { error: r.error }); return; }
      setGuardado((g) => ({ ...g, ...datosAGuardar }));
      responder(p, { ok: "Guardado ✅" });
    });
  };
  const pie = (p: ClavePestana) => puedeEditar && (
    <Pie id={p} onGuardar={() => guardar(p)} ocupado={enCurso !== null} sucio={sucio(p)} msj={msj[p]} />
  );

  const num = (k: Campo, etiqueta: string, ayuda: string) => {
    const [min, max] = RANGOS[k] ?? [0, 999];
    const v = c[k] as unknown as number | "";
    return (
      <Campo etiqueta={etiqueta} ayuda={`${ayuda} · de ${min} a ${max}`}>
        <input type="number" inputMode="numeric" min={min} max={max} className="campo" value={Number.isNaN(v) ? "" : v}
          onChange={(e) => set(k, (e.target.value === "" ? "" : Number(e.target.value)) as never)} />
      </Campo>
    );
  };

  const pestanas: Pestana[] = [
    ...PESTANAS.filter((p) => p.clave !== "clases" || conClases).map((p) => ({ ...p, marca: sucio(p.clave) ? "cambios sin guardar" : undefined })),
    { clave: "equipo", texto: "Equipo", emoji: "👥", href: "/panel/equipo", recargar: true },
  ];

  const copiar = async () => {
    try { await navigator.clipboard.writeText(direccionPagina); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { setCopiado(false); }
  };
  const gracia = Number(c.tolerancia_dias) || 0;
  // Las imágenes se guardan al subirlas: actualizan lo guardado sin tocar lo que se está escribiendo.
  const imagenesListas = (x: Imagenes) => {
    const im = { logo_path: x.logo_path, favicon_path: x.favicon_path, fotos: x.fotos };
    setD((v) => ({ ...v, ...im })); setDGuardado((v) => ({ ...v, ...im }));
  };
  const logo = urlMarca(d.logo_path);

  return (
    <div className="space-y-5">
      {!puedeEditar && <p className="pildora">👀 Solo el dueño cambia la configuración.</p>}
      <Pestanas pestanas={pestanas} activa={pestana} alCambiar={cambiarPestana} etiqueta="Partes de la configuración" />

      <fieldset disabled={!puedeEditar} className="space-y-4" data-pestana-activa={pestana}>
        {pestana === "gimnasio" && <>
          <Tarjeta emoji="🏠" titulo="Tu gimnasio" ayuda="Lo que ve la gente en tu página y en la app del socio.">
            <Campo etiqueta="Nombre del gimnasio" ayuda="Se ve en la barra, en el saludo y en la página. Hasta 60 letras.">
              <input className="campo" maxLength={60} value={d.nombre} onChange={(e) => setDato("nombre", e.target.value)} />
            </Campo>
            <div className="grid sm:grid-cols-3 gap-3">
              <Campo etiqueta="WhatsApp" ayuda="El botón “Escribinos” de tu página. Con característica: 11 1234 5678.">
                <input className="campo" inputMode="tel" autoComplete="tel" value={d.whatsapp ?? ""} onChange={(e) => setDato("whatsapp", e.target.value)} />
              </Campo>
              <Campo etiqueta="Instagram" ayuda="Solo el usuario, por ejemplo @tugimnasio.">
                <input className="campo" autoCapitalize="none" spellCheck={false} value={d.instagram ?? ""} onChange={(e) => setDato("instagram", e.target.value)} />
              </Campo>
              <Campo etiqueta="Mail de contacto" ayuda="Aparece en tu página. Podés dejarlo vacío.">
                <input className="campo" type="email" autoCapitalize="none" value={d.email_contacto ?? ""} onChange={(e) => setDato("email_contacto", e.target.value)} />
              </Campo>
            </div>
            <p className="text-sm texto-tenue">Zona horaria: {d.zona_horaria}. Con ella se calcula cuándo empieza y termina cada día (vencimientos, pases). Si está mal, pedile a soporte BRIK que la cambie.</p>
          </Tarjeta>
          <Tarjeta emoji="📍" titulo={d.sedes.length > 1 ? "Sedes" : "Dónde queda"} ayuda="La dirección, el teléfono y el mapa salen en tu página.">
            {d.sedes.map((s, i) => (
              <div key={s.id} className={`space-y-3 ${i > 0 ? "pt-4 border-t border-[var(--borde)]" : ""}`} data-sede={i}>
                {d.sedes.length > 1 && <p className="font-semibold">{s.es_principal ? "⭐ Sede principal" : `Sede ${i + 1}`}</p>}
                <div className="grid sm:grid-cols-2 gap-3">
                  <Campo etiqueta="Nombre de la sede" ayuda="Por ejemplo “Centro” o el nombre del barrio.">
                    <input className="campo" maxLength={60} value={s.nombre} onChange={(e) => setSede(i, "nombre", e.target.value)} />
                  </Campo>
                  <Campo etiqueta="Dirección" ayuda="Calle, número y localidad.">
                    <input className="campo" maxLength={160} autoComplete="street-address" value={s.direccion ?? ""} onChange={(e) => setSede(i, "direccion", e.target.value)} />
                  </Campo>
                  <Campo etiqueta="Teléfono" ayuda="Con característica. Podés dejarlo vacío.">
                    <input className="campo" inputMode="tel" value={s.telefono ?? ""} onChange={(e) => setSede(i, "telefono", e.target.value)} />
                  </Campo>
                  <Campo etiqueta="Link del mapa" ayuda="En Google Maps: buscá tu gimnasio → Compartir → Copiar vínculo.">
                    <input className="campo" inputMode="url" autoCapitalize="none" spellCheck={false} value={s.mapa_url ?? ""} onChange={(e) => setSede(i, "mapa_url", e.target.value)} />
                  </Campo>
                </div>
              </div>
            ))}
          </Tarjeta>
          {pie("gimnasio")}
        </>}

        {pestana === "marca" && <>
          <Tarjeta emoji="🖼️" titulo="Logo" ayuda="Sale en tu página, arriba en el panel y en la app del socio. Mejor cuadrado o apaisado, con fondo transparente.">
            <UnaImagen tipo="logo" ruta={d.logo_path} reglas={d.reglas_imagenes.logo} puedeEditar={puedeEditar} alListo={imagenesListas}
              vista={(url) => url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={url} alt={`Logo de ${d.nombre}`} className="h-24 max-w-full object-contain rounded-xl p-2 border border-[var(--borde)]" style={{ background: c.color_fondo }} />
                : <p className="texto-tenue">Sin logo: se muestra el nombre del gimnasio.</p>} />
          </Tarjeta>
          <Tarjeta emoji="🔖" titulo="Ícono de la pestaña" ayuda="El dibujito chico que aparece en la pestaña del navegador y al guardar la app en el celular. Si no subís uno, se usa el logo.">
            <UnaImagen tipo="favicon" ruta={d.favicon_path} reglas={d.reglas_imagenes.favicon} puedeEditar={puedeEditar} alListo={imagenesListas}
              vista={(url) => (
                <div className="inline-flex items-center gap-2 rounded-t-xl border border-b-0 border-[var(--borde)] bg-[var(--tarjeta-alta)] px-3 py-2 max-w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {(url ?? logo) ? <img src={(url ?? logo)!} alt="" className="size-5 object-contain" /> : <span aria-hidden>🌐</span>}
                  <span className="text-sm truncate">{d.nombre}</span>
                </div>
              )} />
          </Tarjeta>
          <Tarjeta emoji="🎨" titulo="Colores" ayuda="Se ven en tu página, en el panel y en la app del socio.">
            <div><p className="etiqueta mb-2">Fondo</p><div className="flex flex-wrap gap-2">
              {FONDOS.map((f) => <button key={f} type="button" aria-label={f} aria-pressed={c.color_fondo === f} onClick={() => set("color_fondo", f)} className="size-11 rounded-xl border-2" style={{ background: f, borderColor: c.color_fondo === f ? "var(--acento)" : "var(--borde)" }} />)}
              <input type="color" aria-label="Otro fondo" value={c.color_fondo} onChange={(e) => set("color_fondo", e.target.value)} className="size-11 rounded-xl bg-transparent" />
            </div><p className="text-sm texto-tenue mt-1">Oscuro o claro: los textos se acomodan solos para que se lean.</p></div>
            <div><p className="etiqueta mb-2">Color principal (botones)</p><div className="flex flex-wrap gap-2">
              {ACENTOS.map((a) => <button key={a} type="button" aria-label={a} aria-pressed={c.color_acento === a} onClick={() => set("color_acento", a)} className="size-11 rounded-xl border-2" style={{ background: a, borderColor: c.color_acento === a ? "var(--texto)" : "transparent" }} />)}
              <input type="color" aria-label="Otro color" value={c.color_acento} onChange={(e) => set("color_acento", e.target.value)} className="size-11 rounded-xl bg-transparent" />
            </div><p className="text-sm texto-tenue mt-1">El de la acción principal de cada pantalla. Usá el de tu logo.</p></div>
            <div {...propsMarca(c)} className="rounded-[var(--radio)] p-5 border border-[var(--borde)]">
              <p className="titulo text-2xl flex items-center gap-3 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {logo && <img src={logo} alt="" className="h-10 w-auto max-w-28 flex-none rounded-lg object-contain" />}
                <span className="truncate">{d.nombre || "Tu gimnasio"}</span>
              </p>
              <p className="texto-suave">Así se ve.</p>
              <span className="boton boton-principal mt-3">🔥 Botón principal</span>
            </div>
          </Tarjeta>
          {pie("marca")}
        </>}

        {pestana === "pagina" && <>
          <Tarjeta emoji="🌐" titulo="Tu página" ayuda="La que comparte la gente para conocerte, ver precios y escribirte.">
            <p>{d.publicada
              ? <span className="pildora pildora-verde">✅ Publicada</span>
              : <span className="pildora pildora-amarillo">⏳ Sin publicar: la gente ve “próximamente”</span>}</p>
            <p className="campo !h-auto py-3 break-all select-all" data-direccion-pagina>{direccionPagina}</p>
            <div className="flex flex-wrap gap-2">
              <a href={direccionPagina} target="_blank" rel="noopener noreferrer" className="boton">🌐 Ver mi página</a>
              <button type="button" className="boton" onClick={copiar}>{copiado ? "✅ Copiado" : "📋 Copiar link"}</button>
              <a className="boton" target="_blank" rel="noopener noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`Conocé ${d.nombre}: ${direccionPagina}`)}`}>💬 Mandar por WhatsApp</a>
            </div>
            <p className="text-sm texto-tenue">El contacto y la dirección salen de la pestaña Gimnasio; los precios, de Planes y precios.</p>
          </Tarjeta>
          <Tarjeta emoji="📸" titulo="Fotos" ayuda="Las que ve la gente en tu página. La primera es la que más se ve: ordenalas con las flechas.">
            <Fotos fotos={d.fotos} reglas={d.reglas_imagenes.foto} puedeEditar={puedeEditar} nombre={d.nombre} alListo={imagenesListas} />
          </Tarjeta>
        </>}

        {pestana === "cobros" && <>
          <Tarjeta emoji="💵" titulo="Qué cobrás" ayuda="Lo que no cobrás no aparece al vender. Tiene que quedar al menos uno.">
            <div className="divide-y divide-[var(--borde)]">
              <Interruptor etiqueta="🏷️ Membresía mensual" ayuda="El socio paga el mes y entra todos los días." checked={c.cobra_membresia} onChange={(e) => set("cobra_membresia", e.target.checked)} />
              <Interruptor etiqueta="🎫 Pase diario" ayuda="Paga y entra ese día." checked={c.cobra_pase} onChange={(e) => set("cobra_pase", e.target.checked)} />
              <Interruptor etiqueta="🎟️ Packs de clases" ayuda="Compra una cantidad de clases y las va usando." checked={c.cobra_pack} onChange={(e) => set("cobra_pack", e.target.checked)} />
            </div>
          </Tarjeta>
          <Tarjeta emoji="🏦" titulo="Transferencias" ayuda="Lo que ve el socio para pagarte por transferencia.">
            <div className="grid sm:grid-cols-3 gap-3">
              <Campo etiqueta="Alias" ayuda="6 a 20: letras, números, puntos o guiones.">
                <input className="campo" maxLength={20} autoCapitalize="none" spellCheck={false} value={c.alias_transferencia ?? ""} onChange={(e) => set("alias_transferencia", e.target.value)} />
              </Campo>
              <Campo etiqueta="CBU / CVU" ayuda="22 números.">
                <input className="campo" inputMode="numeric" maxLength={30} value={c.cbu ?? ""} onChange={(e) => set("cbu", e.target.value)} />
              </Campo>
              <Campo etiqueta="Titular" ayuda="A nombre de quién está la cuenta.">
                <input className="campo" maxLength={80} value={c.titular_cuenta ?? ""} onChange={(e) => set("titular_cuenta", e.target.value)} />
              </Campo>
            </div>
          </Tarjeta>
          {pie("cobros")}
        </>}

        {pestana === "reglas" && <>
          <Tarjeta emoji="📏" titulo="Reglas" ayuda="Cómo se calcula si alguien puede entrar, y qué puede hacer la recepción.">
            <div className="grid sm:grid-cols-2 gap-3">
              {num("tolerancia_dias", "Días de gracia al vencer", gracia > 0
                ? `Cuando se le termina la cuota, puede entrar ${gracia === 1 ? "1 día más" : `${gracia} días más`} mientras paga`
                : "Cuando se le termina la cuota, ya no entra hasta pagar")}
              {num("dias_aviso", "Avisar que vence (días antes)", "Aparece en amarillo en la entrada")}
              {num("descuento_max_recepcion", "Descuento máximo de la recepción (%)", "Más que eso lo autoriza el dueño")}
              {num("retencion_dias_ausencia", "“No viene” después de (días)", "Para la lista de retención")}
            </div>
          </Tarjeta>
          {pie("reglas")}
        </>}

        {pestana === "clases" && conClases && <>
          <Tarjeta emoji="🗓️" titulo="Clases" ayuda="Cómo se anota la gente. Para no dar clases, apagalas en Secciones.">
            <div className="grid sm:grid-cols-2 gap-2">
              {[["reserva", "📝 Con reserva y cupo", "Se anotan desde la app; cuando se llena, no entran más."], ["sin_reserva", "🚶 Sin reserva", "Vienen y el profe toma asistencia."]].map(([v, t, a]) => (
                <button key={v} type="button" aria-pressed={c.modo_clases === v} onClick={() => set("modo_clases", v)}
                  className={`boton !flex-col !items-start !h-auto py-3 ${c.modo_clases === v ? "!border-[var(--acento)]" : "opacity-70"}`}>
                  <span>{t}</span><span className="text-sm texto-tenue font-normal">{a}</span>
                </button>
              ))}
            </div>
            {c.modo_clases === "reserva" && <div className="grid sm:grid-cols-2 gap-3">
              {num("reserva_dias_anticipacion", "Se reserva con hasta (días)", "Cuántos días antes se abre la reserva")}
              {num("cancelacion_horas_limite", "Cancelar hasta (horas antes)", "Después de eso la reserva cuenta igual")}
            </div>}
          </Tarjeta>
          {pie("clases")}
        </>}

        {pestana === "secciones" && <>
          <Tarjeta emoji="🧩" titulo="Secciones" ayuda="Apagá lo que no usás: desaparece de todos los paneles.">
            <div className="grid sm:grid-cols-2 gap-x-6 divide-y divide-[var(--borde)] sm:divide-y-0">
              <Interruptor etiqueta="🗓️ Clases" ayuda="Clases con horario, cupo y asistencia. Apagadas, no aparecen en ningún panel ni en la app."
                checked={conClases} onChange={(e) => set("modo_clases", e.target.checked ? (guardado.modo_clases !== "ninguno" ? guardado.modo_clases : "reserva") : "ninguno")} />
              {SECCIONES.map(([k, t, ayuda]) => (
                <Interruptor key={k} etiqueta={t} ayuda={ayuda} checked={!c.secciones_apagadas.includes(k)}
                  onChange={(e) => set("secciones_apagadas", e.target.checked ? c.secciones_apagadas.filter((x) => x !== k) : [...c.secciones_apagadas, k])} />
              ))}
            </div>
          </Tarjeta>
          {pie("secciones")}
        </>}

        {pestana === "direccion" && (
          <Tarjeta emoji="🔗" titulo="Dirección" ayuda="Dónde se abren tu página, tu panel y la app de tus socios.">
            <ul className="divide-y divide-[var(--borde)]">
              {d.dominios.map((x) => (
                <li key={x.host} className="py-3 flex flex-wrap items-center gap-2 justify-between">
                  <span className="font-semibold break-all">{x.host}</span>
                  <span className="flex flex-wrap gap-2">
                    <span className="pildora">{x.tipo === "propio" ? "Dominio propio" : "Dirección de Gym OS"}</span>
                    {x.tipo === "propio" && (x.verificado
                      ? <span className="pildora pildora-verde">✅ Funcionando</span>
                      : <span className="pildora pildora-amarillo">⏳ Esperando la configuración del dominio</span>)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="texto-suave">¿Querés usar tu propio dominio (tugimnasio.com.ar)? Pedíselo a soporte BRIK: lo conectamos y te decimos qué tocar en tu proveedor.</p>
          </Tarjeta>
        )}
      </fieldset>
    </div>
  );
}
