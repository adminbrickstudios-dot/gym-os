import Link from "next/link";
import { FilaContacto } from "@/components/panel/FilaContacto";
import { Vacio } from "@/components/ui/Vacio";
import { fechaCorta } from "@/lib/formato";
import { linkWhatsappSocio } from "@/lib/whatsapp";

// VD-46O · Reactivar ex socios: la lista “Se fueron” con filtro por motivo de baja y antigüedad, y cuántos de los
// contactados volvieron a pagar. Todo lo calcula la base (ex_socios); acá solo se muestra.
export type DatosExSocios = {
  total: number;
  filas: { socio_id: string; nombre: string; telefono: string | null; texto: string; mensaje: string | null; motivo: string; meses: number;
    ultimo_contacto_en: string | null; ultimo_contacto_por: string | null; ultimo_contacto_resultado: string | null }[];
  motivos: { motivo: string; cantidad: number }[];
  antiguedad: { menos_3: number; de_3_a_12: number; mas_12: number };
  seguimiento: { dias: number; contactados: number; volvieron: number };
};

export const MOTIVOS_EX: Record<string, string> = {
  precio: "💸 Precio", horario: "⏰ Horario", mudanza: "📦 Se mudó", otro_gimnasio: "🏋️ Otro gimnasio",
  sin_tiempo: "⌛ Sin tiempo", insatisfecho: "😕 No le gustó", otro: "Otro", sin_baja: "👋 Dejó de pagar",
};
export const ANTIGUEDADES = [
  { clave: "menos_3", titulo: "Menos de 3 meses" }, { clave: "de_3_a_12", titulo: "De 3 a 12 meses" }, { clave: "mas_12", titulo: "Más de un año" },
] as const;

function meses(n: number) {
  if (n < 1) return "Menos de un mes de socio";
  if (n < 12) return `${n} ${n === 1 ? "mes" : "meses"} de socio`;
  const a = Math.floor(n / 12), m = n % 12;
  return `${a} ${a === 1 ? "año" : "años"}${m ? ` y ${m} ${m === 1 ? "mes" : "meses"}` : ""} de socio`;
}

export function ExSocios({ datos: d, motivo, antiguedad, url, zona, mostrar }: {
  datos: DatosExSocios; motivo: string | null; antiguedad: string | null; zona: string; mostrar: number;
  /** La dirección de esta lista con otros filtros (conserva etiqueta y período). */
  url: (motivo: string | null, antiguedad: string | null) => string;
}) {
  const s = d.seguimiento;
  const filtrado = Boolean(motivo || antiguedad);
  return (
    <div data-ex-socios>
      <p className="mensaje mensaje-info mb-4" data-seguimiento-ex>
        🔁 <span>{s.contactados === 0
          ? `Todavía no le escribiste a ningún ex socio en los últimos ${s.dias} días. Cuando lo hagas, acá ves cuántos volvieron a pagar.`
          : <><strong>{s.volvieron} de {s.contactados}</strong> de los ex socios a los que se les escribió (últimos {s.dias} días) volvieron a pagar.</>}</span>
      </p>
      <nav className="flex flex-wrap gap-2 mb-2" aria-label="Filtrar por motivo de baja" data-filtro-motivo>
        <Link href={url(null, antiguedad)} data-transicion className="pestana" aria-current={!motivo ? "page" : undefined}>Todos los motivos</Link>
        {d.motivos.map((m) => (
          <Link key={m.motivo} href={url(m.motivo, antiguedad)} data-transicion className="pestana" aria-current={motivo === m.motivo ? "page" : undefined}>
            {MOTIVOS_EX[m.motivo] ?? m.motivo} <span className="texto-tenue">{m.cantidad}</span>
          </Link>
        ))}
      </nav>
      <nav className="flex flex-wrap gap-2 mb-4" aria-label="Filtrar por antigüedad" data-filtro-antiguedad>
        <Link href={url(motivo, null)} data-transicion className="pestana" aria-current={!antiguedad ? "page" : undefined}>Cualquier antigüedad</Link>
        {ANTIGUEDADES.map((a) => (
          <Link key={a.clave} href={url(motivo, a.clave)} data-transicion className="pestana" aria-current={antiguedad === a.clave ? "page" : undefined}>
            {a.titulo} <span className="texto-tenue">{d.antiguedad[a.clave]}</span>
          </Link>
        ))}
      </nav>
      {d.filas.length === 0 ? (
        <Vacio emoji={filtrado ? "🔎" : "🎉"} titulo={filtrado ? "Nadie con ese filtro" : "Nadie se fue"}>
          {filtrado ? <>Probá con <Link href={url(null, null)} className="underline">todos los ex socios</Link>.</> : "Cuando alguien deje de pagar o se dé de baja, aparece acá para que le escribas."}
        </Vacio>
      ) : (
        <ul className="space-y-2" data-lista-retencion data-ex-filas={d.filas.length}>
          {d.filas.slice(0, mostrar).map((f) => (
            <FilaContacto key={f.socio_id} socioId={f.socio_id} nombre={f.nombre} texto={f.texto} lista="se_fue"
              detalle={`${MOTIVOS_EX[f.motivo] ?? f.motivo} · ${meses(f.meses)}`}
              whatsapp={linkWhatsappSocio(f.telefono, f.mensaje)}
              ultimo={f.ultimo_contacto_en ? `${f.ultimo_contacto_resultado === "vuelve" ? "Dijo que vuelve" : "Le escribió " + (f.ultimo_contacto_por ?? "alguien")} el ${fechaCorta(f.ultimo_contacto_en, zona)}` : null}
              puedeAnotar tarea />
          ))}
        </ul>
      )}
    </div>
  );
}
