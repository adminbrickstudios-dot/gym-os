// Cómo llegó el socio y qué reglamento aceptó (SOC-14). Sale de hechos que ya están.
import Link from "next/link";
import { fechaCorta } from "@/lib/formato";

export type DatosOrigen = {
  origen: "manual" | "importacion" | "alta_web"; alta: string; por: string | null;
  prospecto: { origen: "pagina" | "recepcion" | "referido"; desde: string } | null;
  importacion: { archivo: string | null; en: string } | null;
  reglamento: { version: number; aceptado_en: string } | null;
};
const DE_PROSPECTO = { pagina: "pidió una clase de prueba desde la página", recepcion: "consultó en la recepción", referido: "vino recomendado" } as const;

export function Origen({ socioId, datos: o, zona }: { socioId: string; datos: DatosOrigen; zona: string }) {
  const dia = (x: string) => fechaCorta(x, zona);
  const como = o.origen === "alta_web" ? `Se anotó solo desde la página el ${dia(o.alta)}`
    : o.origen === "importacion" ? `Vino en una importación${o.importacion?.archivo ? ` (${o.importacion.archivo})` : ""} el ${dia(o.importacion?.en ?? o.alta)}`
    : `Lo dio de alta ${o.por ?? "el equipo"} en el mostrador el ${dia(o.alta)}`;
  return (
    <div className="space-y-1 text-sm texto-suave" data-origen={o.origen}>
      <p>📝 {como}.{o.prospecto && ` Antes ${DE_PROSPECTO[o.prospecto.origen]} (${dia(o.prospecto.desde)}).`}</p>
      {o.reglamento && (
        <p data-reglamento={o.reglamento.version}>📜 Aceptó el reglamento (versión {o.reglamento.version}) el {dia(o.reglamento.aceptado_en)} · <Link href={`/panel/socios/${socioId}/reglamento`} className="underline">Ver lo que aceptó</Link></p>
      )}
    </div>
  );
}
