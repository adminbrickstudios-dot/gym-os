import { rpc } from "@/lib/panel/servidor";
import { OfertasLugar, type OfertaLugarDatos } from "./OfertasLugar";

type AvisoApp = { tipo: "clase_pronto" | "evento_manana"; texto: string };

/**
 * Arriba del Inicio: lo que hay que mirar ahora. Las ofertas de lugar (FA-23) y los avisos de la clase que viene y del evento de mañana
 * (FA-12). Solo avisan: no deciden nada del acceso ni de la plata. Un extra: si la base no responde, no dibuja nada y el Inicio sigue.
 */
export async function AvisosDelDia({ socioId, zona }: { socioId: string; zona: string }) {
  const [ofertas, avisos] = await Promise.all([
    rpc<OfertaLugarDatos[]>("ofertas_socio", { p_socio_id: socioId }).catch(() => []),
    rpc<AvisoApp[]>("avisos_app_socio", { p_socio_id: socioId }).catch(() => []),
  ]);
  if (!ofertas.length && !avisos.length) return null;
  return (
    <div className="space-y-3">
      <OfertasLugar ofertas={ofertas} zona={zona} />
      {avisos.map((a) => (
        <p key={`${a.tipo}-${a.texto}`} className="pildora pildora-azul !rounded-2xl !px-4 !py-3 w-full whitespace-normal" role="status" data-aviso-app={a.tipo}>{a.texto}</p>
      ))}
    </div>
  );
}
