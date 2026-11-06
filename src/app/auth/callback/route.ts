import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { MiSesion } from "@/lib/panel/servidor";
import { googleActivo, origenDe } from "@/lib/google";

// VD-22 · Google devuelve a la persona acá con un código. Se cambia por la sesión (PKCE) y:
//   · si ese Google ya está vinculado a un socio de ESTE gimnasio → entra directo a /app;
//   · si no → /auth/vincular (DNI + código al celular o mail que el gimnasio ya tiene). Nunca se vincula por nombre
//     ni por el mail de Google.
// La sesión de Supabase queda en la cookie persistente de siempre (sigue al cerrar el navegador).
export async function GET(req: NextRequest) {
  const h = await headers();
  const origen = origenDe(h);
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, origen), 303);
  const ingreso = (aviso?: string) => ir(`/ingresar?modo=socio${aviso ? `&google=${aviso}` : ""}`);
  if (!googleActivo()) return ingreso();
  const gimnasioId = h.get("x-gimnasio-id");
  if (!gimnasioId) return ingreso("error");

  const p = req.nextUrl.searchParams;
  if (p.get("error")) return ingreso(p.get("error") === "access_denied" ? "cancelado" : "error");
  const codigo = p.get("code");
  if (!codigo) return ingreso("error");

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.exchangeCodeForSession(codigo);
  if (error || !data.user) return ingreso("error");

  // Si este Google ya sostiene a un socio, vuelve a su cuenta (lo hace el servidor: un usuario no se vincula solo).
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { error: errEntrar } = await clienteServicio().rpc("entrar_con_google", { p_gimnasio_id: gimnasioId, p_usuario_id: data.user.id });
  if (errEntrar) { await supabase.auth.signOut(); return ingreso("error"); }

  const { data: sesion, error: errSesion } = await supabase.rpc("mi_sesion");
  if (errSesion) { await supabase.auth.signOut(); return ingreso("error"); }
  const yo = sesion as MiSesion;
  if (yo.socios.some((s) => s.gimnasio_id === gimnasioId)) return ir("/app");
  // Una cuenta del equipo no entra al panel por este botón (el ingreso del equipo tiene sus reglas).
  if (yo.equipo.some((e) => e.gimnasio_id === gimnasioId)) { await supabase.auth.signOut(); return ingreso("equipo"); }
  return ir("/auth/vincular");
}
