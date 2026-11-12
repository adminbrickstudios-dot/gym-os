import Link from "next/link";
import { fechaHoraHumana } from "@/lib/formato";

export type AlertasPatronDatos = {
  dos_sedes: { socio_id: string; nombre: string; sede_a: string; sede_b: string; minutos: number; momento: string }[];
  muchas_entradas: { socio_id: string; nombre: string; dia: string; entradas: number; promedio: number }[];
};

/** FA-22: avisos por patrón en las entradas (los últimos 14 días). Solo avisan: no frenan nada y no cambian ninguna entrada. */
export function AlertasPatron({ datos, zona }: { datos: AlertasPatronDatos; zona: string }) {
  const total = datos.dos_sedes.length + datos.muchas_entradas.length;
  if (total === 0) return null;
  const cuando = (m: string) => fechaHoraHumana(m, zona);
  return (
    <section className="tarjeta p-4 space-y-3" aria-labelledby="patrones" data-alertas-patron={total}>
      <h2 id="patrones" className="titulo text-xl">Entradas para mirar ({total})</h2>
      <p className="texto-suave text-sm">Son avisos: no frenan a nadie. Pueden tener una explicación normal; mirá cada caso.</p>
      <ul className="divide-y divide-[var(--borde)]">
        {datos.dos_sedes.map((a) => (
          <li key={`${a.socio_id}-${a.momento}`} className="py-2" data-patron="dos_sedes">
            <Link href={`/panel/socios/${a.socio_id}`} className="underline font-semibold">{a.nombre}</Link>{" "}
            entró en {a.sede_a} y {a.minutos} {a.minutos === 1 ? "minuto" : "minutos"} después en {a.sede_b} <span className="texto-tenue">({cuando(a.momento)})</span>
          </li>
        ))}
        {datos.muchas_entradas.map((a) => (
          <li key={`${a.socio_id}-${a.dia}`} className="py-2" data-patron="muchas_entradas">
            <Link href={`/panel/socios/${a.socio_id}`} className="underline font-semibold">{a.nombre}</Link>{" "}
            entró {a.entradas} veces el {a.dia.split("-").reverse().slice(0, 2).join("/")}; en un día normal entra {String(a.promedio).replace(".", ",")}
          </li>
        ))}
      </ul>
    </section>
  );
}
