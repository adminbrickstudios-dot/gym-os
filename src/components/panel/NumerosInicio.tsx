import { Icono } from "@/components/ui/Icono";
import Link from "next/link";
import { formatearNumero, formatearPesos } from "@/lib/formato";

export type NumeroInicio = { clave: string; emoji: string; etiqueta: string; valor: number; formato?: "pesos" | "porcentaje"; serie?: number[] };

/** Cada número lleva a la lista que lo forma, ya filtrada (R1: la pestaña o el filtro de esa cuenta; si esa sección está prendida). */
export const LISTA_DEL_NUMERO: Record<string, { ruta: string; seccion: string }> = {
  adentro: { ruta: "/panel/entrada", seccion: "entrada" },
  entraron: { ruta: "/panel/entrada", seccion: "entrada" },
  cobrado: { ruta: "/panel/caja/reporte", seccion: "caja" },
  caja_turno: { ruta: "/panel/caja", seccion: "caja" },
  a_cobrar: { ruta: "/panel/vencen-hoy?pestana=cobrar", seccion: "vencen_hoy" },
  vencen: { ruta: "/panel/vencen-hoy", seccion: "vencen_hoy" },
  deben: { ruta: "/panel/vencen-hoy?pestana=vencidos", seccion: "vencen_hoy" },
  por_vencer: { ruta: "/panel/vencen-hoy?pestana=por_vencer", seccion: "vencen_hoy" },
  plata_riesgo: { ruta: "/panel/retencion?lista=riesgo", seccion: "retencion" },
  no_vienen: { ruta: "/panel/retencion?lista=no_viene", seccion: "retencion" },
  activos: { ruta: "/panel/socios", seccion: "socios" },
  altas_mes: { ruta: "/panel/socios?estado=nuevos", seccion: "socios" },
  bajas_mes: { ruta: "/panel/socios?estado=bajas", seccion: "socios" },
  ocupacion: { ruta: "/panel/clases", seccion: "clases" },
  al_dia: { ruta: "/panel/socios?estado=al_dia", seccion: "socios" },
  por_aprobar: { ruta: "/panel/transferencias", seccion: "transferencias" },
  mis_clases: { ruta: "/panel/clases", seccion: "clases" },
  anotados: { ruta: "/panel/clases", seccion: "clases" },
  presentes: { ruta: "/panel/clases", seccion: "clases" },
  faltan: { ruta: "/panel/clases", seccion: "clases" },
  clases: { ruta: "/panel/clases", seccion: "clases" },
};

/** Mini gráfico de los últimos días (el último, hoy, resaltado). Decorativo: el número ya dice todo. */
function MiniGrafico({ serie, pesos }: { serie: number[]; pesos: boolean }) {
  const max = Math.max(...serie, 1);
  const dicho = serie.map((n) => (pesos ? formatearPesos(n) : formatearNumero(n))).join(", ");
  return (
    <span className="flex items-end gap-[3px] h-6 mt-2" role="img" aria-label={`Tendencia de los últimos 7 días, de más viejo a hoy: ${dicho}`} data-mini-grafico={serie.length}>
      {serie.map((n, i) => (
        <span key={i} className="w-2 rounded-sm" style={{ height: `${Math.max(12, (n / max) * 100)}%`, background: i === serie.length - 1 ? "var(--acento, currentColor)" : "var(--tarjeta-alta)" }} />
      ))}
    </span>
  );
}

/** Cierre para vender (25/11): la línea chica de abajo de cada número (inicio-panel.png). Solo la redacta: los hechos los trae la base. */
export function NumerosInicio({ numeros, apagadas, detalles = {} }: { numeros: NumeroInicio[]; apagadas: string[]; detalles?: Record<string, string> }) {
  // Accesibilidad (Lighthouse): el <dl> solo tiene <div> con su <dt> y su <dd>; el link va adentro del <dd> y cubre toda la tarjeta con CSS.
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
      {numeros.map((n) => {
        const valor = n.formato === "pesos" ? formatearPesos(n.valor) : n.formato === "porcentaje" ? `${formatearNumero(n.valor)} %` : formatearNumero(n.valor);
        const lista = LISTA_DEL_NUMERO[n.clave];
        const conLink = !!lista && !apagadas.includes(lista.seccion);
        const detalle = detalles[n.clave];
        const cuerpo = <>{valor}{n.serie && n.serie.length > 1 && <MiniGrafico serie={n.serie} pesos={n.formato === "pesos"} />}</>;
        return (
          <div key={n.clave} data-numero-item={n.clave} className={`numero-inicio flex flex-col-reverse justify-end ${conLink ? "numero-inicio-link rounded-[var(--radio)] p-2 -m-2 hover:bg-[var(--tarjeta)] transition" : ""}`}>
            <dt className="texto-suave mt-2 text-[15px]"><span aria-hidden><Icono nombre={n.emoji} sistema /></span> <span data-numero-etiqueta>{n.etiqueta}</span>{detalle && <span className="numero-inicio-detalle block" data-numero-detalle={n.clave}>{detalle}</span>}</dt>
            <dd className="numero text-5xl sm:text-6xl min-w-0 break-words">
              {conLink ? <Link href={lista.ruta} data-numero={n.clave} className="numero-inicio-a">{cuerpo}</Link> : <span data-numero={n.clave}>{cuerpo}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
