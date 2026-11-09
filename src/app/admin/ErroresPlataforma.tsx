import Link from "next/link";
import { haceCuanto } from "@/lib/admin/lista";
import { rpc } from "@/lib/panel/servidor";

type Fila = { pantalla: string; cantidad: number; ultimo: string; mensaje: string; gimnasio: string | null; gimnasio_id: string | null };

/** SA-9: los errores de las últimas 24 h de toda la plataforma, agrupados por pantalla. */
export async function ErroresPlataforma() {
  const filas = await rpc<Fila[]>("admin_errores", { p_horas: 24 }).catch(() => [] as Fila[]);
  return (
    <section className="space-y-2" data-errores-plataforma>
      <p className="titulo-grupo">Errores de las últimas 24 h</p>
      {filas.length === 0 ? <p className="texto-suave">Ningún error en las últimas 24 horas.</p> : (
        <ul className="space-y-2">
          {filas.map((f) => (
            <li key={`${f.gimnasio_id}-${f.pantalla}`} className="tarjeta p-3 text-sm">
              <span className="font-semibold">{f.pantalla}</span> · {f.cantidad} {f.cantidad === 1 ? "vez" : "veces"}
              {f.gimnasio && <> · <Link className="underline" href={`/admin/${f.gimnasio_id}`}>{f.gimnasio}</Link></>}
              <span className="texto-tenue" title={new Date(f.ultimo).toLocaleString("es-AR")}> · {haceCuanto(f.ultimo)}</span>
              <span className="block texto-suave break-words">{f.mensaje}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
