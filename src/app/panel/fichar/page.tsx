import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { nombreMes } from "@/lib/gastos";
import { ETIQUETA_ESTADO, horaLocal, textoMinutos, type HorasMes } from "@/lib/fichaje";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { FicharPin } from "./FicharPin";

export const metadata: Metadata = { title: "Fichar y mis horas" };

const moverMes = (d: string, n: number) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 10);
const dia = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

type Mio = { usa: boolean; nombre: string; puede: boolean; en_turno: boolean; entrada_en: string | null; sin_salida_desde: string | null };

/** VD-53 (D15): marcar entrada y salida, y las horas del mes de quien opera. Cada uno ve solo lo suyo (lo exige la base). */
export default async function Fichar({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["encargado", "recepcion", "profe"]);
    exigirSeccion(panel, "fichar");
    const zona = panel.gimnasio.zona_horaria;
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
    const actual = `${hoy.slice(0, 7)}-01`;
    const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) && `${sp.mes}-01` <= actual ? `${sp.mes}-01` : actual;
    const [mio, horas] = await Promise.all([
      rpc<Mio>("mi_fichaje", { p_gimnasio_id: panel.gimnasio.id }, { lectura: true }),
      rpc<HorasMes>("mis_horas", { p_gimnasio_id: panel.gimnasio.id, p_mes: mes }, { lectura: true }),
    ]);
    const anterior = moverMes(mes, -1), siguiente = moverMes(mes, 1);
    return (
      <div className="space-y-8">
        <Encabezado icono="reloj" titulo="Fichar y mis horas" bajada="Marcá tu entrada al llegar y tu salida al irte. Si te olvidás la salida, esa entrada no suma horas hasta que el dueño la corrija." />
        <FicharPin zona={zona} mio={{ nombre: mio.nombre, enTurno: mio.en_turno, entradaEn: mio.entrada_en, sinSalidaDesde: mio.sin_salida_desde }} />
        <section className="space-y-4 max-w-xl" aria-labelledby="mis-horas" data-mis-horas>
          <h2 id="mis-horas" className="titulo text-2xl">Mis horas · {nombreMes(mes)}</h2>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Mes">
            <Link href={`/panel/fichar?mes=${anterior.slice(0, 7)}`} className="pestana">← {nombreMes(anterior).split(" ")[0]}</Link>
            <span className="pestana" aria-current="page">{nombreMes(mes)}</span>
            {mes < actual && <Link href={`/panel/fichar?mes=${siguiente.slice(0, 7)}`} className="pestana">{nombreMes(siguiente).split(" ")[0]} →</Link>}
          </nav>
          <p className="numero text-3xl" data-total-horas>{textoMinutos(horas.minutos)}</p>
          {horas.sin_salida > 0 && <p className="texto-suave text-sm">{horas.sin_salida} {horas.sin_salida === 1 ? "turno quedó sin salida" : "turnos quedaron sin salida"}: no suman. Pedile al dueño que lo corrija.</p>}
          {horas.turnos.length === 0
            ? <p className="texto-suave">Todavía no fichaste nada este mes.</p>
            : (
              <ul className="tarjeta divide-y divide-[var(--borde)]">
                {horas.turnos.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2" data-turno-estado={t.estado}>
                    <span className="font-semibold">{dia(t.dia)}</span>
                    <span>{horaLocal(t.entrada, zona)} a {t.salida ? horaLocal(t.salida, zona) : "—"}</span>
                    <span className="numero ml-auto">{t.estado === "cerrado" ? textoMinutos(t.minutos) : ""}</span>
                    {(t.estado !== "cerrado" || t.corregido) && <span className="pildora text-sm">{t.estado !== "cerrado" ? ETIQUETA_ESTADO[t.estado] : "corregido por el dueño"}</span>}
                  </li>
                ))}
              </ul>)}
        </section>
      </div>
    );
  });
}
