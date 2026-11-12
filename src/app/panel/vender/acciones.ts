"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, ErrorDatos, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { funcionesNuevasDe } from "@/lib/panel/funciones-nuevas";
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

/**
 * VD-49 / VD-50: la base manda errores con un código estable (SQLSTATE) y el texto ya escrito para mostrar
 * ("sin_caja: …", "caja_ajena: …", "ya_cobrada: …"); acá se separa el código del texto para que la pantalla lo reconozca.
 */
export type CodigoCobro = "sin_caja" | "caja_ajena" | "ya_cobrada";
const CODIGOS_COBRO: Record<string, CodigoCobro> = { CJ001: "sin_caja", CJ002: "caja_ajena", DC001: "ya_cobrada" };
function errorDeCobro(e: unknown): { error: string; codigo?: CodigoCobro } {
  const mensaje = (e as Error).message;
  const codigo = e instanceof ErrorDatos && e.codigo ? CODIGOS_COBRO[e.codigo] : undefined;
  return { error: codigo ? mensaje.replace(new RegExp(`^${codigo}: `), "") : mensaje, codigo };
}

export async function cobrar(datos: {
  sedeId: string; socioId: string | null; turnoId: string | null;
  items: Record<string, unknown>[]; pagos: { medio: string; monto: number }[]; claveOperacion?: string;
  /** VD-5: "cobré otro día" (solo dueño o encargado; la base lo exige), con su motivo. */
  cobradoEn?: string; motivoOtroDia?: string;
  /** VD-5: la foto del comprobante de la transferencia (ya subida con `subirComprobanteCobro`). */
  comprobantePath?: string;
  /** VD-50: seguir aunque la cuota ya se cobró hace poco ("Cobrar igual"), con el motivo escrito que guarda la base. */
  confirmarDoble?: boolean; motivoDoble?: string;
}): Promise<{ venta?: Venta; error?: string; codigo?: CodigoCobro }> {
  const panel = await contextoPanel();
  try {
    const { sede } = sedeActiva(panel, datos.sedeId);
    const venta = await rpc<Venta>("vender", {
      p_sede_id: sede.id, p_items: datos.items, p_pagos: datos.pagos, p_socio_id: datos.socioId, p_turno_id: datos.turnoId, p_clave_operacion: datos.claveOperacion ?? null,
      ...(datos.cobradoEn ? { p_cobrado_en: datos.cobradoEn, p_motivo_otro_dia: datos.motivoOtroDia ?? null } : {}),
      ...(datos.comprobantePath ? { p_comprobante_path: datos.comprobantePath } : {}),
      ...(datos.confirmarDoble ? { p_confirmar: true, p_motivo_doble: datos.motivoDoble ?? null } : {}),
    });
    revalidatePath("/panel");
    if (datos.socioId) revalidatePath(`/panel/socios/${datos.socioId}`);
    return { venta };
  } catch (e) { return errorDeCobro(e); }
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
  /** VD-50: la cuota de este socio ya cobrada hace menos de N minutos (la misma regla que frena en vender). */
  reciente: { hace_seg: number; quien: string | null; total: number; venta_id?: string } | null;
  doble_cobro_minutos?: number;
};
/** VD-49: mi caja para cobrar en efectivo en esta sede (caja_para_cobrar): la base dice cuál sirve y qué cajas puedo abrir. */
export type CajaCobro = {
  turno_id: string | null; caja: string | null; vencido: boolean; otra_sede: string | null; modo: string;
  libres: { caja_id: string; nombre: string; fondo_sugerido: number; dejo_anterior: number | null; con_vencida: boolean }[];
};
export type DatosCobro = {
  sedeId: string; zona: string; caja: CajaCobro;
  socio: { socio_id: string; nombre: string; numero: number | null; color: string; texto: string };
  precios: PreciosVenta; ctx: ContextoCobro; vueltoEfectivo: boolean; puedeAnular: boolean; sinProductos: boolean;
};

/** Mi caja de esta sede, de nuevo (después de un error de caja, o para refrescar lo que ofrece la hoja). */
export async function cajaParaCobrar(sedeId: string): Promise<{ caja?: CajaCobro; error?: string }> {
  const panel = await contextoPanel();
  try {
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const { sede } = sedeActiva(panel, sedeId);
    return { caja: await rpc<CajaCobro>("caja_para_cobrar", { p_sede_id: sede.id }, { lectura: true }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Todo junto, en paralelo: el socio, qué debe, qué cubre, cómo se cobra acá, la caja y el aviso de doble cobro. */
export async function datosCobro(sedeId: string | null, socioId: string): Promise<{ datos?: DatosCobro; error?: string }> {
  const panel = await contextoPanel();
  try {
    exigirSeccion(panel, "vender");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const { sede } = sedeActiva(panel, sedeId ?? undefined);
    // Vuelto en efectivo: interruptor del dueño, apagado por defecto. Si no se puede leer, queda apagado (es solo una ayuda de pantalla).
    const [precios, caja, ficha, ctx, vueltoEfectivo] = await Promise.all([
      rpc<PreciosVenta>("precios_venta", { p_sede_id: sede.id, p_socio_id: socioId }, { lectura: true }),
      rpc<CajaCobro>("caja_para_cobrar", { p_sede_id: sede.id }, { lectura: true }),
      rpc<Ficha>("ficha_socio", { p_socio_id: socioId }, { lectura: true }),
      rpc<ContextoCobro>("contexto_cobro", { p_sede_id: sede.id, p_socio_id: socioId }, { lectura: true }),
      funcionesNuevasDe(panel.gimnasio.id).then((c) => c.includes("vuelto_efectivo")).catch(() => false),
    ]);
    return { datos: {
      sedeId: sede.id, zona: panel.gimnasio.zona_horaria, caja,
      socio: { socio_id: ficha.socio.id, nombre: `${ficha.socio.nombre} ${ficha.socio.apellido}`.trim(), numero: ficha.socio.numero ?? null, color: ficha.acceso.color, texto: ficha.acceso.texto },
      precios, ctx, vueltoEfectivo, puedeAnular: panel.yo.rol === "dueno" || panel.yo.rol === "encargado",
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
