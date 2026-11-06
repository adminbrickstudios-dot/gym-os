import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirSeccion, rpc } from "@/lib/panel/servidor";
import type { GradosPanel } from "@/lib/clases/grados";
import { FilaListo, GradosActividad } from "./Grados";

export const metadata: Metadata = { title: "Grados" };

/** COM-13: grados y cinturones por actividad, y los socios listos para rendir el próximo. */
export default async function PaginaGrados() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "clases");
    const p = await rpc<GradosPanel>("grados_panel", { p_gimnasio_id: panel.gimnasio.id });
    const edita = ["dueno", "encargado"].includes(panel.yo.rol);
    const otorga = edita || panel.yo.rol === "profe";
    const conGrados = p.actividades.filter((a) => a.grados.length);
    return (
      <>
        <Encabezado emoji="🥋" titulo="Grados" volver={{ href: "/panel/clases", texto: "Clases" }} volverAlOrigen
          bajada="Para artes marciales: los cinturones de cada actividad, lo que pide cada uno y quién está listo para rendir." />
        {conGrados.length > 0 && (
          <section className="mb-10" aria-labelledby="listos">
            <h2 id="listos" className="titulo text-2xl mb-1">✅ Listos para rendir</h2>
            <p className="texto-suave mb-3">Cumplen las clases y el tiempo desde su grado actual (o desde su primera clase).</p>
            {p.listos.length === 0 ? <p className="texto-suave">Nadie todavía.</p>
              : <ul className="space-y-2">{p.listos.map((l) => <FilaListo key={`${l.socio_id}-${l.actividad_id}`} l={l} puedeOtorgar={otorga} />)}</ul>}
          </section>
        )}
        <h2 className="titulo text-2xl mb-3">Grados por actividad</h2>
        {p.actividades.length === 0 ? <Vacio emoji="🥋" titulo="No hay actividades">Primero cargá las actividades en la grilla de clases.</Vacio>
          : conGrados.length === 0 && !edita ? <Vacio emoji="🥋" titulo="Este gimnasio no usa grados">Los arma el dueño o el encargado.</Vacio>
          : p.actividades.map((a) => <GradosActividad key={a.actividad_id} a={a} puedeEditar={edita} />)}
      </>
    );
  });
}
