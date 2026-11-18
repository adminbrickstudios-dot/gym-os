import Link from "next/link";
import { rpc } from "@/lib/panel/servidor";
import { Icono } from "@/components/ui/Icono";

export type OperadorActual = { nombre: string | null; hay_pines: boolean };

/** CAJ-3: "¿Quién atiende?" en las pantallas del mostrador, si alguien del equipo tiene PIN y nadie lo puso. */
export async function BotonPin({ gimnasioId, volver, operador }: { gimnasioId: string; volver: string; operador?: OperadorActual }) {
  // Cacería (18/11): la pantalla que ya lo leyó en su lote lo pasa y no se vuelve a preguntar.
  const a = operador ?? await rpc<OperadorActual>("operador_actual", { p_gimnasio_id: gimnasioId });
  if (!a.hay_pines || a.nombre) return null;
  return <Link href={`/panel/pin?volver=${encodeURIComponent(volver)}`} className="boton"><Icono nombre="calculadora" /> ¿Quién atiende?</Link>;
}
