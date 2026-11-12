"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { contrasenaElegida, darAcceso, mailValido, nuevaContrasena } from "@/lib/cuentas";
import { origenDePeticion } from "@/lib/cuentas-clave-servidor";
import { textoClave, type ResultadoClave } from "@/lib/cuentas-clave";

export type Resultado = { error?: string; aviso?: string; contrasena?: string; email?: string;
  /** Si el alta no se hizo, lo que se escribió vuelve a los campos (la contraseña no). */
  valores?: { nombre: string; email: string; rol: string; sede: string } };

/**
 * Agrega a alguien al equipo. Primero la base valida que quien lo pide es el
 * dueño (guardar_equipo con su sesión); recién después el servidor usa la
 * clave de servicio para crear o vincular la cuenta.
 */
export async function agregarPersona(_: Resultado, f: FormData): Promise<Resultado> {
  const panel = await contextoPanel();
  const nombre = String(f.get("nombre") ?? "").trim();
  const rol = String(f.get("rol") ?? "");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const sede = String(f.get("sede") ?? "") || null;
  const valores = { nombre, email, rol, sede: sede ?? "" };
  if (email && !mailValido(email)) return { error: "El mail no es válido", valores };
  let equipoId: string;
  try {
    equipoId = await rpc<string>("guardar_equipo", { p_gimnasio_id: panel.gimnasio.id, p_equipo_id: null, p_nombre: nombre, p_rol: rol, p_sede_id: sede });
  } catch (e) { return { error: (e as Error).message, valores }; }
  revalidatePath("/panel/equipo");
  if (!email) return { aviso: `${nombre} quedó en el equipo sin acceso al sistema (aparece en la grilla de clases).` };

  try {
    const { contrasena } = await darAcceso(equipoId, email, nombre, contrasenaElegida(f));
    return contrasena
      ? { contrasena, email, aviso: `Listo. Pasale a ${nombre} su mail y esta contraseña provisoria; la cambia al entrar.` }
      : { email, aviso: `Listo. ${email} ya tenía cuenta: entra con su contraseña de siempre.` };
  } catch (e) {
    return { error: `${nombre} quedó en el equipo, pero sin acceso: ${(e as Error).message}` };
  }
}

export async function editarPersona(equipoId: string, nombre: string, rol: string, sede: string | null, activo: boolean): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_equipo", { p_gimnasio_id: panel.gimnasio.id, p_equipo_id: equipoId, p_nombre: nombre, p_rol: rol, p_sede_id: sede, p_activo: activo });
    revalidatePath("/panel/equipo");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** EQU-1 (D4): un interruptor de permisos del gimnasio (solo el dueño; lo valida la base). */
export async function guardarPermiso(clave: string, valor: boolean): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_permisos_equipo", { p_gimnasio_id: panel.gimnasio.id, p_datos: { [clave]: valor } });
    revalidatePath("/panel", "layout");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

// ── VD-44 · Foto, clases y horario de cada persona ───────────────────
export type HorarioTrabajo = { dia: number; desde: string; hasta: string };

/** La opción general: mostrar al equipo en la página y la app (solo el dueño; lo valida la base). */
export async function guardarMostrarEquipo(mostrar: boolean): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_equipo_ajuste", { p_gimnasio_id: panel.gimnasio.id, p_mostrar: mostrar });
    revalidatePath("/panel/equipo");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarPerfil(equipoId: string, mostrar: boolean, actividades: string[], horario: HorarioTrabajo[]): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_perfil_equipo", { p_gimnasio_id: panel.gimnasio.id, p_equipo_id: equipoId, p_mostrar: mostrar, p_actividades: actividades, p_horario: horario });
    revalidatePath("/panel/equipo");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

type Imagen = "image/jpeg" | "image/png" | "image/webp";
const MAX_FOTO = 6 * 1024 * 1024;

/** La foto se achica (VD-47X) y se sube con la clave de servicio al bucket privado; la base arma la ruta y la confirma. */
export async function subirFotoEquipo(equipoId: string, f: FormData): Promise<{ error?: string }> {
  const foto = f.get("foto");
  if (!(foto instanceof Blob) || foto.size === 0) return { error: "Elegí una foto" };
  if (!["image/jpeg", "image/png", "image/webp"].includes(foto.type) || foto.size > MAX_FOTO) return { error: "La foto tiene que ser JPG, PNG o WEBP de hasta 6 MB." };
  try {
    const { achicarFoto } = await import("@/lib/imagenes-servidor");
    const a = await achicarFoto(new Uint8Array(await foto.arrayBuffer()), foto.type as Imagen);
    const ext = a.mime === "image/png" ? "png" : a.mime === "image/webp" ? "webp" : "jpg";
    const ruta = await rpc<string>("preparar_foto_equipo", { p_equipo_id: equipoId, p_ext: ext });
    const { clienteServicio } = await import("@/lib/supabase/servicio");
    const almacen = clienteServicio().storage.from("fotos_equipo");
    const { error } = await almacen.upload(ruta, Buffer.from(a.bytes), { contentType: a.mime, upsert: false });
    if (error) return { error: `No se pudo subir la foto: ${error.message}` };
    const anterior = await rpc<string | null>("guardar_foto_equipo", { p_equipo_id: equipoId, p_ruta: ruta });
    if (anterior) await almacen.remove([anterior]);
    revalidatePath("/panel/equipo");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function quitarFotoEquipo(equipoId: string): Promise<{ error?: string }> {
  try {
    const anterior = await rpc<string | null>("guardar_foto_equipo", { p_equipo_id: equipoId, p_ruta: null });
    if (anterior) {
      const { clienteServicio } = await import("@/lib/supabase/servicio");
      await clienteServicio().storage.from("fotos_equipo").remove([anterior]);
    }
    revalidatePath("/panel/equipo");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/**
 * C1 · Clave nueva para alguien del equipo, sin mails: solo el dueño (lo decide la base con cuenta_para_nueva_clave).
 * Devuelve la clave una sola vez, con el mensaje armado para copiar o mandar por WhatsApp, y deja el registro de quién la generó.
 */
export async function nuevaClaveEquipo(_: ResultadoClave, f: FormData): Promise<ResultadoClave> {
  const equipoId = String(f.get("equipo_id") ?? "");
  try {
    const panel = await contextoPanel();
    const c = await rpc<{ usuario_id: string; email: string | null; nombre: string }>("cuenta_para_nueva_clave", { p_equipo_id: equipoId });
    if (!c.email) throw new Error(`${c.nombre} no tiene mail en su cuenta`);
    const contrasena = await nuevaContrasena(c.usuario_id, contrasenaElegida(f));
    let aviso = `Contraseña nueva para ${c.nombre}. La anterior ya no sirve. Se muestra una sola vez.`;
    try { await rpc("registrar_clave_entregada", { p_equipo_id: equipoId }); }
    catch (e) { aviso += ` Ojo: no quedó el registro de quién la generó (${(e as Error).message}).`; }
    const origen = await origenDePeticion();
    return { email: c.email, contrasena, aviso, texto: textoClave({ gimnasio: panel.gimnasio.nombre, nombre: c.nombre, destino: "equipo", origen, email: c.email, contrasena }) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
