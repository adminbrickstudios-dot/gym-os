import "server-only";
import { normalizarCobroDebito, type AdhesionMP, type CobroDebitoMP } from "@/lib/mp-debito-procesar";

/**
 * N1 · Lo mínimo de la API de suscripciones de MercadoPago que necesita el aviso (webhook) del débito automático: leer el cobro y leer la
 * suscripción, con el token del gimnasio. La base de la API se cambia con MP_API_URL para probar con el simulador local
 * (scripts/local/mp-simulado.mjs). 🔌 Sin credenciales reales esto no se probó contra MercadoPago: ver docs/base/DEBITO-AUTOMATICO.md.
 */
const API = () => (process.env.MP_API_URL ?? "https://api.mercadopago.com").replace(/\/$/, "");

async function pedir(token: string, ruta: string): Promise<Record<string, unknown>> {
  const r = await fetch(`${API()}${ruta}`, { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, cache: "no-store" });
  const cuerpo = await r.text();
  if (!r.ok) throw new Error(`MercadoPago respondió ${r.status} en ${ruta}: ${cuerpo.slice(0, 200)}`);
  return JSON.parse(cuerpo) as Record<string, unknown>;
}

export async function leerCobroDebito(token: string, id: string): Promise<CobroDebitoMP> {
  return normalizarCobroDebito(await pedir(token, `/authorized_payments/${encodeURIComponent(id)}`));
}

export async function leerAdhesionDebito(token: string, id: string): Promise<AdhesionMP> {
  const raw = await pedir(token, `/preapproval/${encodeURIComponent(id)}`);
  if (!raw.id || !raw.status) throw new Error("La suscripción de MercadoPago no trae su estado");
  return { suscripcionId: String(raw.id), estado: String(raw.status) };
}
