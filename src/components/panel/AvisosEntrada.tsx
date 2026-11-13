"use client";
// VD-4 + E2 · Los avisos de la puerta, en cualquier pantalla del panel.
// Cuando alguien entra solo (QR, QR de la pared, tablet, llavero, molinete) sale abajo a la derecha AL INSTANTE (Realtime, entradas-vivo.ts)
// con el sonido si está prendido: 1,5 s GRANDE (foto, nombre y "Entró por QR · al día hasta 30/11", con el borde del color), después se achica a
// una PASTILLA que queda 8 s más. Tocar la pastilla o el aviso grande lo FIJA (Ver ficha, Cobrar, Anular la entrada); el mouse o el dedo encima lo frena.
// ROJO (no pudo entrar) no se achica: queda grande hasta que alguien lo atienda o lo cierre. AMARILLO: 1,5 s grande y la pastilla con el motivo.
// Se apilan 3 como máximo; el resto se junta en "+N entradas más" (abre Últimas entradas). Con prefers-reduced-motion no hay animación (globals.css).
// Los datos vienen del "oído" compartido (entradas-vivo.ts): nada se calcula acá, solo se muestra lo que dijo estado_acceso / registrar_ingreso.
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AlertaViva, EntradaViva } from "@/app/panel/entrada/ventana-acciones";
import type { ResultadoSocio } from "@/app/panel/acciones";
import { anularEntrada } from "@/app/panel/entrada/acciones";
import { CLAVE_SONIDO, sonar } from "@/app/panel/entrada/sonido";
import { colorVar } from "./Estado";
import { abrirCobrar, hayHojaCobrar } from "./cobrar/evento";
import { escucharEntradas, escucharEstadoAvisos, type EstadoAvisos } from "./entradas-vivo";
import { EVENTO_ABRIR_PANEL_SOCIO } from "./PanelSocioLateral";
import { Icono } from "@/components/ui/Icono";
import { Mensaje } from "@/components/ui/Mensaje";

/** La ventana de Entrada escucha este evento para abrir el veredicto de un socio (detail: ResultadoSocio). */
export const EVENTO_ABRIR_SOCIO = "gymos:abrir-entrada-socio";

/** La ventana de Entrada manda este evento con lo que acaba de anotar la recepción (BASE-3, modo aviso): sale como aviso abajo a la derecha. */
export const EVENTO_AVISO_LOCAL = "gymos:aviso-local";
export type AvisoLocal = { id: string; color: string; texto: string; socioId: string; nombre: string; numero: number | null; cobrar: boolean; puede: boolean; textoSocio: string };

const VIA: Record<string, string> = { recepcion: "en recepción", qr_socio: "con QR", qr_pared: "por QR", kiosco: "en la tablet", nfc: "con el llavero", molinete: "por el molinete" };
const VIA_PRESTAMO: Record<string, string> = { recepcion: "recepción", qr_socio: "el QR", qr_pared: "el QR de la pared", kiosco: "la tablet", nfc: "el llavero", molinete: "el molinete" };
const MAX_VISIBLES = 3;
const MAX_GUARDADOS = 30;
const GRANDE_MS = 1500;     // E2: 1,5 s grande
const PASTILLA_MS = 8000;   // y 8 s de pastilla
const ROJO_MS = 600000;     // El rojo (no puede entrar) se queda hasta que la recepción lo cierre o lo atienda (tope de 10 min)

type Aviso = {
  id: string; color: "verde" | "amarillo" | "rojo" | "azul"; emoji: string;
  /** El nombre y lo que pasó, por separado: la pastilla muestra solo "Juan Pérez · por QR". */
  texto: string; quien: string; corto: string;
  socioId: string; nombre: string; numero: number | null; cobrar: boolean; puede: boolean; textoSocio: string; colorSocio: string;
  /** grande (1,5 s) → pastilla (8 s). El rojo no se achica. */
  fase: "grande" | "pastilla"; fijo: boolean; esIngreso: boolean;
};
let memoriaAvisos: Aviso[] = [];

function deEntrada(x: EntradaViva): Aviso {
  const quien = x.socio;
  const rechazado = x.resultado === "rechazado";
  const color = rechazado || x.color === "rojo" ? "rojo" : x.resultado === "forzado" || x.color === "amarillo" || x.color === "naranja" ? "amarillo" : "verde";
  const via = VIA[x.via_acceso] ?? "";
  const texto = rechazado ? `${quien} intentó entrar${x.via_acceso === "recepcion" ? "" : ` ${via}`}: ${minuscula(x.texto)}`
    : x.resultado === "forzado" ? `${quien} entró ${via} (lo dejaron pasar): ${minuscula(x.texto)}`
    : `${quien} entró ${via}${x.texto ? ` · ${x.texto}` : ""}`;
  const corto = rechazado ? `no pudo entrar: ${minuscula(x.texto)}` : color === "amarillo" ? `entró ${via}: ${minuscula(x.texto)}` : `entró ${via}`;
  return {
    id: x.ingreso_id, color, emoji: color === "rojo" ? "prohibido" : color === "amarillo" ? "alerta" : "ok", texto, quien, corto,
    socioId: x.socio_id, nombre: x.socio, numero: x.numero, cobrar: x.cobrar, puede: !rechazado && x.resultado !== "forzado", textoSocio: x.texto, colorSocio: x.color,
    fase: "grande", fijo: false, esIngreso: true,
  };
}
function deAlerta(a: AlertaViva): Aviso {
  const texto = `${a.socio} volvió a entrar por ${VIA_PRESTAMO[a.via_nueva] ?? a.via_nueva} ${a.minutos < 1 ? "hace menos de 1 min" : `a los ${a.minutos} min`} de haber entrado por ${VIA_PRESTAMO[a.via_anterior] ?? a.via_anterior}`;
  return {
    id: a.alerta_id, color: "amarillo", emoji: "alerta", texto, quien: a.socio, corto: `volvió a entrar por ${VIA_PRESTAMO[a.via_nueva] ?? a.via_nueva}`,
    socioId: a.socio_id, nombre: a.socio, numero: null, cobrar: false, puede: true, textoSocio: "", colorSocio: "amarillo",
    fase: "grande", fijo: false, esIngreso: false,
  };
}
const minuscula = (t: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const sonidoPrendido = () => { try { return localStorage.getItem(CLAVE_SONIDO) !== "no"; } catch { return true; } };

/** Foto del socio si tiene (ruta con sesión); si no, la inicial. */
function Cara({ socioId, nombre, chica }: { socioId: string; nombre: string; chica?: boolean }) {
  const [sin, setSin] = useState(false);
  const lado = chica ? "size-6" : "size-12";
  if (sin) return <span className={`${lado} rounded-full grid place-items-center flex-none bg-[var(--tarjeta)] font-semibold`} aria-hidden>{nombre.trim().charAt(0).toUpperCase()}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/panel/socios/${socioId}/foto`} alt="" className={`${lado} rounded-full object-cover flex-none`} onError={() => setSin(true)} />;
}

export function AvisosEntrada({ gimnasioId, sedeId, puedeCobrar, conVentana }: { gimnasioId: string; sedeId: string; puedeCobrar: boolean; conVentana: boolean }) {
  // Los avisos viven también fuera del componente: si la pantalla se vuelve a montar (p. ej. después de anotar una entrada y refrescar
  // el panel) no se pierden.
  const [avisos, setAvisosRaw] = useState<Aviso[]>(() => memoriaAvisos);
  const [estado, setEstado] = useState<EstadoAvisos>("periodico");
  const setAvisos = useCallback((f: Aviso[] | ((p: Aviso[]) => Aviso[])) => {
    setAvisosRaw((p) => { const n = typeof f === "function" ? f(p) : f; memoriaAvisos = n; return n; });
  }, []);
  const ruta = usePathname();
  const router = useRouter();

  const cerrar = useCallback((id: string) => setAvisos((a) => a.filter((x) => x.id !== id)), [setAvisos]);
  const achicar = useCallback((id: string) => setAvisos((a) => a.map((x) => (x.id === id && x.color !== "rojo" && !x.fijo ? { ...x, fase: "pastilla" } : x))), [setAvisos]);
  const fijar = useCallback((id: string) => setAvisos((a) => a.map((x) => (x.id === id ? { ...x, fijo: true, fase: "grande" } : x))), [setAvisos]);

  const agregar = useCallback((nuevos: Aviso[]) => {
    if (nuevos.length === 0) return;
    setAvisos((previos) => {
      const todos = [...previos, ...nuevos.filter((n) => !previos.some((p) => p.id === n.id))];
      // Si hay de más, se van primero los más viejos que no sean rojos ni estén fijados.
      while (todos.length > MAX_GUARDADOS) {
        const i = todos.findIndex((x) => x.color !== "rojo" && !x.fijo);
        todos.splice(i >= 0 ? i : 0, 1);
      }
      return todos;
    });
  }, [setAvisos]);

  useEffect(() => {
    const quitar = escucharEntradas(gimnasioId, (lote) => {
      if (!lote.avisar) return;
      // Lo que anota esta misma recepción ya lo vio en su pantalla: el aviso es para lo que entró por otro lado.
      const nuevos = [...lote.entradas.filter((x) => x.via_acceso !== "recepcion").map(deEntrada), ...lote.alertas.map(deAlerta)];
      if (nuevos.length === 0) return;
      agregar(nuevos);
      // El sonido de cada color (D50), una sola vez por tanda: el del más grave (rojo, después amarillo, después verde).
      if (sonidoPrendido()) sonar(nuevos.some((n) => n.color === "rojo") ? "rojo" : nuevos.some((n) => n.color === "amarillo") ? "amarillo" : "verde");
    });
    const quitarEstado = escucharEstadoAvisos(setEstado);
    return () => { quitar(); quitarEstado(); };
  }, [gimnasioId, agregar]);

  // BASE-3: lo que anota la propia recepción (modo aviso) llega por acá.
  useEffect(() => {
    const local = (e: Event) => {
      const x = (e as CustomEvent<AvisoLocal>).detail;
      const color = x.color as Aviso["color"];
      const n: Aviso = {
        id: x.id, color, emoji: color === "rojo" ? "prohibido" : color === "amarillo" ? "alerta" : color === "azul" ? "info" : "ok", texto: x.texto, quien: x.nombre, corto: x.textoSocio || x.texto,
        socioId: x.socioId, nombre: x.nombre, numero: x.numero, cobrar: x.cobrar, puede: x.puede, textoSocio: x.textoSocio,
        colorSocio: color === "rojo" ? "rojo" : color === "amarillo" ? "amarillo" : "verde", fase: "grande", fijo: false, esIngreso: false,
      };
      setAvisos((previos) => [...previos.filter((p) => p.id !== n.id), n]);
    };
    window.addEventListener(EVENTO_AVISO_LOCAL, local);
    return () => window.removeEventListener(EVENTO_AVISO_LOCAL, local);
  }, [setAvisos]);

  const abrirVeredicto = (a: Aviso) => {
    cerrar(a.id);
    // BASE-3: tocar el aviso abre el panel lateral con la ficha rápida (la ventana de Entrada sigue en F2).
    if (conVentana) { window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_PANEL_SOCIO, { detail: { socioId: a.socioId } })); return; }
    if (!ruta.startsWith("/panel/entrada")) {
      const socio: ResultadoSocio = { socio_id: a.socioId, numero: a.numero, nombre: a.nombre, color: a.colorSocio, texto: a.textoSocio, puede: a.puede, dado_de_baja: false };
      window.dispatchEvent(new CustomEvent<ResultadoSocio>(EVENTO_ABRIR_SOCIO, { detail: socio }));
    } else {
      router.push(`/panel/entrada?socio=${a.socioId}`);
    }
  };
  const cobrar = (a: Aviso) => {
    cerrar(a.id);
    if (hayHojaCobrar()) abrirCobrar({ socioId: a.socioId, origen: "otro", sedeId });
    else router.push(`/panel/vender?socio=${a.socioId}&cuota=1`);
  };

  if (avisos.length === 0 && estado !== "con_demora") return null;
  // Se ven los últimos 3 (el rojo y lo fijado pasan primero); el resto, en "+N entradas más".
  const prioridad = (a: Aviso) => (a.color === "rojo" || a.fijo ? 1 : 0);
  const ordenados = [...avisos].sort((a, b) => prioridad(a) - prioridad(b));
  const visibles = ordenados.slice(Math.max(0, ordenados.length - MAX_VISIBLES));
  const ocultos = avisos.length - visibles.length;
  return (
    // Abajo a la derecha en la compu (E2), encima de la barrita del DNI si está; en el celular, arriba (abajo tapan la barra y el Cobrar).
    <div className="fixed z-50 right-4 left-4 sm:left-auto sm:w-96 top-[calc(0.75rem+env(safe-area-inset-top))] sm:top-auto sm:bottom-[calc(1rem+var(--barrita-alto,0px))] xl:right-[19rem] flex flex-col gap-2 pointer-events-none"
      data-avisos-entrada={avisos.length} data-avisos-estado={estado} role="region" aria-label="Entradas por la puerta" aria-live="polite">
      {estado === "con_demora" && (
        <p className="pointer-events-auto self-end rounded-full px-3 py-1 text-xs vidrio texto-suave" data-avisos-demora>Avisos con demora</p>
      )}
      {ocultos > 0 && (
        <Link href="/panel/entrada/ultimas" className="pointer-events-auto self-end rounded-full px-3 py-1 text-sm font-semibold vidrio aparecer" data-aviso-mas={ocultos}>
          +{ocultos} {ocultos === 1 ? "entrada más" : "entradas más"}
        </Link>
      )}
      {visibles.map((a) => (
        <Tarjeta key={a.id} a={a} puedeCobrar={puedeCobrar} cerrar={cerrar} achicar={achicar} fijar={fijar} abrirVeredicto={abrirVeredicto} cobrar={cobrar} />
      ))}
    </div>
  );
}

function Tarjeta({ a, puedeCobrar, cerrar, achicar, fijar, abrirVeredicto, cobrar }: {
  a: Aviso; puedeCobrar: boolean; cerrar: (id: string) => void; achicar: (id: string) => void; fijar: (id: string) => void;
  abrirVeredicto: (a: Aviso) => void; cobrar: (a: Aviso) => void;
}) {
  const [pausado, setPausado] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Cada fase tiene su reloj; con el mouse o el dedo encima, o fijado, no corre. El rojo no se achica (tope de 10 min).
  useEffect(() => {
    if (a.fijo || pausado || anulando) return;
    const t = a.color === "rojo" ? setTimeout(() => cerrar(a.id), ROJO_MS)
      : a.fase === "grande" ? setTimeout(() => achicar(a.id), GRANDE_MS)
      : setTimeout(() => cerrar(a.id), PASTILLA_MS);
    return () => clearTimeout(t);
  }, [a.id, a.fase, a.fijo, a.color, pausado, anulando, achicar, cerrar]);

  const borde = { borderLeftColor: colorVar(a.color) };
  const eventos = { onMouseEnter: () => setPausado(true), onMouseLeave: () => setPausado(false), onTouchStart: () => setPausado(true), onTouchEnd: () => setPausado(false) };
  const comunes = { "data-aviso-id": a.id, "data-aviso-entrada": a.color === "azul" ? "azul" : a.color, "data-aviso-socio": a.socioId, "data-aviso-fase": a.fijo ? "fijo" : a.fase } as const;

  const anular = async () => {
    if (motivo.trim().length < 3) { setError("Escribí el motivo (al menos 3 letras)"); return; }
    setOcupado(true); setError(null);
    const r = await anularEntrada(a.id, motivo.trim());
    setOcupado(false);
    if (r.error) { setError(r.error); return; }
    cerrar(a.id);
  };

  // Pastilla: una línea, "Juan Pérez · entró por QR". Tocarla la fija.
  if (a.fase === "pastilla" && !a.fijo && a.color !== "rojo") {
    return (
      <button type="button" {...comunes} {...eventos} onClick={() => fijar(a.id)} aria-label={`${a.quien}: ${a.corto}. Tocá para dejarlo fijo`}
        className="vidrio aparecer pointer-events-auto self-end max-w-full rounded-full min-h-12 pl-2 pr-4 flex items-center gap-2 border-l-4 text-left active:opacity-70" style={borde}>
        <Cara socioId={a.socioId} nombre={a.nombre} chica />
        <span className="min-w-0 text-sm font-semibold truncate">{a.quien} · {a.corto}</span>
      </button>
    );
  }
  // Grande (1,5 s, o fijado, o rojo): foto, nombre y lo que pasó.
  return (
    <div {...comunes} {...eventos} className="vidrio aparecer pointer-events-auto rounded-[var(--radio)] p-3 pr-2 flex items-start gap-2 border-l-4" style={borde}>
      <div className="min-w-0 flex-1 space-y-2">
        <button type="button" onClick={() => (a.fijo || a.color === "rojo" ? abrirVeredicto(a) : fijar(a.id))} className="w-full text-left flex items-start gap-3 min-h-12 active:opacity-70"
          aria-label={a.fijo || a.color === "rojo" ? `Abrir la entrada de ${a.nombre}` : `Dejar fija la entrada de ${a.nombre}`}>
          <Cara socioId={a.socioId} nombre={a.nombre} />
          <span className="min-w-0 text-sm font-semibold break-words"><span className="mr-1" aria-hidden><Icono nombre={a.emoji} sistema /></span>{a.texto}</span>
        </button>
        {(a.fijo || a.color === "rojo") && (
          <div className="flex flex-wrap gap-2" data-aviso-acciones>
            <button type="button" className="boton !min-h-12 !px-4 text-[15px]" data-aviso-ficha onClick={() => abrirVeredicto(a)}><Icono nombre="usuarios" /> Ver ficha</button>
            {a.cobrar && puedeCobrar && <button type="button" data-aviso-cobrar onClick={() => cobrar(a)} className="boton boton-principal !min-h-12 !px-4 text-[15px]"><Icono nombre="plata" /> Cobrar</button>}
            {a.esIngreso && a.color !== "rojo" && !anulando && <button type="button" className="boton !min-h-12 !px-4 text-[15px]" data-aviso-anular onClick={() => setAnulando(true)}><Icono nombre="deshacer" /> Anular la entrada</button>}
          </div>
        )}
        {!a.fijo && a.color !== "rojo" && a.cobrar && puedeCobrar && (
          <button type="button" data-aviso-cobrar onClick={() => cobrar(a)} className="boton boton-principal !min-h-12 !px-4 text-[15px]"><Icono nombre="plata" /> Cobrar</button>
        )}
        {anulando && (
          <div className="space-y-2" data-aviso-anulando>
            <input className="campo" placeholder="Motivo de anular la entrada" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo" />
            {error && <Mensaje tipo="error">{error}</Mensaje>}
            <div className="flex gap-2">
              <button type="button" className="boton boton-principal !min-h-12" disabled={ocupado} onClick={anular}>Anular</button>
              <button type="button" className="boton !min-h-12" onClick={() => { setAnulando(false); setError(null); }}>No</button>
            </div>
          </div>
        )}
      </div>
      <button type="button" onClick={() => cerrar(a.id)} aria-label="Cerrar el aviso" className="size-12 flex-none rounded-[var(--radio-campo)] texto-tenue active:opacity-60 grid place-items-center"><Icono nombre="cerrar" /></button>
    </div>
  );
}
