import type { Metadata } from "next";
import Link from "next/link";
import { FilaContacto } from "@/components/panel/FilaContacto";
import { Encabezado } from "@/components/panel/Marco";
import { fechaCorta, formatearPesos } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { linkWhatsappSocio } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Retención" };

type Fila = { socio_id: string; nombre: string; telefono: string | null; lista: string; texto: string; debe: number | null; monto_mensual: number | null;
  visitas_por_semana: number | null; ultimo_contacto_en: string | null; ultimo_contacto_por: string | null; ultimo_contacto_resultado: string | null; mensaje: string | null };
type Resumen = { plata_en_riesgo: number; listas: Record<string, number> };

const LISTAS = [
  { clave: "vencido", emoji: "🔴", titulo: "Vencidos", ayuda: "Les venció y no pagaron" },
  { clave: "por_vencer", emoji: "⏰", titulo: "Por vencer", ayuda: "Vencen en los próximos días" },
  { clave: "nuevo", emoji: "🌱", titulo: "Nuevos que no vienen", ayuda: "Se anotaron hace poco y aflojaron" },
  { clave: "no_viene", emoji: "💤", titulo: "No vienen", ayuda: "Pagan pero dejaron de venir" },
  { clave: "se_fue", emoji: "👋", titulo: "Se fueron", ayuda: "Hace rato que no pagan" },
];

// La deuda ya está en el texto (sale de la misma función que la puerta): no se repite.
function venia(porSemana: number | null) {
  if (!porSemana) return null;
  const n = Math.round(porSemana);
  return n < 1 ? "Venía menos de una vez por semana" : `Venía ${n} ${n === 1 ? "vez" : "veces"} por semana`;
}

export default async function Retencion({ searchParams }: { searchParams: Promise<{ lista?: string; etiqueta?: string }> }) {
  const sp = await searchParams;
  const pedida = sp.lista;
  const etiqueta = /^[0-9a-f-]{36}$/.test(sp.etiqueta ?? "") ? sp.etiqueta! : null;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "retencion");
    exigirRol(panel, ["dueno", "encargado"]);
    const [resumen, todas, etiquetas, conEtiqueta] = await Promise.all([
      rpc<Resumen>("retencion_resumen", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Fila[]>("retencion", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<{ id: string; nombre: string; socios: number }[]>("etiquetas_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      etiqueta ? rpc<string[]>("socios_con_etiqueta", { p_gimnasio_id: panel.gimnasio.id, p_etiqueta_id: etiqueta }) : Promise.resolve(null),
    ]);
    // Filtrar por etiqueta solo elige filas: quién está en cada lista lo sigue diciendo la base.
    const ids = conEtiqueta ? new Set(conEtiqueta) : null;
    const filas = ids ? todas.filter((f) => ids.has(f.socio_id)) : todas;
    const url = (l: string, e: string | null) => `/panel/retencion?lista=${l}${e ? `&etiqueta=${e}` : ""}`;
    const lista = LISTAS.find((l) => l.clave === pedida) ?? LISTAS.find((l) => (resumen.listas[l.clave] ?? 0) > 0) ?? LISTAS[0];
    const zona = panel.gimnasio.zona_horaria;
    const visibles = filas.filter((f) => f.lista === lista.clave);
    return (
      <>
        <Encabezado emoji="📉" titulo="Retención" bajada="Los que se están yendo, ordenados por urgencia, con el mensaje listo." />
        <p className="mb-8"><span className="numero text-5xl">{formatearPesos(resumen.plata_en_riesgo)}</span> <span className="texto-suave text-lg">por mes en riesgo</span></p>
        <nav aria-label="Listas" className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-4 px-4">
          {LISTAS.map((l) => (
            <Link key={l.clave} href={url(l.clave, etiqueta)} aria-current={l.clave === lista.clave ? "page" : undefined}
              className={`boton !min-h-12 whitespace-nowrap ${l.clave === lista.clave ? "!border-[var(--acento)]" : ""}`}>
              {l.emoji} {l.titulo} <span className="numero text-lg texto-suave">{ids ? filas.filter((f) => f.lista === l.clave).length : resumen.listas[l.clave] ?? 0}</span>
            </Link>
          ))}
        </nav>
        {etiquetas.length > 0 && (
          <nav className="flex flex-wrap gap-2 mb-4" aria-label="Filtrar por etiqueta" data-filtro-etiquetas>
            <Link href={url(lista.clave, null)} className="pestana" aria-current={!etiqueta ? "page" : undefined}>Todos</Link>
            {etiquetas.map((e) => <Link key={e.id} href={url(lista.clave, e.id)} className="pestana" aria-current={etiqueta === e.id ? "page" : undefined}>🏷️ {e.nombre}</Link>)}
          </nav>
        )}
        <p className="texto-suave mb-4">{lista.ayuda}.</p>
        {visibles.length === 0 ? <p className="texto-suave text-lg">Nadie en esta lista. 🎉</p> : (
          <ul className="space-y-2">
            {visibles.map((f) => (
              <FilaContacto key={f.socio_id} socioId={f.socio_id} nombre={f.nombre} texto={f.texto} lista={f.lista}
                detalle={venia(f.visitas_por_semana)}
                whatsapp={linkWhatsappSocio(f.telefono, f.mensaje)}
                ultimo={f.ultimo_contacto_en ? `${f.ultimo_contacto_resultado === "vuelve" ? "Dijo que vuelve" : "Le escribió " + (f.ultimo_contacto_por ?? "alguien")} el ${fechaCorta(f.ultimo_contacto_en, zona)}` : null}
                puedeAnotar />
            ))}
          </ul>
        )}
      </>
    );
  });
}
