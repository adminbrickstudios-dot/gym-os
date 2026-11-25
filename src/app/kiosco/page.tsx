import { textoDeBase } from "@/lib/errores-humanos";
import type { Metadata } from "next";
import { Icono } from "@/components/ui/Icono";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { COOKIE_TABLET } from "./cookie";
import { Kiosco } from "./Kiosco";
import { urlGimnasio } from "@/lib/urls";
import { conSemaforo } from "@/lib/semaforo";

export const metadata: Metadata = { title: "Entrada", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** La tablet en la puerta (ENT-3): sin menú y sin sesión de nadie. */
export default async function PaginaKiosco({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const token = (await cookies()).get(COOKIE_TABLET)?.value;
  const { error: errorLink } = await searchParams;
  let estado: { tablet: string; sede: string; gimnasio: string; con_qr: boolean; qr_pared: boolean; con_salida?: boolean; alta_url?: string | null } | null = null;
  let problema = errorLink ? "El link para autorizar la tablet está incompleto. Copialo de nuevo desde Configuración → Reglas." : null;
  if (token && !problema) {
    const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("kiosco_estado", { p_token: token });
    if (error) problema = textoDeBase(error, "No pudimos leer el estado de la tablet.");
    else {
      // VD-48: ¿se muestra "Me voy"? Lo dice la base (si no responde, la tablet sigue sin el botón: no rompe la entrada).
      const salida = await supabase.rpc("kiosco_salida_activa", { p_token: token });
      // Alta en el kiosco: si el gimnasio tiene las altas online prendidas, quien no está en el sistema ve un QR a "Hacete socio" (si la base no responde, sin QR).
      const alta = await supabase.rpc("kiosco_alta", { p_token: token });
      estado = { ...data, con_salida: salida.error ? false : !!salida.data, alta_url: !alta.error && alta.data ? urlGimnasio(String(alta.data), "/hacete-socio") : null };
    }
  } else if (!problema) problema = "Esta tablet no está autorizada. El dueño la autoriza desde Configuración → Reglas → Tablet en la puerta.";
  // Pista Semáforo: la tablet con el resultado a la izquierda y el teclado a la derecha (kiosco.png), en oscuro.
  if (estado && await conSemaforo()) {
    return <main className="min-h-dvh" data-tono="oscuro"><Kiosco {...estado} semaforo /></main>;
  }
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      {estado ? <Kiosco {...estado} /> : (
        <div className="max-w-lg text-center space-y-4" data-kiosco="sin-autorizar">
          <p className="text-6xl" aria-hidden><Icono nombre="candado" /></p>
          <h1 className="titular text-4xl">Tablet sin autorizar</h1>
          <p className="texto-suave text-lg">{problema}</p>
        </div>
      )}
    </main>
  );
}
