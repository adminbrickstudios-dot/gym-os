"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type EstadoForm = { error?: string; destino?: string };

const CAMPOS = ["nombre", "apellido", "dni", "telefono", "email", "fecha_nacimiento", "contacto_emergencia_nombre", "contacto_emergencia_telefono", "notas"] as const;

export async function guardarSocio(socioId: string | null, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const panel = await contextoPanel();
  const datos = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "").trim()]));
  // Los teléfonos van como los escribió (387 15 555-1234, 011…): los normaliza la base.
  const prospecto = socioId ? "" : String(form.get("prospecto") ?? "");
  let id: string;
  try {
    id = await rpc<string>("guardar_socio", { p_gimnasio_id: panel.gimnasio.id, p_socio_id: socioId, p_datos: datos });
    if (prospecto) {
      await rpc("prospecto_es_socio", { p_gimnasio_id: panel.gimnasio.id, p_prospecto_id: prospecto, p_socio_id: id });
      revalidatePath("/panel/prospectos");
    }
    revalidatePath("/panel/socios");
  } catch (e) {
    return { error: (e as Error).message };
  }
  // Desde un prospecto se va directo a la ficha desde el servidor: la página del alta
  // ya no sirve (el prospecto pasó a socio) y volver a dibujarla daría error.
  if (prospecto) redirect(`/panel/socios/${id}`);
  return { destino: `/panel/socios/${id}` };
}

export async function asignarPlan(socioId: string, planId: string, cambiar: boolean): Promise<{ error?: string }> {
  try {
    await rpc(cambiar ? "cambiar_plan" : "asignar_plan", { p_socio_id: socioId, p_plan_id: planId });
    revalidatePath(`/panel/socios/${socioId}`);
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function darDeBaja(socioId: string, motivo: string): Promise<{ error?: string }> {
  try {
    await rpc("dar_de_baja", { p_socio_id: socioId, p_motivo: motivo });
    revalidatePath(`/panel/socios/${socioId}`);
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** Un socio dado de baja que vuelve: se borra la baja (queda en el historial) y después se le asigna plan. */
export async function volverADarDeAlta(socioId: string): Promise<{ error?: string }> {
  try {
    await rpc("volver_a_dar_de_alta", { p_socio_id: socioId });
    revalidatePath(`/panel/socios/${socioId}`);
    revalidatePath("/panel/socios");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Notas y etiquetas (SOC-3) ───────────────────────────────────────
async function hacer(socioId: string, fn: () => Promise<unknown>): Promise<{ error?: string }> {
  try { await fn(); revalidatePath(`/panel/socios/${socioId}`); revalidatePath("/panel/socios"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
export async function agregarNota(socioId: string, texto: string) { return hacer(socioId, () => rpc("agregar_nota", { p_socio_id: socioId, p_texto: texto })); }
export async function borrarNota(socioId: string, notaId: string) { return hacer(socioId, () => rpc("borrar_nota", { p_nota_id: notaId })); }
export async function ponerEtiqueta(socioId: string, nombre: string) { return hacer(socioId, () => rpc("poner_etiqueta", { p_socio_id: socioId, p_nombre: nombre })); }
export async function sacarEtiqueta(socioId: string, etiquetaId: string) { return hacer(socioId, () => rpc("sacar_etiqueta", { p_socio_id: socioId, p_etiqueta_id: etiquetaId })); }

// ── Foto (SOC-7) ────────────────────────────────────────────────────
// La base arma la ruta y la confirma; el servidor sube con la clave de servicio
// (el bucket es privado y nadie sube con su sesión) y borra la foto anterior.
export async function guardarFoto(socioId: string, form: FormData): Promise<{ error?: string }> {
  const archivo = form.get("foto");
  if (!(archivo instanceof Blob) || archivo.size === 0) return { error: "No llegó la foto." };
  if (archivo.type !== "image/jpeg" || archivo.size > 512 * 1024) return { error: "La foto tiene que ser JPG de hasta 512 KB." };
  try {
    const ruta = await rpc<string>("preparar_foto_socio", { p_socio_id: socioId });
    const { clienteServicio } = await import("@/lib/supabase/servicio");
    const sb = clienteServicio().storage.from("fotos_socios");
    const { error } = await sb.upload(ruta, Buffer.from(await archivo.arrayBuffer()), { contentType: "image/jpeg", upsert: false });
    if (error) return { error: `No se pudo subir la foto: ${error.message}` };
    const anterior = await rpc<string | null>("confirmar_foto_socio", { p_socio_id: socioId, p_ruta: ruta });
    if (anterior) await sb.remove([anterior]);
    revalidatePath(`/panel/socios/${socioId}`);
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function quitarFoto(socioId: string): Promise<{ error?: string }> {
  try {
    const anterior = await rpc<string | null>("confirmar_foto_socio", { p_socio_id: socioId, p_ruta: null });
    if (anterior) {
      const { clienteServicio } = await import("@/lib/supabase/servicio");
      await clienteServicio().storage.from("fotos_socios").remove([anterior]);
    }
    revalidatePath(`/panel/socios/${socioId}`);
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Grupo familiar (SOC-5) ──────────────────────────────────────────
export async function vincularFamilia(socioId: string, otroId: string) { return hacer(socioId, async () => { await rpc("vincular_familia", { p_socio_id: socioId, p_otro_id: otroId }); revalidatePath(`/panel/socios/${otroId}`); }); }
export async function sacarDeFamilia(socioId: string, quienId: string) { return hacer(socioId, async () => { await rpc("sacar_de_familia", { p_socio_id: quienId }); revalidatePath(`/panel/socios/${quienId}`); }); }

// ── Pausas (SOC-9) ──────────────────────────────────────────────────
// El dueño o el encargado la dan; la recepción la pide. La base decide quién puede.
export async function darPausa(socioId: string, suscripcionId: string, desde: string, vuelve: string, motivo: string, nota: string) {
  return hacer(socioId, async () => { await rpc("congelar", { p_suscripcion_id: suscripcionId, p_desde: desde, p_hasta: vuelve, p_categoria: motivo, p_nota: nota || null }); revalidatePath("/panel"); });
}
export async function pedirPausa(socioId: string, suscripcionId: string, desde: string, vuelve: string, motivo: string, nota: string) {
  return hacer(socioId, async () => { await rpc("pedir_pausa", { p_suscripcion_id: suscripcionId, p_desde: desde, p_hasta: vuelve, p_categoria: motivo, p_nota: nota || null }); revalidatePath("/panel"); });
}
export async function resolverPedidoPausa(socioId: string, pedidoId: string, aprobar: boolean) {
  return hacer(socioId, async () => { await rpc("resolver_pedido_pausa", { p_pedido_id: pedidoId, p_aprobar: aprobar }); revalidatePath("/panel"); });
}
export async function volvioAntes(socioId: string, pausaId: string) { return hacer(socioId, () => rpc("descongelar", { p_congelamiento_id: pausaId })); }
export async function anularPausa(socioId: string, pausaId: string, motivo: string) { return hacer(socioId, () => rpc("anular_congelamiento", { p_congelamiento_id: pausaId, p_motivo: motivo })); }
