"use server";
import { revalidatePath } from "next/cache";
import { leerMonto } from "@/lib/formato";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

const listo = () => { revalidatePath("/panel/planes"); return {}; };
const MAL_MONTO = "No entiendo el precio: escribilo como 84.500 o 84500,50";

export async function crearPlan(_: { error?: string }, f: FormData): Promise<{ error?: string; ok?: number }> {
  const panel = await contextoPanel();
  const tipo = String(f.get("tipo"));
  const precio = leerMonto(String(f.get("precio") ?? ""));
  if (Number.isNaN(precio)) return { error: MAL_MONTO };
  if (!(precio > 0)) return { error: "Poné el precio" };
  try {
    const id = await rpc<string>("guardar_plan", { p_gimnasio_id: panel.gimnasio.id, p_plan_id: null, p_datos: {
      tipo, nombre: f.get("nombre"), descripcion: f.get("descripcion"),
      duracion_meses: tipo === "membresia" ? Number(f.get("duracion_meses") || 1) : null,
      cantidad_clases: tipo === "pack" ? Number(f.get("cantidad_clases")) : null,
      validez_dias: tipo === "pack" ? Number(f.get("validez_dias") || 60) : null,
      max_ingresos_semana: f.get("max_ingresos_semana") || null,
      hora_desde: f.get("hora_desde") || null, hora_hasta: f.get("hora_hasta") || null,
    } });
    await rpc("programar_precio", { p_plan_id: id, p_monto: precio });
    const mat = String(f.get("matricula") ?? "").trim();
    if (tipo === "membresia" && mat) {
      const m = leerMonto(mat);
      if (Number.isNaN(m)) return { error: `El plan se creó, pero la matrícula no: ${MAL_MONTO}. Ponela desde ✏️ Editar.` };
      await rpc("guardar_matricula_plan", { p_plan_id: id, p_monto: m, p_anual: f.get("matricula_anual") === "on" });
    }
    listo();
    return { ok: Date.now() };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function cambiarPrecio(planId: string, monto: string, desde: string): Promise<{ error?: string }> {
  const n = leerMonto(monto);
  if (Number.isNaN(n)) return { error: MAL_MONTO };
  try { await rpc("programar_precio", { p_plan_id: planId, p_monto: n, p_desde: desde || null }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

/** Solo manda lo que cambia: la base deja como está todo lo demás (0055). */
export async function activarPlan(planId: string, activo: boolean): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("guardar_plan", { p_gimnasio_id: panel.gimnasio.id, p_plan_id: planId, p_datos: { activo } }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

export async function editarPlan(planId: string, datos: { nombre: string; descripcion: string; max_ingresos_semana?: string; hora_desde?: string; hora_hasta?: string },
  actividades?: string[], matricula?: { monto: string; anual: boolean }): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  const m = matricula?.monto.trim() ? leerMonto(matricula.monto) : null;
  if (Number.isNaN(m)) return { error: `Matrícula: ${MAL_MONTO}` };
  try {
    await rpc("guardar_plan", { p_gimnasio_id: panel.gimnasio.id, p_plan_id: planId, p_datos: datos });
    if (actividades) await rpc("guardar_actividades_plan", { p_plan_id: planId, p_actividades: actividades });
    if (matricula) await rpc("guardar_matricula_plan", { p_plan_id: planId, p_monto: m, p_anual: matricula.anual });
    return listo();
  }
  catch (e) { return { error: (e as Error).message }; }
}

export async function guardarProducto(id: string | null, nombre: string, precio: string | number, activo = true): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  const n = typeof precio === "number" ? precio : leerMonto(precio);
  if (Number.isNaN(n)) return { error: MAL_MONTO };
  try { await rpc("guardar_producto", { p_gimnasio_id: panel.gimnasio.id, p_producto_id: id, p_nombre: nombre, p_precio: n, p_activo: activo }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

export type Variante = { medio?: string | null; hasta_dia?: number | null; monto: string | number };

/** Guarda la lista entera (general + más baratos por medio o por día) desde una fecha (PLA-5). */
export async function programarLista(planId: string, general: string, variantes: Variante[], desde: string): Promise<{ error?: string }> {
  const g = leerMonto(general);
  if (Number.isNaN(g)) return { error: MAL_MONTO };
  const vs = [];
  for (const v of variantes) {
    const m = typeof v.monto === "number" ? v.monto : leerMonto(v.monto);
    if (Number.isNaN(m)) return { error: MAL_MONTO };
    vs.push({ medio: v.medio || null, hasta_dia: v.hasta_dia || null, monto: m });
  }
  try { await rpc("programar_lista_precios", { p_plan_id: planId, p_general: g, p_variantes: vs, p_desde: desde || null }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

export async function anularProgramado(planId: string, desde: string): Promise<{ error?: string }> {
  try { await rpc("anular_precio_programado", { p_plan_id: planId, p_desde: desde }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

export type Aumento = { planes: string[]; tipo: "porcentaje" | "monto"; valor: string; redondeo: number; desde: string };
export type VistaAumento = { desde: string; planes: { plan_id: string; nombre: string; tipo: string; socios: number; antes: number | null; nuevo: number | null;
  variantes: { medio: string | null; hasta_dia: number | null; antes: number; monto: number }[]; problema: string | null; despues: string | null }[] };

const argsAumento = (g: string, a: Aumento) => {
  const v = leerMonto(a.valor.replace("%", ""));
  if (Number.isNaN(v)) throw new Error(a.tipo === "porcentaje" ? "Escribí el porcentaje, por ejemplo 10 o 12,5" : MAL_MONTO);
  return { p_gimnasio_id: g, p_planes: a.planes, p_tipo: a.tipo, p_valor: v, p_redondeo: a.redondeo, p_desde: a.desde || null };
};

/** La vista previa y el aplicar usan la misma cuenta en la base (PLA-4). */
export async function vistaAumento(a: Aumento): Promise<{ error?: string; vista?: VistaAumento }> {
  const panel = await contextoPanel();
  try { return { vista: await rpc<VistaAumento>("vista_aumento", argsAumento(panel.gimnasio.id, a)) }; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function aplicarAumento(a: Aumento): Promise<{ error?: string; n?: number }> {
  const panel = await contextoPanel();
  try { const n = await rpc<number>("aplicar_aumento", argsAumento(panel.gimnasio.id, a)); listo(); revalidatePath("/panel/planes/aumento"); return { n }; }
  catch (e) { return { error: (e as Error).message }; }
}
