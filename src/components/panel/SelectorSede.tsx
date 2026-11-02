import Link from "next/link";

/** Pestañas de sede, solo si la persona puede elegir entre varias. */
export function SelectorSede({ sedes, actual, ruta }: { sedes: { id: string; nombre: string }[]; actual: string; ruta: string }) {
  return (
    <nav aria-label="Sede" className="flex flex-wrap gap-2 mb-6">
      {sedes.map((s) => (
        <Link key={s.id} href={`${ruta}?sede=${s.id}`} aria-current={s.id === actual ? "page" : undefined}
          className={`boton !min-h-11 ${s.id === actual ? "!border-[var(--acento)]" : "opacity-70"}`}>📍 {s.nombre}</Link>
      ))}
    </nav>
  );
}
