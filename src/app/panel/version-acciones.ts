"use server";
import { contextoPanel } from "@/lib/panel/servidor";
import { versionDe, type TablaVersion } from "@/lib/panel/version";

/** VD-34: la versión de lo que se está por editar, para avisar si otro lo cambia mientras tanto. */
export async function versionRegistro(tabla: TablaVersion, id: string): Promise<string | null> {
  const panel = await contextoPanel();
  return versionDe(panel.gimnasio.id, tabla, tabla === "configuracion" ? panel.gimnasio.id : id);
}
