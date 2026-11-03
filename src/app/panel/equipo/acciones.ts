"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { darAcceso, mailValido } from "@/lib/cuentas";

export type Resultado = { error?: string; aviso?: string; contrasena?: string; email?: string };

/**
 * Agrega a alguien al equipo. Primero la base valida que quien lo pide es el
 * dueño (guardar_equipo con su sesión); recién después el servidor usa la
 * clave de servicio para crear o vincular la cuenta.
 */
export async function agregarPersona(_: Resultado, f: FormData): Promise<Resultado> {
  const panel = await contextoPanel();
  const nombre = String(f.get("nombre") ?? "").trim();
  const rol = String(f.get("rol") ?? "");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const sede = String(f.get("sede") ?? "") || null;
  if (email && !mailValido(email)) return { error: "El mail no es válido" };
  let equipoId: string;
  try {
    equipoId = await rpc<string>("guardar_equipo", { p_gimnasio_id: panel.gimnasio.id, p_equipo_id: null, p_nombre: nombre, p_rol: rol, p_sede_id: sede });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath("/panel/equipo");
  if (!email) return { aviso: `${nombre} quedó en el equipo sin acceso al sistema (aparece en la grilla de clases).` };

  try {
    const { contrasena } = await darAcceso(equipoId, email, nombre);
    return contrasena
      ? { contrasena, email, aviso: `Listo. Pasale a ${nombre} su mail y esta contraseña provisoria; la cambia al entrar.` }
      : { email, aviso: `Listo. ${email} ya tenía cuenta: entra con su contraseña de siempre.` };
  } catch (e) {
    return { error: `${nombre} quedó en el equipo, pero sin acceso: ${(e as Error).message}` };
  }
}

export async function editarPersona(equipoId: string, nombre: string, rol: string, sede: string | null, activo: boolean): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_equipo", { p_gimnasio_id: panel.gimnasio.id, p_equipo_id: equipoId, p_nombre: nombre, p_rol: rol, p_sede_id: sede, p_activo: activo });
    revalidatePath("/panel/equipo");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
