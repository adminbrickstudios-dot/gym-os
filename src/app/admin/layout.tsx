import { headers } from "next/headers";
import { rpc } from "@/lib/panel/servidor";
import { EquipoNuevo } from "./EquipoNuevo";
import { Paleta, type GimnasioPaleta } from "./Paleta";

/** El super admin: sobre cada pantalla vive la paleta de Ctrl+K (gimnasios, personas y acciones). Sin acceso, no se arma. */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  let gimnasios: GimnasioPaleta[] = [];
  if ((await headers()).get("x-gymos-contexto") === "plataforma") {
    gimnasios = await rpc<{ gimnasio_id: string; nombre: string; slug: string }[]>("admin_gimnasios")
      .then((l) => l.map((g) => ({ id: g.gimnasio_id, nombre: g.nombre, slug: g.slug })))
      .catch(() => []);
  }
  return (<>{gimnasios.length > 0 && <Paleta gimnasios={gimnasios} />}{gimnasios.length > 0 && <EquipoNuevo />}{children}</>);
}
