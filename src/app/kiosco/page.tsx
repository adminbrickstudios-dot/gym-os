import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { COOKIE_TABLET } from "./cookie";
import { Kiosco } from "./Kiosco";

export const metadata: Metadata = { title: "Entrada", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** La tablet en la puerta (ENT-3): sin menú y sin sesión de nadie. */
export default async function PaginaKiosco({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const token = (await cookies()).get(COOKIE_TABLET)?.value;
  const { error: errorLink } = await searchParams;
  let estado: { tablet: string; sede: string; gimnasio: string; con_qr: boolean } | null = null;
  let problema = errorLink ? "El link para autorizar la tablet está incompleto. Copialo de nuevo desde Configuración → Reglas." : null;
  if (token && !problema) {
    const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("kiosco_estado", { p_token: token });
    if (error) problema = error.message; else estado = data;
  } else if (!problema) problema = "Esta tablet no está autorizada. El dueño la autoriza desde Configuración → Reglas → Tablet en la puerta.";
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      {estado ? <Kiosco {...estado} /> : (
        <div className="max-w-lg text-center space-y-4" data-kiosco="sin-autorizar">
          <p className="text-6xl" aria-hidden>🔒</p>
          <h1 className="titular text-4xl">Tablet sin autorizar</h1>
          <p className="texto-suave text-lg">{problema}</p>
        </div>
      )}
    </main>
  );
}
