"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";

export type Veredicto = {
  puede: boolean; color: string; via: string; motivo: string; texto: string; vence_en: string | null;
  para_regularizar: number | null; pack_restantes: number | null; avisos: string[] | null; modo_aviso: boolean;
};
export type ResultadoIngreso = { ingreso_id: string; repetido: boolean; resultado: string; texto?: string; veredicto?: Veredicto };

export async function veredicto(socioId: string, sedeId: string): Promise<{ v?: Veredicto; error?: string }> {
  const panel = await contextoPanel();
  try {
    const { sede } = sedeActiva(panel, sedeId);
    return { v: await rpc<Veredicto>("estado_acceso", { p_socio_id: socioId, p_sede_id: sede.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function registrarEntrada(socioId: string, sedeId: string, forzarMotivo?: string): Promise<{ r?: ResultadoIngreso; error?: string }> {
  const panel = await contextoPanel();
  try {
    const { sede } = sedeActiva(panel, sedeId);
    const r = await rpc<ResultadoIngreso>("registrar_ingreso", {
      p_socio_id: socioId, p_sede_id: sede.id, p_via_acceso: "recepcion", p_forzar_motivo: forzarMotivo?.trim() || null,
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
