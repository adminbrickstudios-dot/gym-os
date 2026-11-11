"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { aplicarClaveSocio, origenDePeticion, type CuentaSocio } from "@/lib/cuentas-clave-servidor";
import { textoClave, type ResultadoClave } from "@/lib/cuentas-clave";

/**
 * C1 · "Nueva clave" a un toque desde la ficha. La base decide si puede (dueño o recepción, de este gimnasio);
 * recién con su respuesta el servidor toca la cuenta. Sin cuenta todavía: la crea con su mail, sin mandar nada.
 */
export async function nuevaClaveSocio(socioId: string): Promise<ResultadoClave> {
  try {
    const panel = await contextoPanel();
    const c = await rpc<CuentaSocio>("cuenta_para_clave_socio", { p_socio_id: socioId });
    const { contrasena, creada } = await aplicarClaveSocio(c);
    let aviso = creada
      ? `Le creamos la cuenta con ${c.email}. Pasale esta clave: se muestra una sola vez.`
      : `Clave nueva para ${c.nombre}. La anterior ya no sirve. Se muestra una sola vez.`;
    try { await rpc("registrar_clave_entregada", { p_socio_id: socioId, p_cuenta_creada: creada }); }
    catch (e) { aviso += ` Ojo: no quedó el registro de quién la generó (${(e as Error).message}).`; }
    revalidatePath(`/panel/socios/${socioId}`);
    const origen = await origenDePeticion();
    return { contrasena, email: c.email, creada, aviso,
      texto: textoClave({ gimnasio: panel.gimnasio.nombre, nombre: c.nombre, destino: "socio", origen, email: c.email, contrasena }) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
