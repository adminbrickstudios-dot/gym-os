import { Icono } from "@/components/ui/Icono";
import Link from "next/link";
import { formatearNumero, formatearPesos } from "@/lib/formato";

export type NumeroInicio = { clave: string; emoji: string; etiqueta: string; valor: number; formato?: "pesos" | "porcentaje"; serie?: number[] };

/** Cada número lleva a la lista que lo forma (si esa sección está prendida). */
export const LISTA_DEL_NUMERO: Record<string, { ruta: string; seccion: string }> = {
  adentro: { ruta: "/panel/entrada", seccion: "entrada" },
  entraron: { ruta: "/panel/entrada", seccion: "entrada" },
  cobrado: { ruta: "/panel/caja", seccion: "caja" },
  a_cobrar: { ruta: "/panel/vencen-hoy", seccion: "vencen_hoy" },
  vencen: { ruta: "/panel/vencen-hoy", seccion: "vencen_hoy" },
  deben: { ruta: "/panel/vencen-hoy", seccion: "vencen_hoy" },
  por_vencer: { ruta: "/panel/vencen-hoy", seccion: "vencen_hoy" },
  plata_riesgo: { ruta: "/panel/retencion", seccion: "retencion" },
  activos: { ruta: "/panel/socios", seccion: "socios" },
  altas_mes: { ruta: "/panel/socios", seccion: "socios" },
  bajas_mes: { ruta: "/panel/socios", seccion: "socios" },
  ocupacion: { ruta: "/panel/clases", seccion: "clases" },
  al_dia: { ruta: "/panel/socios", seccion: "socios" },
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

export function NumerosInicio({ numeros, apagadas }: { numeros: NumeroInicio[]; apagadas: string[] }) {
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
      {numeros.map((n) => {
        const valor = n.formato === "pesos" ? formatearPesos(n.valor) : n.formato === "porcentaje" ? `${formatearNumero(n.valor)} %` : formatearNumero(n.valor);
        const cuerpo = (
          <>
            <dt className="texto-suave mt-2 text-[15px]"><span aria-hidden><Icono nombre={n.emoji} sistema /></span> {n.etiqueta}</dt>
            <dd className="numero text-5xl sm:text-6xl min-w-0 break-words">{valor}{n.serie && n.serie.length > 1 && <MiniGrafico serie={n.serie} pesos={n.formato === "pesos"} />}</dd>
          </>
        );
        const lista = LISTA_DEL_NUMERO[n.clave];
        return lista && !apagadas.includes(lista.seccion)
          ? <Link key={n.clave} href={lista.ruta} data-numero={n.clave} className="flex flex-col-reverse justify-end rounded-[var(--radio)] p-2 -m-2 hover:bg-[var(--tarjeta)] active:scale-[0.98] transition">{cuerpo}</Link>
          : <div key={n.clave} data-numero={n.clave} className="flex flex-col-reverse justify-end">{cuerpo}</div>;
      })}
    </dl>
  );
}
