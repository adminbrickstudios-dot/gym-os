"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type EstadoForm = { error?: string; destino?: string };

const CAMPOS = ["nombre", "apellido", "dni", "telefono", "email", "fecha_nacimiento", "contacto_emergencia_nombre", "contacto_emergencia_telefono", "notas"] as const;

export async function guardarSocio(socioId: string | null, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const panel = await contextoPanel();
  const datos = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "").trim()]));
  // "387 555-1234" → +54 9 387 555-1234: el gimnasio está en Argentina; si ya trae +, se respeta.
  for (const c of ["telefono", "contacto_emergencia_telefono"] as const) {
    const t = datos[c].replace(/[\s\-()]/g, "");
    if (t && !t.startsWith("+")) datos[c] = `+549${t.replace(/^0/, "").replace(/^549?/, "")}`;
  }
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
