import Link from "next/link";
import { rpc } from "@/lib/panel/servidor";

/** CAJ-3: "🔢 ¿Quién atiende?" en las pantallas del mostrador, si alguien del equipo tiene PIN y nadie lo puso. */
export async function BotonPin({ gimnasioId, volver }: { gimnasioId: string; volver: string }) {
  const a = await rpc<{ nombre: string | null; hay_pines: boolean }>("operador_actual", { p_gimnasio_id: gimnasioId });
  if (!a.hay_pines || a.nombre) return null;
  return <Link href={`/panel/pin?volver=${encodeURIComponent(volver)}`} className="boton">🔢 ¿Quién atiende?</Link>;
}
