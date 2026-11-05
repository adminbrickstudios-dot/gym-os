"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

/** CLA-2: abonarse a un horario / quitar el turno. Quién puede, lo decide la base (el socio o el mostrador). */
const r = async (f: () => Promise<unknown>) => {
  try { await f(); revalidatePath("/app/clases"); revalidatePath("/app"); revalidatePath("/panel/socios", "layout"); revalidatePath("/panel/clases"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
};
export const abonarTurno = async (socioId: string, horarioId: string) => r(() => rpc("abonar_turno", { p_socio_id: socioId, p_horario_id: horarioId }));
export const quitarTurno = async (turnoId: string) => r(() => rpc("quitar_turno", { p_turno_id: turnoId }));
