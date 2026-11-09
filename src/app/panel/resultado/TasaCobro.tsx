import Link from "next/link";

export type TasaDeCobro = { mes: string; tocaba: number; renovaron: number; tasa: number | null; pendientes: { socio_id: string; nombre: string; telefono: string | null; vencio: string }[] };

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

/** FA-10: de los socios a los que se les vencía la cuota este mes, qué parte ya renovó; con la lista de los que faltan (cada uno con su wa.me). */
export function TasaCobro({ t }: { t: TasaDeCobro }) {
  return (
    <section aria-labelledby="tasa" data-tasa-cobro={t.tasa ?? ""}>
      <h2 id="tasa" className="titulo text-2xl mb-3">Tasa de cobro</h2>
      {t.tocaba === 0 ? <p className="texto-suave">Este mes todavía no venció ninguna cuota.</p> : (
        <>
          <p><span className="numero text-5xl">{String(t.tasa).replace(".", ",")}%</span> <span className="texto-suave">renovaron {t.renovaron} de {t.tocaba} a los que se les venció la cuota este mes.</span></p>
          {t.pendientes.length > 0 && (
            <details className="mt-3" data-tasa-pendientes>
              <summary className="cursor-pointer texto-suave">Faltan renovar ({t.pendientes.length})</summary>
              <ul className="tarjeta divide-y divide-[var(--borde)] mt-2">{t.pendientes.map((p) => (
                <li key={p.socio_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <Link href={`/panel/socios/${p.socio_id}`} className="underline min-w-0 truncate">{p.nombre}</Link>
                  <span className="texto-suave text-sm">venció el {dia(p.vencio)}</span>
                  {p.telefono && <a className="boton boton-chico" href={`https://wa.me/${p.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                </li>
              ))}</ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
