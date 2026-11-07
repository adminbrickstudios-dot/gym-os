import { LinkPanel } from "./LinkPanel";

export type MaquinaFuera = { falla_id: string; maquina_id: string; nombre: string; sede: string; desde: string; motivo: string; responsable: string | null; frase: string };

/** VD-54: las máquinas fuera de servicio hoy, en el Inicio del dueño, del encargado y de la recepción (con la frase lista para el socio). */
export function FueraDeServicio({ items, zona }: { items: MaquinaFuera[]; zona: string }) {
  if (items.length === 0) return null;
  const desde = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "numeric", month: "short" }).format(new Date(m));
  return (
    <section aria-labelledby="maquinas-fuera" data-maquinas-fuera={items.length}>
      <h2 id="maquinas-fuera" className="titulo text-3xl mb-1">🛠️ Fuera de servicio hoy ({items.length})</h2>
      <p className="texto-suave mb-4">
        Si un socio pregunta, ya está dicho abajo.{" "}
        <LinkPanel href="/panel/maquinas" className="underline">Ver las máquinas</LinkPanel>
      </p>
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.falla_id} className="tarjeta px-4 py-3 min-w-0" data-maquina-fuera={m.maquina_id}>
            <p className="font-semibold text-lg leading-tight break-words">🟡 {m.nombre} <span className="texto-tenue text-base font-normal">· desde el {desde(m.desde)}</span></p>
            <p className="texto-suave text-[15px] break-words">{m.motivo}{m.responsable ? ` · la arregla ${m.responsable}` : ""}</p>
            <p className="text-[15px] break-words mt-1">💬 “{m.frase}”</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
