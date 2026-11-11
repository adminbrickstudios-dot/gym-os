import type { PasoPrueba } from "./acciones";

const ESTILO = { ok: ["pildora-verde", "Bien"], aviso: ["pildora-amarillo", "Ojo"], falta: ["pildora-rojo", "Falta"] } as const;

/** P6: la checklist de "Probar acceso", cada paso en verde, amarillo o rojo con su detalle y, si tiene arreglo, su botón. */
export function ListaPrueba({ pasos, arreglar }: { pasos: PasoPrueba[]; arreglar?: (p: PasoPrueba) => React.ReactNode }) {
  return (
    <ul className="space-y-1" data-prueba-pasos>
      {pasos.map((p) => (
        <li key={p.clave} className="flex flex-wrap items-center gap-2 text-sm" data-paso-prueba={p.clave} data-estado={p.estado}>
          <span className={`pildora ${ESTILO[p.estado][0]}`}>{ESTILO[p.estado][1]}</span>
          <span className="font-semibold">{p.titulo}</span>
          {p.detalle && <span className="texto-suave break-words">{p.detalle}</span>}
          {p.estado === "falta" && p.arreglo && arreglar?.(p)}
        </li>
      ))}
    </ul>
  );
}
