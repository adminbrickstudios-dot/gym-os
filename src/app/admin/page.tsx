import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/panel/Marco";
import { formatearNumero } from "@/lib/formato";
import { ErrorDatos, rpc, type MiSesion } from "@/lib/panel/servidor";
import { AltaGimnasio } from "./AltaGimnasio";

export const metadata: Metadata = { title: "BRIK · Gimnasios" };
type Gimnasio = { gimnasio_id: string; slug: string; nombre: string; es_demo: boolean; suspendido: boolean; hosts: string[];
  socios: number; socios_al_dia: number; ingresos_7_dias: number; duenos: string[] };

// El super admin de BRIK: vive en el dominio de la plataforma, no en el de un gimnasio.
export default async function Admin() {
  if ((await headers()).get("x-gymos-contexto") !== "plataforma") redirect("/");
  let gimnasios: Gimnasio[];
  try {
    const yo = await rpc<MiSesion>("mi_sesion");
    if (!yo.es_admin) throw new ErrorDatos("Solo para administradores de BRIK", "42501", 403);
    gimnasios = await rpc<Gimnasio[]>("admin_gimnasios");
  } catch (e) {
    if (e instanceof ErrorDatos) return <main className="min-h-dvh grid place-items-center px-4"><Aviso emoji="🔒" titulo="Sin acceso">{e.message}</Aviso></main>;
    throw e;
  }
  const reales = gimnasios.filter((g) => !g.es_demo);
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-8 py-10 space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-4xl mb-3" aria-hidden>🧱</p>
          <h1 className="titular text-6xl">Gimnasios</h1>
          <p className="texto-suave text-lg mt-2">{reales.length} {reales.length === 1 ? "gimnasio" : "gimnasios"} · {formatearNumero(reales.reduce((s, g) => s + g.socios_al_dia, 0))} socios al día</p>
        </div>
        <form action="/salir" method="post"><button className="boton">🚪 Salir</button></form>
      </header>
      <AltaGimnasio dominio={process.env.NEXT_PUBLIC_DOMINIO_BASE ?? ""} />
      <ul className="space-y-2">
        {gimnasios.map((g) => (
          <li key={g.gimnasio_id} className="tarjeta p-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1">
              <p className="titulo text-2xl">{g.nombre} {g.es_demo && <span className="pildora align-middle">demo</span>} {g.suspendido && <span className="pildora pildora-rojo align-middle">suspendido</span>}</p>
              <p className="texto-suave text-sm">{g.duenos.join(", ") || "Sin dueño con acceso"} · {g.hosts.map((h) => <a key={h} className="underline mr-2" href={`https://${h}`} target="_blank" rel="noopener noreferrer">{h}</a>)}</p>
            </div>
            <dl className="flex gap-6">
              <div><dd className="numero text-3xl">{formatearNumero(g.socios)}</dd><dt className="text-sm texto-tenue">socios</dt></div>
              <div><dd className="numero text-3xl">{formatearNumero(g.socios_al_dia)}</dd><dt className="text-sm texto-tenue">al día</dt></div>
              <div><dd className="numero text-3xl">{formatearNumero(g.ingresos_7_dias)}</dd><dt className="text-sm texto-tenue">entradas 7 días</dt></div>
            </dl>
          </li>
        ))}
      </ul>
    </main>
  );
}
