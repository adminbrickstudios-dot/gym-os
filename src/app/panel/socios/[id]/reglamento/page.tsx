import type { Metadata } from "next";
import Link from "next/link";
import { fechaCorta } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Vacio } from "@/components/ui/Vacio";

export const metadata: Metadata = { title: "Reglamento aceptado" };

/** El reglamento tal como lo aceptó el socio (su versión, aunque después haya otra), para mostrárselo. */
export default async function ReglamentoAceptado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    exigirSeccion(panel, "socios");
    const r = await rpc<{ version: number; texto: string; aceptado_en: string } | null>("reglamento_aceptado", { p_socio_id: id });
    return (
      <div className="space-y-6 max-w-2xl">
        <Link href={`/panel/socios/${id}`} className="texto-suave hover:text-[var(--texto)]">← Ficha del socio</Link>
        {r ? <>
          <header>
            <h1 className="titular text-4xl sm:text-5xl">📜 Reglamento aceptado</h1>
            <p className="texto-suave text-lg mt-2">Versión {r.version}, aceptada el {fechaCorta(r.aceptado_en, panel.gimnasio.zona_horaria)}.</p>
          </header>
          <article className="tarjeta p-6 whitespace-pre-wrap leading-relaxed" data-texto-reglamento>{r.texto}</article>
        </> : <Vacio emoji="📜" titulo="No aceptó ningún reglamento">Se acepta al anotarse desde la página. Si lo diste de alta en el mostrador, no pasó por ahí.</Vacio>}
      </div>
    );
  });
}
