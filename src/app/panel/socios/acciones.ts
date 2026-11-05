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
