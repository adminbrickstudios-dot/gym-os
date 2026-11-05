"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";

export type Veredicto = {
  puede: boolean; color: string; via: string; motivo: string; texto: string; vence_en: string | null;
  para_regularizar: number | null; pack_restantes: number | null; avisos: string[] | null; modo_aviso: boolean;
};
export type ResultadoIngreso = { ingreso_id: string; repetido: boolean; resultado: string; texto?: string; veredicto?: Veredicto };

type Apto = { pide: boolean; apto?: { vence: string; vigente: boolean } | null };

/** El veredicto de la puerta, y aparte lo que el mostrador tiene que saber (no cambia si entra): el apto físico, si el gimnasio lo pide. */
export async function veredicto(socioId: string, sedeId: string): Promise<{ v?: Veredicto; apto?: string | null; error?: string }> {
  const panel = await contextoPanel();
  try {
    const { sede } = sedeActiva(panel, sedeId);
    const [v, a] = await Promise.all([
      rpc<Veredicto>("estado_acceso", { p_socio_id: socioId, p_sede_id: sede.id }),
      rpc<Apto>("apto_socio", { p_socio_id: socioId }),
    ]);
    const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const apto = !a.pide ? null : !a.apto ? "🩺 No presentó el apto físico" : !a.apto.vigente ? `🩺 El apto físico venció el ${dia(a.apto.vence)}` : null;
    return { v, apto };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Volvió antes de la pausa: termina hoy (desde hoy entra) y devuelve el veredicto nuevo. */
export async function terminarPausa(socioId: string, sedeId: string): Promise<{ v?: Veredicto; error?: string }> {
  try {
    const p = await rpc<{ pausas: { id: string; estado: string }[] }>("pausas_socio", { p_socio_id: socioId });
    const enCurso = p.pausas.find((x) => x.estado === "en_curso");
    if (!enCurso) return { error: "No tiene una pausa en curso." };
    await rpc("descongelar", { p_congelamiento_id: enCurso.id });
    revalidatePath(`/panel/socios/${socioId}`);
    const r = await veredicto(socioId, sedeId);
    return { v: r.v, error: r.error };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Un QR de socio (cámara o lector): la base dice de quién es, si vale y si ya se usó. */
export async function leerQR(codigo: string): Promise<{ socio?: { socio_id: string; nombre: string; numero: number }; error?: string }> {
  const panel = await contextoPanel();
  try { return { socio: await rpc("leer_qr", { p_gimnasio_id: panel.gimnasio.id, p_codigo: codigo }) }; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function registrarEntrada(socioId: string, sedeId: string, forzarMotivo?: string, via: "recepcion" | "qr_socio" = "recepcion"): Promise<{ r?: ResultadoIngreso; error?: string }> {
  const panel = await contextoPanel();
  try {
    const { sede } = sedeActiva(panel, sedeId);
    const r = await rpc<ResultadoIngreso>("registrar_ingreso", {
      p_socio_id: socioId, p_sede_id: sede.id, p_via_acceso: via, p_forzar_motivo: forzarMotivo?.trim() || null,
    });
    revalidatePath("/panel/entrada");
    revalidatePath("/panel");
    return { r };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function anularEntrada(ingresoId: string, motivo: string): Promise<{ error?: string }> {
  try {
    await rpc("anular_ingreso", { p_ingreso_id: ingresoId, p_motivo: motivo });
    revalidatePath("/panel/entrada");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** Cuántas veces puede dejar pasar hoy quien está en la recepción (el tope lo pone el dueño; D1). */
export async function cupoDejarPasar(): Promise<{ sin_tope: boolean; tope: number; usados: number } | null> {
  const panel = await contextoPanel();
  try { return await rpc("cupo_dejar_pasar", { p_gimnasio_id: panel.gimnasio.id }); } catch { return null; }
}
