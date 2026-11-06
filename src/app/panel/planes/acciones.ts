"use server";
import { revalidatePath } from "next/cache";
import { leerMonto } from "@/lib/formato";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { conflictoDe } from "@/lib/panel/version";

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
  actividades?: string[], matricula?: { monto: string; anual: boolean }, version?: string | null): Promise<{ error?: string; version?: string }> {
  const panel = await contextoPanel();
  const m = matricula?.monto.trim() ? leerMonto(matricula.monto) : null;
  if (Number.isNaN(m)) return { error: `Matrícula: ${MAL_MONTO}` };
  const choque = await conflictoDe(panel.gimnasio.id, "planes", planId, version);
  if (choque) return choque;
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

export type Aumento = { planes: string[]; tipo: "porcentaje" | "monto"; valor: string; redondeo: number; desde: string; motivo?: string };
export type VistaAumento = { desde: string; planes: { plan_id: string; nombre: string; tipo: string; socios: number; antes: number | null; nuevo: number | null;
  variantes: { medio: string | null; hasta_dia: number | null; antes: number; monto: number }[]; problema: string | null; despues: string | null }[] };

const argsAumento = (g: string, a: Aumento) => {
  const v = leerMonto(a.valor.replace("%", ""));
  if (Number.isNaN(v)) throw new Error(a.tipo === "porcentaje" ? "Escribí el porcentaje, por ejemplo 10 o 12,5" : MAL_MONTO);
  return { p_gimnasio_id: g, p_planes: a.planes, p_tipo: a.tipo, p_valor: v, p_redondeo: a.redondeo, p_desde: a.desde || null, p_motivo_sin_aviso: a.motivo?.trim() || null };
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

export type AvisoPrevio = { aviso_dias: number; dias_de_aviso: number; cumple: boolean; fecha_minima: string; socios_a_avisar: number; puede_excepcion: boolean };
export type AumentoHecho = { id: string; creado_en: string; vigente_desde: string; tipo: string; valor: number; aviso_dias_reales: number; aviso_dias_exigido: number;
  excepcion_motivo: string | null; por: string; por_rol: string; planes: string[]; avisados: number; vistos: number };

/** VD-46D: cuántos días de aviso lleva este aumento y a cuántos socios les va a llegar el aviso. */
export async function avisoPrevioAumento(planes: string[], desde: string): Promise<{ error?: string; aviso?: AvisoPrevio }> {
  const panel = await contextoPanel();
  try { return { aviso: await rpc<AvisoPrevio>("aviso_previo_aumento", { p_gimnasio_id: panel.gimnasio.id, p_planes: planes, p_desde: desde || null }) }; }
  catch (e) { return { error: (e as Error).message }; }
}

/** VD-46D: cuántos días de aviso exige el gimnasio (solo el dueño lo cambia). */
export async function guardarAvisoDias(dias: string): Promise<{ error?: string; dias?: number }> {
  const panel = await contextoPanel();
  const n = Number(dias);
  if (!Number.isInteger(n)) return { error: "Escribí un número de días, por ejemplo 30" };
  try { const r = await rpc<number>("guardar_config_aumento", { p_gimnasio_id: panel.gimnasio.id, p_dias: n }); revalidatePath("/panel/planes/aumento"); return { dias: r }; }
  catch (e) { return { error: (e as Error).message }; }
}

export type Stock = { controla: boolean; stock: number; minimo: number | null; negativo?: boolean };

/** VEN-4: prender/apagar el stock de un producto; al prenderlo, se cuenta lo que hay. */
export async function configurarStock(productoId: string, controla: boolean, minimo: string, contado?: string): Promise<{ error?: string }> {
  const m = minimo.trim() === "" ? null : Number(minimo);
  if (m != null && !Number.isInteger(m)) return { error: "Avisar desde: un número entero (vacío = no avisar)" };
  const c = contado?.trim() ? Number(contado) : null;
  if (controla && contado !== undefined && (c == null || !Number.isInteger(c))) return { error: "Contá cuántos hay ahora (un número entero)" };
  try {
    await rpc("configurar_stock", { p_producto_id: productoId, p_controla: controla, p_minimo: m });
    if (controla && c != null) await rpc("contar_stock", { p_producto_id: productoId, p_contado: c });
    return listo();
  } catch (e) { return { error: (e as Error).message }; }
}

export async function moverStock(productoId: string, tipo: "entrada" | "conteo", cantidad: string, motivo = ""): Promise<{ error?: string }> {
  const n = Number(cantidad);
  if (!cantidad.trim() || !Number.isInteger(n)) return { error: "Un número entero" };
  try {
    await rpc(tipo === "entrada" ? "entrada_stock" : "contar_stock", tipo === "entrada"
      ? { p_producto_id: productoId, p_cantidad: n, p_motivo: motivo || null } : { p_producto_id: productoId, p_contado: n });
    return listo();
  } catch (e) { return { error: (e as Error).message }; }
}

export type Convenio = { convenio_id: string; nombre: string; tipo: "porcentaje" | "monto"; valor: number; activo: boolean; socios: number };

/** VEN-3: crear o editar un convenio (dueño y encargado). */
export async function guardarConvenio(id: string | null, nombre: string, tipo: string, valor: string, activo = true): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  const v = leerMonto(valor.replace("%", ""));
  if (Number.isNaN(v)) return { error: tipo === "porcentaje" ? "Escribí el porcentaje, por ejemplo 15" : MAL_MONTO };
  try { await rpc("guardar_convenio", { p_gimnasio_id: panel.gimnasio.id, p_convenio_id: id, p_nombre: nombre, p_tipo: tipo, p_valor: v, p_activo: activo }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

// ── VD-17 · Planes y servicios ─────────────────────────────────────────

export type AjustesPlan = {
  usa_regla_gimnasio: boolean; renovacion: string | null; dia_fijo: number | null; renovacion_propia: string | null; dia_fijo_propio: number | null;
  tolerancia_dias: number | null; consume_en: string | null; visible_en_landing: boolean; todas_las_sedes: boolean; sedes: string[];
};
export type AjustesPlanes = {
  regla_gimnasio: { renovacion: string; dia_fijo: number | null } | null; tolerancia_gimnasio: number | null;
  sedes: { sede_id: string; nombre: string }[]; planes: Record<string, AjustesPlan>;
};
export type Servicio = { producto_id: string; nombre: string; precio: number; activo: boolean; socios: { socio_id: string; nombre: string }[] };

/** Cómo vence el plan (el suyo o el del gimnasio), tolerancia, consume_en, visible en la página y sedes. Lo valida la base. */
export async function guardarAjustesPlan(planId: string, a: {
  renovacion: "gimnasio" | "continua" | "desde_pago" | "dia_fijo"; diaFijo: string; tolerancia: string; consumeEn?: string;
  visible: boolean; todasLasSedes: boolean; sedes: string[]; esMembresia: boolean; esPack: boolean;
  /** La regla de vencimiento solo la cambia el dueño: si no se tocó, no se manda (el encargado edita lo demás). */
  cambioRegla: boolean;
}): Promise<{ error?: string }> {
  const tol = a.tolerancia.trim();
  if (a.esMembresia && tol !== "" && !/^\d{1,2}$/.test(tol)) return { error: "La tolerancia son días enteros (vacío = la del gimnasio)" };
  try {
    if (a.esMembresia && a.cambioRegla) {
      const dia = Number(a.diaFijo);
      if (a.renovacion === "dia_fijo" && !(Number.isInteger(dia) && dia >= 1 && dia <= 28)) return { error: "Con día fijo, elegí el día (del 1 al 28)" };
      await rpc("guardar_regla_plan", {
        p_plan_id: planId, p_usa_gimnasio: a.renovacion === "gimnasio",
        p_renovacion: a.renovacion === "gimnasio" ? null : a.renovacion, p_dia_fijo: a.renovacion === "dia_fijo" ? dia : null,
      });
    }
    await rpc("guardar_ajustes_plan", { p_plan_id: planId, p_datos: {
      ...(a.esMembresia ? { tolerancia_dias: tol === "" ? null : Number(tol) } : {}),
      ...(a.esPack && a.consumeEn ? { consume_en: a.consumeEn } : {}),
      visible_en_landing: a.visible, todas_las_sedes: a.todasLasSedes, sedes: a.todasLasSedes ? [] : a.sedes,
    } });
    return listo();
  } catch (e) { return { error: (e as Error).message }; }
}

/** El orden en que se ofrecen los planes (alta, página): la lista entera, en su orden nuevo. */
export async function ordenarPlanes(ids: string[]): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("ordenar_planes", { p_gimnasio_id: panel.gimnasio.id, p_ids: ids }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

export async function guardarServicio(id: string | null, nombre: string, precio: string | number, activo = true): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  const n = typeof precio === "number" ? precio : leerMonto(precio);
  if (Number.isNaN(n)) return { error: MAL_MONTO };
  try { await rpc("guardar_servicio", { p_gimnasio_id: panel.gimnasio.id, p_producto_id: id, p_nombre: nombre, p_precio: n, p_activo: activo }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

// ── VD-18 · Productos y stock ──────────────────────────────────────────

export type Movimiento = { id: string; fecha: string; cantidad: number; tipo: "entrada" | "conteo"; motivo: string | null; por: string; remito: boolean };
const MAX_FOTO = 6 * 1024 * 1024;

/** Costo, categoría y si se puede vender sin stock. Vacío = sin costo / sin categoría. */
export async function guardarFichaProducto(productoId: string, d: { costo?: string; categoria?: string; permiteNegativo?: boolean }): Promise<{ error?: string }> {
  const datos: Record<string, unknown> = {};
  if (d.costo !== undefined) {
    const c = d.costo.trim() === "" ? null : leerMonto(d.costo);
    if (Number.isNaN(c)) return { error: `Costo: ${MAL_MONTO}` };
    datos.costo = c;
  }
  if (d.categoria !== undefined) datos.categoria = d.categoria.trim() || null;
  if (d.permiteNegativo !== undefined) datos.permite_negativo = d.permiteNegativo;
  try { await rpc("guardar_ficha_producto", { p_producto_id: productoId, p_datos: datos }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

type Imagen = "image/jpeg" | "image/png" | "image/webp";
const extDe = (mime: string) => (mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg");

/** La foto del producto: se achica (VD-47X) y se sube con la clave de servicio; la base arma la ruta y la confirma. */
export async function subirFotoProducto(productoId: string, f: FormData): Promise<{ error?: string }> {
  const foto = f.get("foto");
  if (!(foto instanceof Blob) || foto.size === 0) return { error: "Elegí una foto" };
  if (!["image/jpeg", "image/png", "image/webp"].includes(foto.type) || foto.size > MAX_FOTO) return { error: "La foto tiene que ser JPG, PNG o WEBP de hasta 6 MB." };
  try {
    const { achicarFoto } = await import("@/lib/imagenes-servidor");
    const a = await achicarFoto(new Uint8Array(await foto.arrayBuffer()), foto.type as Imagen);
    const ruta = await rpc<string>("preparar_foto_producto", { p_producto_id: productoId, p_ext: extDe(a.mime) });
    const { clienteServicio } = await import("@/lib/supabase/servicio");
    const { error } = await clienteServicio().storage.from("fotos_productos").upload(ruta, Buffer.from(a.bytes), { contentType: a.mime, upsert: false });
    if (error) return { error: `No se pudo subir la foto: ${error.message}` };
    await rpc("confirmar_foto_producto", { p_producto_id: productoId, p_ruta: ruta });
    return listo();
  } catch (e) { return { error: (e as Error).message }; }
}

export async function quitarFotoProducto(productoId: string): Promise<{ error?: string }> {
  try { await rpc("quitar_foto_producto", { p_producto_id: productoId }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

/** Entró mercadería: la cantidad se anota primero (si la foto del remito falla, la entrada ya quedó). */
export async function entradaMercaderia(productoId: string, f: FormData): Promise<{ error?: string }> {
  const n = Number(String(f.get("cantidad") ?? "").trim());
  if (!String(f.get("cantidad") ?? "").trim() || !Number.isInteger(n)) return { error: "Un número entero" };
  const remito = f.get("remito");
  const conRemito = remito instanceof Blob && remito.size > 0;
  if (conRemito && (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(remito.type) || remito.size > MAX_FOTO)) {
    return { error: "El remito tiene que ser JPG, PNG, WEBP o PDF de hasta 6 MB." };
  }
  try {
    await rpc("entrada_stock", { p_producto_id: productoId, p_cantidad: n, p_motivo: String(f.get("motivo") ?? "").trim() || null });
    listo();
    if (conRemito) {
      let bytes: Uint8Array = new Uint8Array(await remito.arrayBuffer());
      let mime: string = remito.type;
      if (mime !== "application/pdf") {
        const { achicarFoto } = await import("@/lib/imagenes-servidor");
        const a = await achicarFoto(bytes, mime as Imagen); bytes = a.bytes; mime = a.mime;
      }
      const ruta = await rpc<string>("preparar_remito_stock", { p_producto_id: productoId, p_ext: extDe(mime) });
      const { clienteServicio } = await import("@/lib/supabase/servicio");
      const { error } = await clienteServicio().storage.from("remitos_stock").upload(ruta, Buffer.from(bytes), { contentType: mime, upsert: false });
      if (error) return { error: `La mercadería quedó anotada, pero el remito no se pudo subir: ${error.message}` };
      await rpc("confirmar_remito_stock", { p_producto_id: productoId, p_ruta: ruta });
    }
    return listo();
  } catch (e) { return { error: (e as Error).message }; }
}

export async function movimientosDe(productoId: string): Promise<{ movimientos?: Movimiento[]; error?: string }> {
  try { return { movimientos: await rpc<Movimiento[]>("movimientos_stock_producto", { p_producto_id: productoId }) }; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Link de 10 minutos al remito (la base dice antes si quien lo pide puede verlo). */
export async function verRemito(movimientoId: string): Promise<{ url?: string; error?: string }> {
  try {
    const ruta = await rpc<string | null>("remito_stock", { p_movimiento_id: movimientoId });
    if (!ruta) return { error: "Esa entrada no tiene remito" };
    const { clienteServicio } = await import("@/lib/supabase/servicio");
    const { data, error } = await clienteServicio().storage.from("remitos_stock").createSignedUrl(ruta, 600);
    if (error || !data) return { error: "No se pudo abrir el remito" };
    return { url: data.signedUrl };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Asigna o quita un servicio a un socio: desde la próxima cuota se suma solo en Cobrar. */
export async function asignarServicio(socioId: string, productoId: string, asignar: boolean): Promise<{ error?: string }> {
  try { await rpc("asignar_servicio", { p_socio_id: socioId, p_producto_id: productoId, p_asignar: asignar }); revalidatePath(`/panel/socios/${socioId}`); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}
