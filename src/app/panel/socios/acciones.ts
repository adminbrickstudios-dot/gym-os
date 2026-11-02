"use server";
import { revalidatePath } from "next/cache";
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
  try {
    const id = await rpc<string>("guardar_socio", { p_gimnasio_id: panel.gimnasio.id, p_socio_id: socioId, p_datos: datos });
    revalidatePath("/panel/socios");
    return { destino: `/panel/socios/${id}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
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
