"use client";
// VD-4 · Los avisos de vidrio de la puerta, en cualquier pantalla del panel (docs/v2/01 §5).
// "Juan Pérez entró por QR · al día hasta 30/11" se va solo; "Ana Gómez intentó entrar: vencida" se queda
// hasta que se toca la ✕, con el botón Cobrar. Tocar el aviso abre el veredicto en la ventana de Entrada.
// Los datos vienen del "oído" compartido (entradas-vivo.ts): un solo pedido cada 4 s para todo el panel.
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AlertaViva, EntradaViva } from "@/app/panel/entrada/ventana-acciones";
import type { ResultadoSocio } from "@/app/panel/acciones";
import { colorVar } from "./Estado";
import { abrirCobrar, hayHojaCobrar } from "./cobrar/evento";
import { escucharEntradas } from "./entradas-vivo";
import { EVENTO_ABRIR_PANEL_SOCIO } from "./PanelSocioLateral";
import { Icono } from "@/components/ui/Icono";

/** La ventana de Entrada escucha este evento para abrir el veredicto de un socio (detail: ResultadoSocio). */
export const EVENTO_ABRIR_SOCIO = "gymos:abrir-entrada-socio";

/** La ventana de Entrada manda este evento con lo que acaba de anotar la recepción (BASE-3, modo aviso): sale como aviso abajo a la derecha. */
export const EVENTO_AVISO_LOCAL = "gymos:aviso-local";
export type AvisoLocal = { id: string; color: string; texto: string; socioId: string; nombre: string; numero: number | null; cobrar: boolean; puede: boolean; textoSocio: string };

const VIA: Record<string, string> = { recepcion: "en recepción", qr_socio: "con QR", qr_pared: "por QR", kiosco: "en la tablet", nfc: "con el llavero", molinete: "por el molinete" };
const VIA_PRESTAMO: Record<string, string> = { recepcion: "recepción", qr_socio: "el QR", qr_pared: "el QR de la pared", kiosco: "la tablet", nfc: "el llavero", molinete: "el molinete" };
const MAX_VISIBLES = 3;
let memoriaAvisos: Aviso[] = [];
const VERDE_MS = 5000;   // DISENO: verde 5 s, amarillo y azul 8 s, rojo se queda (10 min como tope) (con el mouse o el dedo encima no se esconde)
const AMARILLO_MS = 8000;
const ROJO_MS = 600000;   // El rojo (no puede entrar) se queda hasta que la recepción lo cierre o lo atienda (BASE-3, vd-4); DISENO decía 12 s: se eligió lo más seguro para el mostrador (PREGUNTAS.md).
const msDe = (color: string) => (color === "verde" ? VERDE_MS : color === "rojo" ? ROJO_MS : AMARILLO_MS);

type Aviso = {
  id: string; color: "verde" | "amarillo" | "rojo" | "azul"; emoji: string; texto: string;
  socioId: string; nombre: string; numero: number | null; cobrar: boolean; puede: boolean; textoSocio: string; colorSocio: string;
};

function deEntrada(x: EntradaViva): Aviso {
  const quien = x.socio;
  const rechazado = x.resultado === "rechazado";
  const color = rechazado || x.color === "rojo" ? "rojo" : x.resultado === "forzado" || x.color === "amarillo" || x.color === "naranja" ? "amarillo" : "verde";
  const via = VIA[x.via_acceso] ?? "";
  const texto = rechazado ? `${quien} intentó entrar${x.via_acceso === "recepcion" ? "" : ` ${via}`}: ${minuscula(x.texto)}`
    : x.resultado === "forzado" ? `${quien} entró ${via} (lo dejaron pasar): ${minuscula(x.texto)}`
    : `${quien} entró ${via}${x.texto ? ` · ${x.texto}` : ""}`;
  return {
    id: x.ingreso_id, color, emoji: color === "rojo" ? "prohibido" : color === "amarillo" ? "alerta" : "ok", texto,
    socioId: x.socio_id, nombre: x.socio, numero: x.numero, cobrar: x.cobrar, puede: !rechazado && x.resultado !== "forzado", textoSocio: x.texto, colorSocio: x.color,
  };
}
function deAlerta(a: AlertaViva): Aviso {
  return {
    id: a.alerta_id, color: "amarillo", emoji: "alerta",
    texto: `${a.socio} volvió a entrar por ${VIA_PRESTAMO[a.via_nueva] ?? a.via_nueva} ${a.minutos < 1 ? "hace menos de 1 min" : `a los ${a.minutos} min`} de haber entrado por ${VIA_PRESTAMO[a.via_anterior] ?? a.via_anterior}: ¿es la misma persona?`,
    socioId: a.socio_id, nombre: a.socio, numero: null, cobrar: false, puede: true, textoSocio: "", colorSocio: "amarillo",
  };
}
const minuscula = (t: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);

export function AvisosEntrada({ gimnasioId, sedeId, puedeCobrar, conVentana }: { gimnasioId: string; sedeId: string; puedeCobrar: boolean; conVentana: boolean }) {
  // Los avisos viven también fuera del componente: si la pantalla se vuelve a montar (p. ej. después de anotar una entrada y refrescar
  // el panel) no se pierden. Al volver a montar se les rearma el tiempo.
  const [avisos, setAvisosRaw] = useState<Aviso[]>(() => memoriaAvisos);
  const setAvisos = useCallback((f: Aviso[] | ((p: Aviso[]) => Aviso[])) => {
    setAvisosRaw((p) => { const n = typeof f === "function" ? f(p) : f; memoriaAvisos = n; return n; });
  }, []);
  const ruta = usePathname();
  const router = useRouter();
  const temporizadores = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const cerrar = useCallback((id: string) => {
    const t = temporizadores.current.get(id);
    if (t) clearTimeout(t);
    temporizadores.current.delete(id);
    setAvisos((a) => a.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    const mapa = temporizadores.current;
    const quitar = escucharEntradas(gimnasioId, (lote) => {
      if (!lote.avisar) return;
      // Lo que anota esta misma recepción ya lo vio en su pantalla: el aviso es para lo que entró por otro lado.
      const nuevos = [...lote.entradas.filter((x) => x.via_acceso !== "recepcion").map(deEntrada), ...lote.alertas.map(deAlerta)];
      if (nuevos.length === 0) return;
      setAvisos((previos) => {
        let todos = [...previos, ...nuevos.filter((n) => !previos.some((p) => p.id === n.id))];
        // Si hay de más, se van primero los verdes más viejos; el rojo dura 12 s.
        while (todos.length > MAX_VISIBLES) {
          const i = todos.findIndex((x) => x.color === "verde");
          const j = i >= 0 ? i : todos.findIndex((x) => x.color === "amarillo");
          if (j < 0) break;
          const [fuera] = todos.splice(j, 1);
          const t = mapa.get(fuera.id); if (t) clearTimeout(t); mapa.delete(fuera.id);
          todos = [...todos];
        }
        return todos;
      });
      for (const n of nuevos) {
        mapa.set(n.id, setTimeout(() => cerrar(n.id), msDe(n.color)));
      }
    });
    return () => { quitar(); mapa.forEach((t) => clearTimeout(t)); mapa.clear(); };
  }, [gimnasioId, cerrar]);

  const pausar = (id: string) => { const t = temporizadores.current.get(id); if (t) clearTimeout(t); temporizadores.current.delete(id); };
  const reanudar = (a: Aviso) => { temporizadores.current.set(a.id, setTimeout(() => cerrar(a.id), msDe(a.color))); };
  useEffect(() => {
    const mapa = temporizadores.current;
    for (const a of memoriaAvisos) if (!mapa.has(a.id)) mapa.set(a.id, setTimeout(() => cerrar(a.id), msDe(a.color)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // BASE-3: lo que anota la propia recepción (modo aviso) llega por acá.
  useEffect(() => {
    const mapa = temporizadores.current;
    const local = (e: Event) => {
      const x = (e as CustomEvent<AvisoLocal>).detail;
      const color = x.color as Aviso["color"];
      const n: Aviso = { id: x.id, color, emoji: color === "rojo" ? "prohibido" : color === "amarillo" ? "alerta" : color === "azul" ? "info" : "ok", texto: x.texto,
        socioId: x.socioId, nombre: x.nombre, numero: x.numero, cobrar: x.cobrar, puede: x.puede, textoSocio: x.textoSocio, colorSocio: color === "rojo" ? "rojo" : color === "amarillo" ? "amarillo" : "verde" };
      setAvisos((previos) => {
        let todos = [...previos.filter((p) => p.id !== n.id), n];
        while (todos.length > MAX_VISIBLES) {
          // Se apilan los últimos 3: se va el más viejo (primero un verde o azul, después un amarillo, y si no queda otro, el rojo más viejo). El nuevo nunca.
          const viejos = todos.slice(0, -1);
          const i = viejos.findIndex((q) => q.color === "verde" || q.color === "azul");
          const j = i >= 0 ? i : viejos.findIndex((q) => q.color === "amarillo") >= 0 ? viejos.findIndex((q) => q.color === "amarillo") : 0;
          const [fuera] = todos.splice(j, 1);
          const t = mapa.get(fuera.id); if (t) clearTimeout(t); mapa.delete(fuera.id);
          todos = [...todos];
        }
        return todos;
      });
      mapa.set(n.id, setTimeout(() => cerrar(n.id), msDe(color)));
    };
    window.addEventListener(EVENTO_AVISO_LOCAL, local);
    return () => window.removeEventListener(EVENTO_AVISO_LOCAL, local);
  }, [cerrar]);

  const abrirVeredicto = (a: Aviso) => {
    cerrar(a.id);
    // BASE-3: tocar el aviso abre el panel lateral con la ficha rápida (la ventana de Entrada sigue en F2).
    if (conVentana) { window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_PANEL_SOCIO, { detail: { socioId: a.socioId } })); return; }
    if (conVentana && !ruta.startsWith("/panel/entrada")) {
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

  if (avisos.length === 0) return null;
  return (
    // Arriba a la derecha (en la compu de la barra fija, a su izquierda): abajo tapaban el botón de la Entrada, la barra de abajo del celular y el Cobrar.
    <div className="fixed z-50 right-4 left-4 sm:left-auto sm:w-96 top-[calc(0.75rem+env(safe-area-inset-top))] xl:right-[19rem] flex flex-col gap-2 pointer-events-none" data-avisos-entrada={avisos.length} role="region" aria-label="Avisos de la puerta" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} data-aviso-id={a.id} data-aviso-entrada={a.color === "azul" ? "azul" : a.color} data-aviso-socio={a.socioId}
          onMouseEnter={() => pausar(a.id)} onMouseLeave={() => reanudar(a)} onTouchStart={() => pausar(a.id)} onTouchEnd={() => reanudar(a)}
          className="vidrio aparecer pointer-events-auto rounded-[var(--radio)] p-3 pr-2 flex items-start gap-2 border-l-4" style={{ borderLeftColor: colorVar(a.color) }}>
          <button type="button" onClick={() => abrirVeredicto(a)} className="min-w-0 flex-1 text-left flex items-start gap-2 min-h-12 active:opacity-70" aria-label={`Abrir la entrada de ${a.nombre}`}>
            <span className="text-xl leading-6" aria-hidden><Icono nombre={a.emoji} sistema /></span>
            <span className="min-w-0 text-sm font-semibold break-words">{a.texto}</span>
          </button>
          <div className="flex flex-col items-end gap-1 flex-none">
            <button type="button" onClick={() => cerrar(a.id)} aria-label="Cerrar el aviso" className="size-12 rounded-[var(--radio-campo)] texto-tenue active:opacity-60 grid place-items-center"><Icono nombre="cerrar" /></button>
            {a.cobrar && puedeCobrar && <button type="button" data-aviso-cobrar onClick={() => cobrar(a)} className="boton boton-principal !min-h-12 !px-4 text-[15px]"><Icono nombre="plata" /> Cobrar</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
