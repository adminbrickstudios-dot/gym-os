import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { FormIncidente, TarjetaIncidente, type Incidente } from "./Incidentes";

export const metadata: Metadata = { title: "Incidentes" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** VD-46I (caso 62): lo que pasó en la sala, sin diagnóstico. Todo el equipo anota; el dueño y el encargado ven todos. */
export default async function Incidentes({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "incidentes");
    const socio = UUID.test(sp.socio ?? "") ? sp.socio! : null;
    const r = await rpc<{ puede_ver_todo: boolean; items: Incidente[] }>("incidentes_panel", { p_gimnasio_id: panel.gimnasio.id, p_socio_id: socio, p_limite: 100 });
    const nombreSocio = socio ? r.items.find((i) => i.socio_id === socio)?.socio_nombre ?? null : null;
    return (
      <div data-incidentes>
        <Encabezado icono="corazon" titulo="Incidentes"
          bajada={r.puede_ver_todo ? "Lo que pasó en la sala: dónde, qué pasó y qué se hizo. Sin diagnósticos. A las 24 horas queda escrito y no cambia." : "Anotá lo que pasó en la sala. Acá ves los que cargaste vos; el dueño y el encargado ven todos."} />
        <div className="space-y-6 max-w-3xl">
          <FormIncidente socioInicial={socio && nombreSocio ? { id: socio, nombre: nombreSocio } : null} />
          {socio && <p className="texto-suave">Solo los de {nombreSocio ?? "este socio"}. <Link href="/panel/incidentes" className="underline">Ver todos</Link></p>}
          {r.items.length === 0 ? (
            <Vacio icono="hoja" titulo="Todavía no hay incidentes anotados">
              Si alguien se cae, se marea o se rompe algo en la sala, anotalo acá: dónde, qué pasó y qué se hizo. Queda escrito con tu nombre y la hora.
            </Vacio>
          ) : (
            <ul className="space-y-3" data-lista-incidentes={r.items.length}>
              {r.items.map((i) => <TarjetaIncidente key={i.id} i={i} zona={panel.gimnasio.zona_horaria} />)}
            </ul>
          )}
        </div>
      </div>
    );
  });
}
