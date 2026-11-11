import { Icono } from "@/components/ui/Icono";
import { rpc } from "@/lib/panel/servidor";

type Copias = { ultima_exportacion: string | null; por: string | null; exportaciones: number };
const fecha = (s: string) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "medium", timeStyle: "short" }).format(new Date(s));

/** F2.7: qué copias de los datos de este gimnasio puede afirmar BRIK. Las automáticas son de Supabase (diarias en Pro) y no se consultan desde acá. */
export async function EstadoCopias({ gimnasioId }: { gimnasioId: string }) {
  const c = await rpc<Copias>("admin_estado_copias", { p_gimnasio_id: gimnasioId }).catch(() => null);
  if (!c) return null;
  return (
    <div className="tarjeta p-4 space-y-1 text-sm" data-estado-copias>
      <p className="font-semibold"><Icono nombre="descargar" /> Copias de sus datos</p>
      <p>{c.ultima_exportacion ? `Última exportación manual: ${fecha(c.ultima_exportacion)}${c.por ? ` (${c.por})` : ""}. En total ${c.exportaciones}.` : "Todavía no se exportó nunca."}</p>
      <p className="texto-tenue">Las copias automáticas las hace Supabase (todos los días con el plan Pro) y no se pueden ver desde acá. Antes de una baja, exportá todo.</p>
    </div>
  );
}
