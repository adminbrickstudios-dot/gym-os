"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import { clienteServicio } from "@/lib/supabase/servicio";
import type { Veredicto } from "@/app/panel/entrada/acciones";
import type { Ficha } from "../socios/[id]/tipos";
import type { Cupon, Medio, PreciosVenta } from "./tipos";

export async function preciosPara(sedeId: string, socioId: string | null): Promise<{ precios?: PreciosVenta; error?: string }> {
  const panel = await contextoPanel();
  try {
    const { sede } = sedeActiva(panel, sedeId);
    return { precios: await rpc<PreciosVenta>("precios_venta", { p_sede_id: sede.id, p_socio_id: socioId }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export type Venta = { venta_id: string; total: number; veredicto: Veredicto | null };

export async function cobrar(datos: {
  sedeId: string; socioId: string | null; turnoId: string | null;
  items: Record<string, unknown>[]; pagos: { medio: string; monto: number }[]; claveOperacion?: string;
  /** VD-5: "cobré otro día" (solo dueño o encargado; la base lo exige), con su motivo. */
  cobradoEn?: string; motivoOtroDia?: string;
  /** VD-5: la foto del comprobante de la transferencia (ya subida con `subirComprobanteCobro`). */
  comprobantePath?: string;
}): Promise<{ venta?: Venta; error?: string }> {
  const panel = await contextoPanel();
  try {
    const { sede } = sedeActiva(panel, datos.sedeId);
    const venta = await rpc<Venta>("vender", {
      p_sede_id: sede.id, p_items: datos.items, p_pagos: datos.pagos, p_socio_id: datos.socioId, p_turno_id: datos.turnoId, p_clave_operacion: datos.claveOperacion ?? null,
      ...(datos.cobradoEn ? { p_cobrado_en: datos.cobradoEn, p_motivo_otro_dia: datos.motivoOtroDia ?? null } : {}),
      ...(datos.comprobantePath ? { p_comprobante_path: datos.comprobantePath } : {}),
    });
    revalidatePath("/panel");
    if (datos.socioId) revalidatePath(`/panel/socios/${datos.socioId}`);
    return { venta };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VEN-1: a qué celular y qué texto, armado en la base con el mensaje editable del gimnasio. */
export async function comprobante(ventaId: string): Promise<{ telefono?: string | null; mensaje?: string; error?: string }> {
  try { return await rpc<{ telefono: string | null; mensaje: string }>("comprobante_venta", { p_venta_id: ventaId }); }
  catch (e) { return { error: (e as Error).message }; }
}

/** COM-9: si el código vale hoy (lo dice la base). */
export async function validarCupon(codigo: string): Promise<{ cupon?: Cupon; error?: string }> {
  const panel = await contextoPanel();
  try { return { cupon: await rpc("validar_cupon", { p_gimnasio_id: panel.gimnasio.id, p_codigo: codigo }) }; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Después de cobrar: la venta queda anotada como uso del cupón. */
export async function registrarUsoCupon(ventaId: string, codigo: string): Promise<{ error?: string }> {
  try { await rpc("registrar_uso_cupon", { p_venta_id: ventaId, p_codigo: codigo }); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

// ── VD-5 · La hoja flotante Cobrar ───────────────────────────────────

/** Lo que la base dice al abrir Cobrar (contexto_cobro): nada de esto se calcula en la pantalla. */
export type ContextoCobro = {
  medio_defecto: Medio; operador: string | null; hay_pines: boolean; rol: string;
  puede_otro_dia: boolean; puede_cambiar_medio: boolean;
  cubre: { desde: string; hasta: string } | null;
  reciente: { hace_seg: number; quien: string | null; total: number } | null;
};
export type DatosCobro = {
  sedeId: string; zona: string; turnoId: string | null;
  socio: { socio_id: string; nombre: string; numero: number | null; color: string; texto: string };
  precios: PreciosVenta; ctx: ContextoCobro; puedeAnular: boolean; sinProductos: boolean;
};

/** Todo junto, en paralelo: el socio, qué debe, qué cubre, cómo se cobra acá, la caja y el aviso de doble cobro. */
export async function datosCobro(sedeId: string | null, socioId: string): Promise<{ datos?: DatosCobro; error?: string }> {
  const panel = await contextoPanel();
  try {
    exigirSeccion(panel, "vender");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const { sede } = sedeActiva(panel, sedeId ?? undefined);
    const [precios, cajas, ficha, ctx] = await Promise.all([
      rpc<PreciosVenta>("precios_venta", { p_sede_id: sede.id, p_socio_id: socioId }, { lectura: true }),
      rpc<{ turno_id: string | null }[]>("cajas_sede", { p_sede_id: sede.id }, { lectura: true }),
      rpc<Ficha>("ficha_socio", { p_socio_id: socioId }, { lectura: true }),
      rpc<ContextoCobro>("contexto_cobro", { p_sede_id: sede.id, p_socio_id: socioId }, { lectura: true }),
    ]);
    return { datos: {
      sedeId: sede.id, zona: panel.gimnasio.zona_horaria, turnoId: cajas.find((c) => c.turno_id)?.turno_id ?? null,
      socio: { socio_id: ficha.socio.id, nombre: `${ficha.socio.nombre} ${ficha.socio.apellido}`.trim(), numero: ficha.socio.numero ?? null, color: ficha.acceso.color, texto: ficha.acceso.texto },
      precios, ctx, puedeAnular: panel.yo.rol === "dueno" || panel.yo.rol === "encargado",
      sinProductos: panel.yo.rol === "recepcion" && !panel.permisos.recepcion_vende_productos,
    } };
  } catch (e) { return { error: (e as Error).message }; }
}

const TIPOS_COMPROBANTE: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const MAX_COMPROBANTE = 2.5 * 1024 * 1024;   // el formulario del servidor admite 3 MB

/**
 * Sube la foto del comprobante de una transferencia cobrada en el mostrador. El permiso se
 * verifica antes de usar la clave de servicio; que sea de ESTE socio lo vuelve a exigir la base al cobrar.
 */
export async function subirComprobanteCobro(socioId: string, datos: FormData): Promise<{ path?: string; error?: string }> {
  const panel = await contextoPanel();
  try {
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    if (!/^[0-9a-f-]{36}$/.test(socioId)) return { error: "Socio inválido" };
    const f = datos.get("archivo");
    if (!(f instanceof File) || f.size === 0) return { error: "No llegó el archivo" };
    const ext = TIPOS_COMPROBANTE[f.type];
    if (!ext) return { error: "El comprobante tiene que ser una foto (JPG, PNG, WebP) o un PDF" };
    if (f.size > MAX_COMPROBANTE) return { error: "El archivo pesa más de 2,5 MB: sacale una foto más chica" };
    const path = `${panel.gimnasio.id}/${socioId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await clienteServicio().storage.from("comprobantes").upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
    if (error) return { error: `No se pudo subir el comprobante: ${error.message}` };
    return { path };
  } catch (e) { return { error: (e as Error).message }; }
}

/** "El medio de siempre" de este gimnasio: dueño y encargado (lo exige la base). */
export async function guardarMedioDefecto(medio: string): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("guardar_config_cobro", { p_gimnasio_id: panel.gimnasio.id, p_medio: medio }); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
