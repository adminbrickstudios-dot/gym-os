"use server";
// N5 · Configuración → Funciones nuevas: el interruptor por gimnasio de cada función nueva (apagadas de fábrica) y lo que cada una
// necesita para andar (N2: qué hace la entrada con el apto; N1: las adhesiones al débito automático). Solo el dueño las cambia;
// la base valida, deja el cambio escrito y devuelve cómo quedó. Todo por funciones de la base (permiso denegado = error).
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type FuncionNueva = { clave: string; titulo: string; explicacion: string; plata: boolean; activa: boolean; prendida_en: string | null; prendida_dia: string | null };
export type Novedad = { clave: string; titulo: string; texto: string; desde: string };
export type AptoConfig = { activa: boolean; pide_apto: boolean; modo: "nada" | "avisa" | "frena"; dias: number };
export type Adhesion = { id: string; socio_id: string; nombre: string; monto: number | string; estado: "pendiente" | "activa" | "pausada" | "cancelada"; creada_en: string; cobros: number; sin_acreditar: number };
export type CobroDebito = { mp_pago_id: string; monto: number | string; estado: string; creado_en: string; nombre: string };
export type DebitoEstado = { mp_conectado: boolean; adhesiones: Adhesion[]; ultimos_cobros: CobroDebito[] };

const avisar = () => revalidatePath("/panel", "layout");

export async function leerFuncionesNuevas(): Promise<{ funciones?: FuncionNueva[]; novedades?: Novedad[]; error?: string }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    const [funciones, novedades] = await Promise.all([
      rpc<FuncionNueva[]>("funciones_nuevas_panel", { p_gimnasio_id: g }),
      rpc<Novedad[]>("que_hay_de_nuevo", { p_gimnasio_id: g }),
    ]);
    return { funciones, novedades };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function cambiarFuncionNueva(clave: string, activa: boolean): Promise<{ funciones?: FuncionNueva[]; novedades?: Novedad[]; error?: string }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    await rpc("cambiar_funcion_nueva", { p_gimnasio_id: g, p_clave: clave, p_activa: activa });
    avisar();
    return await leerFuncionesNuevas();
  } catch (e) { return { error: (e as Error).message }; }
}

export async function leerAptoConfig(): Promise<{ config?: AptoConfig; error?: string }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    return { config: await rpc<AptoConfig>("apto_config", { p_gimnasio_id: g }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarAptoConfig(modo: string, dias: number): Promise<{ config?: AptoConfig; error?: string }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    await rpc("guardar_apto_config", { p_gimnasio_id: g, p_modo: modo, p_dias: dias });
    avisar();
    return { config: await rpc<AptoConfig>("apto_config", { p_gimnasio_id: g }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function leerDebito(): Promise<{ estado?: DebitoEstado; error?: string }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    return { estado: await rpc<DebitoEstado>("debito_estado", { p_gimnasio_id: g }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function cancelarAdhesionDebito(adhesionId: string): Promise<{ estado?: DebitoEstado; error?: string }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    await rpc("cancelar_adhesion_debito", { p_gimnasio_id: g, p_adhesion_id: adhesionId });
    return { estado: await rpc<DebitoEstado>("debito_estado", { p_gimnasio_id: g }) };
  } catch (e) { return { error: (e as Error).message }; }
}
