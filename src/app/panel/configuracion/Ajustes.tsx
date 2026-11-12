"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { contraste, propsMarca, seLeePoco } from "@/lib/marca";
import { useVersion } from "@/components/panel/useVersion";
import { guardarConfiguracion,guardarDatosGimnasio, publicarPagina, sumarSede, type EstadoMP } from "./acciones";
import { MercadoPago } from "./MercadoPago";
import { TurnosFijosConfig } from "./TurnosFijosConfig";
import { MetaVisitas } from "./MetaVisitas";
import { PlanFamiliarConfig } from "./PlanFamiliarConfig";
import { PruebaGratisConfig } from "./PruebaGratisConfig";
import { FotoSocioConfig } from "./FotoSocioConfig";
import { AvisarSinBloquear } from "./AvisarSinBloquear";
import { AutonomiaSocios } from "./AutonomiaSocios";
import { VueltoConfig } from "./VueltoConfig";
import { EsperaPlazo } from "./EsperaPlazo";
import { ReglaCierres } from "./ReglaCierres";
import { ReglasBeneficios, type ReglasBeneficiosDatos } from "./ReglasBeneficios";
import { Mensaje } from "@/components/ui/Mensaje";
import { Interruptor } from "@/components/ui/Interruptor";
import { Pestanas, type Pestana } from "@/components/ui/Pestanas";
import { PESTANAS, type ClavePestana } from "./pestanas";
import { Fotos, UnaImagen, type Imagenes, type Reglas } from "./Imagenes";
import { HorariosYCierres, type CierrePanel } from "./Horarios";
import { Tablets } from "./Tablets";
import { LinkResena } from "./LinkResena";
import { ConfigEntrada } from "./ConfigEntrada";
import { ConfigDejarPasarCard, DobleCobroCard, ReglasVencimiento } from "./ReglasCobro";
import type { ConfigDejarPasar, ConfigDobleCobro, ReglasVencimiento as DatosVencimiento } from "./cobros-acciones";
import { ConfigCaja } from "./ConfigCaja";
import { Autoservicio } from "./Autoservicio";
import type { AutoservicioPanel } from "./autoservicio-acciones";
import type { ConfigCaja as DatosConfigCaja } from "@/app/panel/caja/tipos";
import type { ConfigEntrada as DatosConfigEntrada } from "@/app/panel/entrada/config";
import type { Tablet } from "./acciones";
import { Mensajes, type MensajePanel } from "./Mensajes";
import { Historial, type Cambio } from "./Historial";
import type { Agenda } from "@/lib/horarios";
import { urlMarca } from "@/lib/url-marca";
import { BuscadorConfig } from "./BuscadorConfig";
import { Restablecer } from "./Restablecer";
import type { Opcion } from "./indice";
import { Icono } from "@/components/ui/Icono";

export type Config = {
  nombre: string; color_acento: string; color_fondo: string; cobra_membresia: boolean; cobra_pase: boolean; cobra_pack: boolean;
  modo_clases: string; tolerancia_dias: number; dias_aviso: number; secciones_apagadas: string[]; alias_transferencia: string | null;
  cbu: string | null; titular_cuenta: string | null; descuento_max_recepcion: number; retencion_dias_ausencia: number;
  reserva_dias_anticipacion: number; cancelacion_horas_limite: number;
  medios_aceptados: string[]; banco_transferencia: string | null;
  reingreso_mismo_dia_consume: boolean; retencion_dias_nuevo: number; meta_primer_mes: number; kiosco_habituales: boolean; retencion_dias_vencido: number; retencion_dias_se_fue: number; pausa_dias_por_anio: number; pide_apto: boolean; tope_dejar_pasar: number; invitados_por_mes: number;
  accesos_activos: string[]; recargo_tipo: "no" | "porcentaje" | "monto"; recargo_valor: number; recargo_dias: number;
  fiado_activo: boolean; fiado_tope: number;
  falta_politica: "nada" | "bloquear" | "descontar"; falta_bloqueo_dias: number;
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

const MEDIOS: [string, string, string][] = [
  ["efectivo", "Efectivo", "Se cobra con la caja abierta y entra en el arqueo."],
  ["transferencia", "Transferencia", "En el mostrador, o el socio desde la app subiendo el comprobante."],
  ["debito", "Débito", "Con tu posnet o lector."],
  ["credito", "Crédito", "Con tu posnet o lector."],
];
// D37: claro por defecto; los oscuros siguen elegibles.
const FONDOS = ["#F4F5F6", "#faf7f0", "#14161b", "#111315"];   // DISENO: claros y el oscuro del sistema, no siete colores sueltos
const ACENTOS = ["#2fbf5b", "#f5c518", "#3b82f6", "#a78bfa", "#ef4444", "#f97316", "#14b8a6"];
/** [clave, nombre, qué es, qué cambia si se apaga] — el aviso se ve apenas se apaga, antes de guardar. */
const SECCIONES: [string, string, string, string][] = [
  ["entrada", "Entrada", "Recepción busca al socio y le marca la entrada.",
    "Nadie marca entradas desde el panel. El semáforo de cada socio se sigue viendo en su ficha."],
  ["vencen_hoy", "Vencen hoy", "La lista de los que vencen y a quién avisar.",
    "Los que vencen siguen apareciendo en Retención → Vence pronto."],
  ["socios", "Socios", "Fichas, altas y búsqueda.",
    "No hay lista ni fichas ni altas desde el panel. Entrada, Vender y Retención muestran al socio sin abrir su ficha."],
  ["retencion", "Retención", "Los que dejaron de venir, para llamarlos antes de perderlos.",
    "Las listas de los que se van no se ven. Los que vencen hoy siguen en Vencen hoy."],
  ["vender", "Vender", "Cobrar membresías, pases y productos.",
    "No se cobra desde el panel: desaparecen los botones Cobrar y Vender. Los socios pueden pagar por transferencia desde la app."],
  ["caja", "Caja", "Abrir y cerrar caja, y contar la plata.",
    "No se cobra en efectivo: Vender ofrece los otros medios de pago."],
  ["control", "Control", "La línea de tiempo del dueño: cobros, anulaciones, descuentos, cajas, precios y entradas anuladas.",
    "El Control no se ve en ningún panel. Las alertas de la campana (cobros con otra fecha, préstamos de entrada) tampoco llegan."],
  ["transferencias", "Transferencias", "Aprobar los comprobantes que mandan los socios.",
    "Los socios no pueden mandar comprobantes desde la app (no habría quién los apruebe). En el mostrador se sigue cobrando por transferencia."],
  ["gastos", "Gastos", "Cargar gastos y fijos, el presupuesto y la ganancia del mes.",
    "No hay pantalla de Gastos. El Resultado sigue mostrando lo cobrado."],
  ["mensajes", "Mensajes", "Lo que los socios te escriben desde la app: consultas, quejas y objetos perdidos.",
    "Los socios no ven “Escribile al gimnasio” en la app y no hay bandeja de Mensajes en el panel. Lo ya escrito se conserva."],
  ["incidentes", "Incidentes", "El registro de lo que pasa en la sala (caídas, mareos, roturas), sin diagnósticos.",
    "No hay pantalla de Incidentes en el panel. Lo ya anotado se conserva."],
  ["maquinas", "Máquinas", "Marcar una máquina fuera de servicio, con foto y quién la arregla, y ver su historial.",
    "No hay pantalla de Máquinas ni aviso en el Inicio. Lo ya anotado se conserva."],
  ["lockers", "Lockers", "Alquilar lockers a los socios con vencimiento, cobrados con Vender, y ver cuáles vencen.",
    "No hay pantalla de Lockers ni aviso de vencimientos, y el socio no ve su locker en la app. Los alquileres ya hechos se conservan."],
  ["pt", "Personal trainer", "Turnos 1 a 1 con un PT: packs de sesiones, agenda y reservas desde la app.",
    "No hay pantalla de Personal trainer y el socio no ve los turnos en la app. Las sesiones ya reservadas se conservan."],
  ["rutinas", "Rutinas", "Armar ejercicios y rutinas y asignarlas a los socios.",
    "No hay pantalla de Rutinas en el panel ni en Ctrl+K. Las rutinas ya asignadas se conservan y el socio las sigue viendo en su app."],
  ["eventos", "Eventos", "Seminarios y clases especiales con cupo y precio, en el panel, en tu página y en la app.",
    "No hay pantalla de Eventos ni se ven en tu página, en la app ni en la ventana de la Entrada. Los eventos y sus anotados se conservan."],
];

/** Los números de cada campo, igual que la base: si no cierra, ni se manda. */
const RANGOS: Partial<Record<Campo, [number, number, string]>> = {
  tolerancia_dias: [0, 60, "Días de gracia al vencer"],
  dias_aviso: [0, 30, "Avisar que vence"],
  descuento_max_recepcion: [0, 100, "Descuento máximo de la recepción"],
  retencion_dias_ausencia: [3, 90, "“No viene” después de"],
  retencion_dias_nuevo: [7, 90, "Socio nuevo durante"],
  meta_primer_mes: [1, 60, "Meta de entradas del primer mes"],
  retencion_dias_vencido: [1, 120, "Vencido pasa a “se fue” después de"],
  retencion_dias_se_fue: [7, 365, "Los que se fueron se muestran durante"],
  pausa_dias_por_anio: [0, 365, "Pausa: máximo de días por año"],
  tope_dejar_pasar: [0, 50, "Dejar pasar: tope por día de la recepción"],
  invitados_por_mes: [0, 10, "Invitados por socio por mes"],
  recargo_dias: [1, 60, "Recargo: con más de cuántos días de atraso"],
  reserva_dias_anticipacion: [0, 60, "Se reserva con hasta"],
  cancelacion_horas_limite: [0, 72, "Cancelar hasta"],
  falta_bloqueo_dias: [1, 60, "Faltas: días sin poder reservar"],
};

/** Qué campos de la configuración guarda cada pestaña. Gimnasio guarda aparte (otra función). */
const CAMPOS: Partial<Record<ClavePestana, Campo[]>> = {
  marca: ["color_fondo", "color_acento"],
  cobros: ["cobra_membresia", "cobra_pase", "cobra_pack", "medios_aceptados", "alias_transferencia", "cbu", "titular_cuenta", "banco_transferencia",
           "recargo_tipo", "recargo_valor", "recargo_dias", "fiado_activo", "fiado_tope"],
  reglas: ["tolerancia_dias", "dias_aviso", "descuento_max_recepcion", "reingreso_mismo_dia_consume", "pausa_dias_por_anio", "pide_apto", "accesos_activos", "tope_dejar_pasar", "invitados_por_mes",
           "retencion_dias_ausencia", "retencion_dias_nuevo", "retencion_dias_vencido", "retencion_dias_se_fue", "meta_primer_mes", "kiosco_habituales"],
  clases: ["modo_clases", "reserva_dias_anticipacion", "cancelacion_horas_limite", "falta_politica", "falta_bloqueo_dias"],
  secciones: ["secciones_apagadas", "modo_clases"],
};
/** VD-21 · Lo recomendado de cada tarjeta (lo mismo que trae un gimnasio nuevo). "Restablecer" lo guarda por la vía de siempre. */
const RECOMENDADO: Record<string, { valores: Partial<Config>; texto: string }> = {
  "que-cobras": { valores: { cobra_membresia: true, cobra_pase: true, cobra_pack: false }, texto: "membresía y pase diario prendidos, packs apagados." },
  "medios-pago": { valores: { medios_aceptados: ["efectivo", "transferencia", "debito", "credito"] }, texto: "efectivo, transferencia, débito y crédito." },
  recargo: { valores: { recargo_tipo: "no", recargo_valor: 0, recargo_dias: 10 }, texto: "sin recargo por pagar tarde." },
  fiado: { valores: { fiado_activo: false, fiado_tope: 0 }, texto: "no se cobra a cuenta." },
  reglas: { valores: { tolerancia_dias: 5, dias_aviso: 3, descuento_max_recepcion: 10, invitados_por_mes: 2, tope_dejar_pasar: 5, pausa_dias_por_anio: 30, reingreso_mismo_dia_consume: false, pide_apto: false },
    texto: "5 días de gracia, avisar 3 días antes, descuento máximo 10 %, 2 invitados por mes, dejar pasar hasta 5 por día, pausa hasta 30 días, volver a entrar el mismo día no gasta otra entrada y sin apto físico." },
  retencion: { valores: { retencion_dias_ausencia: 14, retencion_dias_nuevo: 28, meta_primer_mes: 8, retencion_dias_vencido: 30, retencion_dias_se_fue: 90 }, texto: "“No viene” a los 14 días, socio nuevo 28 días, meta del primer mes 8 entradas, “se fue” a los 30 días y visible 90." },
  accesos: { valores: { accesos_activos: ["recepcion"], kiosco_habituales: false }, texto: "solo la recepción (QR, tablet y llavero apagados)." },
  clases: { valores: { reserva_dias_anticipacion: 7, cancelacion_horas_limite: 2, falta_politica: "nada", falta_bloqueo_dias: 7 }, texto: "se reserva con 7 días, se cancela hasta 2 horas antes y faltar no tiene consecuencia." },
  secciones: { valores: { secciones_apagadas: [] }, texto: "todas las secciones prendidas." },
};
/** Qué ancla del buscador lleva cada número de la pantalla. */
const ANCLA_NUM: Partial<Record<Campo, string>> = {
  tolerancia_dias: "tolerancia-dias", dias_aviso: "dias-aviso", descuento_max_recepcion: "descuento-max", invitados_por_mes: "invitados", tope_dejar_pasar: "tope-dejar-pasar",
  pausa_dias_por_anio: "pausa-dias", retencion_dias_ausencia: "retencion-ausencia", retencion_dias_nuevo: "retencion-nuevo", meta_primer_mes: "meta-primer-mes",
  retencion_dias_vencido: "retencion-vencido", retencion_dias_se_fue: "retencion-se-fue", reserva_dias_anticipacion: "reserva-dias", cancelacion_horas_limite: "cancelacion-horas",
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
  if (campos.includes("medios_aceptados") && c.medios_aceptados.length === 0) return "Dejá prendido al menos un medio de pago.";
  const sinCaja = c.secciones_apagadas.includes("caja");
  if ((campos.includes("medios_aceptados") || campos.includes("secciones_apagadas")) && sinCaja && c.medios_aceptados.every((m) => m === "efectivo"))
    return "Sin Caja no se cobra en efectivo, y es el único medio prendido: prendé otro medio de pago o dejá Caja prendida.";
  if (campos.includes("alias_transferencia") && c.alias_transferencia?.trim() && !/^[A-Za-z0-9.-]{6,20}$/.test(c.alias_transferencia.trim()))
    return "El alias tiene que tener de 6 a 20 caracteres: letras, números, puntos o guiones, sin espacios.";
  if (campos.includes("cbu") && c.cbu?.trim()) {
    const digitos = c.cbu.replace(/[\s-]/g, "");
    if (!/^[0-9]{22}$/.test(digitos)) return `El CBU o CVU tiene 22 números (sin letras). El que pusiste tiene ${digitos.replace(/\D/g, "").length}.`;
  }
  return null;
}

/** Una tarjeta dentro de una pestaña: título, una línea de qué es, y sus campos. */
function Tarjeta({ icono, titulo, ayuda, ancla, restablecer, children }: { icono?: string; titulo: string; ayuda?: string; ancla?: string; restablecer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4" data-opcion={ancla}>
      <div><p className="titulo text-2xl"><Icono nombre={icono} /> {titulo}</p>{ayuda && <p className="texto-suave">{ayuda}</p>}</div>
      {children}
      {restablecer}
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
          {ocupado ? "Guardando…" : "Guardar"}
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

export function Ajustes({ inicial, datos, agenda, cierres, mensajes, cambios, puedeEditar, pestanaInicial, direccionPagina, tablets, mercadopago, turnosFijos, linkResena = null, entrada, metaVisitas = 12, planFamiliar = false, vencimiento, dejarPasar, dobleCobro, cajaConfig = null, autoservicio = null, beneficios = null }: {
  beneficios?: ReglasBeneficiosDatos | null; autoservicio?: AutoservicioPanel | null; metaVisitas?: number; planFamiliar?: boolean; vencimiento: DatosVencimiento; dejarPasar: ConfigDejarPasar; dobleCobro: ConfigDobleCobro; cajaConfig?: DatosConfigCaja | null;
  inicial: Config; datos: DatosGimnasio; agenda: Agenda; cierres: CierrePanel[]; mensajes: MensajePanel[]; cambios: Cambio[]; puedeEditar: boolean; pestanaInicial: ClavePestana; direccionPagina: string; tablets: Tablet[]; linkResena?: string | null;
  mercadopago: EstadoMP; turnosFijos: boolean; entrada: DatosConfigEntrada;
}) {
  const [c, setC] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [d, setD] = useState(datos);
  const [dGuardado, setDGuardado] = useState(datos);
  const [msj, setMsj] = useState<Partial<Record<ClavePestana, Respuesta>>>({});
  const [enCurso, setEnCurso] = useState<ClavePestana | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [msjPagina, setMsjPagina] = useState<{ ok?: string; error?: string }>({});
  const [publicando, empezarPublicar] = useTransition();
  const cambiarPublicada = (publicada: boolean) => empezarPublicar(async () => {
    const r = await publicarPagina(publicada);
    if (r.error || !r.datos) { setMsjPagina({ error: r.error ?? "No se pudo" }); return; }
    const nuevo = (r.datos as DatosGimnasio).publicada;
    setD((x) => ({ ...x, publicada: nuevo })); setDGuardado((x) => ({ ...x, publicada: nuevo }));
    setMsjPagina({ ok: nuevo ? "Tu página está publicada: ya la puede ver cualquiera." : "Tu página quedó oculta: la gente ve solo tu portada con tu marca y los botones." });
  });
  const [, empezar] = useTransition();
  const [version, setVersion] = useVersion("configuracion", "gimnasio");
  const conClases = c.modo_clases !== "ninguno";
  const [pestana, setPestana] = useState<ClavePestana>(pestanaInicial === "clases" && inicial.modo_clases === "ninguno" ? "secciones" : pestanaInicial);

  // VD-21: el buscador cambia de pestaña y deja la opción resaltada.
  const [destino, setDestino] = useState<{ id: string; n: number } | null>(null);
  const irA = (o: Opcion) => { if (o.pestana !== pestana) cambiarPestana(o.pestana); setDestino((x) => ({ id: o.id, n: (x?.n ?? 0) + 1 })); };
  useEffect(() => {
    if (!destino) return;
    let intentos = 0, quitar: ReturnType<typeof setTimeout> | undefined, espera: ReturnType<typeof setTimeout> | undefined;
    const buscar = () => {
      const el = document.querySelector<HTMLElement>(`[data-opcion~="${destino.id}"]`);
      if (!el) { if (++intentos < 20) espera = setTimeout(buscar, 60); return; }
      const marco = el.closest<HTMLElement>("label") ?? el;
      marco.scrollIntoView({ block: "center", behavior: "smooth" });
      marco.setAttribute("data-resaltada", destino.id);
      quitar = setTimeout(() => marco.removeAttribute("data-resaltada"), 3000);
    };
    espera = setTimeout(buscar, 30);
    return () => { clearTimeout(espera); clearTimeout(quitar); document.querySelectorAll("[data-resaltada]").forEach((e) => e.removeAttribute("data-resaltada")); };
  }, [destino]);

  const set = <K extends Campo>(k: K, v: Config[K]) => setC((x) => ({ ...x, [k]: v }));
  const setDato = <K extends keyof DatosGimnasio>(k: K, v: DatosGimnasio[K]) => setD((x) => ({ ...x, [k]: v }));
  const setSede = (i: number, k: keyof Sede, v: string) => setD((x) => ({ ...x, sedes: x.sedes.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const responder = (p: ClavePestana, r: Omit<Respuesta, "n">) => setMsj((m) => ({ ...m, [p]: { ...r, n: (m[p]?.n ?? 0) + 1 } }));

  const [horariosSucio, setHorariosSucio] = useState(false);
  const [mensajesSucio, setMensajesSucio] = useState(false);
  const sucio = (p: ClavePestana): boolean => {
    if (p === "mensajes") return mensajesSucio;   // los mensajes los edita también el encargado
    if (!puedeEditar) return false;
    if (p === "horarios") return horariosSucio;
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
        responder(p, { ok: "Guardado" });
      });
      return;
    }
    const campos = CAMPOS[p] ?? [];
    const mal = problema(c, campos);
    if (mal) { responder(p, { error: mal }); return; }
    setEnCurso(p);
    empezar(async () => {
      const datosAGuardar = Object.fromEntries(campos.map((k) => [k, c[k]]));
      const r = await guardarConfiguracion(datosAGuardar, version);
      setEnCurso(null);
      if (r.version) setVersion(r.version);
      if (r.error) { responder(p, { error: r.error }); return; }
      setGuardado((g) => ({ ...g, ...datosAGuardar }));
      responder(p, { ok: "Guardado" });
    });
  };
  /** Restablecer una tarjeta: valida, guarda por guardarConfiguracion (la vía de siempre) y deja la pantalla como lo guardado. */
  const restablecer = async (id: string): Promise<string | null> => {
    const r0 = RECOMENDADO[id];
    const mal = problema({ ...c, ...r0.valores }, Object.keys(r0.valores) as Campo[]);
    if (mal) return mal;
    const r = await guardarConfiguracion(r0.valores, version);
    if (r.version) setVersion(r.version);
    if (r.error) return r.error;
    setC((x) => ({ ...x, ...r0.valores })); setGuardado((g) => ({ ...g, ...r0.valores }));
    return null;
  };
  const volver = (id: string) => puedeEditar ? <Restablecer id={id} recomendado={RECOMENDADO[id].texto} alConfirmar={() => restablecer(id)} /> : undefined;
  const pie = (p: ClavePestana) => puedeEditar && (
    <Pie id={p} onGuardar={() => guardar(p)} ocupado={enCurso !== null} sucio={sucio(p)} msj={msj[p]} />
  );

  const num = (k: Campo, etiqueta: string, ayuda: string) => {
    const [min, max] = RANGOS[k] ?? [0, 999];
    const v = c[k] as unknown as number | "";
    return (
      <Campo etiqueta={etiqueta} ayuda={`${ayuda} · de ${min} a ${max}`}>
        <input type="number" inputMode="numeric" min={min} max={max} className="campo" data-opcion={ANCLA_NUM[k]} value={Number.isNaN(v) ? "" : v}
          onChange={(e) => set(k, (e.target.value === "" ? "" : Number(e.target.value)) as never)} />
      </Campo>
    );
  };

  const pestanas: Pestana[] = [
    ...PESTANAS.filter((p) => p.clave !== "clases" || conClases).map((p) => ({ ...p, marca: sucio(p.clave) ? "cambios sin guardar" : undefined })),
    { clave: "equipo", texto: "Equipo", emoji: "usuarios", href: "/panel/equipo", recargar: true },
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
      {!puedeEditar && <p className="pildora"><Icono nombre="ojo" /> Solo el dueño cambia la configuración. Los mensajes y los días que cierra los podés cambiar vos.</p>}
      <BuscadorConfig visible={(o) => o.pestana !== "clases" || conClases} alElegir={irA} />
      <Pestanas pestanas={pestanas} activa={pestana} alCambiar={cambiarPestana} etiqueta="Partes de la configuración" />

      <fieldset disabled={!puedeEditar} className="space-y-4" data-pestana-activa={pestana}>
        {pestana === "gimnasio" && <>
          <Tarjeta icono="inicio" titulo="Tu gimnasio" ancla="datos-gimnasio" ayuda="Lo que ve la gente en tu página y en la app del socio.">
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
            <p className="text-sm texto-tenue" data-opcion="zona-horaria">Zona horaria: {d.zona_horaria}. Con ella se calcula cuándo empieza y termina cada día (vencimientos, pases). Si está mal, pedile a soporte BRIK que la cambie.</p>
          </Tarjeta>
          <Tarjeta icono="ubicacion" titulo={d.sedes.length > 1 ? "Sedes" : "Dónde queda"} ancla="sedes" ayuda="La dirección, el teléfono y el mapa salen en tu página.">
            {d.sedes.map((s, i) => (
              <div key={s.id} className={`space-y-3 ${i > 0 ? "pt-4 border-t border-[var(--borde)]" : ""}`} data-sede={i}>
                {d.sedes.length > 1 && <p className="font-semibold">{s.es_principal ? "Sede principal" : `Sede ${i + 1}`}</p>}
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
            {puedeEditar && <SumarSede alSumar={(sedes) => { setD((x) => ({ ...x, sedes: [...x.sedes, ...sedes.filter((n) => !x.sedes.some((v) => v.id === n.id))] })); setDGuardado((x) => ({ ...x, sedes })); }} />}
          </Tarjeta>
          {pie("gimnasio")}
        </>}

        {pestana === "marca" && <>
          <Tarjeta icono="imagen" titulo="Logo" ancla="logo" ayuda="Sale en tu página, arriba en el panel y en la app del socio. Mejor cuadrado o apaisado, con fondo transparente.">
            <UnaImagen tipo="logo" ruta={d.logo_path} reglas={d.reglas_imagenes.logo} puedeEditar={puedeEditar} alListo={imagenesListas}
              vista={(url) => url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={url} alt={`Logo de ${d.nombre}`} className="h-24 max-w-full object-contain rounded-[var(--radio)] p-2 border border-[var(--borde)]" style={{ background: c.color_fondo }} />
                : <p className="texto-tenue">Sin logo: se muestra el nombre del gimnasio.</p>} />
          </Tarjeta>
          <Tarjeta icono="" titulo="Ícono de la pestaña" ancla="favicon" ayuda="El dibujito chico que aparece en la pestaña del navegador y al guardar la app en el celular. Si no subís uno, se usa el logo.">
            <UnaImagen tipo="favicon" ruta={d.favicon_path} reglas={d.reglas_imagenes.favicon} puedeEditar={puedeEditar} alListo={imagenesListas}
              vista={(url) => (
                <div className="inline-flex items-center gap-2 rounded-t-xl border border-b-0 border-[var(--borde)] bg-[var(--tarjeta-alta)] px-3 py-2 max-w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {(url ?? logo) ? <img src={(url ?? logo)!} alt="" className="size-5 object-contain" /> : <span aria-hidden><Icono nombre="web" /></span>}
                  <span className="text-sm truncate">{d.nombre}</span>
                </div>
              )} />
          </Tarjeta>
          <Tarjeta icono="imagen" titulo="Colores" ancla="colores" ayuda="Se ven en tu página, en el panel y en la app del socio.">
            <div><p className="etiqueta mb-2">Fondo</p><div className="flex flex-wrap gap-2">
              {FONDOS.map((f) => <button key={f} type="button" aria-label={f} aria-pressed={c.color_fondo === f} onClick={() => set("color_fondo", f)} className="size-12 rounded-[var(--radio-campo)] border-2" style={{ background: f, borderColor: c.color_fondo === f ? "var(--acento)" : "var(--borde)" }} />)}
              <input type="color" aria-label="Otro fondo" value={c.color_fondo} onChange={(e) => set("color_fondo", e.target.value)} className="size-11 rounded-[var(--radio)] bg-transparent" />
            </div><p className="text-sm texto-tenue mt-1">Oscuro o claro: los textos se acomodan solos para que se lean.</p></div>
            <div><p className="etiqueta mb-2">Color principal (botones)</p><div className="flex flex-wrap gap-2">
              {ACENTOS.map((a) => <button key={a} type="button" aria-label={a} aria-pressed={c.color_acento === a} onClick={() => set("color_acento", a)} className="size-12 rounded-[var(--radio-campo)] border-2" style={{ background: a, borderColor: c.color_acento === a ? "var(--texto)" : "transparent" }} />)}
              <input type="color" aria-label="Otro color" value={c.color_acento} onChange={(e) => set("color_acento", e.target.value)} className="size-11 rounded-[var(--radio)] bg-transparent" />
            </div><p className="text-sm texto-tenue mt-1">El de la acción principal de cada pantalla. Usá el de tu logo.</p></div>
            {seLeePoco(c.color_acento, c.color_fondo) && (
              <p role="status" className="pildora pildora-amarillo whitespace-normal" data-aviso-contraste>
                <Icono nombre="alerta" /> Este color se ve poco sobre este fondo (contraste {contraste(c.color_acento, c.color_fondo)?.toFixed(1).replace(".", ",")} a 1; conviene 3 o más).
                Los links y los bordes van a costar verse. Se puede guardar igual; probá un color más oscuro o más claro.
              </p>
            )}
            <div {...propsMarca(c)} className="rounded-[var(--radio)] p-5 border border-[var(--borde)]">
              <p className="titulo text-2xl flex items-center gap-3 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {logo && <img src={logo} alt="" className="h-10 w-auto max-w-28 flex-none rounded-lg object-contain" />}
                <span className="truncate">{d.nombre || "Tu gimnasio"}</span>
              </p>
              <p className="texto-suave">Así se ve.</p>
              <span className="boton boton-principal mt-3"><Icono nombre="fuego" /> Botón principal</span>
            </div>
          </Tarjeta>
          {pie("marca")}
        </>}

        {pestana === "pagina" && <>
          <Tarjeta icono="web" titulo="Tu página" ancla="publicar-pagina" ayuda="La que comparte la gente para conocerte, ver precios y escribirte.">
            <p>{d.publicada
              ? <span className="pildora pildora-verde"><Icono nombre="ok" /> Visible</span>
              : <span className="pildora pildora-amarillo"><Icono nombre="persona" /> Oculta: la gente ve solo tu portada y los botones</span>}</p>
            <p className="campo !h-auto py-3 break-all select-all" data-direccion-pagina>{direccionPagina}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/panel/pagina" className="boton" data-opcion="prueba-social"><Icono nombre="lapiz" /> Editar textos y secciones</Link>
              <a href={direccionPagina} target="_blank" rel="noopener noreferrer" className="boton"><Icono nombre="web" /> Ver mi página</a>
              <button type="button" className="boton" onClick={copiar}>{copiado ? "Copiado" : "Copiar link"}</button>
              <a className="boton" target="_blank" rel="noopener noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`Conocé ${d.nombre}: ${direccionPagina}`)}`}><Icono nombre="mensaje" /> Mandar por WhatsApp</a>
            </div>
            {puedeEditar && (
              <div className="flex flex-wrap items-center gap-3" data-publicar>
                {d.publicada
                  ? <button type="button" className="boton" disabled={publicando} onClick={() => cambiarPublicada(false)}>{publicando ? "Guardando…" : "Ocultar mi página"}</button>
                  : <button type="button" className="boton boton-principal" disabled={publicando} onClick={() => cambiarPublicada(true)}>{publicando ? "Guardando…" : "Mostrar mi página"}</button>}
                <span className="text-sm texto-tenue">{d.publicada ? "Si la ocultás, la gente ve solo tu portada con tu marca y los botones “Quiero ser socio” y “Soy socio”, hasta que la vuelvas a mostrar." : "Mientras esté oculta, no se indexa en Google."}</span>
              </div>
            )}
            {msjPagina.error && <Mensaje tipo="error">{msjPagina.error}</Mensaje>}
            {msjPagina.ok && <Mensaje tipo="exito">{msjPagina.ok}</Mensaje>}
            <p className="text-sm texto-tenue">El contacto y la dirección salen de la pestaña Gimnasio; los precios, de Planes y precios.</p>
          </Tarjeta>
          {autoservicio && (
            <Tarjeta icono="celular" titulo="Lo que hacen los socios solos" ancla="autoservicio" ayuda="Anotarse desde tu página y cambiar de plan o comprar pases desde la app.">
              <Autoservicio inicial={autoservicio} puedeEditar={puedeEditar} />
            </Tarjeta>
          )}
          <Tarjeta icono="camara" titulo="Fotos" ancla="fotos" ayuda="Las que ve la gente en tu página. La primera es la que más se ve: ordenalas con las flechas.">
            <Fotos fotos={d.fotos} reglas={d.reglas_imagenes.foto} puedeEditar={puedeEditar} nombre={d.nombre} alListo={imagenesListas} />
          </Tarjeta>
        </>}

        {pestana === "cobros" && <>
          <Tarjeta icono="plata" titulo="Qué cobrás" ancla="que-cobras" restablecer={volver("que-cobras")} ayuda="Lo que no cobrás no aparece al vender. Tiene que quedar al menos uno.">
            <div className="divide-y divide-[var(--borde)]">
              <Interruptor etiqueta="Membresía mensual" ayuda="El socio paga el mes y entra todos los días." checked={c.cobra_membresia} onChange={(e) => set("cobra_membresia", e.target.checked)} />
              <Interruptor etiqueta="Pase diario" ayuda="Paga y entra ese día." checked={c.cobra_pase} onChange={(e) => set("cobra_pase", e.target.checked)} />
              <Interruptor etiqueta="Packs de clases" ayuda="Compra una cantidad de clases y las va usando." checked={c.cobra_pack} onChange={(e) => set("cobra_pack", e.target.checked)} />
            </div>
          </Tarjeta>
          <Tarjeta icono="tarjeta" titulo="Medios de pago" ancla="medios-pago" restablecer={volver("medios-pago")} ayuda="Con qué te pueden pagar. Lo que apagues no se ofrece en Vender ni en la app.">
            <div className="divide-y divide-[var(--borde)]">
              {MEDIOS.map(([k, t, ayuda]) => (
                <Interruptor key={k} etiqueta={t}
                  ayuda={k === "efectivo" && c.secciones_apagadas.includes("caja") ? "Tenés Caja apagada: sin caja no se cobra en efectivo." : ayuda}
                  checked={c.medios_aceptados.includes(k)}
                  onChange={(e) => set("medios_aceptados", e.target.checked ? [...c.medios_aceptados, k] : c.medios_aceptados.filter((x) => x !== k))} />
              ))}
              <Interruptor etiqueta="Mercado Pago" ayuda="Cobrar con link o QR de Mercado Pago, que se acredita solo. Todavía no está disponible: lo vas a poder prender cuando conectemos tu cuenta." checked={false} disabled readOnly />
            </div>
          </Tarjeta>
          <div data-opcion="vuelto-efectivo"><VueltoConfig puedeEditar={puedeEditar} /></div>
          <Tarjeta icono="banco" titulo="Transferencias" ancla="transferencias" ayuda="Lo que ve el socio para pagarte por transferencia.">
            {!c.medios_aceptados.includes("transferencia")
              ? <Mensaje tipo="info">Apagaste las transferencias: estos datos no se le muestran a nadie.</Mensaje>
              : !c.alias_transferencia?.trim() && !c.cbu?.trim() && <Mensaje tipo="aviso">Sin alias ni CBU, la app no le ofrece al socio pagar por transferencia.</Mensaje>}
            <div className="grid sm:grid-cols-2 gap-3">
              <Campo etiqueta="Alias" ayuda="6 a 20: letras, números, puntos o guiones.">
                <input className="campo" maxLength={20} autoCapitalize="none" spellCheck={false} value={c.alias_transferencia ?? ""} onChange={(e) => set("alias_transferencia", e.target.value)} />
              </Campo>
              <Campo etiqueta="CBU / CVU" ayuda="22 números.">
                <input className="campo" inputMode="numeric" maxLength={30} value={c.cbu ?? ""} onChange={(e) => set("cbu", e.target.value)} />
              </Campo>
              <Campo etiqueta="Titular" ayuda="A nombre de quién está la cuenta.">
                <input className="campo" maxLength={80} value={c.titular_cuenta ?? ""} onChange={(e) => set("titular_cuenta", e.target.value)} />
              </Campo>
              <Campo etiqueta="Banco o billetera" ayuda="Para que el socio sepa a dónde transfiere. Podés dejarlo vacío.">
                <input className="campo" maxLength={60} value={c.banco_transferencia ?? ""} onChange={(e) => set("banco_transferencia", e.target.value)} />
              </Campo>
            </div>
          </Tarjeta>
          <Tarjeta icono="reloj" titulo="Recargo por pagar tarde" ancla="recargo" restablecer={volver("recargo")} ayuda="Apagado, nadie paga de más. Prendido, Vender lo suma solo a la cuota y lo muestra antes de cobrar; no cobrarlo es un descuento con motivo.">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Recargo por pagar tarde">
              {([["no", "Sin recargo"], ["porcentaje", "% de la cuota"], ["monto", "$ fijo"]] as const).map(([k, t]) => (
                <label key={k} className={`boton !min-h-11 cursor-pointer ${c.recargo_tipo === k ? "!border-[var(--acento)]" : ""}`}>
                  <input type="radio" name="recargo_tipo" className="sr-only" checked={c.recargo_tipo === k} onChange={() => set("recargo_tipo", k)} />{t}
                </label>
              ))}
            </div>
            {c.recargo_tipo !== "no" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Campo etiqueta={c.recargo_tipo === "porcentaje" ? "Cuánto (% de la cuota)" : "Cuánto ($)"} ayuda={c.recargo_tipo === "porcentaje" ? "Hasta 50 %" : "Se suma igual a cualquier plan"}>
                  <input type="number" inputMode="decimal" min={0} className="campo" aria-label="Valor del recargo" value={Number.isNaN(c.recargo_valor) ? "" : c.recargo_valor}
                    onChange={(e) => set("recargo_valor", (e.target.value === "" ? "" : Number(e.target.value)) as never)} />
                </Campo>
                {num("recargo_dias", "Con más de cuántos días de atraso", `Ej.: con ${c.recargo_dias || 10}, el que paga el día ${(c.recargo_dias || 10) + 1} de atraso o después lo paga`)}
              </div>
            )}
          </Tarjeta>
          <Tarjeta icono="" titulo="Fiar (cuenta corriente)" ancla="fiado" restablecer={volver("fiado")} ayuda="Apagado, todo se cobra en el momento. Prendido, en Vender aparece “A cuenta” hasta un tope por socio; el que debe entra en amarillo con “Debe $…” y lo paga en Vender.">
            <Interruptor etiqueta="Se puede cobrar a cuenta" ayuda={c.fiado_activo ? "Prendido: hasta el tope de abajo por socio." : "Apagado: nadie queda debiendo."}
              checked={c.fiado_activo} onChange={(e) => set("fiado_activo", e.target.checked)} />
            {c.fiado_activo && (
              <Campo etiqueta="Tope por socio ($)" ayuda="Lo máximo que puede deber cada uno">
                <input type="number" inputMode="numeric" min={0} className="campo" aria-label="Tope para fiar" value={Number.isNaN(c.fiado_tope) ? "" : c.fiado_tope}
                  onChange={(e) => set("fiado_tope", (e.target.value === "" ? "" : Number(e.target.value)) as never)} />
              </Campo>
            )}
          </Tarjeta>
          {pie("cobros")}
          <div data-opcion="vencimiento"><ReglasVencimiento inicial={vencimiento} puedeEditar={puedeEditar} /></div>
          <div data-opcion="dejar-pasar"><ConfigDejarPasarCard inicial={dejarPasar} puedeEditar={puedeEditar} /></div>
          <div data-opcion="doble-cobro"><DobleCobroCard inicial={dobleCobro} puedeEditar={puedeEditar} /></div>
          <div data-opcion="mercado-pago"><MercadoPago estado={mercadopago} puedeEditar={puedeEditar} /></div>
          {cajaConfig && <div data-opcion="caja"><ConfigCaja inicial={cajaConfig} puedeEditar={puedeEditar} /></div>}
        </>}

        {pestana === "reglas" && <>
          {/* COM-6: los textos que firman los socios viven en su pantalla. */}
          <p data-opcion="documentos"><Link href="/panel/documentos" className="boton" data-ir-documentos><Icono nombre="lapiz" /> Documentos para firmar (reglamento, deslinde, menores)</Link></p>
          <p data-opcion="datos-personales"><Link href="/panel/datos-personales" className="boton" data-ir-datos-personales>Datos personales: política de privacidad y pedidos de socios</Link></p>
          <Tarjeta icono="grafico" titulo="Reglas" ancla="reglas" restablecer={volver("reglas")} ayuda="Cómo se calcula si alguien puede entrar, y qué puede hacer la recepción.">
            <div className="grid sm:grid-cols-2 gap-3">
              {num("tolerancia_dias", "Días de gracia al vencer", gracia > 0
                ? `Cuando se le termina la cuota, puede entrar ${gracia === 1 ? "1 día más" : `${gracia} días más`} mientras paga`
                : "Cuando se le termina la cuota, ya no entra hasta pagar")}
              {num("dias_aviso", "Avisar que vence (días antes)", "Aparece en amarillo en la entrada")}
              {num("descuento_max_recepcion", "Descuento máximo de la recepción (%)", "Más que eso lo autoriza el dueño")}
              {num("invitados_por_mes", "Invitados por socio por mes", c.invitados_por_mes > 0
                ? "Cada socio al día puede traer a alguien (con DNI); la misma persona tampoco viene más veces"
                : "En 0 no se reciben invitados")}
              {num("tope_dejar_pasar", "Dejar pasar: tope por día de la recepción", c.tope_dejar_pasar > 0
                ? "Por persona. A suspendidos y dados de baja los deja pasar solo el dueño o el encargado"
                : "En 0 la recepción no deja pasar a nadie")}
              {num("pausa_dias_por_anio", "Pausa: máximo de días por año", c.pausa_dias_por_anio > 0
                ? "Por socio. La da el dueño o el encargado; la recepción la pide"
                : "En 0 no se dan pausas")}
            </div>
            <Interruptor etiqueta="Volver a entrar el mismo día gasta otra entrada" data-opcion="reingreso"
              ayuda={c.reingreso_mismo_dia_consume
                ? "Prendido: si alguien con pack entra a las 8 y vuelve a las 19, se le descuenta otra clase; con pase diario, la segunda vez ya no entra."
                : "Apagado: si alguien con pack entra a las 8 y vuelve a las 19, no se le descuenta otra clase; con pase diario, vuelve a entrar."}
              checked={c.reingreso_mismo_dia_consume} onChange={(e) => set("reingreso_mismo_dia_consume", e.target.checked)} />
            <Interruptor etiqueta="Pedir apto físico" data-opcion="pide-apto"
              ayuda={c.pide_apto
                ? "Prendido: en la ficha de cada socio se anota si presentó el apto y hasta cuándo vale (nada médico, sin subir el papel). No frena la entrada."
                : "Apagado: no aparece en ningún lado."}
              checked={c.pide_apto} onChange={(e) => set("pide_apto", e.target.checked)} />
          </Tarjeta>
          <Tarjeta icono="tendencia-baja" titulo="Retención" ancla="retencion" restablecer={volver("retencion")} ayuda="Cuándo alguien aparece en cada lista de Retención, para llamarlo a tiempo.">
            <div className="grid sm:grid-cols-2 gap-3">
              {num("retencion_dias_ausencia", "“No viene” después de (días)", "Paga pero no aparece: entra en la lista “No viene”")}
              {num("retencion_dias_nuevo", "Socio nuevo durante (días)", "Si no viene en sus primeros días, va a “Nuevo que no viene”")}
              {num("meta_primer_mes", "Meta del primer mes (entradas)", "La ficha del socio nuevo muestra cuánto lleva; en la primera semana, menos de 2 entradas lo marca en riesgo")}
              {num("retencion_dias_vencido", "Vencido pasa a “se fue” después de (días)", "Mientras tanto está en “Venció”, para cobrarle")}
              {num("retencion_dias_se_fue", "Los que se fueron se muestran durante (días)", "Después dejan de aparecer en “Se fue”")}
            </div>
          </Tarjeta>
          <Tarjeta icono="puerta" titulo="Cómo entra la gente" ancla="accesos" restablecer={volver("accesos")} ayuda="La recepción busca al socio por nombre, DNI o número y le marca la entrada.">
            <div className="divide-y divide-[var(--borde)]" data-accesos>
              <Interruptor etiqueta="Recepción" ayuda="Siempre prendida: es la forma de respaldo cuando falla todo lo demás." checked disabled readOnly />
              <Interruptor etiqueta="QR del socio" data-opcion="acceso-qr" checked={c.accesos_activos.includes("qr_socio")}
                ayuda={c.accesos_activos.includes("qr_socio")
                  ? "Prendido: el socio ve en su app un QR que cambia cada 30 segundos, y en Entrada aparece “Leer QR” (cámara o lector). Si puede entrar, se anota solo."
                  : "Apagado: la app no muestra el QR y en Entrada no está la cámara."}
                onChange={(e) => set("accesos_activos", e.target.checked ? [...new Set([...c.accesos_activos, "qr_socio"])] : c.accesos_activos.filter((x) => x !== "qr_socio"))} />
              <Interruptor etiqueta="Tablet en la puerta" data-opcion="acceso-kiosco" checked={c.accesos_activos.includes("kiosco")}
                ayuda={c.accesos_activos.includes("kiosco")
                  ? "Prendido: una tablet autorizada en la puerta; el socio escribe su DNI (o muestra su QR) y, si puede, entra solo. Si no puede, la tablet le dice por qué y que pase por recepción."
                  : "Apagado: ninguna tablet deja entrar."}
                onChange={(e) => set("accesos_activos", e.target.checked ? [...new Set([...c.accesos_activos, "kiosco"])] : c.accesos_activos.filter((x) => x !== "kiosco" && x !== "qr_pared"))} />
              {c.accesos_activos.includes("kiosco") && (
                <Interruptor etiqueta="QR en la tablet (el socio lo escanea)" data-opcion="acceso-qr-pared" checked={c.accesos_activos.includes("qr_pared")}
                  ayuda={c.accesos_activos.includes("qr_pared")
                    ? "Prendido: la tablet muestra un QR que cambia cada 30 segundos; el socio lo escanea desde su app y entra (o ve por qué no)."
                    : "Apagado: en la tablet solo se escribe el DNI."}
                  onChange={(e) => set("accesos_activos", e.target.checked ? [...new Set([...c.accesos_activos, "qr_pared"])] : c.accesos_activos.filter((x) => x !== "qr_pared"))} />
              )}
              {c.accesos_activos.includes("kiosco") && (
                <Interruptor etiqueta="Los habituales de esta hora en la tablet" data-opcion="kiosco-habituales" checked={c.kiosco_habituales}
                  ayuda={c.kiosco_habituales
                    ? "Prendido: la tablet muestra a los que suelen venir a esta hora (nombre e inicial del apellido); tocan su nombre y ponen los últimos 3 números del DNI."
                    : "Apagado: la tablet no muestra nombres (se escribe el DNI entero)."}
                  onChange={(e) => set("kiosco_habituales", e.target.checked)} />
              )}
              {guardado.accesos_activos.includes("kiosco") && (
                <Tablets inicial={tablets} sedes={datos.sedes} esDueno={puedeEditar} zona={datos.zona_horaria} />
              )}
              <Interruptor etiqueta="Llavero o tarjeta" data-opcion="acceso-nfc" checked={c.accesos_activos.includes("nfc")}
                ayuda={c.accesos_activos.includes("nfc")
                  ? "Prendido: en la ficha de cada socio se le asigna su llavero; el lector USB lo escribe en Entrada (o en la tablet) y entra directo."
                  : "Apagado: los llaveros no se usan."}
                onChange={(e) => set("accesos_activos", e.target.checked ? [...new Set([...c.accesos_activos, "nfc"])] : c.accesos_activos.filter((x) => x !== "nfc"))} />
            </div>
          </Tarjeta>
          <div data-opcion="meta-visitas"><MetaVisitas inicial={metaVisitas} puedeEditar={puedeEditar} /></div>
          <div data-opcion="plan-familiar-seccion"><PlanFamiliarConfig inicial={planFamiliar} puedeEditar={puedeEditar} /></div>
          <div data-opcion="prueba-gratis"><PruebaGratisConfig puedeEditar={puedeEditar} /></div>
          <div data-opcion="avisar-sin-bloquear"><AvisarSinBloquear puedeEditar={puedeEditar} /></div>
          <div data-opcion="foto-socio"><FotoSocioConfig puedeEditar={puedeEditar} /></div>
          <div data-opcion="autonomia-socios"><AutonomiaSocios puedeEditar={puedeEditar} /></div>
          <div data-opcion="cierres-suma-dias"><ReglaCierres puedeEditar={puedeEditar} /></div>
          {beneficios && <div data-opcion="beneficios"><ReglasBeneficios datos={beneficios} /></div>}
          {pie("reglas")}
        </>}

        {pestana === "clases" && conClases && <>
          <div data-opcion="espera-plazo"><EsperaPlazo puedeEditar={puedeEditar} /></div>
          <Tarjeta icono="calendario" titulo="Clases" ancla="modo-clases" restablecer={volver("clases")} ayuda="Cómo se anota la gente. Para no dar clases, apagalas en Secciones.">
            <div className="grid sm:grid-cols-2 gap-2">
              {[["reserva", "Con reserva y cupo", "Se anotan desde la app; cuando se llena, no entran más."], ["sin_reserva", "Sin reserva", "Vienen y el profe toma asistencia."]].map(([v, t, a]) => (
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
            {c.modo_clases === "reserva" && (
              <div className="space-y-3" data-faltas data-opcion="falta-politica">
                <p className="font-semibold">Si reserva y no viene (sin cancelar)</p>
                <div className="grid sm:grid-cols-3 gap-2">
                  {([["nada", "No pasa nada", "Queda anotado en su ficha."], ["descontar", "Se descuenta del pack", "Si reservó con su pack, la clase cuenta como usada. Cuenta desde que lo prendés."], ["bloquear", "No puede reservar por unos días", "La recepción lo puede anotar igual. Cuenta desde que lo prendés."]] as const).map(([v, t, a]) => (
                    <button key={v} type="button" aria-pressed={c.falta_politica === v} onClick={() => set("falta_politica", v)}
                      className={`boton !flex-col !items-start !h-auto py-3 ${c.falta_politica === v ? "!border-[var(--acento)]" : "opacity-70"}`}>
                      <span>{t}</span><span className="text-sm texto-tenue font-normal">{a}</span>
                    </button>
                  ))}
                </div>
                {c.falta_politica === "bloquear" && <div className="grid sm:grid-cols-2 gap-3">{num("falta_bloqueo_dias", "Días sin poder reservar", "Desde el día de la clase a la que faltó")}</div>}
                <p className="text-sm texto-tenue">El socio lo ve en la app antes de reservar.</p>
              </div>
            )}
          </Tarjeta>
          {pie("clases")}
          {guardado.modo_clases === "reserva" && <div data-opcion="turnos-fijos"><TurnosFijosConfig inicial={turnosFijos} puedeEditar={puedeEditar} /></div>}
        </>}

        {pestana === "secciones" && <>
          <Tarjeta icono="grilla" titulo="Secciones" ancla="secciones" restablecer={volver("secciones")} ayuda="Apagá lo que no usás: desaparece de todos los paneles.">
            <div className="grid sm:grid-cols-2 gap-x-6 divide-y divide-[var(--borde)] sm:divide-y-0">
              <Interruptor etiqueta="Clases" ayuda="Clases con horario, cupo y asistencia. Apagadas, no aparecen en ningún panel ni en la app."
                checked={conClases} onChange={(e) => set("modo_clases", e.target.checked ? (guardado.modo_clases !== "ninguno" ? guardado.modo_clases : "reserva") : "ninguno")} />
              {SECCIONES.map(([k, t, ayuda, alApagar]) => (
                <Interruptor key={k} etiqueta={t} ayuda={c.secciones_apagadas.includes(k) ? <span data-al-apagar={k}><Icono nombre="alerta" /> Apagada: {alApagar}</span> : ayuda}
                  checked={!c.secciones_apagadas.includes(k)}
                  onChange={(e) => set("secciones_apagadas", e.target.checked ? c.secciones_apagadas.filter((x) => x !== k) : [...c.secciones_apagadas, k])} />
              ))}
            </div>
          </Tarjeta>
          {pie("secciones")}
        </>}

        {pestana === "horarios" && !puedeEditar && <p className="texto-suave">Los horarios los cambia el dueño. Los días que cierra los podés cargar vos.</p>}

        {pestana === "direccion" && (
          <Tarjeta icono="enlace" titulo="Dirección" ancla="direccion" ayuda="Dónde se abren tu página, tu panel y la app de tus socios.">
            <ul className="divide-y divide-[var(--borde)]">
              {d.dominios.map((x) => (
                <li key={x.host} className="py-3 flex flex-wrap items-center gap-2 justify-between">
                  <span className="font-semibold break-all">{x.host}</span>
                  <span className="flex flex-wrap gap-2">
                    <span className="pildora">{x.tipo === "propio" ? "Dominio propio" : "Dirección de Base"}</span>
                    {x.tipo === "propio" && (x.verificado
                      ? <span className="pildora pildora-verde"><Icono nombre="ok" /> Funcionando</span>
                      : <span className="pildora pildora-amarillo"><Icono nombre="reloj-arena" /> Esperando la configuración del dominio</span>)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="texto-suave">¿Querés usar tu propio dominio (tugimnasio.com.ar)? Pedíselo a soporte BRIK: lo conectamos y te decimos qué tocar en tu proveedor.</p>
          </Tarjeta>
        )}
      </fieldset>
      {/* Fuera del fieldset: los cierres los carga también el encargado (la base lo permite). */}
      {pestana === "horarios" && (
        <div data-opcion="horarios cierres"><HorariosYCierres agendaInicial={agenda} cierresIniciales={cierres} esDueno={puedeEditar} alCambiarSucio={setHorariosSucio} /></div>
      )}
      {pestana === "entrada" && <ConfigEntrada inicial={entrada} puedeEditar={puedeEditar} />}
      {pestana === "mensajes" && <><div data-opcion="link-resena"><LinkResena inicial={linkResena} puedeEditar={puedeEditar} /></div><div data-opcion="mensajes"><Mensajes iniciales={mensajes} alCambiarSucio={setMensajesSucio} /></div></>}
      {pestana === "cambios" && <div data-opcion="historial"><Historial cambios={cambios} /></div>}
      {/* SEG-2: todos los datos del gimnasio (solo el dueño; lo decide la base). */}
      {pestana === "gimnasio" && puedeEditar && (
        <section className="tarjeta p-5 mt-8 space-y-2" data-exportar-todo data-opcion="exportar-datos">
          <h2 className="titulo text-2xl"><Icono nombre="caja" /> Tus datos</h2>
          <p className="texto-suave">Todo lo de tu gimnasio (socios, pagos, entradas, caja, clases…), un archivo por tema, para abrir con Excel.</p>
          <a href="/panel/exportar" className="boton" download><Icono nombre="descargar" /> Descargar todos los datos</a>
        </section>
      )}
    </div>
  );
}

/** REV-2a: otra sede. Se crea al toque con su caja; dirección y teléfono se completan arriba. */
function SumarSede({ alSumar }: { alSumar: (sedes: Sede[]) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sumando, empezar] = useTransition();
  if (!abierto) return <button type="button" className="boton" onClick={() => setAbierto(true)} data-sumar-sede><Icono nombre="mas" /> Sumar una sede</button>;
  return (
    <form className="pt-4 border-t border-[var(--borde)] space-y-3" data-sumar-sede-form
      onSubmit={(e) => { e.preventDefault(); empezar(async () => {
        const r = await sumarSede(nombre);
        if (r.error) { setError(r.error); return; }
        alSumar((r.datos as { sedes: Sede[] }).sedes); setAbierto(false); setNombre(""); setError(null);
      }); }}>
      <Campo etiqueta="Nombre de la sede nueva" ayuda="Tiene su caja, su entrada y su grilla. La dirección y el teléfono los completás arriba.">
        <input className="campo" maxLength={60} autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="flex gap-2">
        <button type="submit" className="boton boton-principal" disabled={sumando || !nombre.trim()}>{sumando ? "Sumando…" : "Sumar sede"}</button>
        <button type="button" className="boton" onClick={() => { setAbierto(false); setError(null); }}>Cancelar</button>
      </div>
    </form>
  );
}
