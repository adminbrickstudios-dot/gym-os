import type { Metadata } from "next";
import Link from "next/link";
import { PuntoEstado } from "@/components/panel/Estado";
import { Encabezado } from "@/components/panel/Marco";
import { SelectorSede } from "@/components/panel/SelectorSede";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import { Puerta } from "./Puerta";

export const metadata: Metadata = { title: "Entrada" };

type Ingreso = { ingreso_id: string; momento: string; socio_id: string; socio: string; numero: number; resultado: string; color: string; texto: string; registrado_por: string | null };
const ETIQUETA: Record<string, string> = { entro: "Entró", entro_modo_aviso: "Entró con aviso", forzado: "Lo dejaron pasar", rechazado: "No pudo entrar" };

export default async function Entrada({ searchParams }: { searchParams: Promise<{ sede?: string }> }) {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "entrada");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const { sede, puedeCambiar } = sedeActiva(panel, (await searchParams).sede);
    const hoy = await rpc<Ingreso[]>("ingresos_del_dia", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sede.id });
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: panel.gimnasio.zona_horaria, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const entraron = new Set(hoy.filter((i) => i.resultado !== "rechazado").map((i) => i.socio_id)).size;

    return (
      <>
        <Encabezado emoji="🚪" titulo="Entrada" bajada="Buscá al socio: te dice si puede entrar y, si no, por qué." />
        {puedeCambiar && <SelectorSede sedes={panel.sedes} actual={sede.id} ruta="/panel/entrada" />}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10 [&>*]:min-w-0">
          <Puerta sedeId={sede.id} />
          <section aria-labelledby="hoy">
            <h2 id="hoy" className="titulo text-2xl mb-1">Hoy</h2>
            <p className="texto-suave mb-4">{entraron === 1 ? "Entró 1 socio" : `Entraron ${entraron} socios`}</p>
            {hoy.length === 0 ? (
              <p className="texto-tenue">Todavía no entró nadie.</p>
            ) : (
              <ul className="space-y-1">
                {hoy.slice(0, 40).map((i) => (
                  <li key={i.ingreso_id}>
                    <Link href={`/panel/socios/${i.socio_id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[var(--tarjeta)]">
                      <span className="numero text-lg w-12 texto-suave">{hora(i.momento)}</span>
                      <PuntoEstado color={i.resultado === "rechazado" ? "rojo" : i.resultado === "forzado" ? "naranja" : i.color} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold truncate">{i.socio}</span>
                        <span className="block text-sm texto-tenue truncate">{ETIQUETA[i.resultado] ?? i.resultado}{i.resultado !== "entro" ? ` · ${i.texto}` : ""}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </>
    );
  });
}
