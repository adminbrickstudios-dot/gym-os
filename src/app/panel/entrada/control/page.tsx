import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Control de la puerta" };

type Control = {
  desde: string; hasta: string;
  forzados: { ingreso_id: string; momento: string; socio_id: string; socio: string; por: string | null; motivo: string; porque_no: string; anulado: boolean }[];
  anuladas: { ingreso_id: string; anulado_en: string; socio_id: string; socio: string; por: string | null; motivo: string; resultado: string }[];
  por_persona: { nombre: string; rol: string; forzados: number; anuladas: number }[];
};
const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const sumar = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** ENT-8: a quién dejaron pasar y qué entradas se anularon, por semana, con la cuenta por persona. */
export default async function ControlPuerta({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "entrada");
    exigirRol(panel, ["dueno", "encargado"]);
    const hoy = new Intl.DateTimeFormat("sv-SE", { timeZone: panel.gimnasio.zona_horaria }).format(new Date());
    const { desde: pedido } = await searchParams;
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(pedido ?? "") ? pedido! : sumar(hoy, -6);
    const c = await rpc<Control>("control_entrada", { p_gimnasio_id: panel.gimnasio.id, p_desde: desde, p_dias: 7 });
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: panel.gimnasio.zona_horaria, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    return (
      <>
        <Encabezado volver={{ href: "/panel/entrada", texto: "Entrada" }} emoji="🔎" titulo="Control de la puerta"
          bajada="A quién dejaron pasar sin poder entrar y qué entradas se anularon: quién, cuándo y por qué." />
        <nav className="flex flex-wrap items-center gap-2 mb-8" aria-label="Semana" data-semana={c.desde}>
          <Link href={`/panel/entrada/control?desde=${sumar(desde, -7)}`} className="boton">◀ Anterior</Link>
          <span className="font-semibold px-2">Del {dia(c.desde)} al {dia(c.hasta)}</span>
          {sumar(desde, 7) <= hoy && <Link href={`/panel/entrada/control?desde=${sumar(desde, 7)}`} className="boton">Siguiente ▶</Link>}
        </nav>
        {c.forzados.length + c.anuladas.length === 0 ? (
          <Vacio emoji="✅" titulo="Nada para revisar esta semana">Nadie entró sin poder y no se anuló ninguna entrada.</Vacio>
        ) : (
          <div className="space-y-10">
            <section aria-labelledby="personas" data-por-persona={c.por_persona.length}>
              <h2 id="personas" className="titulo text-3xl mb-4">👤 Por persona</h2>
              <ul className="grid sm:grid-cols-3 gap-3">
                {c.por_persona.map((p) => (
                  <li key={p.nombre} className="tarjeta p-5">
                    <p className="font-semibold text-lg">{p.nombre}</p>
                    <p className="texto-suave">{p.forzados} dejados pasar · {p.anuladas} anuladas</p>
                  </li>
                ))}
              </ul>
            </section>
            {c.forzados.length > 0 && (
              <section aria-labelledby="forzados" data-forzados={c.forzados.length}>
                <h2 id="forzados" className="titulo text-3xl mb-4">🚪 Dejados pasar</h2>
                <ul className="space-y-2">{c.forzados.map((f) => (
                  <li key={f.ingreso_id} className={`tarjeta px-4 py-3 ${f.anulado ? "opacity-60" : ""}`}>
                    <p><Link href={`/panel/socios/${f.socio_id}`} className="font-semibold hover:underline">{f.socio}</Link> <span className="texto-tenue">· {hora(f.momento)}</span></p>
                    <p className="texto-suave">{f.por ?? "El equipo"}: “{f.motivo}” · no podía porque {f.porque_no.charAt(0).toLowerCase() + f.porque_no.slice(1)}{f.anulado ? " · después se anuló" : ""}</p>
                  </li>
                ))}</ul>
              </section>
            )}
            {c.anuladas.length > 0 && (
              <section aria-labelledby="anuladas" data-anuladas={c.anuladas.length}>
                <h2 id="anuladas" className="titulo text-3xl mb-4">↩️ Entradas anuladas</h2>
                <ul className="space-y-2">{c.anuladas.map((a) => (
                  <li key={a.ingreso_id} className="tarjeta px-4 py-3">
                    <p><Link href={`/panel/socios/${a.socio_id}`} className="font-semibold hover:underline">{a.socio}</Link> <span className="texto-tenue">· {hora(a.anulado_en)}</span></p>
                    <p className="texto-suave">{a.por ?? "El equipo"}: “{a.motivo}”</p>
                  </li>
                ))}</ul>
              </section>
            )}
          </div>
        )}
      </>
    );
  });
}
