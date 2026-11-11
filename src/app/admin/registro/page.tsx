import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { haceCuanto } from "@/lib/admin/lista";
import { ErrorDatos, rpc } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "BRIK · Registro" };
type Entrada = { accion: string; quien: string; gimnasio: string | null; gimnasio_id: string | null; detalle: Record<string, unknown>; cuando: string };

/** SA-10: todo lo que hace cada usuario de BRIK. Solo se agrega: nadie lo puede borrar. */
const PAGINA = 50;
export default async function Registro({ searchParams }: { searchParams: Promise<{ antes?: string }> }) {
  if ((await headers()).get("x-gymos-contexto") !== "plataforma") redirect("/");
  let filas: Entrada[];
  const { antes } = await searchParams;
  const cursor = antes && !Number.isNaN(Date.parse(antes)) ? new Date(antes).toISOString() : null;
  try { filas = await rpc<Entrada[]>("admin_registro_brik", { p_limite: PAGINA, p_antes: cursor }); }
  catch (e) {
    if (e instanceof ErrorDatos) return <main className="min-h-dvh grid place-items-center px-4"><p role="alert" className="tarjeta p-6">Sin acceso: {e.message}</p></main>;
    throw e;
  }
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-8 py-10 space-y-6">
      <header className="space-y-2">
        <Link href="/admin/seguridad" className="texto-suave">← Seguridad</Link>
        <h1 className="titular text-5xl">Registro de BRIK</h1>
        <p className="texto-suave">Lo que hizo cada usuario de BRIK. Solo se agregan entradas: nadie las edita ni las borra.</p>
      </header>
      {filas.length === 0 && <p className="texto-suave">Todavía no hay nada registrado.</p>}
      <ul className="space-y-2">
        {filas.map((f, i) => (
          <li key={i} className="tarjeta p-3 text-sm" data-registro>
            <span className="font-semibold">{f.accion.replace(/_/g, " ")}</span> · {f.quien}
            {f.gimnasio && <> · <Link className="underline" href={`/admin/${f.gimnasio_id}`}>{f.gimnasio}</Link></>}
            {typeof f.detalle.motivo === "string" && <span className="texto-suave"> · {f.detalle.motivo}</span>}
            <span className="texto-tenue" title={new Date(f.cuando).toLocaleString("es-AR")}> · {haceCuanto(f.cuando)}</span>
          </li>
        ))}
      </ul>
      {/* ESC-05: siempre paginado por cursor (la fecha de la última fila vista), nunca "todo". */}
      <nav className="flex gap-3" aria-label="Páginas del registro">
        {cursor && <Link href="/admin/registro" className="boton" data-registro-inicio>Volver al principio</Link>}
        {filas.length === PAGINA && <Link href={`/admin/registro?antes=${encodeURIComponent(filas[filas.length - 1].cuando)}`} className="boton" data-registro-mas>Ver más antiguos</Link>}
      </nav>
    </main>
  );
}
