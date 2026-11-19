import { Icono } from "@/components/ui/Icono";

/** F7.1: "ahora hay N personas": solo un número, y solo si el dueño lo prendió (Configuración → Lo que los socios hacen solos). El dato viene en el lote del Inicio; si falló, no se muestra nada. */
export function OcupacionEnVivo({ r }: { r: { visible: boolean; personas?: number } | null }) {
  if (!r?.visible || typeof r.personas !== "number") return null;
  return (
    <p className="tarjeta px-4 py-3 flex items-center gap-3" data-ocupacion-en-vivo={r.personas}>
      <Icono nombre="usuarios" />
      <span>Ahora hay <strong className="numero">{r.personas}</strong> {r.personas === 1 ? "persona" : "personas"} en el gimnasio.</span>
    </p>
  );
}
