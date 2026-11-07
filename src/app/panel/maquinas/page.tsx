import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { AltaMaquina, TarjetaMaquina, type DatosMaquinas } from "./Maquinas";

export const metadata: Metadata = { title: "Máquinas" };

/** VD-54 (casos 58-59): qué máquina está fuera de servicio, por qué, quién la arregla y su historial. */
export default async function Maquinas() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "maquinas");
    const r = await rpc<DatosMaquinas>("maquinas_panel", { p_gimnasio_id: panel.gimnasio.id });
    const fuera = r.maquinas.filter((m) => m.estado === "fuera_de_servicio");
    const activas = r.maquinas.filter((m) => m.activa);
    const bajas = r.maquinas.filter((m) => !m.activa);
    const variasSedes = r.sedes.length > 1;
    return (
      <div data-maquinas>
        <Encabezado emoji="🛠️" titulo="Máquinas"
          bajada={r.puede_gestionar ? "Marcá lo que está fuera de servicio, asigná quién la arregla y cerrá la falla cuando vuelve. Todo queda en el historial." : "Si una máquina está rota, marcala: el encargado ve el aviso y la arregla."} />
        <div className="space-y-6 max-w-3xl">
          {fuera.length > 0 && (
            <p className="mensaje mensaje-aviso" data-fuera-de-servicio={fuera.length}>
              <span aria-hidden>🟡</span> <span>Fuera de servicio hoy: {fuera.map((m) => m.nombre).join(", ")}</span>
            </p>
          )}
          {r.puede_gestionar && <AltaMaquina sedes={r.sedes} />}
          {activas.length === 0 ? (
            <Vacio emoji="🏋️" titulo="Todavía no hay máquinas cargadas">
              {r.puede_gestionar ? "Cargá las máquinas del gimnasio (la prensa, la cinta, el remo…) y desde acá se marca cuál está rota." : "El dueño o el encargado tienen que cargar las máquinas."}
            </Vacio>
          ) : (
            <ul className="space-y-3" data-lista-maquinas={activas.length}>
              {activas.map((m) => <TarjetaMaquina key={m.maquina_id} m={m} datos={r} zona={panel.gimnasio.zona_horaria} mostrarSede={variasSedes} />)}
            </ul>
          )}
          {bajas.length > 0 && (
            <details className="tarjeta p-4">
              <summary className="cursor-pointer font-semibold">Máquinas dadas de baja ({bajas.length})</summary>
              <ul className="space-y-3 mt-3">
                {bajas.map((m) => <TarjetaMaquina key={m.maquina_id} m={m} datos={r} zona={panel.gimnasio.zona_horaria} mostrarSede={variasSedes} />)}
              </ul>
            </details>
          )}
        </div>
      </div>
    );
  });
}
