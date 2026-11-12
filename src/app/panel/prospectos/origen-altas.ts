import "server-only";
// N4 · De dónde vienen los socios nuevos: lo que carga Interesados cuando el gimnasio prendió la función. Apagada devuelve null y la
// pantalla no muestra nada. Los links los arma lib/urls.ts (nunca escritos a mano).
import { rpcLectura, type PanelGimnasio } from "@/lib/panel/servidor";
import { urlGimnasio } from "@/lib/urls";

export type CanalAlta = "instagram" | "qr_cartel" | "whatsapp" | "recomendado";
export type ReporteOrigen = {
  dias: number; total: number; sin_origen: number;
  canales: { canal: CanalAlta; altas: number; pagaron: number }[];
  ultimas: { socio_id: string; nombre: string; canal: CanalAlta; creado_en: string; pago: boolean }[];
};
export type OrigenAltasDatos = { reporte: ReporteOrigen; links: { canal: CanalAlta; url: string }[] };

/** El parámetro del link de cada canal (el del cartel se llama "qr"). */
const PARAMETRO: Record<CanalAlta, string> = { instagram: "instagram", qr_cartel: "qr", whatsapp: "whatsapp", recomendado: "recomendado" };

export async function cargarOrigenAltas(panel: PanelGimnasio): Promise<OrigenAltasDatos | null> {
  const activas = await rpcLectura<string[]>("funciones_nuevas_activas", { p_gimnasio_id: panel.gimnasio.id });
  if (!activas.includes("origen_altas")) return null;
  const reporte = await rpcLectura<ReporteOrigen>("origen_altas_reporte", { p_gimnasio_id: panel.gimnasio.id, p_dias: 30 });
  const links = (Object.keys(PARAMETRO) as CanalAlta[]).map((canal) => ({ canal, url: urlGimnasio(panel.gimnasio.slug, `/hacete-socio?o=${PARAMETRO[canal]}`) }));
  return { reporte, links };
}
