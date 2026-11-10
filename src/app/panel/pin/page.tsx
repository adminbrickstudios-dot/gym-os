import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { SalirPin, Teclado } from "./Teclado";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "PIN de la recepción" };

/** CAJ-3 (D15): en la compu de la recepción, cada uno pone su PIN para que quede anotado quién atendió. */
export default async function PaginaPin({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    const actual = await rpc<{ nombre: string | null; tengo_pin: boolean; hay_pines: boolean }>("operador_actual", { p_gimnasio_id: panel.gimnasio.id });
    const nombre = (await cookies()).get("gymos_operador_nombre")?.value || actual.nombre;
    return (
      <>
        <Encabezado icono="calculadora" titulo="¿Quién atiende?"
          bajada="En la compu de la recepción, cada uno pone su PIN y queda anotado quién cobró, abrió la caja o dejó pasar. No da más permisos que la sesión abierta." />
        {nombre && (
          <div className="tarjeta p-4 mb-6 flex flex-wrap items-center gap-3 max-w-sm" data-opera={nombre}>
            <span className="flex-1"><Icono nombre="persona" /> Atiende <strong>{nombre}</strong></span>
            <SalirPin />
          </div>
        )}
        {!actual.hay_pines
          ? <p className="texto-suave max-w-xl">Todavía nadie del equipo tiene PIN. Cada uno lo elige en <Link href="/panel/cuenta" className="underline">Mi cuenta</Link>.</p>
          : <Teclado volver={sp.volver ?? "/panel"} />}
        {actual.hay_pines && !actual.tengo_pin && <p className="texto-tenue text-sm mt-4">¿No tenés PIN? Elegilo en <Link href="/panel/cuenta" className="underline">Mi cuenta</Link>.</p>}
      </>
    );
  });
}
