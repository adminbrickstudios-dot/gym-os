"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

const num = (s: FormDataEntryValue | null) => Number(String(s ?? "").replace(/\./g, "").replace(",", "."));
const listo = () => { revalidatePath("/panel/planes"); return {}; };

export async function crearPlan(_: { error?: string }, f: FormData): Promise<{ error?: string; ok?: number }> {
  const panel = await contextoPanel();
  const tipo = String(f.get("tipo"));
  const precio = num(f.get("precio"));
  if (!(precio > 0)) return { error: "Poné el precio" };
  try {
    const id = await rpc<string>("guardar_plan", { p_gimnasio_id: panel.gimnasio.id, p_plan_id: null, p_datos: {
      tipo, nombre: f.get("nombre"), descripcion: f.get("descripcion"),
      duracion_meses: tipo === "membresia" ? Number(f.get("duracion_meses") || 1) : null,
      cantidad_clases: tipo === "pack" ? Number(f.get("cantidad_clases")) : null,
      validez_dias: tipo === "pack" ? Number(f.get("validez_dias") || 60) : null,
      max_ingresos_semana: f.get("max_ingresos_semana") || null,
    } });
    await rpc("programar_precio", { p_plan_id: id, p_monto: precio });
    listo();
    return { ok: Date.now() };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function cambiarPrecio(planId: string, monto: string, desde: string): Promise<{ error?: string }> {
  try { await rpc("programar_precio", { p_plan_id: planId, p_monto: num(monto), p_desde: desde || null }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

export async function activarPlan(planId: string, nombre: string, activo: boolean): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("guardar_plan", { p_gimnasio_id: panel.gimnasio.id, p_plan_id: planId, p_datos: { nombre, activo } }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

export async function guardarProducto(id: string | null, nombre: string, precio: string, activo = true): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("guardar_producto", { p_gimnasio_id: panel.gimnasio.id, p_producto_id: id, p_nombre: nombre, p_precio: num(precio), p_activo: activo }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}
