import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { Equipo, type Miembro } from "./Equipo";
import { Perfiles, type PerfilesDatos } from "./Perfiles";
import { PermisosEquipo, type Permisos } from "./Permisos";

export const metadata: Metadata = { title: "Equipo" };

export default async function PaginaEquipo() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const [miembros, permisos, perfiles] = await Promise.all([
      rpc<Miembro[]>("equipo_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Permisos>("permisos_equipo", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<PerfilesDatos>("equipo_perfiles", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    return (
      <>
        <Encabezado emoji="🧑‍🤝‍🧑" titulo="Equipo" bajada="Quién trabaja en el gimnasio y qué puede hacer cada uno."
          accion={(panel.yo.rol === "dueno" || panel.permisos.encargado_ve_resultado) ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/panel/equipo/actividad" className="boton" data-link-actividad>📋 Qué hizo cada uno</Link>
              {!panel.secciones_apagadas.includes("control") && <Link href="/panel/control" className="boton" data-link-control>🛡️ Control</Link>}
            </div>
          ) : undefined} />
        <div className="space-y-10">
          <Equipo miembros={miembros} sedes={panel.sedes} puedeEditar={panel.yo.rol === "dueno"} />
          <Perfiles personas={miembros.filter((m) => m.activo)} datos={perfiles} esDueno={panel.yo.rol === "dueno"} />
          <PermisosEquipo inicial={permisos} puedeEditar={panel.yo.rol === "dueno"} />
        </div>
      </>
    );
  });
}
