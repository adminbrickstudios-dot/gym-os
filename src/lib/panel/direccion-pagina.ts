import "server-only";
import { headers } from "next/headers";
import { clasificarHost } from "@/lib/host";
import { dominioBase, dominioPlataforma } from "@/lib/dominios";
import { origenDe, rutaGimnasio } from "@/lib/urls";

/** La dirección de la página del gimnasio, vista desde donde está abierto el panel. */
export async function direccionPagina(slug: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const enPlataforma = clasificarHost(host, dominioBase(), dominioPlataforma()).tipo === "plataforma";
  const origen = origenDe(h);
  return enPlataforma ? `${origen}${rutaGimnasio(slug)}` : `${origen}/`;
}
