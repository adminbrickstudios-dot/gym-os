import "server-only";
import { headers } from "next/headers";
import { dominioPlataforma } from "@/lib/dominios";
import { normalizarHost } from "@/lib/host";
import { rutaGimnasio } from "@/lib/urls";

/**
 * H3: la raíz de la página del gimnasio DESDE la dirección que está usando la persona. En su propia dirección es "/"; desde la
 * dirección de la plataforma (/g/<slug>/…) es "/g/<slug>": un "/" a secas llevaría a la página de venta de la plataforma.
 * Las direcciones se arman con src/lib/urls.ts.
 */
export async function raizDelGimnasio(): Promise<string> {
  const h = await headers();
  const slug = h.get("x-gimnasio-slug");
  const pedido = normalizarHost(h.get("x-forwarded-host") ?? h.get("host"));
  if (slug && pedido && pedido === dominioPlataforma()) return rutaGimnasio(slug);
  return "/";
}
