"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";
import { clienteServicio } from "@/lib/supabase/servicio";

/**
 * FA-16 (D57): el socio sube su foto, solo si el gimnasio lo permitió (la base lo decide: apagado por defecto). La base arma
 * la ruta y la confirma; el servidor sube con la clave de servicio (el bucket es privado) y borra la anterior.
 * Queda "sin confirmar" hasta que la recepción la confirma o la reemplaza.
 */
export async function subirMiFoto(socioId: string, form: FormData): Promise<{ error?: string }> {
  const archivo = form.get("foto");
  if (!(archivo instanceof Blob) || archivo.size === 0) return { error: "No llegó la foto." };
  if (archivo.type !== "image/jpeg" || archivo.size > 512 * 1024) return { error: "La foto tiene que ser JPG de hasta 512 KB." };
  try {
    const ruta = await rpc<string>("preparar_foto_propia", { p_socio_id: socioId });
    const sb = clienteServicio().storage.from("fotos_socios");
    const { error } = await sb.upload(ruta, Buffer.from(await archivo.arrayBuffer()), { contentType: "image/jpeg", upsert: false });
    if (error) return { error: `No se pudo subir la foto: ${error.message}` };
    const anterior = await rpc<string | null>("confirmar_foto_propia", { p_socio_id: socioId, p_ruta: ruta });
    if (anterior) await sb.remove([anterior]);
    revalidatePath("/app/yo");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
