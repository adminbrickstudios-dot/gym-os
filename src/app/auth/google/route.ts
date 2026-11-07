import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { googleActivo, origenDe } from "@/lib/google";

// VD-22 · "Continuar con Google": arma el pedido a Google con @supabase/ssr (PKCE: el verificador queda en una
// cookie de esta dirección) y manda a la persona a Google. Vuelve por /auth/callback. Con Google apagado
// (sin ENTRAR_CON_GOOGLE=1) no hace nada: vuelve al ingreso.
export async function GET() {
  const h = await headers();
  const origen = origenDe(h);
  const volver = (aviso?: string) => NextResponse.redirect(new URL(`/ingresar?modo=socio${aviso ? `&google=${aviso}` : ""}`, origen), 303);
  if (!googleActivo() || !h.get("x-gimnasio-id")) return volver();

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origen}/auth/callback`, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) return volver("error");
  return NextResponse.redirect(data.url, 303);
}
