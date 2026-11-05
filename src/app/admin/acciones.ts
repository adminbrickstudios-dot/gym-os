"use server";
import { revalidatePath } from "next/cache";
import { darAcceso, mailValido, nuevaContrasena } from "@/lib/cuentas";
import { dominioBase } from "@/lib/dominios";
import { rpc } from "@/lib/panel/servidor";

// Todas las acciones del super admin siguen el mismo orden: primero la base
// valida con la sesión de quien pide (admin_* / *_para_*), recién después el
// servidor usa la clave de servicio. Ningún error se pierde: todo vuelve como
// texto a la pantalla.

export type EstadoAlta = {
  error?: string;
  ok?: { gimnasio_id: string; slug: string; nombre: string; email?: string; contrasena?: string; aviso: string };
};

export async function crearGimnasio(_: EstadoAlta, f: FormData): Promise<EstadoAlta> {
  const slug = String(f.get("slug") ?? "").trim().toLowerCase();
  const nombre = String(f.get("nombre") ?? "").trim();
  const dueno = String(f.get("dueno") ?? "").trim();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (email && !mailValido(email)) return { error: "El mail del dueño no es válido" };
  const base = dominioBase();
  if (!base) return { error: "Falta NEXT_PUBLIC_DOMINIO_BASE en Vercel (Settings → Environment Variables) y redeployar." };

  let r: { gimnasio_id: string; equipo_id: string; host: string };
  try {
    r = await rpc("admin_crear_gimnasio", { p_slug: slug, p_nombre: nombre, p_dominio_base: base, p_dueno_nombre: dueno });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/admin");
  // ADM-1: la plantilla del tipo (si falla, el gimnasio ya está creado: se dice, no se esconde).
  const tipo = String(f.get("tipo") ?? "");
  let avisoPlantilla = "";
  if (tipo) {
    try { await rpc("admin_aplicar_plantilla", { p_gimnasio_id: r.gimnasio_id, p_tipo: tipo }); }
    catch (e) { avisoPlantilla = ` No se pudo aplicar la plantilla: ${(e as Error).message}.`; }
  }
  const creado = { gimnasio_id: r.gimnasio_id, slug, nombre };
  if (!email) return { ok: { ...creado, aviso: `${nombre} está creado. Para que el dueño entre, dale acceso con su mail desde el gimnasio.${avisoPlantilla}` } };
  try {
    const { contrasena } = await darAcceso(r.equipo_id, email, dueno);
    return { ok: { ...creado, email, contrasena, aviso: (contrasena ? "Pasale al dueño su mail y esta contraseña provisoria." : "El dueño ya tenía cuenta: entra con la suya.") + avisoPlantilla } };
  } catch (e) {
    return { ok: { ...creado, aviso: `${nombre} está creado, pero el dueño todavía no tiene acceso: ${(e as Error).message}` } };
  }
}

export type Resultado = { error?: string; aviso?: string; email?: string; contrasena?: string };

/** Alta de una persona en el equipo de un gimnasio, con acceso si se carga el mail. */
export async function agregarPersona(_: Resultado, f: FormData): Promise<Resultado> {
  const gimnasioId = String(f.get("gimnasio_id") ?? "");
  const nombre = String(f.get("nombre") ?? "").trim();
  const rol = String(f.get("rol") ?? "");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (email && !mailValido(email)) return { error: "El mail no es válido" };
  let equipoId: string;
  try {
    equipoId = await rpc<string>("admin_agregar_persona", { p_gimnasio_id: gimnasioId, p_nombre: nombre, p_rol: rol });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/admin/${gimnasioId}`);
  if (!email) return { aviso: `${nombre} quedó en el equipo, sin acceso al sistema.` };
  try {
    const { contrasena } = await darAcceso(equipoId, email, nombre);
    return contrasena
      ? { email, contrasena, aviso: `Pasale a ${nombre} su mail y esta contraseña provisoria.` }
      : { email, aviso: `${email} ya tenía cuenta: entra con su contraseña de siempre.` };
  } catch (e) {
    return { error: `${nombre} quedó en el equipo, pero sin acceso: ${(e as Error).message}` };
  }
}

/** Primer acceso para alguien del equipo que no tenía cuenta. Sirve igual desde el super admin y desde el panel del dueño. */
export async function darAccesoPersona(_: Resultado, f: FormData): Promise<Resultado> {
  const equipoId = String(f.get("equipo_id") ?? "");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!mailValido(email)) return { error: "Escribí un mail válido" };
  try {
    const p = await rpc<{ nombre: string }>("persona_para_dar_acceso", { p_equipo_id: equipoId });
    const { contrasena } = await darAcceso(equipoId, email, p.nombre);
    revalidatePath("/admin", "layout");
    revalidatePath("/panel/equipo");
    return contrasena
      ? { email, contrasena, aviso: `Pasale a ${p.nombre} su mail y esta contraseña provisoria.` }
      : { email, aviso: `${email} ya tenía cuenta: ${p.nombre} entra con su contraseña de siempre.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Contraseña provisoria nueva para alguien que se la olvidó. */
export async function nuevaClavePersona(_: Resultado, f: FormData): Promise<Resultado> {
  const equipoId = String(f.get("equipo_id") ?? "");
  try {
    const c = await rpc<{ usuario_id: string; email: string | null; nombre: string }>("cuenta_para_nueva_clave", { p_equipo_id: equipoId });
    const contrasena = await nuevaContrasena(c.usuario_id);
    return { email: c.email ?? undefined, contrasena, aviso: `Contraseña nueva para ${c.nombre}. La anterior ya no sirve.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function agregarDominio(_: Resultado, f: FormData): Promise<Resultado> {
  const gimnasioId = String(f.get("gimnasio_id") ?? "");
  const host = String(f.get("host") ?? "");
  try {
    await rpc("admin_agregar_dominio", { p_gimnasio_id: gimnasioId, p_host: host });
    revalidatePath(`/admin/${gimnasioId}`);
    return { aviso: "Dirección agregada. Sumala también en Vercel → Settings → Domains para que abra." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function quitarDominio(gimnasioId: string, dominioId: string): Promise<{ error?: string }> {
  try {
    await rpc("admin_quitar_dominio", { p_dominio_id: dominioId });
    revalidatePath(`/admin/${gimnasioId}`);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** ADM-6: una novedad para todos los dueños (la ven en Inicio hasta cerrarla). */
export async function publicarNovedadPlataforma(titulo: string, texto: string, link: string): Promise<{ error?: string }> {
  try { await rpc("admin_publicar_novedad", { p_titulo: titulo, p_texto: texto, p_link: link || null }); revalidatePath("/admin"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
export async function retirarNovedadPlataforma(id: string): Promise<{ error?: string }> {
  try { await rpc("admin_retirar_novedad", { p_id: id }); revalidatePath("/admin"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

// ── ADM-3 (D13): el abono de cada gimnasio a BRIK. El precio lo carga Mateo. ──
const hechoAdmin = async (f: () => Promise<unknown>, rutas: string[]) => {
  try { await f(); for (const r of rutas) revalidatePath(r); return {}; } catch (e) { return { error: (e as Error).message }; }
};
export const guardarPlanBrik = async (id: string | null, nombre: string, precio: number, activo = true) =>
  hechoAdmin(() => rpc("admin_guardar_plan_brik", { p_id: id, p_nombre: nombre, p_precio: precio, p_activo: activo }), ["/admin"]);
export const asignarPlanBrik = async (gimnasioId: string, planId: string | null) =>
  hechoAdmin(() => rpc("admin_asignar_plan_brik", { p_gimnasio_id: gimnasioId, p_plan_id: planId }), ["/admin", `/admin/${gimnasioId}`]);
export const registrarPagoBrik = async (gimnasioId: string, monto: number, cubreHasta: string, nota: string) =>
  hechoAdmin(() => rpc("admin_registrar_pago_brik", { p_gimnasio_id: gimnasioId, p_monto: monto, p_cubre_hasta: cubreHasta, p_nota: nota || null }), ["/admin", `/admin/${gimnasioId}`]);
export const anularPagoBrik = async (gimnasioId: string, pagoId: string) =>
  hechoAdmin(() => rpc("admin_anular_pago_brik", { p_pago_id: pagoId }), ["/admin", `/admin/${gimnasioId}`]);
