"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { errorSiHaySalud } from "@/lib/salud";

type Resp = { error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** VD-46I: se anota el hecho, nunca un diagnóstico: si el texto parece un dato de salud, se pide reescribir (y no se guarda). */
export async function crearIncidente(datos: { donde: string; que_paso: string; testigos: string; que_se_hizo: string; socio_id: string | null; ocurrio_en: string | null }): Promise<Resp> {
  const sal = errorSiHaySalud(datos.donde, datos.que_paso, datos.testigos, datos.que_se_hizo);
  if (sal) return { error: sal };
  const panel = await contextoPanel();
  try {
    await rpc("crear_incidente", {
      p_gimnasio_id: panel.gimnasio.id, p_donde: datos.donde, p_que_paso: datos.que_paso, p_testigos: datos.testigos || null,
      p_que_se_hizo: datos.que_se_hizo, p_socio_id: datos.socio_id && UUID.test(datos.socio_id) ? datos.socio_id : null,
      p_ocurrio_en: datos.ocurrio_en || null,
    });
    revalidatePath("/panel/incidentes");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** Solo dentro de las 24 h (la base lo exige igual). */
export async function corregirIncidente(id: string, datos: { donde: string; que_paso: string; testigos: string; que_se_hizo: string }): Promise<Resp> {
  const sal = errorSiHaySalud(datos.donde, datos.que_paso, datos.testigos, datos.que_se_hizo);
  if (sal) return { error: sal };
  try {
    await rpc("corregir_incidente", { p_incidente_id: id, p_donde: datos.donde, p_que_paso: datos.que_paso, p_testigos: datos.testigos || null, p_que_se_hizo: datos.que_se_hizo });
    revalidatePath("/panel/incidentes");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
