import Link from "next/link";
import { rpc } from "@/lib/panel/servidor";
import type { ResumenApp } from "@/lib/app/resumen";

/**
 * FA-14: la recomendación del Inicio, con su regla a la vista ("hace 10 días que no venís, hoy hay Funcional 19:00").
 * Solo avisa: no cambia nada del acceso. Si no hay nada que recomendar (vino hace poco, o nunca) no dibuja nada, y si la base
 * no responde tampoco: es un extra, no puede romper el Inicio.
 */
export async function Recomendacion({ socioId, q }: { socioId: string; q: string }) {
  const r = await rpc<ResumenApp>("resumen_app_socio", { p_socio_id: socioId }).catch(() => null);
  const reco = r?.recomendacion;
  if (!reco) return null;
  return (
    <section className="tarjeta p-4 space-y-2" aria-label="Para vos" data-recomendacion={reco.regla}>
      <p className="text-lg">💡 {reco.texto}</p>
      <Link href={`/app/resumen${q}`} className="boton !min-h-11">🏅 Mis insignias y mi año</Link>
    </section>
  );
}
