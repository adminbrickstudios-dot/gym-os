"use server";
import { revalidatePath } from "next/cache";
import { leerMonto } from "@/lib/formato";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { achicarFoto } from "@/lib/imagenes-servidor";

type Resp = { error?: string };
const MAX = 6 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAL = "No entiendo el monto: escribilo como 84.500 o 84500,50";

const hacer = async (f: () => Promise<unknown>): Promise<Resp> => {
  try { await f(); revalidatePath("/panel/gastos"); revalidatePath("/panel/resultado"); return {}; } catch (e) { return { error: (e as Error).message }; }
};

/** Un gasto del día, con la foto del comprobante si hay. La foto va después (la base arma la ruta): si falla, el gasto ya quedó anotado. */
export async function cargarGasto(datos: FormData): Promise<Resp> {
  const monto = leerMonto(String(datos.get("monto") ?? ""));
  if (Number.isNaN(monto)) return { error: MAL };
  if (!(monto > 0)) return { error: "Escribí el monto, por ejemplo 250.000" };
  const foto = datos.get("comprobante");
  const conFoto = foto instanceof Blob && foto.size > 0;
  if (conFoto && (!TIPOS.includes(foto.type) || foto.size > MAX)) return { error: "El comprobante tiene que ser JPG, PNG, WEBP o PDF de hasta 6 MB." };
  try {
    const p = await contextoPanel();
    const id = await rpc<string>("cargar_gasto", {
      p_gimnasio_id: p.gimnasio.id, p_fecha: String(datos.get("fecha") || "") || null, p_categoria: String(datos.get("categoria") ?? ""),
      p_detalle: String(datos.get("detalle") ?? ""), p_monto: monto,
    });
    revalidatePath("/panel/gastos"); revalidatePath("/panel/resultado");
    if (conFoto) {
      let bytes: Uint8Array = new Uint8Array(await foto.arrayBuffer());
      let mime = foto.type;
      if (mime !== "application/pdf") { const a = await achicarFoto(bytes, mime as "image/jpeg" | "image/png" | "image/webp"); bytes = a.bytes; mime = a.mime; }
      const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const ruta = await rpc<string>("preparar_comprobante_gasto", { p_gasto_id: id, p_ext: ext });
      const { clienteServicio } = await import("@/lib/supabase/servicio");
      const { error } = await clienteServicio().storage.from("comprobantes_gastos").upload(ruta, Buffer.from(bytes), { contentType: mime, upsert: false });
      if (error) return { error: `El gasto quedó anotado, pero el comprobante no se pudo subir: ${error.message}` };
      await rpc("confirmar_comprobante_gasto", { p_gasto_id: id, p_ruta: ruta });
    }
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export const anularGasto = async (id: string) => hacer(() => rpc("anular_gasto", { p_gasto_id: id }));

/** Link de 10 minutos al comprobante (la base dice antes si quien lo pide puede verlo). */
export async function verComprobante(id: string): Promise<{ url?: string; error?: string }> {
  try {
    const ruta = await rpc<string | null>("comprobante_gasto", { p_gasto_id: id });
    if (!ruta) return { error: "Ese gasto no tiene comprobante" };
    const { clienteServicio } = await import("@/lib/supabase/servicio");
    const { data, error } = await clienteServicio().storage.from("comprobantes_gastos").createSignedUrl(ruta, 600);
    if (error) return { error: `No se pudo abrir el comprobante: ${error.message}` };
    return { url: data.signedUrl };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function agregarFijo(categoria: string, detalle: string, monto: string, desde: string | null): Promise<Resp> {
  const n = leerMonto(monto);
  if (Number.isNaN(n)) return { error: MAL };
  if (!(n > 0)) return { error: "Escribí el monto, por ejemplo 250.000" };
  return hacer(async () => { const p = await contextoPanel(); await rpc("guardar_gasto_fijo", { p_gimnasio_id: p.gimnasio.id, p_categoria: categoria, p_detalle: detalle, p_monto: n, p_desde: desde }); });
}
/** Deja de contar desde el mes que se está mirando; los meses anteriores no cambian. */
export const terminarFijo = async (id: string, mes: string) => hacer(() => rpc("terminar_gasto_fijo", { p_fijo_id: id, p_desde_mes: mes }));

/** Monto vacío o 0: se saca el presupuesto de esa categoría. */
export async function guardarPresupuesto(categoria: string, monto: string): Promise<Resp> {
  const vacio = !String(monto).trim();
  const n = vacio ? 0 : leerMonto(monto);
  if (Number.isNaN(n)) return { error: MAL };
  return hacer(async () => { const p = await contextoPanel(); await rpc("guardar_presupuesto_gasto", { p_gimnasio_id: p.gimnasio.id, p_categoria: categoria, p_monto: n }); });
}

export async function permitirEncargado(prendido: boolean): Promise<Resp> {
  return hacer(async () => { const p = await contextoPanel(); await rpc("guardar_permiso_gastos", { p_gimnasio_id: p.gimnasio.id, p_prendido: prendido }); });
}
