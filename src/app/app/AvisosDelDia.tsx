import { OfertasLugar, type OfertaLugarDatos } from "./OfertasLugar";

export type AvisoDelDia = { tipo: "clase_pronto" | "evento_manana" | "vence_pronto"; texto: string };

/**
 * Arriba del Inicio: lo que hay que mirar ahora. Las ofertas de lugar (FA-23) y los avisos de la clase que viene, del evento de mañana y del
 * vencimiento (FA-12). Solo avisan: no deciden nada del acceso ni de la plata. Los datos vienen en el lote del Inicio; si la base falló llega null
 * y no dibuja nada (el Inicio sigue).
 */
export function AvisosDelDia({ zona, ofertas, avisos }: { zona: string; ofertas: OfertaLugarDatos[] | null; avisos: AvisoDelDia[] | null }) {
  const of = ofertas ?? [], av = avisos ?? [];
  if (!of.length && !av.length) return null;
  return (
    <div className="space-y-3">
      <OfertasLugar ofertas={of} zona={zona} />
      {av.map((a) => (
        <p key={`${a.tipo}-${a.texto}`} className="pildora pildora-azul !rounded-[var(--radio)] !px-4 !py-3 w-full whitespace-normal" role="status" data-aviso-app={a.tipo}>{a.texto}</p>
      ))}
    </div>
  );
}
