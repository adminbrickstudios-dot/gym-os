import { Icono } from "@/components/ui/Icono";
import { rpc } from "@/lib/panel/servidor";

/** F7.1: "ahora hay N personas": solo un número, y solo si el dueño lo prendió (Configuración → Lo que los socios hacen solos). Si falla, no se muestra nada. */
export async function OcupacionEnVivo({ gimnasioId }: { gimnasioId: string }) {
  const r = await rpc<{ visible: boolean; personas?: number }>("ocupacion_en_vivo", { p_gimnasio_id: gimnasioId }).catch(() => null);
  if (!r?.visible || typeof r.personas !== "number") return null;
  return (
    <p className="tarjeta px-4 py-3 flex items-center gap-3" data-ocupacion-en-vivo={r.personas}>
      <Icono nombre="usuarios" />
      <span>Ahora hay <strong className="numero">{r.personas}</strong> {r.personas === 1 ? "persona" : "personas"} en el gimnasio.</span>
    </p>
  );
}
