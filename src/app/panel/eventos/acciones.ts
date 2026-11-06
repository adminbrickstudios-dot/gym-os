"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

const MAX_FLYER = 6 * 1024 * 1024;
const listo = () => { revalidatePath("/panel/eventos"); revalidatePath("/panel/vender"); };

export type DatosEvento = {
  nombre: string; inicio: string; cupo: number; precio: number; descripcion: string; para: string;
  fin?: string | null; fechasExtra?: string[]; lugar?: string; responsable?: string; precioSocio?: number | null; borrador?: boolean; listaEspera?: boolean;
};

/** COM-8 + VD-19: el evento se crea con su producto y su cupo (la base valida y decide quién puede). Devuelve el id para subir el flyer. */
export async function crearEvento(d: DatosEvento): Promise<{ error?: string; id?: string }> {
  const panel = await contextoPanel();
  try {
    const id = await rpc<string>("crear_evento", {
      p_gimnasio_id: panel.gimnasio.id, p_nombre: d.nombre, p_inicio: d.inicio, p_cupo: d.cupo, p_precio: d.precio, p_descripcion: d.descripcion, p_para: d.para,
      p_fin: d.fin ?? null, p_fechas_extra: d.fechasExtra ?? [], p_lugar: d.lugar ?? null, p_responsable: d.responsable ?? null,
      p_precio_socio: d.precioSocio ?? null, p_borrador: d.borrador ?? false, p_lista_espera: d.listaEspera ?? true,
    });
    listo();
    return { id };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-19: el flyer es la foto del producto del evento (se achica a 800 px y se sube con la clave de servicio; la base confirma la ruta). */
export async function subirFlyerEvento(eventoId: string, f: FormData): Promise<{ error?: string }> {
  const foto = f.get("flyer");
  if (!(foto instanceof Blob) || foto.size === 0) return { error: "Elegí una imagen." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(foto.type) || foto.size > MAX_FLYER) return { error: "El flyer tiene que ser JPG, PNG o WEBP de hasta 6 MB." };
  const panel = await contextoPanel();
  try {
    const eventos = await rpc<{ evento_id: string; producto_id: string }[]>("eventos_panel", { p_gimnasio_id: panel.gimnasio.id });
    const ev = eventos.find((e) => e.evento_id === eventoId);
    if (!ev) return { error: "No encontré ese evento." };
    const { achicarFoto } = await import("@/lib/imagenes-servidor");
    const a = await achicarFoto(new Uint8Array(await foto.arrayBuffer()), foto.type as "image/jpeg" | "image/png" | "image/webp");
    const ext = a.mime === "image/png" ? "png" : a.mime === "image/webp" ? "webp" : "jpg";
    const ruta = await rpc<string>("preparar_foto_producto", { p_producto_id: ev.producto_id, p_ext: ext });
    const { clienteServicio } = await import("@/lib/supabase/servicio");
    const { error } = await clienteServicio().storage.from("fotos_productos").upload(ruta, Buffer.from(a.bytes), { contentType: a.mime, upsert: false });
    if (error) return { error: `No se pudo subir el flyer: ${error.message}` };
    await rpc("confirmar_foto_producto", { p_producto_id: ev.producto_id, p_ruta: ruta });
    listo();
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function publicarEvento(id: string): Promise<{ error?: string }> {
  try { await rpc("publicar_evento", { p_evento_id: id }); listo(); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function cerrarEvento(id: string): Promise<{ error?: string }> {
  try { await rpc("cerrar_evento", { p_evento_id: id }); listo(); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Check-in del día (desde la lista del evento; la Entrada usa la misma función). */
export async function marcarPresente(eventoId: string, quien: { socioId?: string | null; inscripcionId?: string | null }, quitar = false): Promise<{ error?: string }> {
  try {
    await rpc(quitar ? "evento_quitar_presente" : "evento_marcar_presente", { p_evento_id: eventoId, p_socio_id: quien.socioId ?? null, p_inscripcion_id: quien.inscripcionId ?? null });
    revalidatePath("/panel/eventos");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
