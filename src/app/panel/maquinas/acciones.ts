"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { achicarFoto } from "@/lib/imagenes-servidor";

type Resp = { error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_FOTO = 6 * 1024 * 1024;

export type FallaHistorial = {
  falla_id: string; motivo: string; reportada_en: string; reportada_por: string; tiene_foto: boolean; responsable: string | null;
  arreglada_en: string | null; arreglada_por: string | null; nota_arreglo: string | null; dias_fuera: number | null;
};

/** La foto es opcional y va después: la base arma la ruta, el servidor sube, la base confirma. Si falla, la falla ya quedó anotada. */
async function subirFoto(fallaId: string, foto: FormData | null | undefined): Promise<string | null> {
  const f = foto?.get("foto");
  if (!(f instanceof Blob) || f.size === 0) return null;
  if (!TIPOS.includes(f.type) || f.size > MAX_FOTO) return "La foto tiene que ser JPG, PNG o WEBP de hasta 6 MB.";
  const a = await achicarFoto(new Uint8Array(await f.arrayBuffer()), f.type as "image/jpeg" | "image/png" | "image/webp");
  const ext = a.mime === "image/png" ? "png" : a.mime === "image/webp" ? "webp" : "jpg";
  const ruta = await rpc<string>("preparar_foto_falla", { p_falla_id: fallaId, p_ext: ext });
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { error } = await clienteServicio().storage.from("fotos_maquinas").upload(ruta, Buffer.from(a.bytes), { contentType: a.mime, upsert: false });
  if (error) return `La falla quedó anotada, pero la foto no se pudo subir: ${error.message}`;
  await rpc("confirmar_foto_falla", { p_falla_id: fallaId, p_ruta: ruta });
  return null;
}

export async function crearMaquina(sedeId: string, nombre: string): Promise<Resp> {
  const panel = await contextoPanel();
  try {
    await rpc("crear_maquina", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sedeId, p_nombre: nombre });
    revalidatePath("/panel/maquinas");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function darDeBajaMaquina(maquinaId: string, activa: boolean): Promise<Resp> {
  try {
    await rpc("dar_de_baja_maquina", { p_maquina_id: maquinaId, p_activa: activa });
    revalidatePath("/panel/maquinas");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function reportarFalla(maquinaId: string, motivo: string, responsableId: string | null, foto?: FormData | null): Promise<Resp> {
  try {
    const id = await rpc<string>("reportar_falla", { p_maquina_id: maquinaId, p_motivo: motivo, p_responsable_id: responsableId && UUID.test(responsableId) ? responsableId : null });
    revalidatePath("/panel/maquinas"); revalidatePath("/panel");
    const e = await subirFoto(id, foto);
    return e ? { error: e } : {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** Si se olvidaron la foto al reportar: se suma después (una sola vez). */
export async function sumarFotoFalla(fallaId: string, foto: FormData): Promise<Resp> {
  try {
    const e = await subirFoto(fallaId, foto);
    if (e) return { error: e };
    revalidatePath("/panel/maquinas");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function asignarResponsable(fallaId: string, responsableId: string | null): Promise<Resp> {
  try {
    await rpc("asignar_responsable_falla", { p_falla_id: fallaId, p_responsable_id: responsableId && UUID.test(responsableId) ? responsableId : null });
    revalidatePath("/panel/maquinas"); revalidatePath("/panel");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function arreglarFalla(fallaId: string, nota: string): Promise<Resp> {
  try {
    await rpc("arreglar_falla", { p_falla_id: fallaId, p_nota: nota.trim() || null });
    revalidatePath("/panel/maquinas"); revalidatePath("/panel");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** Link de 10 minutos a la foto (la base dice antes si quien la pide es del equipo y la sección está prendida). */
export async function verFotoFalla(fallaId: string): Promise<{ url?: string; error?: string }> {
  try {
    const ruta = await rpc<string | null>("foto_falla", { p_falla_id: fallaId });
    if (!ruta) return { error: "Esa falla no tiene foto" };
    const { clienteServicio } = await import("@/lib/supabase/servicio");
    const { data, error } = await clienteServicio().storage.from("fotos_maquinas").createSignedUrl(ruta, 600);
    if (error) return { error: `No se pudo abrir la foto: ${error.message}` };
    return { url: data.signedUrl };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function historialMaquina(maquinaId: string): Promise<{ fallas?: FallaHistorial[]; error?: string }> {
  try {
    const r = await rpc<{ fallas: FallaHistorial[] }>("historial_maquina", { p_maquina_id: maquinaId });
    return { fallas: r.fallas };
  } catch (e) { return { error: (e as Error).message }; }
}
