// Pestaña Cambios: quién cambió qué de la configuración y cuándo. Lo escribe
// la base (triggers), nunca la pantalla; acá solo se lee.
import { Vacio } from "@/components/ui/Vacio";

export type Cambio = { campo: string; etiqueta: string; antes: string; despues: string; quien: string; cuando: string; cuando_texto: string };

export function Historial({ cambios }: { cambios: Cambio[] }) {
  if (!cambios.length) {
    return <Vacio emoji="🕓" titulo="Todavía no hay cambios">Cada vez que alguien cambie algo de la configuración, aparece acá: qué, de qué a qué, quién y cuándo.</Vacio>;
  }
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-historial={cambios.length}>
      <div>
        <p className="titulo text-2xl">🕓 Cambios</p>
        <p className="texto-suave">Quién cambió qué de la configuración, de lo más nuevo a lo más viejo. No se puede borrar.</p>
      </div>
      <ul className="divide-y divide-[var(--borde)]">
        {cambios.map((c, i) => (
          <li key={`${c.cuando}-${c.campo}-${i}`} className="py-3 space-y-1" data-cambio={c.campo}>
            <p className="font-semibold">{c.etiqueta}</p>
            <p className="break-words"><span className="texto-tenue line-through">{c.antes}</span> <span aria-hidden>→</span> <span>{c.despues}</span></p>
            <p className="text-sm texto-tenue">{c.quien} · {c.cuando_texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
