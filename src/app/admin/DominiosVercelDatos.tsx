import { configuracionVercel } from "@/lib/admin/vercel-dominios";
import { DominiosVercel } from "./DominiosVercel";

/** Lee del servidor si la API de Vercel está configurada (solo los nombres de lo que falta: nunca el token). */
export function DominiosVercelDatos() {
  const c = configuracionVercel(process.env);
  return <DominiosVercel lista={c.lista} faltan={c.lista ? [] : c.faltan} />;
}
